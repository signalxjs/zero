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
