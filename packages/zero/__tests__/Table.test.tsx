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
import { signal } from 'sigx';
import { Table, tableAnatomy } from '@sigx/zero';
import { expectAnatomy } from './helpers';

const selector = (scope: string, name: string) => `[data-scope="${scope}"][data-part="${name}"]`;
const part = (c: HTMLElement, name: string) =>
    c.querySelector<HTMLElement>(selector('table', name))!;
const tick = () => new Promise((r) => setTimeout(r, 0));

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

    it('the scroll root is a keyboard stop, a region labelled by the caption (#270)', async () => {
        render(sample(), container);
        await tick();
        const root = part(container, 'root');
        // A table wider than its container must be scrollable without a
        // pointer (axe scrollable-region-focusable).
        expect(root.tabIndex).toBe(0);
        expect(root.getAttribute('role')).toBe('region');
        const caption = part(container, 'caption');
        expect(caption.id).not.toBe('');
        expect(root.getAttribute('aria-labelledby')).toBe(caption.id);
        expect(root.hasAttribute('aria-label')).toBe(false);
        expect(tableAnatomy.parts.root.flags).toEqual(['focus-visible']);
        expectAnatomy(container, tableAnatomy);
    });

    it('the region reference tracks the caption: gone with it, back with it', async () => {
        const state = signal({ caption: true });
        render(
            <Table.Root aria-label="Fallback">
                {() => (state.caption ? <Table.Caption>Revenue</Table.Caption> : null)}
                <Table.Body><Table.Row><Table.Cell>1</Table.Cell></Table.Row></Table.Body>
            </Table.Root>,
            container,
        );
        await tick();
        const root = part(container, 'root');
        expect(root.getAttribute('aria-labelledby')).toBe(part(container, 'caption').id);
        expect(root.hasAttribute('aria-label')).toBe(false);

        state.caption = false;
        await tick();
        // No dangling IDREF: the app's own name takes over.
        expect(root.hasAttribute('aria-labelledby')).toBe(false);
        expect(root.getAttribute('aria-label')).toBe('Fallback');
        expect(root.getAttribute('role')).toBe('region');

        state.caption = true;
        await tick();
        expect(root.getAttribute('aria-labelledby')).toBe(part(container, 'caption').id);
    });

    it('with no caption and no app name the root is focusable but no region', async () => {
        render(
            <Table.Root>
                <Table.Body><Table.Row><Table.Cell>1</Table.Cell></Table.Row></Table.Body>
            </Table.Root>,
            container,
        );
        await tick();
        const root = part(container, 'root');
        expect(root.tabIndex).toBe(0);
        // A nameless region is an axe violation — no role rather than that.
        expect(root.hasAttribute('role')).toBe(false);
        expect(root.hasAttribute('aria-labelledby')).toBe(false);
        expect(root.hasAttribute('aria-label')).toBe(false);
    });

    it('an app aria-labelledby names the region when there is no caption', async () => {
        render(
            <Table.Root aria-labelledby="heading">
                <Table.Body><Table.Row><Table.Cell>1</Table.Cell></Table.Row></Table.Body>
            </Table.Root>,
            container,
        );
        await tick();
        const root = part(container, 'root');
        expect(root.getAttribute('role')).toBe('region');
        expect(root.getAttribute('aria-labelledby')).toBe('heading');
        expect(part(container, 'table').getAttribute('aria-labelledby')).toBe('heading');
    });

    it('renders data-focus-visible for its own keyboard focus only', () => {
        render(
            <Table.Root>
                <Table.Body><Table.Row><Table.Cell><button type="button">Edit</button></Table.Cell></Table.Row></Table.Body>
            </Table.Root>,
            container,
        );
        const root = part(container, 'root');
        const restore = Element.prototype.matches;
        // happy-dom has no :focus-visible — report it for the focused element.
        Element.prototype.matches = function (this: Element, sel: string) {
            return sel === ':focus-visible' ? this === document.activeElement : restore.call(this, sel);
        } as Element['matches'];
        try {
            root.focus();
            expect(root.getAttribute('data-focus-visible')).toBe('');
            root.blur();
            expect(root.hasAttribute('data-focus-visible')).toBe(false);
            container.querySelector('button')!.focus();
            expect(root.hasAttribute('data-focus-visible')).toBe(false);
        } finally {
            Element.prototype.matches = restore;
        }
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

describe('Table column spec (#55)', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    const all = (name: string) => [...container.querySelectorAll<HTMLElement>(selector('table', name))];
    const columns = [
        { label: 'Time', width: '100px' },
        { label: 'What' },
        { key: 'age', label: 'Age', width: '60px', align: 'end' as const },
    ];

    it('renders the widths as a colgroup before the head, and the header row from the labels', () => {
        render(
            <Table.Root columns={columns}>
                <Table.Caption>History</Table.Caption>
                <Table.Head />
                <Table.Body>
                    <Table.Row>
                        <Table.Cell column={0}>09:12</Table.Cell>
                        <Table.Cell column={1}>Deployed</Table.Cell>
                        <Table.Cell column="age">3m</Table.Cell>
                    </Table.Row>
                </Table.Body>
            </Table.Root>,
            container,
        );
        expectAnatomy(container, tableAnatomy);
        const table = part(container, 'table');
        // The content model: caption, then colgroup, then thead.
        expect([...table.children].map((c) => c.tagName)).toEqual(['CAPTION', 'COLGROUP', 'THEAD', 'TBODY']);
        // A custom property, never a width literal — a responsive rule can
        // take it back without !important.
        const width = (c: HTMLElement) => c.style.getPropertyValue('--table-column-width');
        const align = (c: HTMLElement) => c.style.getPropertyValue('--table-cell-align');
        expect(all('column').map(width)).toEqual(['100px', '', '60px']);
        expect(all('header-cell').map((c) => c.textContent)).toEqual(['Time', 'What', 'Age']);
        expect(all('header-cell').map(align)).toEqual(['', '', 'end']);
        expect(all('cell').map(align)).toEqual(['', '', 'end']);
    });

    it('explicit head children win; a header cell naming its column defaults to the label', () => {
        render(
            <Table.Root columns={columns}>
                <Table.Head>
                    <Table.Row>
                        <Table.HeaderCell column={0}>When</Table.HeaderCell>
                        <Table.HeaderCell column={1} />
                        <Table.HeaderCell column="age" />
                    </Table.Row>
                </Table.Head>
            </Table.Root>,
            container,
        );
        expect(all('header-cell').map((c) => c.textContent)).toEqual(['When', 'What', 'Age']);
        expect(all('column')).toHaveLength(3);
    });

    it('renders no colgroup and no default row without a spec', () => {
        render(
            <Table.Root>
                <Table.Head />
                <Table.Body><Table.Row><Table.Cell>x</Table.Cell></Table.Row></Table.Body>
            </Table.Root>,
            container,
        );
        expect(all('colgroup')).toHaveLength(0);
        expect(all('header-cell')).toHaveLength(0);
        expect(part(container, 'cell').style.getPropertyValue('--table-cell-align')).toBe('');
    });

    it('throws on a column the spec does not have', () => {
        expect(() => render(
            <Table.Root columns={columns}>
                <Table.Body><Table.Row><Table.Cell column="size">x</Table.Cell></Table.Row></Table.Body>
            </Table.Root>,
            container,
        )).toThrow(/column "size" is not in Table.Root's columns/);
        expect(() => render(
            <Table.Root columns={columns}>
                <Table.Body><Table.Row><Table.Cell column={3}>x</Table.Cell></Table.Row></Table.Body>
            </Table.Root>,
            document.createElement('div'),
        )).toThrow(/column 3 is not in/);
    });
});

describe('Table stacked mode (#55)', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    const all = (name: string) => [...container.querySelectorAll<HTMLElement>(selector('table', name))];
    const columns = [{ label: 'Time' }, { label: 'What' }, { key: 'note' }];

    function stacked(stack?: string) {
        return (
            <Table.Root columns={columns} stack={stack}>
                <Table.Caption>History</Table.Caption>
                <Table.Head />
                <Table.Body>
                    <Table.Row>
                        <Table.Cell column={0}>09:12</Table.Cell>
                        <Table.Cell column={1}>Deployed <b>api</b></Table.Cell>
                        <Table.Cell column="note">—</Table.Cell>
                    </Table.Row>
                    <Table.Row>
                        <Table.Cell colSpan={3}>No more activity</Table.Cell>
                    </Table.Row>
                </Table.Body>
            </Table.Root>
        );
    }

    it('renders the breakpoint as the data-l-stack layout attribute on the root', () => {
        render(stacked('md'), container);
        expectAnatomy(container, tableAnatomy);
        expect(part(container, 'root').getAttribute('data-l-stack')).toBe('md');
        expect(tableAnatomy.parts.root.layout).toEqual(['stack']);
    });

    it('opens each cell naming a labelled column with an aria-hidden cell-label', () => {
        render(stacked('md'), container);
        const labels = all('cell-label');
        expect(labels.map((l) => l.textContent)).toEqual(['Time', 'What']);
        for (const label of labels) {
            expect(label.tagName).toBe('SPAN');
            expect(label.getAttribute('aria-hidden')).toBe('true');
            // First, so it hangs before the value whatever the value is.
            expect(label.parentElement!.firstChild).toBe(label);
        }
        // A column without a label, and a cell naming no column, print none.
        const cells = all('cell');
        expect(cells[2]!.querySelector(selector('table', 'cell-label'))).toBeNull();
        expect(cells[3]!.querySelector(selector('table', 'cell-label'))).toBeNull();
        // The value itself is untouched.
        expect(cells[1]!.textContent).toBe('WhatDeployed api');
    });

    it('restates the native table roles while it can stack, and an app role still wins', () => {
        render(stacked('md'), container);
        expect(part(container, 'table').getAttribute('role')).toBe('table');
        expect(part(container, 'caption').hasAttribute('role')).toBe(false);
        expect(part(container, 'head').getAttribute('role')).toBe('rowgroup');
        expect(part(container, 'body').getAttribute('role')).toBe('rowgroup');
        expect(all('row').map((r) => r.getAttribute('role'))).toEqual(['row', 'row', 'row']);
        expect(all('header-cell').map((c) => c.getAttribute('role'))).toEqual(['columnheader', 'columnheader', 'columnheader']);
        expect(all('cell').map((c) => c.getAttribute('role'))).toEqual(['cell', 'cell', 'cell', 'cell']);

        const other = document.createElement('div');
        render(
            <Table.Root stack="md" role="grid">
                <Table.Body>
                    <Table.Row role="presentation">
                        <Table.HeaderCell scope="row">Q1</Table.HeaderCell>
                        <Table.Cell role="gridcell">x</Table.Cell>
                    </Table.Row>
                </Table.Body>
            </Table.Root>,
            other,
        );
        expect(other.querySelector(selector('table', 'table'))!.getAttribute('role')).toBe('grid');
        expect(other.querySelector(selector('table', 'row'))!.getAttribute('role')).toBe('presentation');
        expect(other.querySelector(selector('table', 'header-cell'))!.getAttribute('role')).toBe('rowheader');
        expect(other.querySelector(selector('table', 'cell'))!.getAttribute('role')).toBe('gridcell');
    });

    it('without stack: no attribute, no labels, no restated roles', () => {
        render(stacked(), container);
        expect(part(container, 'root').hasAttribute('data-l-stack')).toBe(false);
        expect(all('cell-label')).toHaveLength(0);
        expect(part(container, 'table').hasAttribute('role')).toBe(false);
        expect(all('row').some((r) => r.hasAttribute('role'))).toBe(false);
    });

    it('refuses a value that cannot be a breakpoint name', () => {
        expect(() => render(stacked('Md'), document.createElement('div'))).toThrow(/"Md" is not a value of "stack"/);
        expect(() => render(stacked('base'), document.createElement('div'))).toThrow(/breakpoint name other than "base"/);
    });
});
