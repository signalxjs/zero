import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * NumberInput — a spinbutton over a real text input.
 *
 * `control` is the field chrome wrapping input + triggers (the Combobox
 * split): the focus ring and invalid tint draw on the box, not the bare
 * `<input>`. `hidden-input` posts the canonical decimal when `name` is set —
 * the visible input never carries `name`, so a custom display format can't
 * corrupt form data.
 */
export const numberInputAnatomy = defineAnatomy('number-input', {
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
    control: {
        element: 'div',
        parent: 'root',
        flags: ['disabled', 'invalid', 'readonly', 'focus-visible'],
        tokens: ['color', 'radius-field', 'size'],
    },
    input: {
        element: 'input',
        parent: 'control',
        flags: ['disabled', 'invalid', 'required', 'readonly', 'focus-visible'],
        tokens: ['color', 'text', 'size'],
    },
    'increment-trigger': {
        element: 'button',
        parent: 'control',
        flags: ['disabled', 'pressed', 'press-animating'],
        tokens: ['color'],
        asChild: true,
    },
    'decrement-trigger': {
        element: 'button',
        parent: 'control',
        flags: ['disabled', 'pressed', 'press-animating'],
        tokens: ['color'],
        asChild: true,
    },
    'hidden-input': {
        element: 'input',
        parent: 'root',
    },
}, {
    models: [
        { concept: 'value', type: 'number | null', formControl: true },
    ],
});
