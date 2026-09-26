import { defineAnatomy } from '../../contract/anatomy.js';
import { PLACEMENT_VOCABULARY } from '../../contract/data-attrs.js';

export const popoverAnatomy = defineAnatomy('popover', {
    trigger: {
        element: 'button',
        states: ['open', 'closed'],
        flags: ['disabled', 'focus-visible', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-field', 'size', 'text'],
        asChild: true,
    },
    // Anchor-positioned: carries `data-placement` plus the published
    // POSITION_PROPERTIES — `--anchor-width`/`--anchor-height`,
    // `--available-width`/`--available-height`, `--transform-origin`.
    popup: {
        element: 'div',
        states: ['open', 'closed'],
        placements: [...PLACEMENT_VOCABULARY],
        tokens: ['color', 'radius-box'],
    },
    title: {
        element: 'h3',
        parent: 'popup',
        tokens: ['color', 'text'],
    },
    description: {
        element: 'p',
        parent: 'popup',
        tokens: ['color', 'text'],
    },
    // The mark on the popup edge facing the anchor, rendered only when the
    // app renders Popover.Arrow. Decorative (`aria-hidden`), and not a paint
    // part: it is the popup's own surface continued, never a mark a reader
    // must see. The strategy writes ARROW_PROPERTIES on it — `--arrow-x` on
    // a `top*`/`bottom*` popup, `--arrow-y` beside — and the recipe picks
    // the edge from the popup's `data-placement`.
    arrow: {
        element: 'span',
        parent: 'popup',
        tokens: ['color'],
    },
    // What the popup is positioned against in the trigger's place, while
    // rendered. Top-level: it sits wherever the app puts it, never inside
    // the popup.
    anchor: {
        element: 'div',
        asChild: true,
    },
    close: {
        element: 'button',
        parent: 'popup',
        flags: ['disabled', 'focus-visible', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-field', 'size'],
        asChild: true,
    },
}, {
    models: [
        { concept: 'open', type: 'boolean' },
    ],
});
