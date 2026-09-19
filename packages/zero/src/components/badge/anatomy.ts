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
     * It re-carries `color` (#94): the badge's colour is the pill's tone and
     * the dot's is the status, and a neutral pill with a green dot is the
     * common case, not the exception. Without a colour of its own the dot is
     * the pill's ink, which is legible on any fill the pill has.
     *
     * `running` is the one state, present while the thing the pill names is
     * in flight — Button's `loading` shape, absent at rest — and it is the
     * governed lifecycle spelling (#93), not a `streaming` of the pill's own.
     * The outcomes and tones are colours, which the `color` axis already
     * says.
     */
    dot: {
        element: 'span',
        parent: 'root',
        states: ['running'],
        carries: ['color'],
        tokens: ['color', 'size'],
    },
});
