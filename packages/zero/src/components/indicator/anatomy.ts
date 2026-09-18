import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Indicator — a wrapper that anchors a floating item to a corner or edge of
 * whatever it wraps: the badge on the inbox button, the dot on the avatar.
 *
 * Two parts and no paint of its own. `root` establishes the containing box
 * (recipes make it the positioning context), `item` floats to a declared
 * `data-placement` slot — contract data, not styling, which is what lets a
 * recipe key each slot and `expectAnatomy` reject an undeclared one.
 *
 * Eight slots: four corners, two edge midpoints, and the two bare LOGICAL
 * inline sides for the middle row (`start`/`end` — the pair #334 added to
 * PLACEMENT_VOCABULARY). Deliberately no `left`/`right`: an indicator
 * anchors to the reading direction, not to the glass, so its whole subset
 * spells logically and recipes position it with `inset-inline-*` — the RTL
 * mirror is free. And no `middle-center`: an item centred ON its content is
 * an overlay, not an indicator.
 */
export const INDICATOR_PLACEMENTS = [
    'top-start', 'top', 'top-end',
    'start', 'end',
    'bottom-start', 'bottom', 'bottom-end',
] as const;

export const indicatorAnatomy = defineAnatomy('indicator', {
    root: {
        element: 'div',
    },
    item: {
        element: 'span',
        parent: 'root',
        placements: INDICATOR_PLACEMENTS,
    },
});
