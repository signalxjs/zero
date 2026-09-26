import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Collapsible — one native `<details>` disclosure. The panel is labelled by
 * the trigger (no role: a disclosure's content is not a landmark).
 *
 * Runtime-published properties (web-only, #276): the panel carries its
 * measured content size as `--collapsible-panel-height` /
 * `--collapsible-panel-width` (px, `scrollHeight`/`scrollWidth`), fresh while
 * open and re-measured as a close begins. A close flips `data-state` to
 * `closed` at once but keeps the element `open` until the panel's own
 * animations have played, so a recipe animates the close on the panel's
 * `closed` state — `block-size` from `var(--collapsible-panel-height)` to `0`.
 */
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
