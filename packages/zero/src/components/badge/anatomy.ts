import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Badge — one element, and that is the whole point.
 *
 * At badge scale the fill IS the component: there is no chrome to separate
 * from content, so `root` both carries the axes and renders the text. That
 * makes it the only content-tier scope the contrast audit's one-element probe
 * can measure directly (`axisCellsFor` skips any scope whose carrier renders
 * no text), which is why it is the one that wires its own `variant`
 * vocabulary — see `tokens.scopes` in zero-basic.
 */
export const badgeAnatomy = defineAnatomy('badge', {
    root: {
        element: 'span',
        tokens: ['color', 'radius-field', 'size', 'text'],
    },
    /**
     * The status dot (#130) — a pill that says "Deploying" wants the dot
     * that says how it is going, and a pill and a `Status` beside each other
     * are two boxes where the reader sees one. Optional: a badge without it
     * is the one element it was.
     *
     * It re-carries `color` (#94), with that mechanism's rule: the nearest
     * carrier wins. A dot with a colour of its own is the status — a neutral
     * pill with a green dot is the common case, not the exception; a dot
     * without one follows the pill's colour, and on an uncoloured pill it is
     * the pill's ink. Every skin draws a coloured dot as the role's fill
     * inside a ring in the role's `-content` ink, which is what keeps it
     * visible when the pill it follows is a solid fill of the same role.
     *
     * `running` is the one state, present while the thing the pill names is
     * in flight — Button's `loading` shape, absent at rest — and it is the
     * governed lifecycle spelling (#93), not a `streaming` of the pill's own.
     * The outcomes and tones are colours, which the `color` axis already
     * says.
     */
    dot: {
        element: 'span',
        // The status dot (#130): the pill's ink at rest, a role's fill when it
        // re-carries `color`.
        paint: true,
        parent: 'root',
        states: ['running'],
        carries: ['color'],
        tokens: ['color', 'size'],
    },
});
