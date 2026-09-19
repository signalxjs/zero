/**
 * Table's responsive stacked mode (zero#55) — the geometry zero owns, and
 * the helper a skin paints its cards with.
 *
 * `Table.Root stack="md"` renders `data-l-stack="md"` on the root: below the
 * design system's `md`, every row becomes one block and each cell that names
 * a column opens with that column's label (the `cell-label` part). Two
 * halves, split the way the maintainers decided on the issue:
 *
 * - **Geometry is zero's** ({@link tableStackCss}). Block rows, the visually
 *   hidden head, the hanging label, the reset column widths — every skin
 *   gets the same, in `@layer zero.structure`, so no recipe can forget or
 *   out-specify it. It is per breakpoint, which is why the kit emits it
 *   rather than `css/base.css`: only the design system knows what `md` is.
 * - **Chrome is the skin's** ({@link tableStackAt}). The card's border, fill,
 *   padding and the gap between cards are recipe styles, conditioned on the
 *   same range through the recipe's own `below-<breakpoint>` keys.
 *
 * ## Why the selectors spell out the whole containment chain
 *
 * `root > table > section > row > cell > cell-label`, child combinators all
 * the way down, rather than a descendant `[data-l-stack="md"] [data-part="cell"]`.
 * A table nested in a stacked table's cell is a different table: it stacks
 * at its own breakpoint or not at all, and a descendant selector would turn
 * its rows into cards too.
 *
 * ## Why the label hangs rather than sitting in a grid column
 *
 * A cell's content is whatever the app wrote — text, then an element, then
 * more text. In a grid or flex cell each of those runs becomes its own
 * anonymous item and the value falls apart across tracks, and anonymous
 * items cannot be placed. So the cell stays a block formatting context, its
 * start padding is the label column, and the label floats into that padding
 * with a matching negative margin: the value flows as ordinary inline
 * content, a long label wraps within its column, and `flow-root` grows the
 * cell to contain it. `--table-stack-label-size` and
 * `--table-stack-label-gap` size the column — a skin sets them as component
 * tokens on the root. Both are lengths; a percentage would resolve against
 * two different boxes on the cell and the label.
 */
import type { CssProps, PartStyles } from './recipes.js';
import { BELOW_PREFIX } from './recipes.js';
import type { TokensInput } from './tokens.js';

/** The table parts a stacked-mode rule can address. */
export type TableStackPart =
    | 'root' | 'table' | 'caption' | 'colgroup' | 'column'
    | 'head' | 'body' | 'foot' | 'row' | 'header-cell' | 'cell' | 'cell-label';

const part = (name: string): string => `[data-scope="table"][data-part="${name}"]`;
/** A table section — head, body or foot; the chain above a row does not care which. */
const SECTION = '[data-scope="table"]';

/**
 * The containment chain from a table stacking at `breakpoint` down to — not
 * including — `name`, or `undefined` for the root itself.
 */
function chainAbove(breakpoint: string, name: TableStackPart): string | undefined {
    const root = `${part('root')}[data-l-stack="${breakpoint}"]`;
    const table = `${root} > ${part('table')}`;
    switch (name) {
        case 'root': return undefined;
        case 'table': return root;
        case 'caption': case 'colgroup': case 'head': case 'body': case 'foot': return table;
        case 'column': return `${table} > ${part('colgroup')}`;
        case 'row': return `${table} > ${SECTION}`;
        case 'header-cell': case 'cell': return `${table} > ${SECTION} > ${part('row')}`;
        case 'cell-label': return `${table} > ${SECTION} > ${part('row')} > ${part('cell')}`;
    }
}

/** The full selector of `name` inside a table stacking at `breakpoint`. */
const stacked = (breakpoint: string, name: TableStackPart): string => {
    const above = chainAbove(breakpoint, name);
    return above === undefined ? `${part('root')}[data-l-stack="${breakpoint}"]` : `${above} > ${part(name)}`;
};

const LABEL_SIZE = 'var(--table-stack-label-size, 8rem)';
const LABEL_GAP = 'var(--table-stack-label-gap, var(--space-md, 0.5rem))';

const block = (selectors: readonly string[], decls: Record<string, string>, indent: string): string => {
    const body = Object.entries(decls).map(([k, v]) => `${indent}    ${k}: ${v};`).join('\n');
    return `${indent}${selectors.join(`,\n${indent}`)} {\n${body}\n${indent}}`;
};

/**
 * The stacked geometry for one design system, as a `@layer zero.structure`
 * block — or `''` when it declares no breakpoints, since then no `stack`
 * value can name one.
 *
 * Emitted by `compileDesignSystem` into the table's component stylesheet
 * (and so `index.css`), never through `DesignSystemInput.css`, which lands
 * in `zero.recipes`. One `@media (width < …)` block per breakpoint — the
 * same range a recipe's `below-<breakpoint>` key compiles to — and a
 * restatement of `css/base.css`'s `display: none` for the label, so the
 * component file is whole on its own (and the static contrast matrix, which
 * reads component files and not base.css, sees the label as hidden exactly
 * when the browser does).
 */
export function tableStackCss(breakpoints: Readonly<Record<string, string>>): string {
    const entries = Object.entries(breakpoints);
    if (entries.length === 0) return '';
    const i = '        ';
    // No comment in the output: the audit's CSS reader reads the kit's own
    // emission, which carries none.
    const out: string[] = [
        '@layer zero.structure {',
        block([part('cell-label')], { display: 'none' }, '    '),
    ];
    for (const [bp, width] of entries) {
        const s = (name: TableStackPart): string => stacked(bp, name);
        const rules = [
            block([s('table'), s('caption')], { display: 'block' }, i),
            block([s('colgroup')], { display: 'none' }, i),
            // The column spec's widths are table-layout facts; a block has
            // no columns for them to size.
            block([s('column')], { width: 'auto' }, i),
            // Read, not seen: the header association is what gives each
            // value its name to assistive tech, so the head stays in the
            // tree — the same clip as `[data-visually-hidden]`.
            block([s('head')], {
                position: 'absolute',
                'inline-size': '1px',
                'block-size': '1px',
                width: '1px',
                height: '1px',
                margin: '-1px',
                padding: '0',
                border: '0',
                overflow: 'hidden',
                clip: 'rect(0 0 0 0)',
                'clip-path': 'inset(50%)',
                'white-space': 'nowrap',
            }, i),
            // One track, so a recipe's `gap` spaces the cards.
            block([s('body'), s('foot')], { display: 'grid', 'grid-template-columns': 'minmax(0, 1fr)' }, i),
            block([s('row')], { display: 'block' }, i),
            // A column's alignment is a column fact too: a stacked value
            // reads from the start. `text-align` rather than the custom
            // property, which the cell carries inline.
            block([s('header-cell'), s('cell')], { display: 'flow-root', 'text-align': 'start' }, i),
            block([`${s('cell')}:has(> ${part('cell-label')})`], {
                'padding-inline-start': `calc(${LABEL_SIZE} + ${LABEL_GAP})`,
            }, i),
            block([s('cell-label')], {
                display: 'block',
                float: 'inline-start',
                'box-sizing': 'border-box',
                'inline-size': LABEL_SIZE,
                'margin-inline-start': `calc(-1 * (${LABEL_SIZE} + ${LABEL_GAP}))`,
                'margin-inline-end': LABEL_GAP,
            }, i),
        ];
        out.push(`    @media (width < ${width}) {\n${rules.join('\n')}\n    }`);
    }
    out.push('}');
    return out.join('\n');
}

/**
 * A skin's stacked-mode styles for one table part: spread into the part's
 * `at`, they apply only while a table is stacked — below the breakpoint its
 * `stack` names, for every breakpoint the design system declares.
 *
 * ```ts
 * row: {
 *     base: { borderBlockEnd: hairline },
 *     at: tableStackAt(tokens, 'row', { border: hairline, borderRadius: 'var(--radius-box)' }),
 * },
 * ```
 *
 * Each entry is a `below-<breakpoint>` condition holding one `selectors`
 * rule, `:where(<chain>) > &`. The chain is inside `:where()`, so the rule
 * keeps the part's own (0,2,0) specificity: it beats the part's `base` by
 * source order, and a state or modifier rule — a selected row's fill, a
 * zebra stripe — still beats it. The root has no chain; its rule is
 * `&[data-l-stack="<bp>"]`.
 *
 * Takes the tokens rather than a breakpoint list so a recipe module copied
 * into another design system (`@sigx/create-zero-ds`'s baseline) follows
 * that design system's breakpoints. On the lynx target the conditions are
 * dropped and reported, like every other `at` block.
 */
export function tableStackAt(
    tokens: Pick<TokensInput, 'breakpoints'>,
    name: TableStackPart,
    styles: CssProps,
): Record<string, PartStyles> {
    const at: Record<string, PartStyles> = {};
    for (const bp of Object.keys(tokens.breakpoints ?? {})) {
        const above = chainAbove(bp, name);
        const key = above === undefined ? `&[data-l-stack="${bp}"]` : `:where(${above}) > &`;
        at[`${BELOW_PREFIX}${bp}`] = { selectors: { [key]: styles } };
    }
    return at;
}
