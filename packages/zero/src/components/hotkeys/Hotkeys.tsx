/**
 * Hotkeys — `createHotkeys` as a renderless component, for an app written
 * in JSX alone (#460).
 *
 * ```tsx
 * <Hotkeys bindings={{ j: next, k: prev, '/': focusSearch, 'Shift+?': showHelp }} />
 * ```
 *
 * Keys are `aria-keyshortcuts` syntax — the string a `Menu.Item`'s
 * `keyshortcuts` announces binds the same shortcut here. It listens on
 * `document` (or `target`) while mounted and follows `createHotkeys`'s
 * rules: nothing fires while the user is typing, on an unbound modifier
 * chord, or while a modal dialog or an open popup owns the keyboard.
 *
 * Deliberately not a scope. It renders nothing, so there is nothing for a
 * design system to style and no anatomy, like `VisuallyHidden`.
 */
import { component } from 'sigx';
import type { Define } from 'sigx';
import { createHotkeys, type HotkeyBindings } from '../../behaviors/hotkeys.js';

export type HotkeysProps =
    /** Handlers keyed by `aria-keyshortcuts` strings (`"Control+S"`, `"j"`, `"?"`). Read on every keydown. */
    & Define.Prop<'bindings', HotkeyBindings, true>
    /** Listen at all (default true). */
    & Define.Prop<'enabled', boolean, false>
    /**
     * Where the listener attaches (default `document`). `null` listens
     * nowhere — a ref that is not set yet.
     */
    & Define.Prop<'target', EventTarget | null, false>;

export const Hotkeys = component<HotkeysProps>(({ props }) => {
    createHotkeys(() => props.bindings, {
        enabled: () => props.enabled ?? true,
        target: () => (props.target === undefined ? document : props.target),
    });
    return () => null;
}, { name: 'Hotkeys' });
