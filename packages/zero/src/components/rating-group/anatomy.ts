import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * RatingGroup — radio semantics over a row of symbols, with fractional
 * display.
 *
 * `item` carries the one three-value state set in the library:
 * `full|half|empty`, driven by the DISPLAYED value (hover preview included),
 * so a recipe styles the fill without knowing whether it previews or
 * commits. `data-highlighted` marks items inside the preview range while a
 * pointer is over the control.
 */
export const ratingGroupAnatomy = defineAnatomy('rating-group', {
    root: {
        element: 'div',
        flags: ['disabled', 'invalid', 'required', 'readonly'],
        tokens: ['color'],
    },
    label: {
        element: 'div',
        parent: 'root',
        flags: ['disabled', 'invalid', 'required'],
        tokens: ['color', 'text'],
    },
    control: {
        element: 'div',
        parent: 'root',
        flags: ['disabled', 'readonly', 'focus-visible'],
        tokens: ['color', 'size'],
    },
    item: {
        element: 'span',
        parent: 'control',
        states: ['full', 'half', 'empty'],
        flags: ['highlighted', 'disabled', 'readonly', 'focus-visible'],
        tokens: ['color', 'size'],
    },
    'hidden-input': {
        element: 'input',
        parent: 'root',
    },
}, {
    models: [
        { concept: 'value', type: 'number', formControl: true },
    ],
});
