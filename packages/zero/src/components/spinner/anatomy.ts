import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Spinner — a busy indicator, and nothing else.
 *
 * No state: it spins, or it is not rendered. A `loading|idle` pair was
 * considered and cut — an idle spinner is one nobody should be looking at,
 * and giving it a state would invite a design system to paint one.
 *
 * `role="status"` with a name, because a spinner with no accessible name is a
 * decoration that happens to move. The runtime supplies "Loading" and the
 * `label` prop overrides it. The mark itself is drawn by the recipe, so the
 * part hints `color` and carries no text.
 */
export const spinnerAnatomy = defineAnatomy('spinner', {
    root: {
        element: 'span',
        tokens: ['color', 'size'],
    },
});
