import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Input — a single-line text field.
 *
 * `control` is the field chrome wrapping the input (the Combobox/NumberInput
 * split): the focus ring and the invalid tint draw on the box, not on the bare
 * `<input>`. Nothing else lives inside it today, but that seam is the reason a
 * leading icon or a trailing affordance can arrive later without breaking the
 * anatomy.
 *
 * There is no `hidden-input`, unlike every other form scope here. Checkbox,
 * Switch and NumberInput all post through a hidden mirror because their
 * visible control is not a form control (a `<span>`) or not the canonical
 * value (a formatted number). An `<input type="text">` is both, so `name` goes
 * straight on it.
 */
export const inputAnatomy = defineAnatomy('input', {
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
}, {
    models: [
        { concept: 'value', type: 'string', formControl: true },
    ],
});
