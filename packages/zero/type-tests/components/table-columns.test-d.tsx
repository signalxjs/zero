/**
 * Table's column spec (#55) against the REAL parts: `columns` on Root, and a
 * cell names its column by index or key.
 */
import { Table } from '@sigx/zero';
import type { TableColumn } from '@sigx/zero';

const columns: TableColumn[] = [{ label: 'Time', width: '100px' }, { key: 'age', label: 'Age', align: 'end' }];

// ── valid ──
export const spec = (
    <Table.Root columns={columns}>
        <Table.Head />
        <Table.Body><Table.Row><Table.Cell column={0}>09:12</Table.Cell><Table.Cell column="age">3m</Table.Cell></Table.Row></Table.Body>
    </Table.Root>
);
export const header = <Table.HeaderCell column="age" />;

// ── invalid ──
// @ts-expect-error — alignment is start, center or end
export const e1: TableColumn = { align: 'right' };
// @ts-expect-error — a column is named by index or key
export const e2 = <Table.Cell column={true}>x</Table.Cell>;

// ── stacked mode (#55): a breakpoint name, never a record ──
export const stacked = <Table.Root stack="md" columns={columns}><Table.Head /></Table.Root>;
// @ts-expect-error — `stack` names one breakpoint; it does not vary per breakpoint
export const e3 = <Table.Root stack={{ md: 'md' }} />;
