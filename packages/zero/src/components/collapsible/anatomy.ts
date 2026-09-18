import { defineAnatomy } from '../../contract/anatomy.js';

export const collapsibleAnatomy = defineAnatomy('collapsible', {
    root: {
        element: 'details',
        states: ['open', 'closed'],
        flags: ['disabled'],
        tokens: ['color', 'radius-box'],
    },
    trigger: {
        element: 'summary',
        parent: 'root',
        states: ['open', 'closed'],
        flags: ['disabled', 'focus-visible', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-field', 'size', 'text'],
    },
    panel: {
        element: 'div',
        parent: 'root',
        states: ['open', 'closed'],
        tokens: ['color', 'text'],
    },
}, {
    models: [
        { concept: 'open', type: 'boolean' },
    ],
});
