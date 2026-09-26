import { defineAnatomy } from '../../contract/anatomy.js';
import { PLACEMENT_VOCABULARY } from '../../contract/data-attrs.js';

export const tooltipAnatomy = defineAnatomy('tooltip', {
    trigger: {
        element: 'button',
        states: ['open', 'closed'],
        flags: ['disabled'],
        asChild: true,
    },
    // Anchor-positioned: carries `data-placement` plus the published
    // POSITION_PROPERTIES — `--anchor-width`/`--anchor-height`,
    // `--available-width`/`--available-height`, `--transform-origin`.
    popup: {
        element: 'div',
        states: ['open', 'closed'],
        placements: [...PLACEMENT_VOCABULARY],
        tokens: ['color', 'radius-field', 'text'],
    },
    // The mark on the popup edge facing the anchor, rendered only when the
    // app renders Tooltip.Arrow. Decorative (`aria-hidden`), and not a paint
    // part: it is the popup's own surface continued, never a mark a reader
    // must see. The strategy writes ARROW_PROPERTIES on it — `--arrow-x` on
    // a `top*`/`bottom*` popup, `--arrow-y` beside — and the recipe picks
    // the edge from the popup's `data-placement`.
    arrow: {
        element: 'span',
        parent: 'popup',
        tokens: ['color'],
    },
}, {
    models: [
        { concept: 'open', type: 'boolean' },
    ],
});
