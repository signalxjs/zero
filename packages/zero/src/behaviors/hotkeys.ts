/**
 * Keyboard shortcuts — `createHotkeys` binds keys an app announces with
 * `aria-keyshortcuts` (#460).
 *
 * ```tsx
 * createHotkeys({
 *     'Control+S Meta+S': save,
 *     j: next,
 *     '?': showHelp,
 * });
 * ```
 *
 * A binding's key is `aria-keyshortcuts` syntax, so the string that
 * announces a shortcut (`Menu.Item keyshortcuts`) is the string that binds
 * it: modifiers (`Control`, `Alt`, `Shift`, `Meta`) joined by `+` to one
 * key named by `KeyboardEvent.key` (`S`, `?`, `Escape`, `F8`, `Space`),
 * with alternatives separated by spaces. The rules every hand-written
 * document listener has to get right are the behavior's, not the app's:
 *
 * - **Typing is not a shortcut.** A keydown from an editable target — a
 *   text-like `<input>`, a `<textarea>`, a `<select>`, contenteditable, or
 *   a `combobox`/`textbox`/`searchbox` role — never fires, and neither
 *   does one mid IME composition.
 * - **Modifiers match exactly.** `j` does not fire on Control+J, so an
 *   unbound chord (the browser's, the OS's) passes through. Shift is the
 *   one leniency: a symbol typed with Shift on one layout and without it on
 *   another (`?`, `#`, `/`) matches either way unless the binding names
 *   `Shift+` itself. Letters compare case-insensitively (`Shift+K` is the
 *   key `K` with Shift down), and fall back to `KeyboardEvent.code`, so an
 *   Option chord on macOS (Option+K reports `˚`) still matches `Alt+K`.
 * - **Someone else's keyboard.** Nothing fires while a modal `<dialog>`,
 *   an open Menu, Select, Popover or Combobox popup is up, nor for a
 *   keydown from inside an open non-modal Dialog or Drawer (the rest of
 *   the page stays live beside one) — unless the listener's own `target`
 *   sits inside that surface.
 * - **Handled is handled.** A keydown something already `preventDefault`ed
 *   is left alone; a binding that fires prevents the default itself.
 *
 * Call during setup: the listener attaches on mount (setup never touches
 * the DOM, so it is SSR-safe) and detaches on unmount.
 */
import { getCurrentInstance, onMounted, onUnmounted, watch } from 'sigx';
import { keyboardOwningLayers } from './dismiss.js';
import { mountScope } from './mount-scope.js';

export type HotkeyHandler = (e: KeyboardEvent) => void;

/** Handlers keyed by `aria-keyshortcuts` strings (`"Control+S"`, `"j"`, `"Shift+?"`). */
export type HotkeyBindings = Record<string, HotkeyHandler>;

export interface HotkeysOptions {
    /** Listen at all (default true). A getter is read on every keydown. */
    enabled?: boolean | (() => boolean);
    /**
     * Where the keydown listener attaches (default `document`). Read on
     * mount and tracked, so a getter over a ref re-attaches when it changes.
     */
    target?: () => EventTarget | null | undefined;
}

/** One `aria-keyshortcuts` alternative, parsed. */
export interface ParsedHotkey {
    /** A `KeyboardEvent.key` value (`'s'`, `'?'`, `'Escape'`, `' '`). */
    key: string;
    ctrl: boolean;
    alt: boolean;
    meta: boolean;
    shift: boolean;
}

const MODIFIER_ALIASES: Record<string, 'ctrl' | 'alt' | 'meta' | 'shift'> = {
    control: 'ctrl',
    ctrl: 'ctrl',
    alt: 'alt',
    option: 'alt',
    meta: 'meta',
    cmd: 'meta',
    command: 'meta',
    shift: 'shift',
};

/** Key names `aria-keyshortcuts` spells differently from `KeyboardEvent.key`. */
const KEY_ALIASES: Record<string, string> = {
    space: ' ',
    spacebar: ' ',
    esc: 'Escape',
    plus: '+',
};

function parseOne(spec: string): ParsedHotkey {
    let key: string;
    let mods: string[];
    if (spec === '+') {
        key = '+';
        mods = [];
    } else if (spec.endsWith('++')) {
        key = '+';
        mods = spec.slice(0, -2).split('+');
    } else {
        const parts = spec.split('+');
        key = parts.pop()!;
        mods = parts;
    }
    const parsed: ParsedHotkey = { key, ctrl: false, alt: false, meta: false, shift: false };
    for (const m of mods) {
        const flag = MODIFIER_ALIASES[m.toLowerCase()];
        if (!flag) throw new Error(`[zero] createHotkeys: unknown modifier "${m}" in "${spec}"`);
        parsed[flag] = true;
    }
    if (!key) throw new Error(`[zero] createHotkeys: "${spec}" names no key`);
    parsed.key = KEY_ALIASES[key.toLowerCase()] ?? key;
    return parsed;
}

/**
 * Parse an `aria-keyshortcuts` value into its alternatives: `"Control+S
 * Meta+S"` is two. The last `+`-separated token of each is the key, so
 * `"Control++"` binds Control and `+`.
 */
export function parseHotkey(spec: string): ParsedHotkey[] {
    return spec.trim().split(/\s+/).filter(Boolean).map(parseOne);
}

const isLetter = (k: string): boolean => /^[a-z]$/i.test(k);
const isDigit = (k: string): boolean => /^[0-9]$/.test(k);
const isAsciiAlnum = (k: string): boolean => /^[a-z0-9]$/i.test(k);
/** One printable character that is not a letter or digit: `?`, `#`, `/`. */
const isSymbol = (k: string): boolean => [...k].length === 1 && k !== ' ' && !isAsciiAlnum(k);

function matchesParsed(e: KeyboardEvent, p: ParsedHotkey): boolean {
    const k = p.key;
    let keyOk: boolean;
    if (isLetter(k)) {
        keyOk = e.key.toLowerCase() === k.toLowerCase()
            // An Option/AltGr chord reports the character it typed; the
            // physical key still says which letter was pressed.
            || (!isAsciiAlnum(e.key) && e.code === `Key${k.toUpperCase()}`);
    } else if (isDigit(k)) {
        keyOk = e.key === k || (!isAsciiAlnum(e.key) && e.code === `Digit${k}`);
    } else if (isSymbol(k)) {
        keyOk = e.key === k;
    } else {
        keyOk = e.key.toLowerCase() === k.toLowerCase();
    }
    if (!keyOk) return false;
    // A symbol reported as itself took whatever Shift/AltGr its layout needs
    // to type it: those modifiers do not make it a different key.
    const typed = isSymbol(k) && e.key === k;
    const altGraph = typed && !p.ctrl && !p.alt
        && ((typeof e.getModifierState === 'function' && e.getModifierState('AltGraph')) || (e.ctrlKey && e.altKey));
    if (!altGraph && (e.ctrlKey !== p.ctrl || e.altKey !== p.alt)) return false;
    if (e.metaKey !== p.meta) return false;
    if (p.shift) return e.shiftKey;
    return typed || !e.shiftKey;
}

/**
 * Whether a keydown matches a hotkey: an `aria-keyshortcuts` string (any of
 * its space-separated alternatives) or already-parsed alternatives.
 */
export function matchesHotkey(e: KeyboardEvent, hotkey: string | ParsedHotkey | readonly ParsedHotkey[]): boolean {
    const alts = typeof hotkey === 'string' ? parseHotkey(hotkey) : Array.isArray(hotkey) ? hotkey : [hotkey as ParsedHotkey];
    return alts.some((p) => matchesParsed(e, p));
}

const MODIFIER_KEYS = new Set(['altKey', 'ctrlKey', 'metaKey', 'shiftKey']);

/**
 * Toast's key-combination form (`Toast.Viewport hotkey`): every key in the
 * list is down at once — modifiers named by their event flag (`altKey`),
 * the rest by `KeyboardEvent.code` or `key` (`['altKey', 'KeyT']`,
 * `['F8']`). Unlike `matchesHotkey`, other modifiers may be down too.
 */
export function matchesKeyCombo(e: KeyboardEvent, keys: readonly string[]): boolean {
    return keys.every((k) =>
        MODIFIER_KEYS.has(k) ? !!(e as unknown as Record<string, boolean>)[k] : e.code === k || e.key === k);
}

const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image', 'hidden']);
const TEXT_ROLES = new Set(['combobox', 'textbox', 'searchbox']);

/**
 * Whether a keydown from `target` is typing: a text-like `<input>`, a
 * `<textarea>`, a `<select>`, contenteditable content, or an element with
 * the `combobox`, `textbox` or `searchbox` role.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
    if (typeof Element === 'undefined' || !(target instanceof Element)) return false;
    if ((target as HTMLElement).isContentEditable) return true;
    const tag = target.localName;
    if (tag === 'textarea' || tag === 'select') return true;
    if (tag === 'input') return !NON_TEXT_INPUTS.has((target as HTMLInputElement).type);
    const role = target.getAttribute('role');
    return role != null && TEXT_ROLES.has(role);
}

/** The open native surfaces that take the keyboard while they are up. */
const OWNING_POPUPS = '[role="menu"]:popover-open, [role="listbox"]:popover-open, [data-scope="popover"][data-part="popup"]:popover-open';

/**
 * Whether the keyboard belongs to a surface other than `scope`'s, for a
 * keydown from `origin`: a modal `<dialog>`, an open Menu, Select or
 * Popover popup, an open Combobox list, or — for a keydown from inside it —
 * a non-modal Dialog or Drawer. A surface that contains `scope` (the
 * listener's own target) does not count; with no `scope` (or `document`),
 * every such surface does.
 */
export function keyboardOwnedElsewhere(scope?: EventTarget | null, origin: EventTarget | null = null): boolean {
    if (typeof document === 'undefined') return false;
    const inside = typeof Node !== 'undefined' && scope instanceof Node && scope !== document ? scope : null;
    const elsewhere = (el: Element): boolean => !(inside && el.contains(inside));
    const owners: Element[] = keyboardOwningLayers(origin);
    try {
        owners.push(...document.querySelectorAll('dialog:modal'));
    } catch { /* an engine without `:modal` */ }
    if (typeof HTMLElement.prototype.showPopover === 'function') {
        try {
            owners.push(...document.querySelectorAll(OWNING_POPUPS));
        } catch { /* an engine without `:popover-open` */ }
    }
    return owners.some(elsewhere);
}

/**
 * Bind keyboard shortcuts for the calling component's lifetime. `bindings`
 * (or a getter returning them, read on every keydown) maps
 * `aria-keyshortcuts` strings to handlers; the first binding that matches
 * wins, its handler runs and the keydown's default is prevented. See the
 * module comment for the rules a keydown passes first.
 */
export function createHotkeys(bindings: HotkeyBindings | (() => HotkeyBindings), options: HotkeysOptions = {}): void {
    if (!getCurrentInstance()) {
        throw new Error('[zero] createHotkeys() must be called from a component\'s setup — it listens on mount and detaches on unmount');
    }
    const cache = new Map<string, ParsedHotkey[]>();
    const parsed = (spec: string): ParsedHotkey[] => {
        let p = cache.get(spec);
        if (!p) cache.set(spec, p = parseHotkey(spec));
        return p;
    };
    const enabled = (): boolean => {
        const on = options.enabled;
        return typeof on === 'function' ? on() : on ?? true;
    };
    let listening: EventTarget | null = null;

    const onKeydown = (event: Event): void => {
        const e = event as KeyboardEvent;
        if (!enabled() || e.defaultPrevented) return;
        if (e.isComposing || e.keyCode === 229) return;
        const origin = typeof e.composedPath === 'function' ? e.composedPath()[0] ?? e.target : e.target;
        if (isEditableTarget(origin)) return;
        if (keyboardOwnedElsewhere(listening, origin)) return;
        const map = typeof bindings === 'function' ? bindings() : bindings;
        for (const spec of Object.keys(map)) {
            if (!matchesHotkey(e, parsed(spec))) continue;
            e.preventDefault();
            map[spec](e);
            return;
        }
    };

    let detach: (() => void) | null = null;
    const attach = (t: EventTarget | null): void => {
        detach?.();
        detach = null;
        if (!t) return;
        t.addEventListener('keydown', onKeydown);
        listening = t;
        detach = () => {
            t.removeEventListener('keydown', onKeydown);
            listening = null;
        };
    };

    const scoped = mountScope();
    onMounted(() => scoped(() => {
        if (typeof document === 'undefined') return;
        watch(
            () => (options.target ? options.target() : document) ?? null,
            (t, _prev, onCleanup) => {
                attach(t);
                onCleanup(() => { detach?.(); detach = null; });
            },
            { immediate: true },
        );
    }));
    onUnmounted(() => { detach?.(); detach = null; });
}
