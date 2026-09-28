/**
 * Hotkeys — document-level single-key shortcuts (#440: zero binds no keys;
 * `Menu.Item keyshortcuts` only announces them).
 *
 * ```tsx
 * <Hotkeys bindings={{ j: next, k: prev, '/': focusSearch, '?': showHelp }} />
 * ```
 *
 * Renders nothing. A binding never fires while the user is typing (an
 * editable target), while a modifier other than Shift is held, or while a
 * modal dialog or an open popup owns the keyboard — the three rules every
 * mail client's shortcuts follow, and the ones an app gets wrong alone.
 */
import { component } from 'sigx';
import type { Define } from 'sigx';

export type HotkeyHandler = (e: KeyboardEvent) => void;

export type HotkeysProps =
    /** Keyed by `KeyboardEvent.key` (`j`, `/`, `?`, `#`, `Escape`). */
    & Define.Prop<'bindings', Record<string, HotkeyHandler>, true>
    & Define.Prop<'disabled', boolean, false>;

function typing(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
    if (target instanceof HTMLInputElement) return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range'].includes(target.type);
    return target.getAttribute('role') === 'combobox';
}

function keyboardOwnedElsewhere(): boolean {
    return document.querySelector('dialog[open]:modal, [role="menu"]:popover-open, [role="listbox"]:popover-open') !== null;
}

export const Hotkeys = component<HotkeysProps>(({ props, onMounted, onUnmounted }) => {
    const onKeydown = (e: KeyboardEvent): void => {
        if (props.disabled || e.defaultPrevented || e.isComposing) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (typing(e.target)) return;
        let owned = false;
        try { owned = keyboardOwnedElsewhere(); } catch { /* :modal / :popover-open unsupported */ }
        if (owned) return;
        const handler = props.bindings[e.key];
        if (!handler) return;
        e.preventDefault();
        handler(e);
    };
    onMounted(() => document.addEventListener('keydown', onKeydown));
    onUnmounted(() => document.removeEventListener('keydown', onKeydown));
    return () => null;
}, { name: 'Hotkeys' });
