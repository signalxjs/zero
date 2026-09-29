import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Input — a single-line text field.
 *
 * `control` is the field chrome wrapping the input (the Combobox/NumberInput
 * split): the focus ring and the invalid tint draw on the box, not on the bare
 * `<input>`. It is also the row the affordances sit in (#281):
 *
 * - `adornment` — a leading or trailing ICON (or any graphic) at one logical
 *   edge, named by `data-placement` (`start` | `end`). A press on it that
 *   lands on nothing interactive focuses the input, as a press on the box's
 *   own padding would. Recipes order it with `order`, never physical margins.
 * - `affix` — prefix or suffix TEXT (`https://`, `.com`, `kg`, `$`), with the
 *   same placement and the same press. A separate part because a design
 *   system lays the two out differently (#467): Material centres an icon in
 *   the container and moves a resting label past a leading one, while affix
 *   text sits on the input's own text line, shows only once the label has
 *   floated, and never moves the label. A skin must not have to guess which
 *   one it holds from the content.
 * - `clear-trigger` — empties the value like typing would, then focuses the
 *   input. Out of the tab order (the keyboard path is select-all + delete,
 *   or Escape in a `search` field), and it renders nothing while the value is
 *   empty — a button that can do nothing is noise, not a state — so it needs
 *   no state and no `hiddenIn`.
 * - `visibility-trigger` — a password field's show/hide toggle: `on` while the
 *   characters are shown, `aria-pressed` carrying the same to AT. Only a
 *   `type="password"` root switches the input to `text` while it is on.
 *
 * - `outline` — optional (#468): the field's outline as a `<fieldset>`
 *   laid over the control, whose `notch` (its `<legend>`) cuts the gap a
 *   floated label sits in. Decorative (`aria-hidden`). The runtime publishes
 *   the input's visible label's layout inline size on it as
 *   `--input-label-inline-size` (px; `0px` without a visible label) — the
 *   geometry a skin needs to size the notch at the scale it floats the label
 *   with. A design system that draws its border on the control, with no
 *   floating label, may leave it undisplayed.
 *
 * There is no `hidden-input`, unlike every other form scope here. Checkbox,
 * Switch and NumberInput all post through a hidden mirror because their
 * visible control is not a form control (a `<span>`) or not the canonical
 * value (a formatted number). An `<input type="text">` is both, so `name` goes
 * straight on it.
 *
 * `placeholder` (#416) flags `root` and `control` while the text is
 * empty, the word Select already uses for "nothing chosen". It is what a
 * floating label reads to rest inside the field. `:placeholder-shown` cannot
 * stand in: it matches only when the input HAS a `placeholder` attribute,
 * and a label resting in the field is exactly the case where it has none.
 * It tracks the element on every keystroke, timing modifiers included. It
 * is deliberately absent from `input`: reading the text there would
 * re-render the native element per keystroke, and sigx re-binds the model on
 * each render, which drops a pending `debounce`.
 */
export const inputAnatomy = defineAnatomy('input', {
    root: {
        element: 'div',
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
    control: {
        element: 'div',
        parent: 'root',
        flags: ['disabled', 'invalid', 'readonly', 'focus-visible', 'placeholder'],
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
    affix: {
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
    outline: {
        element: 'fieldset',
        parent: 'control',
        tokens: ['color', 'radius-field'],
    },
    notch: {
        element: 'legend',
        parent: 'outline',
        tokens: ['text'],
    },
}, {
    models: [
        { concept: 'value', type: 'string', formControl: true },
        { name: 'visible', concept: 'visible', type: 'boolean' },
    ],
    // On the optional outline: the visible label's layout inline size (px,
    // before transforms), which a recipe sizes the notch from (#468).
    runtimeProperties: ['--input-label-inline-size'],
});
