import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Table — semantic table anatomy over the real table elements.
 *
 * The root is the SCROLL CONTAINER, not the table: a table is the one
 * component whose natural content is wider than its container, and a
 * `<table>` cannot be its own overflow box (`display: table` does not
 * scroll), so the anatomy ships the wrapper — `root` is the `div` recipes
 * give `overflow-x: auto`, and `table` is the real `<table>` inside it.
 * The variant axes ride the root, where the compiler anchors axis rules.
 *
 * Everything below renders the real table elements — the elements ARE the
 * semantics: AT row/column navigation and header association only exist on
 * a real table, so there is no `asChild` anywhere in this scope.
 *
 * No states: a table has no machine lifecycle. A row can carry the shared
 * `selected` flag (the app's "this row is chosen" — a per-row fact, so a
 * flag, not a mod). Zebra striping and hover-highlight are per-instance
 * styling choices from a skin's own vocabulary — `data-mod-*` on the root
 * in the skins that offer them, never anatomy.
 *
 * Sorting is deliberately OUT (follow-up): `header-cell` renders the `<th>`
 * that would carry `aria-sort`, so the anatomy is ready without shipping
 * dead parts. `row` declares `parent: 'table'` rather than head/body/foot —
 * the parent names the containing part, and a row is contained by whichever
 * section it sits in, all of which sit in the table.
 */
export const tableAnatomy = defineAnatomy('table', {
    root: {
        element: 'div',
        tokens: ['color', 'radius-box', 'size'],
    },
    table: {
        element: 'table',
        parent: 'root',
        tokens: ['color', 'size', 'text'],
    },
    caption: {
        element: 'caption',
        parent: 'table',
        tokens: ['color', 'text'],
    },
    head: {
        element: 'thead',
        parent: 'table',
        tokens: ['color', 'text'],
    },
    body: {
        element: 'tbody',
        parent: 'table',
        tokens: ['color'],
    },
    foot: {
        element: 'tfoot',
        parent: 'table',
        tokens: ['color', 'text'],
    },
    row: {
        element: 'tr',
        parent: 'table',
        flags: ['selected'],
        tokens: ['color'],
    },
    'header-cell': {
        element: 'th',
        parent: 'row',
        tokens: ['color', 'text', 'size'],
    },
    cell: {
        element: 'td',
        parent: 'row',
        tokens: ['color', 'text', 'size'],
    },
});
