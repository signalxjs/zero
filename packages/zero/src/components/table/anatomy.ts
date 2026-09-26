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
 * Being the scroll box, the root is also a keyboard stop (`tabIndex=0` —
 * a table wider than its container must scroll without a pointer), so it
 * carries `data-focus-visible` for the design system's ring, and is a
 * `region` named by the caption (or the app's label) whenever it has a
 * name to carry.
 *
 * Everything below renders the real table elements — the elements ARE the
 * semantics: AT row/column navigation and header association only exist on
 * a real table, so there is no `asChild` anywhere in this scope.
 *
 * The table itself has no machine lifecycle. A row can carry the shared
 * `selected` flag (the app's "this row is chosen" — a per-row fact, so a
 * flag, not a mod). Zebra striping and hover-highlight are per-instance
 * styling choices from a skin's own vocabulary — `data-mod-*` on the root
 * in the skins that offer them, never anatomy. `row` declares
 * `parent: 'table'` rather than head/body/foot — the parent names the
 * containing part, and a row is contained by whichever section it sits in,
 * all of which sit in the table.
 *
 * Sorting (#286) is the one state: the root's named `model:sort` holds
 * `{ column, direction } | null`, and a `sortable` header cell carries the
 * sort family (`ascending|descending|none`, `aria-sort`'s own spellings) as
 * both `aria-sort` and `data-state` — `none` for a sortable column the
 * table is not sorted by; a header cell that cannot sort has no state at
 * all. Its content sits in `sort-trigger`, a real `<button>` (the only way
 * to sort from a keyboard, and what `aria-sort` on the `<th>` expects to
 * find), which cycles the model; `sort-indicator` inside it is the
 * direction mark, `aria-hidden` because `aria-sort` already says it — a
 * paint part, drawn from the one default glyph that recipes turn or hide
 * per state. The runtime never sorts rows: the app owns the data, and
 * re-orders it from `sortChange`.
 *
 * `colgroup` / `column` are the column spec's widths (`Table.Root`'s
 * `columns`), rendered by `Table.Head` just before the `<thead>` — the
 * content model's place for them. The width rides `--table-column-width` on
 * each `<col>` and a `zero.structure` rule applies it, so a design system
 * never has to remember to; alignment rides `--table-cell-align` on the
 * cells that name their column, which the cell recipes read.
 *
 * `stack` on the root (`data-l-stack="md"`, a breakpoint-valued layout
 * attribute) is the responsive stacked mode: below that breakpoint every
 * row is one labelled block. The geometry is zero's — kit-emitted
 * per-breakpoint rules in `@layer zero.structure` — and the card chrome is
 * the skin's. `cell-label` is the column's label printed inside each cell
 * that names a column, a real `aria-hidden` element rather than a
 * `::before` (a skin that draws on the cell's pseudo-elements cannot
 * collide with it). It renders only on a table that stacks, and is
 * `display: none` until the table actually does; assistive tech keeps
 * reading the header association, since the head row is visually hidden
 * rather than removed.
 */
export const tableAnatomy = defineAnatomy('table', {
    root: {
        element: 'div',
        layout: ['stack'],
        // The scroll box is a keyboard stop, and recipes ring it.
        flags: ['focus-visible'],
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
    colgroup: {
        element: 'colgroup',
        parent: 'table',
    },
    column: {
        element: 'col',
        parent: 'colgroup',
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
        // Only on a `sortable` header cell, mirroring its `aria-sort`.
        states: ['ascending', 'descending', 'none'],
        tokens: ['color', 'text', 'size'],
    },
    'sort-trigger': {
        element: 'button',
        parent: 'header-cell',
        states: ['ascending', 'descending', 'none'],
        flags: ['disabled', 'focus-visible', 'pressed', 'press-animating'],
        tokens: ['color', 'text', 'radius-field'],
    },
    'sort-indicator': {
        element: 'span',
        parent: 'sort-trigger',
        paint: { glyph: '▲' },
        states: ['ascending', 'descending', 'none'],
        tokens: ['color'],
    },
    cell: {
        element: 'td',
        parent: 'row',
        tokens: ['color', 'text', 'size'],
    },
    'cell-label': {
        element: 'span',
        parent: 'cell',
        tokens: ['color', 'text'],
    },
}, {
    models: [
        { name: 'sort', concept: 'sort', type: '{ column: string; direction: \'ascending\' | \'descending\' } | null' },
    ],
});
