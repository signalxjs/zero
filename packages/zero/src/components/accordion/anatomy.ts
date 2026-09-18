import { defineAnatomy } from '../../contract/anatomy.js';

export const accordionAnatomy = defineAnatomy('accordion', {
    root: {
        element: 'div',
        tokens: ['color', 'radius-box'],
    },
    item: {
        element: 'details',
        parent: 'root',
        states: ['open', 'closed'],
        flags: ['disabled'],
        tokens: ['color', 'radius-box'],
    },
    trigger: {
        element: 'summary',
        parent: 'item',
        states: ['open', 'closed'],
        flags: ['disabled', 'focus-visible', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-field', 'size', 'text'],
    },
    panel: {
        element: 'div',
        parent: 'item',
        states: ['open', 'closed'],
        tokens: ['color', 'text'],
    },
}, {
    models: [
        { concept: 'value', type: 'string[]' },
    ],
});
