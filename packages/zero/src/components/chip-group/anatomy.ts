import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * ChipGroup (#544) — a set of chips with one roving tab stop and, while
 * `selectable`, one value model whose shape follows `multiple`: a `string`
 * (`''` when nothing is chosen) or a `string[]` — ToggleGroup's and Select's
 * rule. A chip set is most often not a selection at all, so without
 * `selectable` there is no model: the chips only act or remove.
 *
 * `root` is the `role="group"`, named by `label`; the chips inside it are
 * `chip` scopes, and their `action` parts are the roving stops. Arrow keys
 * move focus (orientation- and RTL-aware, wrapping by default) without
 * changing the value; Space/Enter/click select.
 *
 * FORM PARTICIPATION is ToggleGroup's: a visually-hidden `<select>`
 * (`hidden-input`) while `name` is set and the group is `selectable`.
 */
export const chipGroupAnatomy = defineAnatomy('chip-group', {
    root: {
        element: 'div',
        flags: ['disabled', 'invalid', 'required'],
        tokens: ['color', 'size'],
    },
    'hidden-input': {
        element: 'select',
        parent: 'root',
    },
}, {
    orientation: true,
    models: [
        { concept: 'value', type: 'string', multiple: true, formControl: true },
    ],
});
