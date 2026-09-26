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
});
