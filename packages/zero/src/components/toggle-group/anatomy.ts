import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * ToggleGroup — a row of toggle buttons under one value model, single or
 * multiple selection, arrow-key roving.
 *
 * `item` mirrors the standalone toggle's `on|off` contract so a design
 * system can share fill styles between the two; `data-selected` doubles the
 * on-state as a presence flag for compound selectors
 * (`[data-part="item"][data-selected]` composes with other flags where a
 * `data-state` match cannot).
 */
export const toggleGroupAnatomy = defineAnatomy('toggle-group', {
    root: {
        element: 'div',
        flags: ['disabled'],
        tokens: ['color', 'radius-field', 'size'],
    },
    item: {
        element: 'button',
        parent: 'root',
        states: ['on', 'off'],
        flags: ['disabled', 'selected', 'focus-visible', 'pressed', 'press-animating'],
        tokens: ['color', 'text'],
        asChild: true,
    },
}, {
    orientation: true,
    models: [
        { concept: 'value', type: 'string', multiple: true },
    ],
});
