import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Tabs — the APG tabs pattern.
 *
 * `indicator` is an optional, decorative (`aria-hidden`) span an app places
 * inside the list: the one tab style CSS cannot express alone, a mark that
 * slides to whichever tab is active (#283). It carries `data-orientation`.
 *
 * Runtime-published properties (web-only, #283): the indicator carries the
 * active tab's box as `--tabs-indicator-inset-inline-start`,
 * `--tabs-indicator-inset-block-start`, `--tabs-indicator-inline-size` and
 * `--tabs-indicator-block-size` (px). The offsets are relative to the list's
 * padding box in its scrolled content, so a recipe positions the indicator
 * `absolute` in a `relative` list with logical insets; the inline offset is
 * measured from the list's inline-start edge, so RTL needs no correction.
 * They are re-measured when the value changes and whenever the list or a tab
 * resizes. Until the first measurement, and while no tab is active, the
 * indicator is not displayed — so a recipe's transition on those properties
 * never plays on first paint.
 *
 * `tab-label` is an optional span an app places inside a tab around its
 * text (#530). When the active tab holds one, the indicator also carries
 * that label's inline extent as `--tabs-indicator-content-inset-inline-start`
 * and `--tabs-indicator-content-inline-size` (same list coordinates), so a
 * skin can draw a content-width mark — Material 3's primary tabs underline
 * the label, not the tab. Without a label the content pair repeats the
 * tab's own inline offset and size, so a recipe may use it unconditionally.
 */
export const tabsAnatomy = defineAnatomy('tabs', {
    root: {
        element: 'div',
        tokens: ['color'],
    },
    list: {
        element: 'div',
        parent: 'root',
        tokens: ['color', 'radius-field'],
    },
    tab: {
        element: 'button',
        parent: 'list',
        states: ['active', 'inactive'],
        flags: ['disabled', 'focus-visible', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-field', 'size', 'text'],
        asChild: true,
    },
    'tab-label': {
        element: 'span',
        parent: 'tab',
        tokens: ['text'],
    },
    indicator: {
        element: 'span',
        parent: 'list',
        tokens: ['color'],
        // A mark, not a surface: the indicator matrix measures its paint.
        paint: true,
    },
    panel: {
        element: 'div',
        parent: 'root',
        states: ['active', 'inactive'],
        // The runtime sets `hidden` on every panel but the selected one, so
        // `[data-state="inactive"]` on a panel can never paint.
        hiddenIn: ['inactive'],
        tokens: ['color', 'radius-box', 'text'],
    },
}, {
    orientation: true,
    models: [
        { concept: 'value', type: 'string' },
    ],
    // The active tab's box on the indicator, relative to the list's padding
    // box (px, logical), so a recipe slides a mark between tabs (#283) —
    // plus its label's inline extent, for a content-width mark (#530).
    runtimeProperties: [
        '--tabs-indicator-inset-inline-start',
        '--tabs-indicator-inset-block-start',
        '--tabs-indicator-inline-size',
        '--tabs-indicator-block-size',
        '--tabs-indicator-content-inset-inline-start',
        '--tabs-indicator-content-inline-size',
    ],
});
