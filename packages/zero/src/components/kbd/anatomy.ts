import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Kbd — one element, and the element is the point.
 *
 * Badge's shape (the fill IS the component: root carries the axes and renders
 * the text), but on the platform's own `<kbd>` — the one HTML element whose
 * whole job is "this run of text is keyboard input". A styled span would look
 * identical and mean nothing to a reader mode or a screen reader's element
 * list.
 *
 * No states, no flags: a keycap has no lifecycle. `size` is the axis that
 * earns its keep (a shortcut in running text sits smaller than one in a
 * settings table); `color` rides along on the uniform carrier surface.
 */
export const kbdAnatomy = defineAnatomy('kbd', {
    root: {
        element: 'kbd',
        tokens: ['color', 'radius-field', 'size', 'text'],
    },
});
