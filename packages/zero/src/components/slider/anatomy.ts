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
        flags: ['disabled', 'invalid', 'readonly', 'focus-visible'],
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
        flags: ['disabled', 'invalid', 'readonly', 'focus-visible', 'pressed'],
        tokens: ['color', 'radius-selector', 'size'],
    },
    track: {
        element: 'div',
        parent: 'root',
        flags: ['disabled', 'readonly'],
        tokens: ['color', 'radius-selector', 'size'],
    },
    range: {
        element: 'div',
        // The composed range slider's marks (#325), painted on the rail
        // exactly like progress's.
        paint: true,
        parent: 'track',
        flags: ['disabled'],
        tokens: ['color', 'radius-selector'],
    },
    thumb: {
        element: 'div',
        paint: true,
        parent: 'track',
        flags: ['disabled', 'readonly', 'pressed', 'focus-visible'],
        tokens: ['color', 'radius-selector', 'size'],
    },
    // The optional per-thumb value indicator (#490): an app places
    // `Slider.ThumbValue` inside a `Slider.Thumb` and it renders that thumb's
    // formatted value — the bubble Material shows over a dragged handle. It
    // mirrors its thumb's `pressed` (a drag of that thumb, a track press
    // included) and `focus-visible`, so a recipe can show it only then.
    // Decorative (`aria-hidden`): the thumb already announces the value.
    'thumb-value': {
        element: 'span',
        parent: 'thumb',
        flags: ['pressed', 'focus-visible'],
        tokens: ['color', 'radius-selector', 'text'],
    },
    // A tick from the root's `marks` prop, positioned on the track by the
    // runtime (logical inline-start percent; physical bottom percent when
    // the root is `orientation="vertical"`); carries the mark's label text
    // when one is declared. `active` while the mark sits on the selected
    // span — the one `range` paints: min → value for one value, lowest →
    // highest for several, ends included — `inactive` off it (#490).
    mark: {
        element: 'span',
        parent: 'track',
        states: ['active', 'inactive'],
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
    // `data-orientation` on the root and the positioned parts (#170).
    orientation: true,
    models: [
        { concept: 'value', type: 'number | number[]', formControl: true },
    ],
    // On the root, the value as a percent of the range.
    runtimeProperties: ['--slider-percent'],
});
