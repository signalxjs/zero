import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Chat — one message row: an avatar slot, a name line, the bubble, a status
 * line.
 *
 * The root IS the row, and its one piece of contract data is which inline
 * side it sits on: `data-placement="start|end"` from the logical pair.
 * `start` — the reading edge — is the other party in every messenger; your
 * own rows opt into `end`. Logical on purpose: a row from the other party
 * sits at the reading start in BOTH directions, so a physical `left` would
 * be wrong in one of them, and recipes flip nothing by hand.
 *
 * `avatar` is a SLOT (put zero's Avatar, an `<img>`, initials — anything in
 * it), not a nested avatar anatomy. The colour axis rides the root and is
 * wired to the BUBBLE's fill by recipes — the row itself never paints.
 */
export const chatAnatomy = defineAnatomy('chat', {
    root: {
        element: 'div',
        placements: ['start', 'end'],
        tokens: ['color'],
    },
    avatar: {
        element: 'div',
        parent: 'root',
    },
    header: {
        element: 'div',
        parent: 'root',
        tokens: ['color', 'text'],
    },
    bubble: {
        element: 'div',
        parent: 'root',
        tokens: ['color', 'radius-box', 'text'],
    },
    footer: {
        element: 'div',
        parent: 'root',
        tokens: ['color', 'text'],
    },
});
