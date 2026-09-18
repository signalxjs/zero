import { defineAnatomy } from '../../contract/anatomy.js';

export const progressAnatomy = defineAnatomy('progress', {
    root: {
        element: 'div',
        states: ['loading', 'complete', 'indeterminate'],
        tokens: ['color'],
    },
    label: {
        element: 'div',
        parent: 'root',
        tokens: ['color', 'text'],
    },
    track: {
        element: 'div',
        parent: 'root',
        tokens: ['color', 'radius-selector'],
    },
    range: {
        element: 'div',
        parent: 'track',
        states: ['loading', 'complete', 'indeterminate'],
        tokens: ['color', 'radius-selector'],
    },
    'value-text': {
        element: 'div',
        parent: 'root',
        tokens: ['color', 'text'],
    },
});
