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
});
