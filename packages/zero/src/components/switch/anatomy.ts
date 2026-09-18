import { defineAnatomy } from '../../contract/anatomy.js';

export const switchAnatomy = defineAnatomy('switch', {
    root: {
        element: 'label',
        states: ['checked', 'unchecked'],
        flags: ['disabled', 'focus-visible', 'invalid', 'required'],
        tokens: ['color'],
    },
    control: {
        element: 'span',
        parent: 'root',
        states: ['checked', 'unchecked'],
        // `invalid` is here as well as on the root, matching `checkbox`: the
        // track is what a design system paints, and reaching it from the root
        // costs every recipe a descendant selector for a fact the control
        // knows about itself (#269).
        flags: ['disabled', 'focus-visible', 'invalid', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-selector', 'size'],
    },
    thumb: {
        element: 'span',
        parent: 'control',
        states: ['checked', 'unchecked'],
        tokens: ['color', 'radius-selector'],
    },
    label: {
        element: 'span',
        parent: 'root',
        states: ['checked', 'unchecked'],
        flags: ['disabled'],
        tokens: ['color', 'text'],
    },
    'hidden-input': {
        element: 'input',
        parent: 'root',
    },
}, {
    models: [
        { concept: 'checked', type: 'boolean', formControl: true },
    ],
});
