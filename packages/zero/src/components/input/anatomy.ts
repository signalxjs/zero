import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Input — a single-line text field.
 *
 * `control` is the field chrome wrapping the input (the Combobox/NumberInput
 * split): the focus ring and the invalid tint draw on the box, not on the bare
 * `<input>`. It is also the row the three affordances sit in (#281):
 *
 * - `adornment` — consumer content (an icon, a unit, a prefix) at one logical
 *   edge, named by `data-placement` (`start` | `end`). A press on it that
 *   lands on nothing interactive focuses the input, as a press on the box's
 *   own padding would. Recipes order it with `order`, never physical margins.
 * - `clear-trigger` — empties the value like typing would, then focuses the
 *   input. Out of the tab order (the keyboard path is select-all + delete,
 *   or Escape in a `search` field), and it renders nothing while the value is
 *   empty — a button that can do nothing is noise, not a state — so it needs
 *   no state and no `hiddenIn`.
 * - `visibility-trigger` — a password field's show/hide toggle: `on` while the
 *   characters are shown, `aria-pressed` carrying the same to AT. Only a
 *   `type="password"` root switches the input to `text` while it is on.
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
        visuallyHidden: true,
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
    adornment: {
        element: 'span',
        parent: 'control',
        placements: ['start', 'end'],
        flags: ['disabled'],
        tokens: ['color', 'text', 'size'],
    },
    'clear-trigger': {
        element: 'button',
        parent: 'control',
        flags: ['disabled', 'focus-visible', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-selector', 'text'],
    },
    'visibility-trigger': {
        element: 'button',
        parent: 'control',
        states: ['on', 'off'],
        flags: ['disabled', 'focus-visible', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-selector', 'text'],
    },
}, {
    models: [
        { concept: 'value', type: 'string', formControl: true },
        { name: 'visible', concept: 'visible', type: 'boolean' },
    ],
});
