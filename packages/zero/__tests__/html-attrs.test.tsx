/**
 * The attribute pass-through (#49).
 *
 * sigx hands a component every prop, but nothing reaches the element unless
 * the part puts it there — so an `aria-label` on `Button.Root` used to
 * compile (TypeScript never flags a hyphenated JSX attribute) and vanish.
 * Pinned here: `htmlAttrs` forwards `aria-*`, the app's `data-*`, `id`,
 * `title` and `role`; the contract's own `data-*` throws; the part's own
 * attributes win where both set one; and the parts the issue named forward.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { component, signal } from 'sigx';
import {
    Button, Card, Table,
    htmlAttrs, RESERVED_DATA_ATTRS, FLAG_VOCABULARY, LAYOUT_ATTR_PREFIX, MOD_ATTR_PREFIX,
} from '@sigx/zero';

describe('htmlAttrs', () => {
    it('forwards aria-*, data-*, id, title and role — nothing else', () => {
        expect(htmlAttrs({
            'aria-label': 'Close',
            'aria-busy': true,
            'data-row-id': 3,
            id: 'x',
            title: 't',
            role: 'region',
            class: 'c',
            onClick: () => {},
            disabled: true,
            children: [],
        })).toEqual({
            'aria-label': 'Close',
            'aria-busy': 'true',
            'data-row-id': 3,
            id: 'x',
            title: 't',
            role: 'region',
        });
    });

    it('skips an undefined value before the reserved guard', () => {
        expect(htmlAttrs({ 'aria-label': undefined, 'data-state': undefined })).toEqual({});
    });

    it.each([
        'data-scope', 'data-part', 'data-state', 'data-orientation', 'data-placement',
        'data-color', 'data-size', 'data-variant', 'data-disabled', 'data-focus-visible',
        'data-mod-block', 'data-l-gap', 'data-l-md-gap',
    ])('throws on the contract-owned %s', (name) => {
        expect(() => htmlAttrs({ [name]: 'x' })).toThrow(/anatomy contract/);
    });

    it.each([[{}], [null], [() => 'x'], [Symbol('s')]])('throws on a value an attribute cannot carry: %s', (value) => {
        expect(() => htmlAttrs({ 'aria-label': value })).toThrow(/string, number or boolean/);
    });

    it('takes only a string for id, title and role', () => {
        expect(() => htmlAttrs({ id: 3 })).toThrow(/expected a string/);
        expect(() => htmlAttrs({ role: true })).toThrow(/expected a string/);
    });

    it('renders an aria-* boolean as its token, keeps a data-* boolean', () => {
        expect(htmlAttrs({ 'aria-expanded': false, 'aria-busy': true, 'data-open': true }))
            .toEqual({ 'aria-expanded': 'false', 'aria-busy': 'true', 'data-open': true });
    });

    it('reserves every flag, and restates the layout and mod prefixes honestly', () => {
        for (const flag of FLAG_VOCABULARY) expect(RESERVED_DATA_ATTRS.has(`data-${flag}`)).toBe(true);
        // html-attrs.ts restates the layout prefix rather than importing it.
        expect(() => htmlAttrs({ [`${LAYOUT_ATTR_PREFIX}gap`]: 'md' })).toThrow();
        expect(() => htmlAttrs({ [`${MOD_ATTR_PREFIX}x`]: '' })).toThrow();
    });
});

describe('forwarding parts', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    const q = (scope: string, part: string) =>
        container.querySelector<HTMLElement>(`[data-scope="${scope}"][data-part="${part}"]`)!;

    it('Button.Root: aria-*, data-*, id, title and the form attributes', () => {
        render(
            <Button.Root
                aria-label="Close" aria-describedby="hint" data-testid="close" id="close" title="Close it"
                type="submit" form="settings" name="intent" value="close"
            >×</Button.Root>,
            container,
        );
        const el = q('button', 'root') as HTMLButtonElement;
        expect(el.getAttribute('aria-label')).toBe('Close');
        expect(el.getAttribute('aria-describedby')).toBe('hint');
        expect(el.getAttribute('data-testid')).toBe('close');
        expect(el.id).toBe('close');
        expect(el.title).toBe('Close it');
        expect(el.getAttribute('form')).toBe('settings');
        expect(el.name).toBe('intent');
        expect(el.value).toBe('close');
    });

    it('Button.Root: forwarded attributes ride the asChild bag', () => {
        render(
            <Button.Root asChild aria-label="Docs" data-testid="docs">
                {(p: Record<string, unknown>) => <a href="/docs" {...p}>?</a>}
            </Button.Root>,
            container,
        );
        const el = q('button', 'root');
        expect(el.tagName).toBe('A');
        expect(el.getAttribute('aria-label')).toBe('Docs');
        expect(el.getAttribute('data-testid')).toBe('docs');
    });

    it("Button.Root: the part's own attribute wins, an app's survives where the part sets none", () => {
        render(
            <Button.Root asChild disabled aria-disabled="false">
                {(p: Record<string, unknown>) => <a href="/docs" {...p}>Docs</a>}
            </Button.Root>,
            container,
        );
        expect(q('button', 'root').getAttribute('aria-disabled')).toBe('true');
        container.innerHTML = '';
        render(<Button.Root aria-disabled="true">Save</Button.Root>, container);
        expect(q('button', 'root').getAttribute('aria-disabled')).toBe('true');
    });

    it('Button.Root: a forwarded attribute follows its value', () => {
        const state = signal({ label: 'Save' });
        const App = component(() => () => <Button.Root aria-label={state.label}>✓</Button.Root>);
        render(<App />, container);
        expect(q('button', 'root').getAttribute('aria-label')).toBe('Save');
        state.label = 'Saved';
        expect(q('button', 'root').getAttribute('aria-label')).toBe('Saved');
    });

    it('Button.Root: a reserved data-* throws (the untyped caller — TS refuses it)', () => {
        const attrs: Record<string, unknown> = { 'data-state': 'open' };
        expect(() => render(<Button.Root {...attrs}>x</Button.Root>, container)).toThrow(/anatomy contract/);
    });

    it('Table: rows and cells forward, cells span, aria names the <table>', () => {
        render(
            <Table.Root aria-label="History" role="grid" data-testid="history" id="t">
                <Table.Head>
                    <Table.Row><Table.HeaderCell colSpan={2} id="h">When</Table.HeaderCell></Table.Row>
                </Table.Head>
                <Table.Body data-section="days">
                    <Table.Row data-day-row="mon" aria-rowindex={2}>
                        <Table.Cell colSpan={2} rowSpan={1} title="Monday">Mon</Table.Cell>
                    </Table.Row>
                </Table.Body>
            </Table.Root>,
            container,
        );
        const root = q('table', 'root');
        expect(root.id).toBe('t');
        expect(root.getAttribute('data-testid')).toBe('history');
        // aria-label on the scroll wrapper would name a generic div; the
        // table is what AT reads.
        expect(root.hasAttribute('aria-label')).toBe(false);
        expect(root.hasAttribute('role')).toBe(false);
        expect(q('table', 'table').getAttribute('aria-label')).toBe('History');
        expect(q('table', 'table').getAttribute('role')).toBe('grid');
        expect(q('table', 'body').getAttribute('data-section')).toBe('days');
        const row = container.querySelector<HTMLElement>('[data-day-row="mon"]')!;
        expect(row.getAttribute('data-part')).toBe('row');
        expect(row.getAttribute('aria-rowindex')).toBe('2');
        const cell = q('table', 'cell') as HTMLTableCellElement;
        expect(cell.colSpan).toBe(2);
        expect(cell.rowSpan).toBe(1);
        expect(cell.title).toBe('Monday');
        const th = q('table', 'header-cell') as HTMLTableCellElement;
        expect(th.colSpan).toBe(2);
        expect(th.id).toBe('h');
    });

    it('Card: role/aria on the root, and asChild renders the element a named card is', () => {
        render(
            <Card.Root role="region" aria-labelledby="t" data-testid="report">
                <Card.Title id="t">Report</Card.Title>
            </Card.Root>,
            container,
        );
        const root = q('card', 'root');
        expect(root.getAttribute('role')).toBe('region');
        expect(root.getAttribute('aria-labelledby')).toBe('t');
        expect(root.getAttribute('data-testid')).toBe('report');
        expect(q('card', 'title').id).toBe('t');

        container.innerHTML = '';
        render(
            <Card.Root asChild variant="outline">
                {(p: Record<string, unknown>) => <article aria-labelledby="t2" {...p}>Body</article>}
            </Card.Root>,
            container,
        );
        const article = q('card', 'root');
        expect(article.tagName).toBe('ARTICLE');
        expect(article.getAttribute('data-variant')).toBe('outline');
        expect(article.getAttribute('aria-labelledby')).toBe('t2');
    });
});
