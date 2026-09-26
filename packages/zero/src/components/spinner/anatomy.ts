import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Spinner — a busy indicator, and nothing else.
 *
 * No state: it spins, or it is not rendered. A `loading|idle` pair was
 * considered and cut — an idle spinner is one nobody should be looking at,
 * and giving it a state would invite a design system to paint one.
 *
 * `role="status"` with words, because a spinner that says nothing is a
 * decoration that happens to move. The words are the `label` part's TEXT —
 * always visually hidden, since a live region announces content and screen
 * readers skip a name that only sits in an `aria-label` (#274). The runtime
 * supplies "Loading" and the `label` prop overrides it; a `decorative`
 * spinner renders no label at all. The mark itself is drawn by the recipe on
 * the root, so the root hints `color` and carries no text, and the label
 * hints nothing: the structure layer clips it, and there is nothing for a
 * design system to style.
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
    label: {
        element: 'span',
        parent: 'root',
        visuallyHidden: true,
    },
});
