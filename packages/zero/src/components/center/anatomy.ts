import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Center — put a thing in the middle, on one axis or both.
 *
 * One part. It exists because centering is the layout question with the most
 * wrong answers: `margin: auto` centres inline but not block, a flex parent
 * centres its children but not itself, and `position: absolute` with a
 * transform centres anything and takes it out of flow. A named component
 * that resolves to `place-items` means the caller says WHAT they want rather
 * than which trick to use.
 *
 * `axis` is `both` (the default), `inline` or `block` — logical, so it
 * follows writing mode rather than naming a physical edge.
 *
 * Distinct from `<Row justify="center" align="center">`, which centres a
 * row's CONTENT along its own axes. Center is the single-child case, and it
 * does not care what the child is.
 */
export const centerAnatomy = defineAnatomy('center', {
    root: {
        element: 'div',
        layout: ['axis', 'pad', 'pad-x', 'pad-y', 'gap'],
    },
});
