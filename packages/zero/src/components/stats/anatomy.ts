import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Stats — a row (or column) of figures with their labels: revenue, signups,
 * uptime. Card's cousin: purely a styling container with a conventional
 * interior, no state, no ids, no ARIA — a stat that needs to be a landmark
 * is a `<section>` the consumer writes.
 *
 * `item` is one stat; `title`/`value`/`desc` are its text bands and `figure`
 * the icon/avatar slot, all optional. Both `root` and `item` carry
 * `data-orientation`: the between-item divider is directional CSS on the
 * ITEM (`item + item`), and a sibling selector cannot reach up to the root
 * — the same reason toggle-group stamps its items.
 */
export const statsAnatomy = defineAnatomy('stats', {
    root: {
        element: 'div',
        tokens: ['color', 'radius-box', 'size'],
    },
    item: {
        element: 'div',
        parent: 'root',
        tokens: ['color'],
    },
    title: {
        element: 'div',
        parent: 'item',
        tokens: ['color', 'text'],
    },
    value: {
        element: 'div',
        parent: 'item',
        tokens: ['color', 'text', 'size'],
    },
    desc: {
        element: 'div',
        parent: 'item',
        tokens: ['color', 'text'],
    },
    figure: {
        element: 'div',
        parent: 'item',
        tokens: ['color'],
    },
}, { orientation: true });
