import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Spacer — flexible room between things, or a fixed gap where a gap alone
 * cannot reach.
 *
 * One part, no state, no role: it is decorative by definition and carries
 * nothing a reader needs announced.
 *
 * It earns its place next to `gap` because the two answer different
 * questions. `gap` spaces EVERY child of a stack equally; a spacer pushes ONE
 * boundary apart — the toolbar whose last two buttons sit at the far end, the
 * card footer with a label on the left and actions on the right. Expressing
 * that with `gap` means splitting the row into nested stacks.
 *
 * Absent a `space` it flexes to fill whatever room is left; given one it
 * becomes a fixed rung of the spacing ramp.
 */
export const spacerAnatomy = defineAnatomy('spacer', {
    root: {
        element: 'div',
        layout: ['space'],
    },
});
