import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * CheckboxGroup — a labelled `role="group"` of `Checkbox.Root`s sharing one
 * `string[]` model.
 *
 * The group renders only its own two parts; the boxes inside are ordinary
 * `checkbox` scope parts (a boxed `Checkbox.Root` reads the group from
 * context), so a design system styles a box once, grouped or not. `root`
 * restates the group's flags for a recipe that dims or outlines the whole
 * set; `label` is the group's visible name, referenced by the root's
 * `aria-labelledby` only while it is rendered.
 */
export const checkboxGroupAnatomy = defineAnatomy('checkbox-group', {
    root: {
        element: 'div',
        flags: ['disabled', 'invalid', 'required', 'readonly'],
        tokens: ['color', 'size'],
    },
    label: {
        element: 'div',
        parent: 'root',
        flags: ['disabled', 'invalid', 'required'],
        tokens: ['color', 'text'],
    },
}, {
    orientation: true,
    models: [
        { concept: 'value', type: 'string[]', formControl: true },
    ],
});
