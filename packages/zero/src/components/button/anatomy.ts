import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * A button is one element, plus the spinner it shows while loading.
 *
 * One machine state, and only while it holds: `loading` (the `loading` prop —
 * work in flight). At rest the root carries no `data-state` at all rather
 * than an invented resting spelling; a button has nothing to be open or
 * checked about, and a toggle button is a different component with a
 * persistent pressed *mode* rather than a flag. `:active` remains available
 * to recipes as a plain pseudo-class; `pressed` / `press-animating` are the
 * runtime press-feedback hooks on top of it — pointer-anchored
 * (`--press-x/y/r`), keyboard-parity, and one-shot-capable (`press-animating`
 * outlives release), none of which `:active` can express.
 *
 * `spinner` is a real element (an empty, `aria-hidden` span before the label,
 * rendered only while loading), not a pseudo-element a skin picks: Material
 * already spends both `::before` (the state layer) and `::after` (the
 * ripple), and a named part is what an app extending a design system can
 * address (`parts.spinner`) without reaching into a skin's selectors.
 */
export const buttonAnatomy = defineAnatomy('button', {
    root: {
        element: 'button',
        states: ['loading'],
        flags: ['disabled', 'focus-visible', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-field', 'size', 'text'],
        asChild: true,
    },
    spinner: {
        element: 'span',
        parent: 'root',
        tokens: ['color', 'size'],
    },
});
