import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Grid — a two-dimensional layout, where Stack is one-dimensional.
 *
 * Attribute carriers only, like Stack: the geometry is the design system's,
 * and the column count is a closed contract value rather than a length.
 *
 * `cols` is a twelve-column count or `auto`. `auto` is the mode worth having
 * — `repeat(auto-fit, minmax(<track>, 1fr))` reflows by available width with
 * no breakpoint named at all, which is what a dashboard of cards wants; the
 * counted modes are for the layouts that really are "three across".
 *
 * `cell` exists for the same reason Stack's `item` does: `grid-column` is a
 * property of the grid ITEM, so a wrapper cannot make the child span. It
 * supports `asChild` so the child can carry the part.
 *
 * No `role`: a CSS grid is visual arrangement. A consumer who means a table
 * writes the table roles, and zero ships a Table for that.
 */
export const gridAnatomy = defineAnatomy('grid', {
    root: {
        element: 'div',
        layout: ['cols', 'track', 'gap', 'gap-x', 'gap-y', 'pad', 'pad-x', 'pad-y', 'align', 'justify'],
    },
    cell: {
        element: 'div',
        parent: 'root',
        layout: ['span'],
        asChild: true,
    },
});
