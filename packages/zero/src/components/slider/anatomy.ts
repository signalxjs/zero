import { defineAnatomy } from '../../contract/anatomy.js';

// Two web projections over one anatomy (a superset anatomy from the
// multi-target RFC — docs/architecture.md §11 — whose original
// platform-divergent case was Lynx): a scalar model renders `control` — a native
// `<input type="range">`, thumb styled via its vendor pseudo-elements — and
// none of `track`/`range`/`thumb`; a range model (`number[]`) composes the
// real `track`/`range`/`thumb` parts (one thumb per value) and no `control`,
// which is also the projection platforms without a native range widget (Lynx)
// always use. One recipe carries every projection — rules for parts a render
// doesn't include are inert there.
export const sliderAnatomy = defineAnatomy('slider', {
    root: {
        element: 'div',
        flags: ['disabled', 'invalid', 'focus-visible'],
        tokens: ['color'],
    },
    label: {
        element: 'label',
        parent: 'root',
        flags: ['disabled'],
        tokens: ['color', 'text'],
    },
    control: {
        element: 'input',
        parent: 'root',
        flags: ['disabled', 'invalid', 'focus-visible', 'pressed'],
        tokens: ['color', 'radius-selector', 'size'],
    },
    track: {
        element: 'div',
        parent: 'root',
        flags: ['disabled'],
        tokens: ['color', 'radius-selector', 'size'],
    },
    range: {
        element: 'div',
        parent: 'track',
        flags: ['disabled'],
        tokens: ['color', 'radius-selector'],
    },
    thumb: {
        element: 'div',
        parent: 'track',
        flags: ['disabled', 'pressed', 'focus-visible'],
        tokens: ['color', 'radius-selector', 'size'],
    },
    // A tick from the root's `marks` prop, positioned on the track by the
    // runtime (logical inline-start percent); carries the mark's label text
    // when one is declared.
    mark: {
        element: 'span',
        parent: 'track',
        flags: ['disabled'],
        tokens: ['color', 'text'],
    },
    'value-text': {
        element: 'output',
        parent: 'root',
        tokens: ['color', 'text'],
    },
    // Range models post through hidden inputs (one per value, shared name);
    // the scalar projection posts through the native control itself.
    'hidden-input': {
        element: 'input',
        parent: 'root',
    },
}, {
    orientation: true,
    models: [
        { concept: 'value', type: 'number | number[]', formControl: true },
    ],
});
