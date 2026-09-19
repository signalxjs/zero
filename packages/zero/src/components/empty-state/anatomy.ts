import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * EmptyState — what stands where the content would be: nothing yet, nothing
 * found, nothing reachable (#131).
 *
 * Every app writes this three times — an empty list, a failed load, an
 * offline notice — and every one of them was raw markup, because zero only
 * had `Combobox.Empty`, which is the empty case of one popup. The parts are
 * the ones all three share: a decorative `icon`, a `title`, a
 * `description`, and an `actions` band for the way out (retry, create, go
 * back). The tone is the `color` axis — a failure is `error`, an offline
 * notice `warning` — the way Alert says it, so there is no variant to
 * invent.
 *
 * It is NOT an Alert. An alert announces itself (`role="alert"`) and can be
 * dismissed; an empty state is the page's content while there is none, is
 * read in flow, and stays until the content arrives. No role of its own —
 * an app that wants a failure announced passes `role="status"`, and one that
 * wants a heading renders `title` as one through `asChild`. No open/closed:
 * presence is the consumer's `if`.
 *
 * `actions` holds the consumer's own buttons and links (`Button.Root`, or a
 * `Button.Root asChild` over an `<a>`); it is a band, not a button, so it
 * takes no flags of its own.
 */
export const emptyStateAnatomy = defineAnatomy('empty-state', {
    root: {
        element: 'div',
        tokens: ['color', 'radius-box', 'size'],
    },
    icon: {
        element: 'span',
        parent: 'root',
        tokens: ['color'],
    },
    title: {
        element: 'div',
        parent: 'root',
        tokens: ['color', 'text'],
        asChild: true,
    },
    description: {
        element: 'div',
        parent: 'root',
        tokens: ['color', 'text'],
    },
    actions: {
        element: 'div',
        parent: 'root',
    },
});
