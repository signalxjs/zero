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
import { component, compound } from 'sigx';
import type { Define } from 'sigx';
import { dataAttr } from '../../contract/data-attrs.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type { HtmlAttrValue, WithClass, WithHtmlAttrs, WithVariantAxes } from '../../contract/props.js';
import { tableAnatomy } from './anatomy.js';

const SCOPE = tableAnatomy.scope;

export type TableRootProps =
    & WithVariantAxes<'table'>
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
const TableHead = section('head', 'thead', 'Table.Head');
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

export type TableHeaderCellProps =
    /** Which axis this header labels — the native `<th scope>`; default `col`. */
    & Define.Prop<'scope', 'col' | 'row', false>
    & TableCellSpanProps
    & WithClass
    & WithHtmlAttrs
    & Define.Slot<'default'>;

/** The `<th>` — carries no sorting today; `aria-sort` is the planned home. */
const TableHeaderCell = component<TableHeaderCellProps>(({ props, slots }) => {
    return () => (
        <th
            {...htmlAttrs(props)}
            data-scope={SCOPE}
            data-part="header-cell"
            scope={props.scope ?? 'col'}
            colSpan={props.colSpan}
            rowSpan={props.rowSpan}
            class={props.class}
        >
            {slots.default?.()}
        </th>
    );
}, { name: 'Table.HeaderCell' });

export type TableCellProps = TablePartProps & TableCellSpanProps;

const TableCell = component<TableCellProps>(({ props, slots }) => {
    return () => (
        <td
            {...htmlAttrs(props)}
            data-scope={SCOPE}
            data-part="cell"
            colSpan={props.colSpan}
            rowSpan={props.rowSpan}
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
