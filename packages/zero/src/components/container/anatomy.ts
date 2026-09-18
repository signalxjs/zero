import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Container — the element that stops a page running to the full width of a
 * 2000px monitor.
 *
 * One part, and two facts: a maximum width, and the gutters that keep content
 * off the edge on a narrow one. Both come from the design system — the width
 * from the `--measure-*` ramp, the gutters from `--space-*`.
 *
 * `measure` is a layout attribute rather than the `size` axis. A container's
 * width and a control's size are different questions: `size="lg"` on a Button
 * means a chunkier button and on a Container would mean a wider page, and
 * those ramps have no reason to move together. `prose` — a reading measure in
 * `ch` — is not a size at all.
 *
 * It carries no `color`: a container is a constraint, not a surface. Wrap it
 * around a Box, or put one inside it.
 */
export const containerAnatomy = defineAnatomy('container', {
    root: {
        element: 'div',
        layout: ['measure', 'pad', 'pad-x', 'pad-y'],
    },
});
