/**
 * The navigation tier (#339): navbar, breadcrumbs, pagination — the
 * ContentSweep mould for the behavior tier's light half. Steps and Drawer
 * carry real machinery and live in their own files (`Steps.test.tsx`,
 * `Drawer.test.tsx`); what is asserted here is anatomy, semantics and the
 * one value model (Pagination's page number).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import type { PartProps } from '@sigx/zero';
import { Breadcrumbs, breadcrumbsAnatomy, Navbar, navbarAnatomy, Pagination, paginationAnatomy } from '@sigx/zero';
import { signal } from 'sigx';
import { expectAnatomy } from './helpers';

const selector = (scope: string, name: string) => `[data-scope="${scope}"][data-part="${name}"]`;

/** The part, asserted present — for the cases that go on to read it. */
const part = (c: HTMLElement, scope: string, name: string) =>
    c.querySelector<HTMLElement>(selector(scope, name))!;

describe('Navbar', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('renders a valid anatomy on a <header> landmark', () => {
        render(
            <Navbar.Root>
                <Navbar.Start>Logo</Navbar.Start>
                <Navbar.Center>Search</Navbar.Center>
                <Navbar.End>Actions</Navbar.End>
            </Navbar.Root>,
            container,
        );
        expectAnatomy(container, navbarAnatomy);
        const root = part(container, 'navbar', 'root');
        // <header>, not <nav>: the bar is page furniture that routinely holds
        // non-navigation content (branding, search, actions). Wrapping all of
        // it in a navigation landmark would mislabel most of it — the <nav>
        // belongs around the actual link set the consumer puts INSIDE a
        // section.
        expect(root.tagName).toBe('HEADER');
        expect(part(container, 'navbar', 'start').textContent).toBe('Logo');
        expect(part(container, 'navbar', 'center').textContent).toBe('Search');
        expect(part(container, 'navbar', 'end').textContent).toBe('Actions');
    });

    it('sections are optional — a bar with only a start renders cleanly', () => {
        render(
            <Navbar.Root>
                <Navbar.Start>Logo</Navbar.Start>
            </Navbar.Root>,
            container,
        );
        expectAnatomy(container, navbarAnatomy);
        expect(container.querySelector(selector('navbar', 'center'))).toBeNull();
        expect(container.querySelector(selector('navbar', 'end'))).toBeNull();
    });

    it('declares no states and no flags — a bar has no lifecycle', () => {
        for (const name of navbarAnatomy.partNames()) {
            expect(navbarAnatomy.parts[name].states).toBeUndefined();
            expect(navbarAnatomy.parts[name].flags).toBeUndefined();
        }
    });

    it('passes the variant axes through on the root', () => {
        render(
            <Navbar.Root color="primary" size="lg">
                <Navbar.Start>Logo</Navbar.Start>
            </Navbar.Root>,
            container,
        );
        const root = part(container, 'navbar', 'root');
        expect(root.getAttribute('data-color')).toBe('primary');
        expect(root.getAttribute('data-size')).toBe('lg');
        expectAnatomy(container, navbarAnatomy);
    });
});

describe('Breadcrumbs', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    const trail = () => (
        <Breadcrumbs.Root>
            <Breadcrumbs.List>
                <Breadcrumbs.Item>
                    <Breadcrumbs.Link href="/">Home</Breadcrumbs.Link>
                    <Breadcrumbs.Separator />
                </Breadcrumbs.Item>
                <Breadcrumbs.Item>
                    <Breadcrumbs.Link href="/docs">Docs</Breadcrumbs.Link>
                    <Breadcrumbs.Separator />
                </Breadcrumbs.Item>
                <Breadcrumbs.Item>
                    <Breadcrumbs.Link href="/docs/anatomy" current>Anatomy</Breadcrumbs.Link>
                </Breadcrumbs.Item>
            </Breadcrumbs.List>
        </Breadcrumbs.Root>
    );

    it('renders the APG breadcrumb shape: labelled <nav> around an <ol>', () => {
        render(trail(), container);
        expectAnatomy(container, breadcrumbsAnatomy);
        const root = part(container, 'breadcrumbs', 'root');
        // The APG breadcrumb pattern is a navigation landmark named
        // "Breadcrumb" wrapping an ordered list — order is the meaning here
        // (the trail runs from the root of the hierarchy to the current
        // page), which is what <ol> announces and <ul> would not.
        expect(root.tagName).toBe('NAV');
        expect(root.getAttribute('aria-label')).toBe('Breadcrumb');
        expect(part(container, 'breadcrumbs', 'list').tagName).toBe('OL');
        const items = container.querySelectorAll(selector('breadcrumbs', 'item'));
        expect(items).toHaveLength(3);
        expect(items[0]!.tagName).toBe('LI');
    });

    it('the label prop renames the landmark', () => {
        render(
            <Breadcrumbs.Root label="Brödsmulor">
                <Breadcrumbs.List>
                    <Breadcrumbs.Item>
                        <Breadcrumbs.Link href="/" current>Hem</Breadcrumbs.Link>
                    </Breadcrumbs.Item>
                </Breadcrumbs.List>
            </Breadcrumbs.Root>,
            container,
        );
        expect(part(container, 'breadcrumbs', 'root').getAttribute('aria-label')).toBe('Brödsmulor');
    });

    it('marks the current page with aria-current="page" and the activation state', () => {
        render(trail(), container);
        const links = [...container.querySelectorAll<HTMLElement>(selector('breadcrumbs', 'link'))];
        expect(links).toHaveLength(3);
        // `current`, not a new flag: `data-current` is not in FLAG_VOCABULARY
        // and the synonym table maps current → active, so the governed
        // spelling is the activation pair — one link active, the rest
        // inactive, exactly tabs' shape.
        expect(links[2]!.getAttribute('aria-current')).toBe('page');
        expect(links[2]!.getAttribute('data-state')).toBe('active');
        for (const link of links.slice(0, 2)) {
            expect(link.hasAttribute('aria-current')).toBe(false);
            expect(link.getAttribute('data-state')).toBe('inactive');
        }
    });

    it('hides the separator from assistive tech, with a replaceable glyph', () => {
        render(trail(), container);
        const separators = [...container.querySelectorAll<HTMLElement>(selector('breadcrumbs', 'separator'))];
        expect(separators).toHaveLength(2);
        for (const sep of separators) {
            // The separator is punctuation for the eye; the list structure
            // already separates the items for the ear.
            expect(sep.getAttribute('aria-hidden')).toBe('true');
            expect(sep.textContent).toBe('/');
        }

        const custom = document.createElement('div');
        document.body.appendChild(custom);
        render(
            <Breadcrumbs.Root>
                <Breadcrumbs.List>
                    <Breadcrumbs.Item>
                        <Breadcrumbs.Link href="/">Home</Breadcrumbs.Link>
                        <Breadcrumbs.Separator>→</Breadcrumbs.Separator>
                    </Breadcrumbs.Item>
                    <Breadcrumbs.Item>
                        <Breadcrumbs.Link href="/a" current>A</Breadcrumbs.Link>
                    </Breadcrumbs.Item>
                </Breadcrumbs.List>
            </Breadcrumbs.Root>,
            custom,
        );
        expect(part(custom, 'breadcrumbs', 'separator').textContent).toBe('→');
        expectAnatomy(custom, breadcrumbsAnatomy);
    });

    it('asChild hands the link contract to the consumer element — href included', () => {
        render(
            <Breadcrumbs.Root>
                <Breadcrumbs.List>
                    <Breadcrumbs.Item>
                        <Breadcrumbs.Link href="/docs" asChild>
                            {(p: PartProps) => <a {...p}>Docs</a>}
                        </Breadcrumbs.Link>
                        <Breadcrumbs.Separator />
                    </Breadcrumbs.Item>
                    <Breadcrumbs.Item>
                        <Breadcrumbs.Link current asChild>
                            {(p: PartProps) => <span {...p}>Here</span>}
                        </Breadcrumbs.Link>
                    </Breadcrumbs.Item>
                </Breadcrumbs.List>
            </Breadcrumbs.Root>,
            container,
        );
        const links = [...container.querySelectorAll<HTMLElement>(selector('breadcrumbs', 'link'))];
        // The bag carries everything the built-in <a> would have, href
        // included — a consumer's own anchor keeps the destination without
        // restating it.
        expect(links[0]!.tagName).toBe('A');
        expect(links[0]!.getAttribute('href')).toBe('/docs');
        const current = links[1]!;
        expect(current.tagName).toBe('SPAN');
        expect(current.getAttribute('aria-current')).toBe('page');
        expect(current.getAttribute('data-state')).toBe('active');
        expectAnatomy(container, breadcrumbsAnatomy);
    });

    it('passes the variant axes through on the root', () => {
        render(
            <Breadcrumbs.Root color="primary" size="sm">
                <Breadcrumbs.List>
                    <Breadcrumbs.Item>
                        <Breadcrumbs.Link href="/" current>Home</Breadcrumbs.Link>
                    </Breadcrumbs.Item>
                </Breadcrumbs.List>
            </Breadcrumbs.Root>,
            container,
        );
        const root = part(container, 'breadcrumbs', 'root');
        expect(root.getAttribute('data-color')).toBe('primary');
        expect(root.getAttribute('data-size')).toBe('sm');
    });
});

describe('Pagination', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    /** The rendered page row, as button texts with '…' for ellipses. */
    const rowText = (c: HTMLElement): string[] =>
        [...c.querySelectorAll<HTMLElement>(
            `${selector('pagination', 'item')}, ${selector('pagination', 'ellipsis')}`,
        )].map((el) => (el.getAttribute('data-part') === 'ellipsis' ? '…' : el.textContent!));

    it('renders a labelled nav of page buttons with a valid anatomy', () => {
        render(<Pagination.Root count={3} />, container);
        expectAnatomy(container, paginationAnatomy);
        const root = part(container, 'pagination', 'root');
        expect(root.tagName).toBe('NAV');
        expect(root.getAttribute('aria-label')).toBe('Pagination');
        const items = [...container.querySelectorAll<HTMLElement>(selector('pagination', 'item'))];
        expect(items.map((i) => i.textContent)).toEqual(['1', '2', '3']);
        for (const item of items) expect(item.tagName).toBe('BUTTON');
        // Ordinary buttons in a nav landmark — no roving tabindex. There is
        // no APG pagination pattern; each page is a distinct, meaningful tab
        // stop exactly like any other button row, and prev/next bracket them.
        for (const item of items) expect(item.tabIndex).toBe(0);
    });

    it('windows the middle with ellipses: sibling and boundary counts', () => {
        render(<Pagination.Root count={10} defaultPage={5} />, container);
        expect(rowText(container)).toEqual(['1', '…', '4', '5', '6', '…', '10']);
        expectAnatomy(container, paginationAnatomy);
        // The ellipsis is punctuation, not a control.
        const ellipsis = part(container, 'pagination', 'ellipsis');
        expect(ellipsis.getAttribute('aria-hidden')).toBe('true');
    });

    it('keeps a constant row width at the edges', () => {
        render(<Pagination.Root count={10} defaultPage={1} />, container);
        // Page 1 shows as many leading pages as page 5 shows around itself
        // (seven entries in both rows), so the row does not jump width as
        // the user walks it — the sibling block slides instead of shrinking.
        expect(rowText(container)).toEqual(['1', '2', '3', '4', '5', '…', '10']);
    });

    it('marks the current page with aria-current="page" and the activation state', () => {
        render(<Pagination.Root count={5} defaultPage={2} />, container);
        const items = [...container.querySelectorAll<HTMLElement>(selector('pagination', 'item'))];
        expect(items[1]!.getAttribute('aria-current')).toBe('page');
        expect(items[1]!.getAttribute('data-state')).toBe('active');
        for (const other of [items[0]!, ...items.slice(2)]) {
            expect(other.hasAttribute('aria-current')).toBe(false);
            expect(other.getAttribute('data-state')).toBe('inactive');
        }
    });

    it('clicking a page moves the model; prev/next step it', () => {
        const state = signal({ page: 1 });
        render(<Pagination.Root count={5} model={[state, 'page']} />, container);
        const items = [...container.querySelectorAll<HTMLElement>(selector('pagination', 'item'))];
        items[2]!.click();
        expect(state.page).toBe(3);
        part(container, 'pagination', 'next-trigger').click();
        expect(state.page).toBe(4);
        part(container, 'pagination', 'prev-trigger').click();
        expect(state.page).toBe(3);
    });

    it('disables prev at the first page and next at the last', () => {
        const state = signal({ page: 1 });
        render(<Pagination.Root count={3} model={[state, 'page']} />, container);
        const prev = part(container, 'pagination', 'prev-trigger') as HTMLButtonElement;
        const next = part(container, 'pagination', 'next-trigger') as HTMLButtonElement;
        expect(prev.disabled).toBe(true);
        expect(prev.getAttribute('data-disabled')).toBe('');
        expect(next.disabled).toBe(false);
        prev.click();
        expect(state.page).toBe(1);

        state.page = 3;
        expect(next.disabled).toBe(true);
        expect(next.getAttribute('data-disabled')).toBe('');
        expect(prev.disabled).toBe(false);
        next.click();
        expect(state.page).toBe(3);
        expectAnatomy(container, paginationAnatomy);
    });

    it('clamps consumer numbers to whole pages in range', () => {
        // A float or NaN would render fractional page labels and unstable
        // keys (review finding, pinned): every number is floored and
        // clamped at its source.
        render(<Pagination.Root count={5.9} defaultPage={2.5} siblingCount={1.5} />, container);
        const items = [...container.querySelectorAll<HTMLElement>(selector('pagination', 'item'))];
        expect(items.map((i) => i.textContent)).toEqual(['1', '2', '3', '4', '5']);
        expect(items[1]!.getAttribute('data-state')).toBe('active');
    });

    it('names the triggers for assistive tech, localizably', () => {
        render(<Pagination.Root count={3} prevLabel="Föregående" nextLabel="Nästa" label="Sidor" />, container);
        expect(part(container, 'pagination', 'root').getAttribute('aria-label')).toBe('Sidor');
        expect(part(container, 'pagination', 'prev-trigger').getAttribute('aria-label')).toBe('Föregående');
        expect(part(container, 'pagination', 'next-trigger').getAttribute('aria-label')).toBe('Nästa');
    });

    it('passes the variant axes through on the root', () => {
        render(<Pagination.Root count={2} color="primary" size="sm" />, container);
        const root = part(container, 'pagination', 'root');
        expect(root.getAttribute('data-color')).toBe('primary');
        expect(root.getAttribute('data-size')).toBe('sm');
    });
});
