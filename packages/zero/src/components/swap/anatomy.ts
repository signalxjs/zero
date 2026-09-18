import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Swap — two faces over one boolean.
 *
 * `on` and `off` are content slots that BOTH stay rendered: the component
 * exists for the CSS transition between them (fade, daisy's rotate/flip —
 * all recipe styling keyed on `data-state`), and the `hidden` attribute
 * computes `display: none`, which would kill it. The inactive face is
 * `aria-hidden` instead — painted for the animation, absent for AT. All
 * three parts carry `data-state on|off` (the toggle family): the faces
 * need it to style their own presence, the root to host the transition.
 *
 * Interactive is OPT-IN: a swap is a DISPLAY by default (a theme icon that
 * follows external state) and must not claim button semantics; with
 * `interactive` the root renders a real `<button aria-pressed>` — Toggle's
 * contract, restated here because the faces are the content. There is no
 * indeterminate face: the model is a boolean and a third face would be a
 * third state wearing a styling costume.
 *
 * The faces carry no `text` hint on purpose: they are glyph slots (icons,
 * emoji), and the inactive one is legitimately painted at opacity 0 —
 * which is exactly what the text-legibility matrix must not be asked to
 * read.
 */
export const swapAnatomy = defineAnatomy('swap', {
    root: {
        element: 'span',
        states: ['on', 'off'],
        flags: ['disabled', 'focus-visible', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-selector', 'size'],
    },
    on: {
        element: 'span',
        parent: 'root',
        states: ['on', 'off'],
        tokens: ['color'],
    },
    off: {
        element: 'span',
        parent: 'root',
        states: ['on', 'off'],
        tokens: ['color'],
    },
}, {
    models: [
        { concept: 'active', type: 'boolean' },
    ],
});
