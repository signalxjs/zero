import { defineAnatomy } from '../../contract/anatomy.js';

export const fieldAnatomy = defineAnatomy('field', {
    root: {
        element: 'div',
        flags: ['disabled', 'invalid', 'required', 'readonly'],
        tokens: ['color'],
    },
    label: {
        element: 'label',
        parent: 'root',
        flags: ['disabled', 'invalid', 'required'],
        tokens: ['color', 'text'],
    },
    description: {
        element: 'p',
        parent: 'root',
        tokens: ['color', 'text'],
    },
    error: {
        element: 'p',
        parent: 'root',
        flags: ['invalid'],
        tokens: ['color', 'text'],
    },
});
