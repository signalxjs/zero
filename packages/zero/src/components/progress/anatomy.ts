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
        paint: true,
        parent: 'track',
        states: ['loading', 'complete', 'indeterminate'],
        tokens: ['color', 'radius-selector'],
    },
    'value-text': {
        element: 'div',
        parent: 'root',
        tokens: ['color', 'text'],
    },
}, {
    // Written on the root, from the value against min/max; absent while
    // indeterminate.
    runtimeProperties: ['--progress-percent'],
});
