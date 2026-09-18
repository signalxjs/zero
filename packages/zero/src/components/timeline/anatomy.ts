import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Timeline — an ordered sequence of events along an axis.
 *
 * A real list (`ul`/`li`): assistive tech announces "list, N items" and can
 * walk it, which is the whole accessibility story — everything else here is
 * geometry for recipes.
 *
 * The anatomy is deliberately flatter than daisy's start/middle/end triple:
 * one `marker` (the dot/icon on the axis — a PAINT part, graded by the
 * contrast audit's indicator matrix), one `connector` (the line segment from
 * this item's marker toward the next), and one `content` box that declares
 * which SIDE of the axis it sits on as `data-placement="start|end"` —
 * contract data from the logical pair, so alternating layouts are per-item
 * markup, not nth-child guesswork, and RTL mirrors for free.
 *
 * `content` and `connector` carry `data-orientation` as well as the root and
 * item: "start" means the inline side of a vertical timeline and the block
 * side of a horizontal one, and a recipe can only compose side × axis on the
 * element that carries both.
 */
export const timelineAnatomy = defineAnatomy('timeline', {
    root: {
        element: 'ul',
        tokens: ['color', 'size'],
    },
    item: {
        element: 'li',
        parent: 'root',
    },
    marker: {
        element: 'div',
        parent: 'item',
        tokens: ['color', 'size'],
    },
    connector: {
        element: 'div',
        parent: 'item',
        tokens: ['color'],
    },
    content: {
        element: 'div',
        parent: 'item',
        placements: ['start', 'end'],
        tokens: ['color', 'radius-box', 'text'],
    },
}, { orientation: true });
