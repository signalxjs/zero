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
 * The marker RE-CARRIES the colour axis (`PartSpec.carries`, #94): a
 * `color` on `Timeline.Marker` renders `data-color` on the marker itself and
 * outranks the root's, so each entry can paint its own tone — the nearest
 * carrier wins, and a marker without one follows the root.
 *
 * `content` and `connector` carry `data-orientation` as well as the root and
 * item: "start" means the inline side of a vertical timeline and the block
 * side of a horizontal one, and a recipe can only compose side × axis on the
 * element that carries both.
 *
 * `title` and `description` (#302) are the two text bands inside `content`
 * — the event and its detail, which Mantine's and Chakra's timelines name
 * and a skin wants to set apart (weight, ink, rhythm). Both optional:
 * content that is one line of text stays one line of text. Both are `div`s,
 * because an event is not a heading by default; `title` takes `asChild` for
 * the page whose outline wants one (an `h3` per release in a changelog).
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
        // The dot on the axis (#334), named after what it is rather than its job.
        paint: true,
        parent: 'item',
        // Per-entry colour (#94): the marker re-carries `color`, so one
        // event's dot can say "failed" while the timeline stays neutral.
        carries: ['color'],
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
    title: {
        element: 'div',
        parent: 'content',
        tokens: ['color', 'text'],
        asChild: true,
    },
    description: {
        element: 'div',
        parent: 'content',
        tokens: ['color', 'text'],
    },
}, { orientation: true });
