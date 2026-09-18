import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Textarea — a multi-line text field.
 *
 * No `control` part, deliberately, where Input has one. Input's control is the
 * seam that lets something sit *beside* the text inside the box; a textarea's
 * box has no such inside — the scrollbar and the resize handle belong to the
 * element itself, and a wrapper would be chrome with nothing to wrap. So the
 * border, the ring and the invalid tint draw on the `<textarea>` directly.
 *
 * No `hidden-input` either: a `<textarea>` is a form control and carries its
 * own `name` (see the Input anatomy for why the other form scopes differ).
 */
export const textareaAnatomy = defineAnatomy('textarea', {
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
    textarea: {
        element: 'textarea',
        parent: 'root',
        flags: ['disabled', 'invalid', 'required', 'readonly', 'focus-visible'],
        tokens: ['color', 'text', 'size', 'radius-field'],
    },
}, {
    models: [
        { concept: 'value', type: 'string', formControl: true },
    ],
});
