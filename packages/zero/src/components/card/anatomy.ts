import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Card — a surface with a conventional interior, and no behavior.
 *
 * Deliberately stateless and context-free: a card is the one content-tier
 * component that is purely a styling container, so it mints no ids and wires
 * no ARIA. `aria-labelledby` from `root` to `title` was considered and cut —
 * it does nothing on a plain `div`, and giving `root` a `role` to make it work
 * would turn every card on a page into a landmark the reader has to walk past.
 * A card that needs a name is an `<article>` or a `<section>` the consumer
 * writes — `asChild` on `root`, or `role`/`aria-labelledby` forwarded onto
 * it — and zero styles the inside of it.
 *
 * `header`/`body`/`footer` are the layout bands, `title`/`description` the
 * text inside the header. All five are optional — a card is often just `root`
 * and `body`. `title` defaults to an `h3` and `description` to a `p`; both
 * take `asChild`, because the heading level is the page outline's call (an
 * `h2` under the page's `h1`, a `div` in a card that is not a section at
 * all) and a description may need to be more than one paragraph.
 */
export const cardAnatomy = defineAnatomy('card', {
    root: {
        element: 'div',
        tokens: ['color', 'radius-box', 'size'],
        asChild: true,
    },
    header: {
        element: 'div',
        parent: 'root',
        tokens: ['color'],
    },
    title: {
        element: 'h3',
        parent: 'header',
        tokens: ['color', 'text'],
        asChild: true,
    },
    description: {
        element: 'p',
        parent: 'header',
        tokens: ['color', 'text'],
        asChild: true,
    },
    body: {
        element: 'div',
        parent: 'root',
        tokens: ['color', 'text'],
    },
    footer: {
        element: 'div',
        parent: 'root',
        tokens: ['color'],
    },
});
