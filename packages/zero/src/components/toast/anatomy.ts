import { defineAnatomy } from '../../contract/anatomy.js';

// Toast stamps `data-placement` itself (the viewport's placement prop, echoed
// on every root for placement-keyed styling) rather than through the anchored
// position strategy, and it has no reference element to sit left or right of
// — so its placement subset is the six edge slots, not the full vocabulary.
const TOAST_PLACEMENTS = ['top-start', 'top', 'top-end', 'bottom-start', 'bottom', 'bottom-end'] as const;

export const toastAnatomy = defineAnatomy('toast', {
    // `open` while the stack is expanded — hovered or holding focus, or
    // always with `expand="always"`; `closed` while it rests. Styling only:
    // the viewport is shown whenever there are toasts, in either state.
    viewport: {
        element: 'ol',
        states: ['open', 'closed'],
        placements: TOAST_PLACEMENTS,
    },
    root: {
        element: 'li',
        parent: 'viewport',
        states: ['open', 'closed'],
        placements: TOAST_PLACEMENTS,
        tokens: ['color', 'radius-box', 'text'],
    },
    // The work status of a promise toast (`ToastData.status`); rendered only
    // while the toast has one. Decorative (`aria-hidden`) — the title says it.
    indicator: {
        element: 'span',
        parent: 'root',
        states: ['loading', 'complete', 'error'],
        paint: true,
        tokens: ['color'],
    },
    title: {
        element: 'div',
        parent: 'root',
        tokens: ['color', 'text'],
    },
    description: {
        element: 'div',
        parent: 'root',
        tokens: ['color', 'text'],
    },
    action: {
        element: 'button',
        parent: 'root',
        flags: ['disabled', 'focus-visible', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-field', 'size', 'text'],
        asChild: true,
    },
    close: {
        element: 'button',
        parent: 'root',
        flags: ['disabled', 'focus-visible', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-selector'],
        asChild: true,
    },
});
