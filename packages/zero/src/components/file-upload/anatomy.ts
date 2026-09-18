import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * FileUpload — a real `<input type="file">` wrapped in the anatomy that
 * makes it styleable.
 *
 * The INPUT IS THE CONTROL: it carries `name`/`accept`/`multiple`/`required`
 * and posts its FileList natively, so there is no hidden-input question —
 * nothing else holds the value. It is visually hidden (the Switch
 * technique) and out of the tab order; the TRIGGER (a real `<button>`) is
 * the one keyboard path to the picker. The DROPZONE is a pointer affordance
 * only — never focusable, no role: drag-and-drop has no keyboard path (APG
 * defines no drop-target pattern), and a focusable dropzone would be a
 * second tab stop duplicating the trigger.
 *
 * No states. Drag-over is the shared `highlighted` flag — the vocabulary's
 * word for "the pointer is over this and it will act" — stamped on the
 * dropzone AND the root, so a recipe can lift the whole field while a drag
 * hovers. `disabled`/`invalid`/`required` ride the usual parts, fed by the
 * field context exactly like Input.
 *
 * `item` renders one accepted file from the model (`File[]`); `item-name`/
 * `item-size` are its text bands (size formatted human-readable) and
 * `item-remove` the per-file button, labelled "Remove <name>".
 */
export const fileUploadAnatomy = defineAnatomy('file-upload', {
    root: {
        element: 'div',
        flags: ['disabled', 'invalid', 'required', 'highlighted'],
        tokens: ['color', 'radius-box', 'size'],
    },
    label: {
        element: 'label',
        parent: 'root',
        flags: ['disabled', 'invalid', 'required'],
        tokens: ['color', 'text'],
    },
    input: {
        element: 'input',
        parent: 'root',
    },
    trigger: {
        element: 'button',
        parent: 'root',
        flags: ['disabled', 'invalid', 'focus-visible', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-field', 'size', 'text'],
    },
    dropzone: {
        element: 'div',
        parent: 'root',
        flags: ['disabled', 'highlighted'],
        tokens: ['color', 'radius-box', 'size', 'text'],
    },
    'item-group': {
        element: 'ul',
        parent: 'root',
    },
    item: {
        element: 'li',
        parent: 'item-group',
        flags: ['disabled'],
        tokens: ['color', 'radius-field'],
    },
    'item-name': {
        element: 'span',
        parent: 'item',
        tokens: ['color', 'text'],
    },
    'item-size': {
        element: 'span',
        parent: 'item',
        tokens: ['color', 'text'],
    },
    'item-remove': {
        element: 'button',
        parent: 'item',
        flags: ['disabled', 'focus-visible', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-selector', 'text'],
    },
}, {
    models: [
        { concept: 'files', type: 'File[]', formControl: true },
    ],
});
