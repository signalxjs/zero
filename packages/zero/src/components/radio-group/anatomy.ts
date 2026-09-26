import { defineAnatomy } from '../../contract/anatomy.js';

export const radioGroupAnatomy = defineAnatomy('radio-group', {
    root: {
        element: 'div',
        flags: ['disabled', 'invalid', 'required', 'readonly'],
        tokens: ['color'],
    },
    label: {
        element: 'div',
        parent: 'root',
        flags: ['disabled', 'invalid', 'required'],
        tokens: ['color', 'text'],
    },
    item: {
        element: 'label',
        parent: 'root',
        states: ['checked', 'unchecked'],
        // `invalid` and `readonly` are facts about the group, restated on
        // each item and its control — the surfaces a design system paints —
        // so a recipe never reaches them through a descendant selector
        // (checkbox/switch parity, #267).
        flags: ['disabled', 'focus-visible', 'invalid', 'readonly'],
        tokens: ['color'],
    },
    'item-control': {
        element: 'span',
        parent: 'item',
        states: ['checked', 'unchecked'],
        flags: ['disabled', 'focus-visible', 'invalid', 'readonly', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-selector', 'size'],
    },
    'item-indicator': {
        element: 'span',
        paint: true,
        parent: 'item-control',
        states: ['checked', 'unchecked'],
        tokens: ['color'],
    },
    'item-label': {
        element: 'span',
        parent: 'item',
        states: ['checked', 'unchecked'],
        flags: ['disabled'],
        tokens: ['color', 'text'],
    },
    'hidden-input': {
        element: 'input',
        parent: 'item',
    },
}, {
    orientation: true,
    models: [
        { concept: 'value', type: 'string', formControl: true },
    ],
});
