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
 *
 * `item-indicator` (#437) is the item's optional mark — a check a design
 * system draws in front of the label of an on item (Material's segmented
 * button). It mirrors the item's `on|off` and renders only where the app
 * places `ToggleGroup.ItemIndicator`; zero renders an empty, `aria-hidden`
 * span and the recipe draws the mark, so a skin that spends both of the
 * item's pseudo-elements (a state layer and a ripple) still has a slot.
 *
 * `hidden-input` is Select's: a real, visually-hidden `<select>` holding the
 * pressed values, rendered only while the root carries a `name` — one field
 * in single mode, repeated fields under `multiple`.
 */
export const toggleGroupAnatomy = defineAnatomy('toggle-group', {
    root: {
        element: 'div',
        flags: ['disabled', 'invalid', 'required'],
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
    'item-indicator': {
        element: 'span',
        // No glyph: zero renders an empty span and the recipe draws the
        // check, shown while the item is on.
        paint: true,
        parent: 'item',
        states: ['on', 'off'],
        tokens: ['color'],
    },
    'hidden-input': {
        element: 'select',
        parent: 'root',
    },
}, {
    orientation: true,
    models: [
        { concept: 'value', type: 'string', multiple: true, formControl: true },
    ],
});
