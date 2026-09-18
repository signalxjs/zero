import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Skeleton — the shape of what is coming.
 *
 * One part, two states, and the children stay in the DOM through both. That
 * is the whole design: a skeleton exists to hold the layout its content will
 * occupy, so swapping the content out for a placeholder box would defeat it —
 * the box would be the wrong size and the page would jump when the real thing
 * arrived. The recipe paints OVER the content while `loading` (a fill plus,
 * conventionally, transparent ink) and paints nothing once `loaded`.
 *
 * No `hiddenIn`, and that is the difference from Avatar's swap: nothing is
 * hidden in either state, so the two are told apart by PAINT. Every design
 * system therefore has to make them differ, and the state-legibility guard
 * will say so if one does not.
 */
export const skeletonAnatomy = defineAnatomy('skeleton', {
    root: {
        element: 'div',
        states: ['loading', 'loaded'],
        tokens: ['color', 'radius-box', 'size'],
    },
}, {
    models: [
        { concept: 'loading', type: 'boolean' },
    ],
});
