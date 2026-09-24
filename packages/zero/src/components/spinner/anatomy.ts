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
        // Pure paint (#314): an invisible spinner is a real bug, and the
        // non-text floor is 3:1. Skeleton deliberately does NOT declare it — it
        // is the absence of content, and a placeholder loud enough to clear
        // 3:1 would read as a filled block someone meant.
        paint: true,
        tokens: ['color', 'size'],
    },
});
