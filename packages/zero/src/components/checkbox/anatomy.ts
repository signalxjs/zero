import { defineAnatomy } from '../../contract/anatomy.js';

export const checkboxAnatomy = defineAnatomy('checkbox', {
    root: {
        element: 'label',
        states: ['checked', 'unchecked', 'indeterminate'],
        flags: ['disabled', 'focus-visible', 'invalid', 'required', 'readonly'],
        tokens: ['color'],
    },
    control: {
        element: 'span',
        parent: 'root',
        states: ['checked', 'unchecked', 'indeterminate'],
        flags: ['disabled', 'focus-visible', 'invalid', 'readonly', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-selector', 'size'],
    },
    indicator: {
        element: 'span',
        paint: true,
        parent: 'control',
        states: ['checked', 'unchecked', 'indeterminate'],
        tokens: ['color'],
    },
    label: {
        element: 'span',
        parent: 'root',
        states: ['checked', 'unchecked', 'indeterminate'],
        flags: ['disabled'],
        tokens: ['color', 'text'],
        visuallyHidden: true,
    },
    'hidden-input': {
        element: 'input',
        parent: 'root',
    },
}, {
    models: [
        { concept: 'checked', type: 'boolean | string[]', formControl: true },
    ],
});
