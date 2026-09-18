/**
 * Table — data in real table elements, wrapped in the scroll container the
 * content's width demands.
 *
 * ```tsx
 * <Table.Root mods={{ zebra: true }}>
 *     <Table.Caption>Quarterly revenue</Table.Caption>
 *     <Table.Head>
 *         <Table.Row>
 *             <Table.HeaderCell>Quarter</Table.HeaderCell>
 *             <Table.HeaderCell>Revenue</Table.HeaderCell>
 *         </Table.Row>
 *     </Table.Head>
 *     <Table.Body>
 *         <Table.Row>
 *             <Table.Cell>Q1</Table.Cell>
 *             <Table.Cell>$12,930</Table.Cell>
 *         </Table.Row>
 *     </Table.Body>
 * </Table.Root>
 * ```
 *
 * Pure semantics plus styling hooks — no state, no ids, no ARIA beyond what
 * the elements carry natively (see `anatomy.ts` for the root-as-scroll-
 * container and no-sorting decisions). `Table.Caption` is the table's
 * accessible name; write one.
 */
import { component, compound, defineInjectable, defineProvide } from 'sigx';
import type { Define } from 'sigx';
import { dataAttr } from '../../contract/data-attrs.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type { HtmlAttrValue, WithClass, WithHtmlAttrs, WithVariantAxes } from '../../contract/props.js';
import { tableAnatomy } from './anatomy.js';

const SCOPE = tableAnatomy.scope;

/**
 * One column of the table's column spec. Every field is optional: a column
 * with nothing to say still holds its place, so indexes line up.
 */
export interface TableColumn {
    /** A stable name a cell can use in `column` instead of an index. */
    key?: string;
    /** The header text `<Table.Head />` renders for this column. */
    label?: string;
    /**
     * Any CSS width (`100px`, `12ch`, `20%`). Omitted → `auto`, sharing the
     * slack. Rendered as `--table-column-width` on the column's `<col>`, never
     * as a `width` literal, so a responsive rule can take it back.
     */
    width?: string;
    /**
     * Text alignment for the cells that name this column — numbers and ages
     * read `end`. Rendered as `--table-cell-align` on each such cell, which
     * the design system's cell recipes read.
     */
    align?: 'start' | 'center' | 'end';
}

interface TableContext {
    columns(): readonly TableColumn[];
}

export const useTableContext = defineInjectable<TableContext>(() => ({ columns: () => [] }));

/** The spec entry a cell's `column` names — by index, or by `key`. */
function columnOf(ctx: TableContext, ref: number | string | undefined): TableColumn | undefined {
    if (ref === undefined) return undefined;
    const columns = ctx.columns();
    const column = typeof ref === 'number' ? columns[ref] : columns.find((c) => c.key === ref);
    // A cell naming a column the spec does not have is a typo or a stale
    // index, and alignment silently not applying is the failure to avoid.
    if (!column) {
        throw new Error(`[zero] Table: column ${JSON.stringify(ref)} is not in Table.Root's columns (${columns.length} declared)`);
    }
    return column;
}

const alignStyle = (column: TableColumn | undefined): Record<string, string> | undefined =>
    column?.align ? { '--table-cell-align': column.align } : undefined;

export type TableRootProps =
    & WithVariantAxes<'table'>
    /**
     * The column spec: per column a `label`, a `width` and an `align`.
     * `Table.Head` renders the widths as a `<colgroup>` (and, with no
     * children of its own, the header row from the labels); a cell that
     * names its `column` takes the alignment.
     */
    & Define.Prop<'columns', readonly TableColumn[], false>
    & WithClass
    /**
     * Forwarded attributes split across the two elements Root renders:
     * `aria-*` and `role` go to the `<table>` — the element that IS the
     * table to assistive tech, where `aria-label` on the scroll wrapper would
     * name nothing, and where a `role="grid"` means something; kept together
     * so a role and the name that goes with it describe one element — and
     * `id`, `title` and `data-*` land on the root `div`, the part an app
     * addresses.
     */
    & WithHtmlAttrs
    & Define.Slot<'default'>;

const TableRoot = component<TableRootProps>(({ props, slots }) => {
    const ctx: TableContext = { columns: () => props.columns ?? [] };
    defineProvide(useTableContext, () => ctx);

    return () => {
        const rootAttrs: Record<string, HtmlAttrValue> = {};
        const tableAttrs: Record<string, HtmlAttrValue> = {};
        for (const [key, value] of Object.entries(htmlAttrs(props))) {
            (key === 'role' || key.startsWith('aria-') ? tableAttrs : rootAttrs)[key] = value;
        }
        return (
            <div
                {...rootAttrs}
                data-scope={SCOPE}
                data-part="root"
                {...variantAttrs(props)}
                class={props.class}
            >
                <table {...tableAttrs} data-scope={SCOPE} data-part="table">
                    {slots.default?.()}
                </table>
            </div>
        );
    };
}, { name: 'Table.Root' });

export type TablePartProps = WithClass & WithHtmlAttrs & Define.Slot<'default'>;

const section = (partName: 'caption' | 'head' | 'body' | 'foot', tag: 'caption' | 'thead' | 'tbody' | 'tfoot', name: string) =>
    component<TablePartProps>(({ props, slots }) => {
        const Tag = tag;
        return () => (
            <Tag {...htmlAttrs(props)} data-scope={SCOPE} data-part={partName} class={props.class}>
                {slots.default?.()}
            </Tag>
        );
    }, { name });

const TableCaption = section('caption', 'caption', 'Table.Caption');

/**
 * `<thead>`, preceded by the column spec's `<colgroup>` when Root has one —
 * here rather than in Root because the content model puts `colgroup` after
 * the caption and before the head. With no children it renders the header
 * row from the spec's labels.
 */
const TableHead = component<TablePartProps>(({ props, slots }) => {
    const ctx = useTableContext();
    return () => {
        const columns = ctx.columns();
        const children = slots.default?.();
        return (
            <>
                {columns.length > 0 ? (
                    <colgroup data-scope={SCOPE} data-part="colgroup">
                        {columns.map((column, index) => (
                            <col
                                key={column.key ?? index}
                                data-scope={SCOPE}
                                data-part="column"
                                style={column.width ? { '--table-column-width': column.width } : undefined}
                            />
                        ))}
                    </colgroup>
                ) : null}
                <thead {...htmlAttrs(props)} data-scope={SCOPE} data-part="head" class={props.class}>
                    {children ?? (columns.length > 0 ? (
                        <TableRow>
                            {columns.map((column, index) => <TableHeaderCell key={column.key ?? index} column={index} />)}
                        </TableRow>
                    ) : null)}
                </thead>
            </>
        );
    };
}, { name: 'Table.Head' });

const TableBody = section('body', 'tbody', 'Table.Body');
const TableFoot = section('foot', 'tfoot', 'Table.Foot');

export type TableRowProps =
    /** The app's "this row is chosen" — renders the shared `data-selected` flag. */
    & Define.Prop<'selected', boolean, false>
    & WithClass
    & WithHtmlAttrs
    & Define.Slot<'default'>;

const TableRow = component<TableRowProps>(({ props, slots }) => {
    return () => (
        <tr
            {...htmlAttrs(props)}
            data-scope={SCOPE}
            data-part="row"
            data-selected={dataAttr(props.selected)}
            class={props.class}
        >
            {slots.default?.()}
        </tr>
    );
}, { name: 'Table.Row' });

/** The native cell spans — an empty-state row that covers the table is `colSpan`. */
export type TableCellSpanProps =
    & Define.Prop<'colSpan', number, false>
    & Define.Prop<'rowSpan', number, false>;

/**
 * The column spec entry this cell belongs to — an index into
 * `Table.Root`'s `columns`, or a column's `key`. The cell takes the column's
 * alignment; a header cell with no children also renders its label.
 */
export type TableCellColumnProps = Define.Prop<'column', number | string, false>;

export type TableHeaderCellProps =
    /** Which axis this header labels — the native `<th scope>`; default `col`. */
    & Define.Prop<'scope', 'col' | 'row', false>
    & TableCellSpanProps
    & TableCellColumnProps
    & WithClass
    & WithHtmlAttrs
    & Define.Slot<'default'>;

/** The `<th>` — carries no sorting today; `aria-sort` is the planned home. */
const TableHeaderCell = component<TableHeaderCellProps>(({ props, slots }) => {
    const ctx = useTableContext();
    return () => {
        const column = columnOf(ctx, props.column);
        return (
            <th
                {...htmlAttrs(props)}
                data-scope={SCOPE}
                data-part="header-cell"
                scope={props.scope ?? 'col'}
                colSpan={props.colSpan}
                rowSpan={props.rowSpan}
                style={alignStyle(column)}
                class={props.class}
            >
                {slots.default?.() ?? column?.label}
            </th>
        );
    };
}, { name: 'Table.HeaderCell' });

export type TableCellProps = TablePartProps & TableCellSpanProps & TableCellColumnProps;

const TableCell = component<TableCellProps>(({ props, slots }) => {
    const ctx = useTableContext();
    return () => (
        <td
            {...htmlAttrs(props)}
            data-scope={SCOPE}
            data-part="cell"
            colSpan={props.colSpan}
            rowSpan={props.rowSpan}
            style={alignStyle(columnOf(ctx, props.column))}
            class={props.class}
        >
            {slots.default?.()}
        </td>
    );
}, { name: 'Table.Cell' });

export const Table = compound(TableRoot, {
    Root: TableRoot,
    Caption: TableCaption,
    Head: TableHead,
    Body: TableBody,
    Foot: TableFoot,
    Row: TableRow,
    HeaderCell: TableHeaderCell,
    Cell: TableCell,
});
