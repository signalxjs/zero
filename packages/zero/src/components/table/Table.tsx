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
import { variantAttrs } from '../../contract/props.js';
import type { WithClass, WithVariantAxes } from '../../contract/props.js';
import { tableAnatomy } from './anatomy.js';

const SCOPE = tableAnatomy.scope;

export type TableRootProps =
    & WithVariantAxes<'table'>
    & WithClass
    & Define.Slot<'default'>;

const TableRoot = component<TableRootProps>(({ props, slots }) => {
    return () => (
        <div
            data-scope={SCOPE}
            data-part="root"
            {...variantAttrs(props)}
            class={props.class}
        >
            <table data-scope={SCOPE} data-part="table">
                {slots.default?.()}
            </table>
        </div>
    );
}, { name: 'Table.Root' });

export type TablePartProps = WithClass & Define.Slot<'default'>;

const section = (partName: 'caption' | 'head' | 'body' | 'foot', tag: 'caption' | 'thead' | 'tbody' | 'tfoot', name: string) =>
    component<TablePartProps>(({ props, slots }) => {
        const Tag = tag;
        return () => (
            <Tag data-scope={SCOPE} data-part={partName} class={props.class}>
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
    & Define.Slot<'default'>;

const TableRow = component<TableRowProps>(({ props, slots }) => {
    return () => (
        <tr
            data-scope={SCOPE}
            data-part="row"
            data-selected={dataAttr(props.selected)}
            class={props.class}
        >
            {slots.default?.()}
        </tr>
    );
}, { name: 'Table.Row' });

export type TableHeaderCellProps =
    /** Which axis this header labels — the native `<th scope>`; default `col`. */
    & Define.Prop<'scope', 'col' | 'row', false>
    & WithClass
    & Define.Slot<'default'>;

/** The `<th>` — carries no sorting today; `aria-sort` is the planned home. */
const TableHeaderCell = component<TableHeaderCellProps>(({ props, slots }) => {
    return () => (
        <th
            data-scope={SCOPE}
            data-part="header-cell"
            scope={props.scope ?? 'col'}
            class={props.class}
        >
            {slots.default?.()}
        </th>
    );
}, { name: 'Table.HeaderCell' });

const TableCell = component<TablePartProps>(({ props, slots }) => {
    return () => (
        <td data-scope={SCOPE} data-part="cell" class={props.class}>
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
