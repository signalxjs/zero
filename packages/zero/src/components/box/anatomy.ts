import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Box — a padded surface that takes a semantic colour.
 *
 * The layout tier's one scope that PAINTS. The other four are geometry and
 * wire no axes at all; this one exists because "a panel, tinted by meaning"
 * is the other half of building a page, and doing it with `class` would put
 * the one thing a design system should own back in the app.
 *
 * Card is the structured sibling — header, title, body, footer — and Box is
 * deliberately the unstructured one: a callout, a well, a sidebar panel. It
 * follows Card's axis answer rather than inventing a second one: `color` is
 * wired, `variant` is not (no surveyed system varies a plain surface's
 * chrome; the ones that do call it a Card).
 *
 * `size` is declared out of existence rather than wired, which is the one
 * place Box departs from Card. A Box's size IS its padding, and `pad` already
 * says that through the layout attribute; wiring `size` as well would give
 * one fact two spellings.
 *
 * Declares the `text` hint so the contrast audit measures it: a
 * `color="primary"` box is exactly the kind of thing whose ink can go wrong.
 */
export const boxAnatomy = defineAnatomy('box', {
    root: {
        element: 'div',
        layout: ['pad', 'pad-x', 'pad-y'],
        tokens: ['color', 'radius-box', 'text'],
    },
});
