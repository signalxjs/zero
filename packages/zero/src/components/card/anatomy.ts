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
 * writes; zero styles the inside of it.
 *
 * `header`/`body`/`footer` are the layout bands, `title`/`description` the
 * text inside the header. All five are optional — a card is often just `root`
 * and `body`.
 */
export const cardAnatomy = defineAnatomy('card', {
    root: {
        element: 'div',
        tokens: ['color', 'radius-box', 'size'],
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
    },
    description: {
        element: 'p',
        parent: 'header',
        tokens: ['color', 'text'],
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
