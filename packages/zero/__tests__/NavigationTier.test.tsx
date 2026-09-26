/**
 * The navigation tier (#339): navbar, breadcrumbs, pagination — the
 * ContentSweep mould for the behavior tier's light half. Steps and Drawer
 * carry real machinery and live in their own files (`Steps.test.tsx`,
 * `Drawer.test.tsx`); what is asserted here is anatomy, semantics and the
 * one value model (Pagination's page number).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@sigx/runtime-dom';
import type { PartProps } from '@sigx/zero';
import { Badge, Breadcrumbs, breadcrumbsAnatomy, Menu, Navbar, navbarAnatomy, NavList, navListAnatomy, Pagination, paginationAnatomy, useBreadcrumbsContext } from '@sigx/zero';
import { component, signal } from 'sigx';
import type { JSXElement } from 'sigx';
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

describe('NavList (#132)', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    function mount(current: string) {
        render(
            <NavList.Root label="Main" color="primary">
                <NavList.Group>
                    <NavList.Heading>Workspace</NavList.Heading>
                    <NavList.List>
                        <NavList.Item>
                            <NavList.Link href="/inbox" current={current === '/inbox'}>
                                <NavList.Icon>✉</NavList.Icon>
                                Inbox
                                <NavList.Meta><Badge>12</Badge></NavList.Meta>
                            </NavList.Link>
                        </NavList.Item>
                        <NavList.Item>
                            <NavList.Link href="/sent" current={current === '/sent'}>Sent</NavList.Link>
                        </NavList.Item>
                    </NavList.List>
                </NavList.Group>
                <NavList.List>
                    <NavList.Item>
                        <NavList.Link asChild current={current === '/settings'}>
                            {(p: PartProps) => <a href="/settings" {...p}>Settings</a>}
                        </NavList.Link>
                    </NavList.Item>
                </NavList.List>
            </NavList.Root>,
            container,
        );
    }

    it('is a named navigation landmark over lists, with the current page as the active link', () => {
        mount('/inbox');
        expectAnatomy(container, navListAnatomy);
        const root = part(container, 'nav-list', 'root');
        expect(root.tagName).toBe('NAV');
        expect(root.getAttribute('aria-label')).toBe('Main');
        expect(root.getAttribute('data-color')).toBe('primary');
        const links = [...container.querySelectorAll('[data-scope="nav-list"][data-part="link"]')];
        expect(links.map((l) => l.getAttribute('data-state'))).toEqual(['active', 'inactive', 'inactive']);
        expect(links.map((l) => l.getAttribute('aria-current'))).toEqual(['page', null, null]);
        // Breadcrumbs' rule: the current page is the activation STATE, never a flag.
        expect(links[0]!.hasAttribute('data-current')).toBe(false);
    });

    it('a group is named by its heading, ids wired without the consumer', async () => {
        mount('/sent');
        // The reference is written a microtask after the heading mounts.
        await new Promise((r) => setTimeout(r, 0));
        const group = part(container, 'nav-list', 'group');
        const heading = part(container, 'nav-list', 'heading');
        expect(group.getAttribute('role')).toBe('group');
        expect(heading.id).toBeTruthy();
        expect(group.getAttribute('aria-labelledby')).toBe(heading.id);
    });

    it('a group without a heading references nothing — no dangling aria-labelledby', async () => {
        render(
            <NavList.Root label="Main">
                <NavList.Group aria-label="Pinned">
                    <NavList.List><NavList.Item><NavList.Link href="/a">A</NavList.Link></NavList.Item></NavList.List>
                </NavList.Group>
                <NavList.Group>
                    <NavList.List><NavList.Item><NavList.Link href="/b">B</NavList.Link></NavList.Item></NavList.List>
                </NavList.Group>
            </NavList.Root>,
            container,
        );
        await new Promise((r) => setTimeout(r, 0));
        const groups = container.querySelectorAll('[data-scope="nav-list"][data-part="group"]');
        expect(groups[0]!.getAttribute('aria-label')).toBe('Pinned');
        expect(groups[0]!.hasAttribute('aria-labelledby')).toBe(false);
        expect(groups[1]!.hasAttribute('aria-labelledby')).toBe(false);
        expectAnatomy(container, navListAnatomy);
    });

    it('the icon is decorative, meta holds a composed Badge, and asChild keeps the router\'s anchor', () => {
        mount('/settings');
        expect(part(container, 'nav-list', 'icon').getAttribute('aria-hidden')).toBe('true');
        expect(part(container, 'nav-list', 'meta').querySelector('[data-scope="badge"]')).not.toBeNull();
        const settings = [...container.querySelectorAll('[data-scope="nav-list"][data-part="link"]')].at(-1)!;
        expect(settings.tagName).toBe('A');
        expect(settings.getAttribute('href')).toBe('/settings');
        expect(settings.getAttribute('data-state')).toBe('active');
        expect(settings.getAttribute('aria-current')).toBe('page');
    });

    it('server-renders the landmark, the group name and the current link', async () => {
        const { defineApp } = await import('sigx');
        const { renderToString } = await import('@sigx/server-renderer');
        const { zeroPlugin } = await import('@sigx/zero');
        const app = defineApp(
            <NavList.Root label="Main">
                <NavList.Group>
                    <NavList.Heading>Workspace</NavList.Heading>
                    <NavList.List><NavList.Item><NavList.Link href="/inbox" current>Inbox</NavList.Link></NavList.Item></NavList.List>
                </NavList.Group>
            </NavList.Root>,
        );
        app.use(zeroPlugin());
        const html = await renderToString(app);
        expect(html).toMatch(/<nav[^>]*aria-label="Main"[^>]*data-scope="nav-list"/);
        expect(html).toMatch(/role="group"/);
        // The group's name is written once the heading has mounted (a
        // microtask after, on the client); the server render never writes a
        // reference that could dangle, so any it does write must resolve.
        for (const [, id] of html.matchAll(/aria-labelledby="([^"]+)"/g)) expect(html).toContain(`id="${id}"`);
        expect(html).toMatch(/<div[^>]*id="zx-nav-list-heading[^"]*"[^>]*data-part="heading"/);
        expect(html).toMatch(/<a[^>]*data-part="link"[^>]*data-state="active"[^>]*aria-current="page"/);
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

describe('Breadcrumbs collapse (#295)', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    const NAMES = ['Home', 'Docs', 'Components', 'Navigation', 'Breadcrumbs'];

    /** Five crumbs with the ellipsis after `ellipsisAfter` leading items. */
    const trail = (root: Record<string, unknown> = {}, ellipsisAfter = 1, trigger?: () => JSXElement) => {
        const crumbs = NAMES.map((name, i) => (
            <Breadcrumbs.Item>
                <Breadcrumbs.Link href={`/${i}`} current={i === NAMES.length - 1}>{name}</Breadcrumbs.Link>
                {i < NAMES.length - 1 ? <Breadcrumbs.Separator /> : null}
            </Breadcrumbs.Item>
        ));
        const ellipsis = (
            <Breadcrumbs.Ellipsis>
                {trigger ? trigger() : <Breadcrumbs.EllipsisTrigger />}
                <Breadcrumbs.Separator />
            </Breadcrumbs.Ellipsis>
        );
        return (
            <Breadcrumbs.Root {...root}>
                <Breadcrumbs.List>
                    {[...crumbs.slice(0, ellipsisAfter), ellipsis, ...crumbs.slice(ellipsisAfter)]}
                </Breadcrumbs.List>
            </Breadcrumbs.Root>
        );
    };

    const items = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>(selector('breadcrumbs', 'item'))];
    /** The crumbs a sighted user sees, '…' for an open ellipsis. */
    const visible = (c: HTMLElement): string[] =>
        [...c.querySelectorAll<HTMLElement>(`${selector('breadcrumbs', 'item')}, ${selector('breadcrumbs', 'ellipsis')}`)]
            .filter((el) => !el.hidden)
            .map((el) => (el.getAttribute('data-part') === 'ellipsis' ? '…' : el.querySelector('a')!.textContent!));
    const flush = () => new Promise<void>((r) => setTimeout(r, 0));

    it('without maxItems nothing collapses: every item open, the ellipsis hidden', () => {
        render(trail(), container);
        expect(visible(container)).toEqual(NAMES);
        for (const item of items(container)) {
            expect(item.getAttribute('data-state')).toBe('open');
            expect(item.hasAttribute('hidden')).toBe(false);
        }
        const ellipsis = part(container, 'breadcrumbs', 'ellipsis');
        expect(ellipsis.tagName).toBe('LI');
        expect(ellipsis.getAttribute('data-state')).toBe('closed');
        expect(ellipsis.hidden).toBe(true);
        expectAnatomy(container, breadcrumbsAnatomy);
    });

    it('maxItems hides the middle items behind an open ellipsis', () => {
        render(trail({ maxItems: 3 }), container);
        expect(visible(container)).toEqual(['Home', '…', 'Breadcrumbs']);
        const all = items(container);
        for (const hidden of all.slice(1, 4)) {
            expect(hidden.hidden).toBe(true);
            expect(hidden.getAttribute('data-state')).toBe('closed');
            // The item's own separator sits inside it and hides with it.
            expect(hidden.querySelector(selector('breadcrumbs', 'separator'))).not.toBeNull();
        }
        const ellipsis = part(container, 'breadcrumbs', 'ellipsis');
        expect(ellipsis.getAttribute('data-state')).toBe('open');
        expect(ellipsis.hidden).toBe(false);
        const trigger = part(container, 'breadcrumbs', 'ellipsis-trigger');
        expect(trigger.tagName).toBe('BUTTON');
        expect(trigger.getAttribute('type')).toBe('button');
        expect(trigger.getAttribute('aria-label')).toBe('Show 3 more breadcrumbs');
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
        expect(trigger.textContent).toBe('…');
        expectAnatomy(container, breadcrumbsAnatomy);
    });

    it('does not collapse at or under maxItems', () => {
        render(trail({ maxItems: 5 }), container);
        expect(visible(container)).toEqual(NAMES);
        expect(part(container, 'breadcrumbs', 'ellipsis').hidden).toBe(true);
    });

    it('itemsBeforeCollapse / itemsAfterCollapse choose the kept ends', () => {
        render(trail({ maxItems: 4, itemsBeforeCollapse: 2, itemsAfterCollapse: 2 }, 2), container);
        expect(visible(container)).toEqual(['Home', 'Docs', '…', 'Navigation', 'Breadcrumbs']);
        expect(part(container, 'breadcrumbs', 'ellipsis-trigger').getAttribute('aria-label')).toBe('Show 1 more breadcrumbs');
    });

    it('invalid counts fall back instead of throwing or over-collapsing', () => {
        // NaN kept ends take their defaults (1 and 1) rather than reaching
        // Array.from as an invalid length.
        render(trail({ maxItems: 3, itemsBeforeCollapse: Number.NaN, itemsAfterCollapse: Number.NaN }), container);
        expect(visible(container)).toEqual(['Home', '…', 'Breadcrumbs']);
        // A NaN maxItems reads as absent: nothing collapses.
        const other = document.createElement('div');
        document.body.appendChild(other);
        render(trail({ maxItems: Number.NaN }), other);
        expect(visible(other)).toEqual(NAMES);
        // So does a negative one; a fractional one floors.
        const negative = document.createElement('div');
        document.body.appendChild(negative);
        render(trail({ maxItems: -1 }), negative);
        expect(visible(negative)).toEqual(NAMES);
        const fractional = document.createElement('div');
        document.body.appendChild(fractional);
        render(trail({ maxItems: 4.9 }), fractional);
        expect(visible(fractional)).toEqual(['Home', '…', 'Breadcrumbs']);
    });

    it('shows the whole trail when the kept ends leave nothing to hide', () => {
        render(trail({ maxItems: 2, itemsBeforeCollapse: 3, itemsAfterCollapse: 2 }, 3), container);
        expect(visible(container)).toEqual(NAMES);
    });

    it('activating the trigger expands the trail and focuses the first revealed link', async () => {
        const expanded: boolean[] = [];
        render(trail({ maxItems: 3, onExpandedChange: (v: boolean) => expanded.push(v) }), container);
        const trigger = part(container, 'breadcrumbs', 'ellipsis-trigger');
        trigger.focus();
        trigger.click();
        await flush();
        expect(expanded).toEqual([true]);
        expect(visible(container)).toEqual(NAMES);
        expect(part(container, 'breadcrumbs', 'ellipsis').hidden).toBe(true);
        expect(document.activeElement?.textContent).toBe('Docs');
        expectAnatomy(container, breadcrumbsAnatomy);
    });

    it('model:expanded is controllable both ways; defaultExpanded seeds it', async () => {
        const state = signal({ expanded: true });
        render(trail({ maxItems: 3, 'model:expanded': [state, 'expanded'] }), container);
        expect(visible(container)).toEqual(NAMES);
        state.expanded = false;
        await flush();
        expect(visible(container)).toEqual(['Home', '…', 'Breadcrumbs']);
        part(container, 'breadcrumbs', 'ellipsis-trigger').click();
        expect(state.expanded).toBe(true);

        const seeded = document.createElement('div');
        document.body.appendChild(seeded);
        render(trail({ maxItems: 3, defaultExpanded: true }), seeded);
        expect(visible(seeded)).toEqual(NAMES);
    });

    it('the label prop names the trigger from the hidden count', () => {
        render(trail({ maxItems: 3 }, 1, () => (
            <Breadcrumbs.EllipsisTrigger label={(n: number) => `Visa ${n} till`} />
        )), container);
        expect(part(container, 'breadcrumbs', 'ellipsis-trigger').getAttribute('aria-label')).toBe('Visa 3 till');
    });

    it('exposes hiddenCount / hiddenIndices on the context, and asChild composes with Menu.Trigger', () => {
        const seen: Array<[number, number[]]> = [];
        const Probe = component(() => {
            const ctx = useBreadcrumbsContext();
            return () => {
                seen.push([ctx.hiddenCount(), ctx.hiddenIndices()]);
                return null;
            };
        });
        render(trail({ maxItems: 3 }, 1, () => (
            <>
                <Menu.Root>
                    <Menu.Trigger asChild>
                        {(menu: PartProps) => (
                            <Breadcrumbs.EllipsisTrigger asChild>
                                {(own: PartProps) => <button type="button" {...own} {...menu}>…</button>}
                            </Breadcrumbs.EllipsisTrigger>
                        )}
                    </Menu.Trigger>
                </Menu.Root>
                <Probe />
            </>
        )), container);
        expect(seen.at(-1)).toEqual([3, [1, 2, 3]]);
        // The menu's bag wins the element (its scope, part and handlers);
        // the breadcrumb's name survives, since a menu trigger sets none.
        const trigger = part(container, 'menu', 'trigger');
        expect(trigger.getAttribute('aria-label')).toBe('Show 3 more breadcrumbs');
        expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
        trigger.click();
        expect(trigger.getAttribute('aria-expanded')).toBe('true');
        expect(visible(container)).toEqual(['Home', '…', 'Breadcrumbs']);
    });

    it('re-derives when an item is added', async () => {
        const state = signal({ n: 3 });
        const Dynamic = component(() => () => (
            <Breadcrumbs.Root maxItems={3}>
                <Breadcrumbs.List>
                    <Breadcrumbs.Item><Breadcrumbs.Link href="/">Home</Breadcrumbs.Link></Breadcrumbs.Item>
                    <Breadcrumbs.Ellipsis><Breadcrumbs.EllipsisTrigger /></Breadcrumbs.Ellipsis>
                    {Array.from({ length: state.n - 1 }, (_, i) => (
                        <Breadcrumbs.Item key={i}><Breadcrumbs.Link href={`/${i}`}>{`L${i}`}</Breadcrumbs.Link></Breadcrumbs.Item>
                    ))}
                </Breadcrumbs.List>
            </Breadcrumbs.Root>
        ));
        render(<Dynamic />, container);
        expect(visible(container)).toEqual(['Home', 'L0', 'L1']);
        state.n = 4;
        await flush();
        expect(visible(container)).toEqual(['Home', '…', 'L2']);
    });

    it('warns when the ellipsis is misplaced or missing', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        render(trail({ maxItems: 3 }, 2), container);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('Breadcrumbs.Ellipsis is misplaced'));
        warn.mockClear();

        const other = document.createElement('div');
        document.body.appendChild(other);
        render(trail({ maxItems: 3 }, 1), other);
        expect(warn).not.toHaveBeenCalled();

        const missing = document.createElement('div');
        document.body.appendChild(missing);
        render(
            <Breadcrumbs.Root maxItems={1}>
                <Breadcrumbs.List>
                    <Breadcrumbs.Item><Breadcrumbs.Link href="/">A</Breadcrumbs.Link></Breadcrumbs.Item>
                    <Breadcrumbs.Item><Breadcrumbs.Link href="/b">B</Breadcrumbs.Link></Breadcrumbs.Item>
                    <Breadcrumbs.Item><Breadcrumbs.Link href="/c">C</Breadcrumbs.Link></Breadcrumbs.Item>
                </Breadcrumbs.List>
            </Breadcrumbs.Root>,
            missing,
        );
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('renders no Breadcrumbs.Ellipsis'));
        warn.mockRestore();
    });

    it('an app aria-labelledby replaces the default labels', () => {
        render(
            <Breadcrumbs.Root maxItems={1} aria-labelledby="crumbs-heading">
                <Breadcrumbs.List>
                    <Breadcrumbs.Item><Breadcrumbs.Link href="/">A</Breadcrumbs.Link></Breadcrumbs.Item>
                    <Breadcrumbs.Ellipsis><Breadcrumbs.EllipsisTrigger aria-labelledby="more-label" /></Breadcrumbs.Ellipsis>
                    <Breadcrumbs.Item><Breadcrumbs.Link href="/b">B</Breadcrumbs.Link></Breadcrumbs.Item>
                    <Breadcrumbs.Item><Breadcrumbs.Link href="/c">C</Breadcrumbs.Link></Breadcrumbs.Item>
                </Breadcrumbs.List>
            </Breadcrumbs.Root>,
            container,
        );
        const root = part(container, 'breadcrumbs', 'root');
        expect(root.getAttribute('aria-labelledby')).toBe('crumbs-heading');
        expect(root.hasAttribute('aria-label')).toBe(false);
        const trigger = part(container, 'breadcrumbs', 'ellipsis-trigger');
        expect(trigger.getAttribute('aria-labelledby')).toBe('more-label');
        expect(trigger.hasAttribute('aria-label')).toBe(false);
    });

    it('judges placement in tree order inside a detached subtree', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        // Never attached: items and ellipsis still share one tree, so a
        // correct placement stays quiet and a wrong one is still caught.
        render(trail({ maxItems: 3 }, 1), document.createElement('div'));
        expect(warn).not.toHaveBeenCalled();
        render(trail({ maxItems: 3 }, 2), document.createElement('div'));
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('Breadcrumbs.Ellipsis is misplaced'));
        warn.mockRestore();
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

    it('a bound trigger is aria-disabled but stays focusable, and a press is a no-op (#270)', () => {
        const state = signal({ page: 1 });
        render(<Pagination.Root count={3} model={[state, 'page']} />, container);
        const prev = part(container, 'pagination', 'prev-trigger') as HTMLButtonElement;
        const next = part(container, 'pagination', 'next-trigger') as HTMLButtonElement;
        // Not natively disabled: `disabled` would drop focus to <body> on
        // the very press that reaches the bound.
        expect(prev.disabled).toBe(false);
        expect(prev.getAttribute('aria-disabled')).toBe('true');
        expect(prev.getAttribute('data-disabled')).toBe('');
        expect(next.hasAttribute('aria-disabled')).toBe(false);
        expect(next.hasAttribute('data-disabled')).toBe(false);
        prev.click();
        expect(state.page).toBe(1);

        // Walk to the last page with focus on next: it stays there.
        next.focus();
        next.click();
        next.click();
        expect(state.page).toBe(3);
        expect(document.activeElement).toBe(next);
        expect(next.disabled).toBe(false);
        expect(next.getAttribute('aria-disabled')).toBe('true');
        expect(next.getAttribute('data-disabled')).toBe('');
        expect(prev.hasAttribute('aria-disabled')).toBe(false);
        next.click();
        expect(state.page).toBe(3);
        expectAnatomy(container, paginationAnatomy);
    });

    it('a disabled Root declares its flag and disables every button natively (#270)', () => {
        const state = signal({ page: 2 });
        render(<Pagination.Root count={3} disabled model={[state, 'page']} />, container);
        // `disabled` is a declared root flag — the anatomy check fails an
        // undeclared one.
        expect(paginationAnatomy.parts.root.flags).toContain('disabled');
        expectAnatomy(container, paginationAnatomy);
        const root = part(container, 'pagination', 'root');
        expect(root.getAttribute('data-disabled')).toBe('');
        const buttons = [...root.querySelectorAll<HTMLButtonElement>('button')];
        expect(buttons.length).toBeGreaterThan(2);
        for (const b of buttons) {
            expect(b.disabled).toBe(true);
            // Native `disabled` already says it — no aria-disabled on top.
            expect(b.hasAttribute('aria-disabled')).toBe(false);
        }
        part(container, 'pagination', 'next-trigger').click();
        expect(state.page).toBe(2);
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

    it('names each page through pageLabel, defaulting to "Page n" (#176)', () => {
        render(<Pagination.Root count={3} />, container);
        const items = () => [...container.querySelectorAll<HTMLElement>(selector('pagination', 'item'))];
        expect(items().map((i) => i.getAttribute('aria-label'))).toEqual(['Page 1', 'Page 2', 'Page 3']);

        const other = document.createElement('div');
        document.body.appendChild(other);
        render(<Pagination.Root count={3} pageLabel={(n) => `Sida ${n}`} />, other);
        const localized = [...other.querySelectorAll<HTMLElement>(selector('pagination', 'item'))];
        expect(localized.map((i) => i.getAttribute('aria-label'))).toEqual(['Sida 1', 'Sida 2', 'Sida 3']);
        render(null, other);
        other.remove();
    });

    it('keeps focus on the activated page when the window shifts (#176)', async () => {
        // count=20 at page 4 renders 1 2 3 4 5 … 20; activating 5 slides the
        // window to 1 … 4 5 6 … 20. Unkeyed rows let the diff patch the
        // focused '5' button in place to read '6', so focus silently moved
        // to a page the user did not activate.
        render(<Pagination.Root count={20} defaultPage={4} />, container);
        expect(rowText(container)).toEqual(['1', '2', '3', '4', '5', '…', '20']);
        const five = [...container.querySelectorAll<HTMLElement>(selector('pagination', 'item'))]
            .find((b) => b.textContent === '5')!;
        five.focus();
        five.click();
        await Promise.resolve();
        expect(rowText(container)).toEqual(['1', '…', '4', '5', '6', '…', '20']);
        expect(five.isConnected).toBe(true);
        expect(five.textContent).toBe('5');
        expect(five.getAttribute('aria-label')).toBe('Page 5');
        expect(five.getAttribute('aria-current')).toBe('page');
        expect(document.activeElement).toBe(five);
        expectAnatomy(container, paginationAnatomy);
    });

    it('withEdges brackets the row with first/last triggers that jump to the bounds (#294)', () => {
        const state = signal({ page: 2 });
        render(<Pagination.Root count={9} withEdges model={[state, 'page']} />, container);
        expectAnatomy(container, paginationAnatomy);
        const root = part(container, 'pagination', 'root');
        const order = [...root.children].map((el) => el.getAttribute('data-part'));
        expect(order[0]).toBe('first-trigger');
        expect(order[1]).toBe('prev-trigger');
        expect(order.at(-2)).toBe('next-trigger');
        expect(order.at(-1)).toBe('last-trigger');
        const first = part(container, 'pagination', 'first-trigger') as HTMLButtonElement;
        const last = part(container, 'pagination', 'last-trigger') as HTMLButtonElement;
        expect(first.getAttribute('aria-label')).toBe('First page');
        expect(last.getAttribute('aria-label')).toBe('Last page');
        expect(first.textContent).toBe('«');
        expect(last.textContent).toBe('»');

        last.focus();
        last.click();
        expect(state.page).toBe(9);
        // The bound is the focusable aria-disabled treatment (#270).
        expect(document.activeElement).toBe(last);
        expect(last.disabled).toBe(false);
        expect(last.getAttribute('aria-disabled')).toBe('true');
        expect(last.getAttribute('data-disabled')).toBe('');
        expect(first.hasAttribute('aria-disabled')).toBe(false);
        last.click();
        expect(state.page).toBe(9);

        first.click();
        expect(state.page).toBe(1);
        expect(first.getAttribute('aria-disabled')).toBe('true');
        expect(first.getAttribute('data-disabled')).toBe('');
        expectAnatomy(container, paginationAnatomy);
    });

    it('renders no edge triggers by default, and names them localizably', () => {
        render(<Pagination.Root count={3} />, container);
        expect(container.querySelector(selector('pagination', 'first-trigger'))).toBeNull();
        expect(container.querySelector(selector('pagination', 'last-trigger'))).toBeNull();

        const other = document.createElement('div');
        document.body.appendChild(other);
        render(<Pagination.Root count={3} withEdges firstLabel="Första" lastLabel="Sista" />, other);
        expect(part(other, 'pagination', 'first-trigger').getAttribute('aria-label')).toBe('Första');
        expect(part(other, 'pagination', 'last-trigger').getAttribute('aria-label')).toBe('Sista');
        render(null, other);
        other.remove();
    });

    it('link mode renders every control as <a href>, current page aria-current (#294)', () => {
        const state = signal({ page: 2 });
        render(
            <Pagination.Root count={5} withEdges model={[state, 'page']} getPageHref={(n) => `/posts?page=${n}`} />,
            container,
        );
        expectAnatomy(container, paginationAnatomy);
        const root = part(container, 'pagination', 'root');
        expect(root.querySelector('button')).toBeNull();
        const items = [...container.querySelectorAll<HTMLAnchorElement>(selector('pagination', 'item'))];
        expect(items.map((a) => a.tagName)).toEqual(['A', 'A', 'A', 'A', 'A']);
        expect(items.map((a) => a.getAttribute('href'))).toEqual([1, 2, 3, 4, 5].map((n) => `/posts?page=${n}`));
        expect(items[1]!.getAttribute('aria-current')).toBe('page');
        expect(items[0]!.hasAttribute('aria-current')).toBe(false);
        // A live link is a link by its href — no role, no type, no tabindex.
        for (const a of items) {
            expect(a.hasAttribute('role')).toBe(false);
            expect(a.hasAttribute('type')).toBe(false);
            expect(a.hasAttribute('tabindex')).toBe(false);
        }
        const href = (name: string) => part(container, 'pagination', name).getAttribute('href');
        expect(href('first-trigger')).toBe('/posts?page=1');
        expect(href('prev-trigger')).toBe('/posts?page=1');
        expect(href('next-trigger')).toBe('/posts?page=3');
        expect(href('last-trigger')).toBe('/posts?page=5');
    });

    it('a link-mode click moves the model and is never prevented; a modified click is left alone', () => {
        const state = signal({ page: 2 });
        render(<Pagination.Root count={5} model={[state, 'page']} getPageHref={(n) => `#p${n}`} />, container);
        const four = [...container.querySelectorAll<HTMLAnchorElement>(selector('pagination', 'item'))]
            .find((a) => a.textContent === '4')!;
        const click = (el: HTMLElement, init: MouseEventInit = {}) => {
            const e = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
            el.dispatchEvent(e);
            return e;
        };
        // An SPA router intercepts by preventing the default itself — zero
        // never does, so the href is followed when nothing intercepts.
        let seen: MouseEvent | null = null;
        const spy = (e: Event) => { seen = e as MouseEvent; e.preventDefault(); };
        container.addEventListener('click', spy);
        click(four);
        container.removeEventListener('click', spy);
        expect(state.page).toBe(4);
        expect(seen).not.toBeNull();

        // Ctrl/Cmd-click opens the page elsewhere: the view stays put.
        const five = [...container.querySelectorAll<HTMLAnchorElement>(selector('pagination', 'item'))]
            .find((a) => a.textContent === '5')!;
        const guard = (e: Event) => e.preventDefault();
        container.addEventListener('click', guard);
        const e = click(five, { ctrlKey: true });
        click(five, { metaKey: true });
        container.removeEventListener('click', guard);
        expect(state.page).toBe(4);
        // The default-prevented flag is the guard's, not zero's.
        expect(e.defaultPrevented).toBe(true);
    });

    it('a link-mode bound is an <a> without href, role=link, aria-disabled, still focusable', () => {
        const state = signal({ page: 1 });
        render(<Pagination.Root count={3} withEdges model={[state, 'page']} getPageHref={(n) => `#p${n}`} />, container);
        for (const name of ['first-trigger', 'prev-trigger']) {
            const a = part(container, 'pagination', name);
            expect(a.tagName).toBe('A');
            expect(a.hasAttribute('href')).toBe(false);
            expect(a.getAttribute('role')).toBe('link');
            expect(a.getAttribute('aria-disabled')).toBe('true');
            expect(a.getAttribute('data-disabled')).toBe('');
            expect(a.getAttribute('tabindex')).toBe('0');
            a.click();
            expect(state.page).toBe(1);
        }
        const next = part(container, 'pagination', 'next-trigger');
        expect(next.hasAttribute('role')).toBe(false);
        expect(next.getAttribute('href')).toBe('#p2');
        expectAnatomy(container, paginationAnatomy);
    });

    it('a disabled link-mode Root leaves nothing to follow or focus', () => {
        const state = signal({ page: 2 });
        render(<Pagination.Root count={3} withEdges disabled model={[state, 'page']} getPageHref={(n) => `#p${n}`} />, container);
        expectAnatomy(container, paginationAnatomy);
        const links = [...part(container, 'pagination', 'root').querySelectorAll<HTMLAnchorElement>('a')];
        expect(links.length).toBe(7);
        for (const a of links) {
            expect(a.hasAttribute('href')).toBe(false);
            expect(a.hasAttribute('tabindex')).toBe(false);
            expect(a.getAttribute('aria-disabled')).toBe('true');
            expect(a.getAttribute('role')).toBe('link');
            a.click();
        }
        expect(state.page).toBe(2);
    });

    it('passes the variant axes through on the root', () => {
        render(<Pagination.Root count={2} color="primary" size="sm" />, container);
        const root = part(container, 'pagination', 'root');
        expect(root.getAttribute('data-color')).toBe('primary');
        expect(root.getAttribute('data-size')).toBe('sm');
    });
});
