import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Accordion — native `<details>` items under one root.
 *
 * `data-orientation` (the triggers' arrow-key axis, `vertical` by default)
 * rides the root and every trigger. The panel is a `region` labelled by its
 * trigger unless the root says `regions={false}`.
 *
 * Runtime-published properties (web-only, #276): each panel carries its
 * measured content size as `--accordion-panel-height` /
 * `--accordion-panel-width` (px, `scrollHeight`/`scrollWidth`), fresh while
 * open and re-measured as a close begins. A closing item flips `data-state`
 * to `closed` at once but stays `open` until the panel's own animations have
 * played, so a recipe animates the close on the panel's `closed` state —
 * `block-size` from `var(--accordion-panel-height)` to `0`.
 */
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
    orientation: true,
    models: [
        { concept: 'value', type: 'string[]' },
    ],
});
