import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Chip (#544) — a compact element that stands for an action, a choice, a
 * filter or an entity: Material's assist, filter, input and suggestion chips,
 * daisyUI's badge-buttons, a tag in a composer. zero names none of those;
 * the design system decides the look, and zero ships the three behaviours
 * every chip is some mix of:
 *
 * - **Action** — `action` is a `<button>` (or, through `asChild`, a link):
 *   it does something when pressed.
 * - **Selection** — a `selectable` chip is a toggle: `action` carries
 *   `aria-pressed`, and `root` and `action` hold `on | off`. Standalone it
 *   binds its own boolean model; inside a `selectable` `chip-group` the group
 *   owns the value.
 * - **Removal** — `remove` is the trailing button of an entity chip. It is
 *   out of the tab order (the keyboard path is Backspace/Delete on `action`
 *   while `removable`, the combobox tag's), and a removal inside a group
 *   hands focus to the neighbouring chip before the `remove` event runs.
 *
 * `root` is a plain container and the axis carrier: a chip is often TWO
 * buttons side by side, which one `<button>` could not hold. `data-state`
 * appears only while the chip is selectable — a chip that selects nothing
 * has no mode to report.
 */
export const chipAnatomy = defineAnatomy('chip', {
    root: {
        element: 'div',
        states: ['on', 'off'],
        flags: ['disabled', 'selected'],
        tokens: ['color', 'radius-field', 'size'],
    },
    action: {
        element: 'button',
        parent: 'root',
        states: ['on', 'off'],
        flags: ['disabled', 'focus-visible', 'pressed', 'press-animating'],
        tokens: ['color', 'text'],
        asChild: true,
    },
    icon: {
        element: 'span',
        parent: 'action',
        tokens: ['color'],
    },
    label: {
        element: 'span',
        parent: 'action',
        tokens: ['text'],
    },
    remove: {
        element: 'button',
        parent: 'root',
        flags: ['disabled', 'focus-visible', 'pressed', 'press-animating'],
        tokens: ['color'],
    },
}, {
    models: [
        { concept: 'selected', type: 'boolean' },
    ],
});
