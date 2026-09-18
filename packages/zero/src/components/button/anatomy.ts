import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * A button is one element, so the anatomy is one part.
 *
 * No machine states: a button has nothing to be open or checked about, and a
 * toggle button is a different component with a persistent pressed *mode*
 * rather than a flag. `:active` remains available to recipes as a plain
 * pseudo-class; `pressed` / `press-animating` are the runtime press-feedback
 * hooks on top of it — pointer-anchored (`--press-x/y/r`), keyboard-parity,
 * and one-shot-capable (`press-animating` outlives release), none of which
 * `:active` can express.
 */
export const buttonAnatomy = defineAnatomy('button', {
    root: {
        element: 'button',
        flags: ['disabled', 'focus-visible', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-field', 'size', 'text'],
        asChild: true,
    },
});
