import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Pagination — a page picker over a numbered range, windowed with ellipses.
 *
 * A `<nav>` landmark named "Pagination" holding ordinary buttons — there is
 * NO APG pagination pattern to defer to, so the semantics are the honest
 * minimum: the landmark scopes the control, the current page's button
 * carries `aria-current="page"`, and every button is its own tab stop.
 * Deliberately no roving tabindex: roving is for composites where one
 * widget owns many stops (tabs, radio); here each page is a distinct,
 * meaningful destination exactly like any other button row, and collapsing
 * them to one stop would hide the row from keyboard users walking by Tab.
 * No list either — the windowed row is a strip of controls, not content;
 * wrapper `<li>`s would be elements no part of the anatomy could honestly
 * claim (contrast Breadcrumbs, where the trail IS content and order the
 * meaning).
 *
 * Zero renders the row itself (the window derives from `count` and the
 * model, so it cannot be consumer-composed): `item` per visible page,
 * `ellipsis` (aria-hidden punctuation) where the window elides,
 * `prev-trigger`/`next-trigger` bracketing it — carrying the `‹`/`›`
 * glyph (Select.Indicator's convention) and named by `aria-label`. The
 * glyph is physical ink, so the reading-direction correction is the design
 * system's `scaleX(-1)` under its rtl guard, exactly like the other
 * pointing chevrons.
 *
 * The window is constant-width, so its rendered width follows `count` and
 * the windowing props, not the container. The root is therefore the row's
 * overflow box — the part recipes give `overflow-x: auto` (Table's answer
 * to the same problem), so a narrow container scrolls the row rather than
 * clipping its trailing pages (#44). Wrapping was ruled out: a page range
 * that reflows onto two lines reads as two ranges.
 *
 * The current page is the activation state (`active|inactive`) — the same
 * governed spelling as breadcrumbs' current link and tabs' selected tab.
 *
 * `disabled` on the root disables the whole control: the root carries
 * `data-disabled` and every button is natively disabled. A trigger at its
 * bound (prev on page 1, next on the last page) is different — it is
 * `aria-disabled` + `data-disabled` but stays focusable, so the press that
 * reaches the last page does not drop keyboard focus to the body.
 */
export const paginationAnatomy = defineAnatomy('pagination', {
    root: {
        element: 'nav',
        flags: ['disabled'],
        tokens: ['color', 'size'],
    },
    item: {
        element: 'button',
        parent: 'root',
        states: ['active', 'inactive'],
        flags: ['disabled', 'focus-visible', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-field', 'size', 'text'],
    },
    ellipsis: {
        element: 'span',
        parent: 'root',
        tokens: ['color', 'text'],
    },
    'prev-trigger': {
        element: 'button',
        // The `‹`/`›` glyph is the only affordance for "there are more pages" (#339).
        paint: { glyph: '‹' },
        parent: 'root',
        flags: ['disabled', 'focus-visible', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-field', 'size'],
    },
    'next-trigger': {
        element: 'button',
        paint: { glyph: '›' },
        parent: 'root',
        flags: ['disabled', 'focus-visible', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-field', 'size'],
    },
}, {
    models: [
        { concept: 'page', type: 'number' },
    ],
});
