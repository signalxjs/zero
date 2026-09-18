import { defineAnatomy } from '../../contract/anatomy.js';
import { PLACEMENT_VOCABULARY } from '../../contract/data-attrs.js';

export const tooltipAnatomy = defineAnatomy('tooltip', {
    trigger: {
        element: 'button',
        states: ['open', 'closed'],
        flags: ['disabled'],
        asChild: true,
    },
    popup: {
        element: 'div',
        states: ['open', 'closed'],
        placements: [...PLACEMENT_VOCABULARY],
        tokens: ['color', 'radius-field', 'text'],
    },
}, {
    models: [
        { concept: 'open', type: 'boolean' },
    ],
});
