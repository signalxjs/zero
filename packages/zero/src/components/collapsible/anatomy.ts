import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Collapsible — one disclosure. The panel is labelled by the trigger (no
 * role: a disclosure's content is not a landmark).
 *
 * Two constructions; `element` records the default. Native (the default):
 * the root is a `<details>` and the trigger its `<summary>`. `native={false}`
 * on the root (#453): the root renders a `<div>`, the trigger a `<button
 * aria-expanded aria-controls>` that can sit anywhere inside the root, and
 * the panel hides with `hidden="until-found"` — findable, so its
 * `beforematch` opens it. Only there does the trigger take `asChild` and
 * lend its bag to another part (`absorbable`, #452): a native `<summary>`
 * must be the `<details>`' first child and can be nothing else. The root
 * and the panel are never absorbed: the root contains the other two, and
 * the panel's hiding and size animation are keyed on its own element.
 *
 * `hidden="until-found"` is not `hiddenIn`: the UA gives it
 * `content-visibility: hidden`, not `display: none` — the panel keeps its
 * box, and a design system collapses it (`&[hidden]`) like any rendered
 * part.
 *
 * Runtime-published properties (web-only, #276): the panel carries its
 * measured content size as `--collapsible-panel-height` /
 * `--collapsible-panel-width` (px, `scrollHeight`/`scrollWidth`), fresh while
 * open and re-measured as a close begins. A close flips `data-state` to
 * `closed` at once but keeps the element `open` (non-native: the panel
 * without `hidden`) until the panel's own animations have played, so a
 * recipe animates the close on the panel's `closed` state — `block-size`
 * from `var(--collapsible-panel-height)` to `0`.
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
        asChild: true,
        absorbable: true,
    },
    // The trigger's optional disclosure mark (#437) — a chevron the recipe
    // draws, turned by the disclosure's `open|closed`. Rendered only where
    // the app places `Collapsible.Indicator` inside its trigger. `parent`
    // names the root, not the trigger: the trigger is absorbable (its bag
    // may be lent to a host that keeps its own anatomy), so no part may
    // declare it as its container — `paint.host` still measures the mark on
    // the trigger it sits in, menu's `item-indicator` idiom.
    indicator: {
        element: 'span',
        // No glyph: zero renders an empty, aria-hidden span and the recipe
        // draws the chevron.
        paint: { host: 'trigger' },
        parent: 'root',
        states: ['open', 'closed'],
        tokens: ['color'],
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
