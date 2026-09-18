import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * A toggle is one button with a persistent pressed *mode* — which is exactly
 * what distinguishes it from Button (no machine state) and from Switch (a
 * form control over a hidden checkbox). `on|off` is the mode; `aria-pressed`
 * carries it to AT; there is no form participation.
 */
export const toggleAnatomy = defineAnatomy('toggle', {
    root: {
        element: 'button',
        states: ['on', 'off'],
        flags: ['disabled', 'focus-visible', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-field', 'size', 'text'],
        asChild: true,
    },
}, {
    models: [
        { concept: 'pressed', type: 'boolean' },
    ],
});
