import { defineAnatomy } from '../../contract/anatomy.js';

export const fieldAnatomy = defineAnatomy('field', {
    root: {
        element: 'div',
        // `placeholder`: the control inside holds no value (#469) — the
        // text controls' and Select's own flag, mirrored.
        flags: ['disabled', 'invalid', 'required', 'readonly', 'placeholder'],
        tokens: ['color'],
    },
    label: {
        element: 'label',
        parent: 'root',
        flags: ['disabled', 'invalid', 'required'],
        tokens: ['color', 'text'],
        visuallyHidden: true,
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
