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
 *
 * The item RE-CARRIES the colour axis (`PartSpec.carries`, #161, the
 * mechanism #94 introduced for timeline's marker and #112 used for steps'
 * item): a `color` on `Stats.Item` renders `data-color` on that item and
 * outranks the root's — the nearest carrier wins — so one figure can say
 * "warning" while the rest of the row stays plain. The bands inside the item
 * follow the item's value; an item without one follows the root.
 */
export const statsAnatomy = defineAnatomy('stats', {
    root: {
        element: 'div',
        tokens: ['color', 'radius-box', 'size'],
    },
    item: {
        element: 'div',
        parent: 'root',
        // Per-item colour (#161): the item re-carries `color`, so one stat's
        // value can paint a tone of its own.
        carries: ['color'],
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
