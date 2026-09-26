import { defineAnatomy } from '../../contract/anatomy.js';
import { PLACEMENT_VOCABULARY } from '../../contract/data-attrs.js';

export const hoverCardAnatomy = defineAnatomy('hover-card', {
    // A link by default — the thing a hover card previews is usually a
    // destination (a profile, a page). Not a disclosure: no `aria-expanded`,
    // no `aria-describedby`. The card is a sighted-pointer and keyboard
    // enhancement; the destination is the accessible path.
    trigger: {
        element: 'a',
        states: ['open', 'closed'],
        flags: ['focus-visible'],
        tokens: ['color', 'text'],
        asChild: true,
    },
    // Anchor-positioned: carries `data-placement` plus the published
    // POSITION_PROPERTIES — `--anchor-width`/`--anchor-height`,
    // `--available-width`/`--available-height`, `--transform-origin`.
    // Content may be interactive (links, buttons), so no `role="tooltip"`.
    popup: {
        element: 'div',
        states: ['open', 'closed'],
        placements: [...PLACEMENT_VOCABULARY],
        tokens: ['color', 'radius-box', 'text'],
    },
    // The mark on the popup edge facing the trigger, rendered only when the
    // app renders HoverCard.Arrow. Decorative (`aria-hidden`), and not a
    // paint part: the popup's own surface continued. The strategy writes
    // ARROW_PROPERTIES on it — `--arrow-x` on a `top*`/`bottom*` popup,
    // `--arrow-y` beside — and the recipe picks the edge from the popup's
    // `data-placement`.
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
