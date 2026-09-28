import { component, signal } from 'sigx';
import { Badge, Drawer, Kbd, NavList } from '@sigx/zero';
import type { PartProps } from '@sigx/zero';
import { pickRole, pickSize } from '../design-systems';
import type { PageEntry } from './registry';

// Every link points at this page: the playground's router owns the hash,
// and which link is "current" is a fact the router would pass in — here it
// is pinned so the demo reads the same on every load.
const ROUTES = [
    { key: 'inbox', icon: '✉', label: 'Inbox', meta: 12 },
    { key: 'drafts', icon: '✎', label: 'Drafts', meta: 2 },
    { key: 'sent', icon: '➤', label: 'Sent' },
] as const;

// State-driven navigation (#451): no URL, just a signal. Each link has no
// `href`, so it renders a native button whose `onClick` moves `view`.
const VIEWS = [
    { key: 'overview', icon: '◉', label: 'Overview' },
    { key: 'activity', icon: '≋', label: 'Activity', meta: 3 },
    { key: 'members', icon: '☺', label: 'Members' },
] as const;

const NavListDemos = component(() => {
    const state = signal({ current: 'inbox' });
    const project = signal({ view: 'overview' as string });

    const links = () => ROUTES.map((r) => (
        <NavList.Item>
            <NavList.Link href="#/nav-list" current={state.current === r.key}>
                <NavList.Icon>{r.icon}</NavList.Icon>
                {r.label}
                {'meta' in r ? <NavList.Meta><Badge size={pickSize('xs', 'sm')}>{r.meta}</Badge></NavList.Meta> : null}
            </NavList.Link>
        </NavList.Item>
    ));

    return () => (
        <>
            <p>
                The navigation list a sidebar is made of (#132): a labelled{' '}
                <code>&lt;nav&gt;</code> over groups of links, the current page
                as <code>aria-current="page"</code> and{' '}
                <code>data-state="active"</code> — Breadcrumbs' rule, one level
                down — an <code>Icon</code> in front and a <code>Meta</code>{' '}
                slot at the far edge for a count or a key hint. Which link is
                current is the router's knowledge, passed in.
            </p>
            <div style="max-width: 16rem" data-demo="nav-list">
                <NavList.Root label="Mail" color={pickRole('primary')}>
                    <NavList.Group>
                        <NavList.Heading>Mailboxes</NavList.Heading>
                        <NavList.List>{links()}</NavList.List>
                    </NavList.Group>
                    <NavList.Group>
                        <NavList.Heading>Workspace</NavList.Heading>
                        <NavList.List>
                            <NavList.Item>
                                <NavList.Link asChild current={state.current === 'settings'}>
                                    {(p: PartProps) => (
                                        <a href="#/nav-list" {...p}>
                                            <NavList.Icon>⚙</NavList.Icon>
                                            Settings
                                            <NavList.Meta><Kbd>,</Kbd></NavList.Meta>
                                        </a>
                                    )}
                                </NavList.Link>
                            </NavList.Item>
                        </NavList.List>
                    </NavList.Group>
                </NavList.Root>
            </div>
            <p>
                A link without an <code>href</code> is a native{' '}
                <code>&lt;button type="button"&gt;</code> (#451): for an app
                that navigates by state — a signal, a store, a router with no
                URLs — its <code>onClick</code> is the navigation, and a tab
                stop, Enter and Space come with the element. With an{' '}
                <code>href</code> the same <code>onClick</code> runs on the
                anchor and never prevents it, so a router can intercept.
            </p>
            <div style="max-width: 16rem" data-demo="nav-list-buttons">
                <NavList.Root label="Project" color={pickRole('primary')}>
                    <NavList.List>
                        {VIEWS.map((v) => (
                            <NavList.Item>
                                <NavList.Link current={project.view === v.key} onClick={() => { project.view = v.key; }}>
                                    <NavList.Icon>{v.icon}</NavList.Icon>
                                    {v.label}
                                    {'meta' in v ? <NavList.Meta><Badge size={pickSize('xs', 'sm')}>{v.meta}</Badge></NavList.Meta> : null}
                                </NavList.Link>
                            </NavList.Item>
                        ))}
                    </NavList.List>
                </NavList.Root>
                <output data-testid="nav-list-view">view: {project.view}</output>
            </div>
            <p>
                Inside a responsive Drawer it is the app shell's sidebar:
                docked open at or above <code>md</code>, a sheet below it. The
                list does not know which — the drawer decides.
            </p>
            <div class="demo-dock" data-demo="sidebar">
                <Drawer.Root modal={{ below: 'md' }}>
                    <Drawer.Trigger>Open navigation</Drawer.Trigger>
                    <Drawer.Panel measure="xs">
                        <Drawer.Title visuallyHidden>Navigation</Drawer.Title>
                        <NavList.Root label="Main">
                            <NavList.List>{links()}</NavList.List>
                        </NavList.Root>
                        <Drawer.Close>Close navigation</Drawer.Close>
                    </Drawer.Panel>
                </Drawer.Root>
            </div>
        </>
    );
}, { name: 'NavListDemos' });

export const navListPage: PageEntry = {
    id: 'nav-list',
    title: 'NavList',
    category: 'Navigation & structure',
    Demos: NavListDemos,
};
