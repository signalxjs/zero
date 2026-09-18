/**
 * Table — semantic table anatomy over the real table elements (#340).
 *
 * The decisions pinned here:
 * - The ROOT IS THE SCROLL CONTAINER: a table is the one component whose
 *   natural content is wider than its container, and a `<table>` cannot be
 *   its own overflow box (`display: table` does not scroll), so the anatomy
 *   ships the wrapper — `root` (a `div` recipes give `overflow-x: auto`)
 *   containing the `table` part on a real `<table>`.
 * - Everything below renders the REAL table elements — caption/thead/tbody/
 *   tfoot/tr/th/td — because the elements are the semantics: AT table
 *   navigation (row/column walking, header association) only exists on a
 *   real table.
 * - Zebra striping and hover-highlight are design-system MODS
 *   (`data-mod-*`), not anatomy: they are per-instance styling choices from
 *   a skin's own vocabulary, with no machine lifecycle behind them.
 * - Sorting is OUT (follow-up): `header-cell` renders the `<th>` that would
 *   carry `aria-sort`, so the anatomy is ready without shipping dead parts.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { Table, tableAnatomy } from '@sigx/zero';
import { expectAnatomy } from './helpers';

const selector = (scope: string, name: string) => `[data-scope="${scope}"][data-part="${name}"]`;
const part = (c: HTMLElement, name: string) =>
    c.querySelector<HTMLElement>(selector('table', name))!;

function sample(selected = false) {
    return (
        <Table.Root color="neutral" size="sm">
            <Table.Caption>Quarterly revenue</Table.Caption>
            <Table.Head>
                <Table.Row>
                    <Table.HeaderCell>Quarter</Table.HeaderCell>
                    <Table.HeaderCell>Revenue</Table.HeaderCell>
                </Table.Row>
            </Table.Head>
            <Table.Body>
                <Table.Row selected={selected}>
                    <Table.Cell>Q1</Table.Cell>
                    <Table.Cell>$12,930</Table.Cell>
                </Table.Row>
            </Table.Body>
            <Table.Foot>
                <Table.Row>
                    <Table.Cell>Total</Table.Cell>
                    <Table.Cell>$12,930</Table.Cell>
                </Table.Row>
            </Table.Foot>
        </Table.Root>
    );
}

describe('Table', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('renders a valid anatomy over the real table elements', () => {
        render(sample(), container);
        expectAnatomy(container, tableAnatomy);
        // The elements ARE the semantics — AT row/column navigation and
        // header association only exist on a real table.
        expect(part(container, 'root').tagName).toBe('DIV');
        expect(part(container, 'table').tagName).toBe('TABLE');
        expect(part(container, 'caption').tagName).toBe('CAPTION');
        expect(part(container, 'head').tagName).toBe('THEAD');
        expect(part(container, 'body').tagName).toBe('TBODY');
        expect(part(container, 'foot').tagName).toBe('TFOOT');
        expect(part(container, 'row').tagName).toBe('TR');
        expect(part(container, 'header-cell').tagName).toBe('TH');
        expect(part(container, 'cell').tagName).toBe('TD');
    });

    it('the root is the scroll container, not the table', () => {
        // A `<table>` cannot be its own overflow box, so the anatomy ships
        // the wrapper: root (the div recipes give `overflow-x: auto`)
        // CONTAINS the table part. The axes ride the root — the compiler
        // anchors axis rules on the chain root.
        render(sample(), container);
        const root = part(container, 'root');
        const table = part(container, 'table');
        expect(root.contains(table)).toBe(true);
        expect(root).not.toBe(table);
        expect(root.getAttribute('data-color')).toBe('neutral');
        expect(root.getAttribute('data-size')).toBe('sm');
    });

    it('declares no states — a table has no machine lifecycle', () => {
        for (const name of tableAnatomy.partNames()) {
            expect(tableAnatomy.parts[name].states, `${name} must declare no states`).toBeUndefined();
        }
    });

    it('a row can carry the shared `selected` flag, presence-only', () => {
        render(sample(true), container);
        const rows = container.querySelectorAll(selector('table', 'row'));
        // The body row is selected; the head and foot rows are not.
        expect(rows[1]!.getAttribute('data-selected')).toBe('');
        expect(rows[0]!.hasAttribute('data-selected')).toBe(false);
        expect(rows[2]!.hasAttribute('data-selected')).toBe(false);
        expect(rows[1]!.getAttribute('aria-selected')).toBeNull();
    });

    it('header-cell is aria-sort-ready but ships no sorting', () => {
        // Sorting is a follow-up: the th exists so `aria-sort` has a home,
        // and nothing writes it today.
        render(sample(), container);
        expect(part(container, 'header-cell').hasAttribute('aria-sort')).toBe(false);
        expect(tableAnatomy.parts['header-cell'].element).toBe('th');
    });

    it('zebra and hover-highlight ride the mods bag, not the anatomy', () => {
        const c2 = document.createElement('div');
        document.body.appendChild(c2);
        render(
            <Table.Root mods={{ zebra: true, hover: true }}>
                <Table.Caption>Striped</Table.Caption>
                <Table.Body>
                    <Table.Row><Table.Cell>One</Table.Cell></Table.Row>
                </Table.Body>
            </Table.Root>,
            c2,
        );
        expectAnatomy(c2, tableAnatomy);
        const root = part(c2, 'root');
        expect(root.getAttribute('data-mod-zebra')).toBe('');
        expect(root.getAttribute('data-mod-hover')).toBe('');
    });
});
