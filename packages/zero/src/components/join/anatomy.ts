import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Join — visual grouping that collapses the radii of adjacent children: a
 * segmented search field, a button strip, an input with its Go button.
 *
 * Pure CSS composition — the component is two attribute carriers and nothing
 * else. `item` supports `asChild` and that is the honest joint: a wrapper
 * cannot collapse the radius of the control inside it (the corner rules only
 * reach what carries the part attributes), so the control itself should
 * carry them.
 *
 * Both `root` and `item` carry `data-orientation`: the collapse is
 * directional CSS on the item (`item + item` seams, first/last corners), and
 * a sibling selector cannot see the root — stats' reasoning.
 *
 * No `role="group"`, considered and cut: a join is VISUAL grouping, and a
 * search field joined to its button is not a semantic group the reader needs
 * announced. A consumer who means "toolbar" writes the role.
 */
export const joinAnatomy = defineAnatomy('join', {
    root: {
        element: 'div',
        tokens: ['radius-field'],
    },
    item: {
        element: 'div',
        parent: 'root',
        tokens: ['radius-field'],
        asChild: true,
    },
}, { orientation: true });
