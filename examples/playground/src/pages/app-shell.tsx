import { component } from 'sigx';
import { AppShell, Badge, Button, Container, Drawer, NavList, Navbar, Row } from '@sigx/zero';
import { pickRole, pickScopeVariant, pickSize } from '../design-systems';
import type { PageEntry } from './registry';

/**
 * The app shell: the `AppShell` frame (#459) around the Navbar + Drawer +
 * NavList composition (#133).
 *
 * `AppShell.Root` claims the height — here the demo wrapper's bounded
 * `block-size`, since the root is `100dvh` capped at `100%` of a sized
 * parent — and never scrolls itself. A `Drawer.Root` with
 * `modal={{ below: 'md' }}` wraps the rest: it renders no element, so the
 * trigger can live in the Navbar while the panel is the sidebar in
 * `AppShell.Body`, beside `AppShell.Main`. At or above `md` the panel docks
 * open in flow and the trigger hides (the kit's `zero.structure` block, from
 * the design system's own breakpoint); below it the navigation is a sheet
 * the trigger opens. One NavList, rendered once, either way.
 *
 * Inside `<main>`, a growing Row holds two `AppShell.Region`s — the named
 * scroll boxes. Each has more content than fits, and each scrolls on its own
 * without moving the frame or the page.
 */
const MESSAGES = Array.from({ length: 30 }, (_, i) => `Message ${i + 1}: status update from the build`);
const PARAGRAPHS = Array.from({ length: 12 }, (_, i) => i + 1);

const AppShellDemos = component(() => () => (
    <>
        <p>
            <code>AppShell</code> is the frame: <code>AppShell.Root</code> claims
            the viewport (here, the demo box's height) and never scrolls,{' '}
            <code>AppShell.Main</code> renders <code>&lt;main&gt;</code>, and
            each <code>AppShell.Region</code> is a named, focusable scroll box.
            Around it sits the composition: a <code>Navbar</code> for the top
            bar and a responsive <code>Drawer</code> for the sidebar with a{' '}
            <code>NavList</code> inside it. The <code>Drawer.Root</code> renders
            no element, so it wraps the whole shell and its trigger can sit in
            the bar. Scroll either region: the other one, the bar and the page
            stay put. Resize below <code>md</code>: the sidebar becomes a sheet
            and the menu button appears — the navigation is rendered once.
        </p>
        <div
            data-demo="app-shell"
            style="block-size: 28rem; border: 1px solid color-mix(in oklch, currentColor 20%, transparent); border-radius: 0.5rem; overflow: hidden"
        >
            <AppShell.Root>
                <Drawer.Root modal={{ below: 'md' }}>
                    <Navbar.Root>
                        <Navbar.Start>
                            <Drawer.Trigger aria-label="Open navigation">☰</Drawer.Trigger>
                            <strong>Acme</strong>
                        </Navbar.Start>
                        <Navbar.End>
                            <Button.Root size={pickSize('sm')} variant={pickScopeVariant('button', 'ghost')}>Help</Button.Root>
                            <Button.Root size={pickSize('sm')} color={pickRole('primary')}>New</Button.Root>
                        </Navbar.End>
                    </Navbar.Root>
                    <AppShell.Body>
                        <Drawer.Panel measure="xs">
                            <Drawer.Title visuallyHidden>Navigation</Drawer.Title>
                            <NavList.Root label="Main">
                                <NavList.List>
                                    <NavList.Item>
                                        <NavList.Link href="#/app-shell" current>
                                            <NavList.Icon>▤</NavList.Icon>
                                            Overview
                                        </NavList.Link>
                                    </NavList.Item>
                                    <NavList.Item>
                                        <NavList.Link href="#/app-shell">
                                            <NavList.Icon>✉</NavList.Icon>
                                            Inbox
                                            <NavList.Meta><Badge size={pickSize('xs', 'sm')}>3</Badge></NavList.Meta>
                                        </NavList.Link>
                                    </NavList.Item>
                                    <NavList.Item>
                                        <NavList.Link href="#/app-shell">
                                            <NavList.Icon>⚙</NavList.Icon>
                                            Settings
                                        </NavList.Link>
                                    </NavList.Item>
                                </NavList.List>
                            </NavList.Root>
                            <Drawer.Close>Close navigation</Drawer.Close>
                        </Drawer.Panel>
                        <AppShell.Main>
                            <Row grow gap="none">
                                <AppShell.Region label="Messages">
                                    <Container pad="md">
                                        <ul style="margin: 0; padding-inline-start: 1.25rem">
                                            {MESSAGES.map((m) => <li>{m}</li>)}
                                        </ul>
                                    </Container>
                                </AppShell.Region>
                                <AppShell.Region label="Reading pane">
                                    <Container measure="md" pad="md">
                                        <h3 style="margin-top: 0">Overview</h3>
                                        {PARAGRAPHS.map((n) => (
                                            <p>
                                                Paragraph {n}. The page. Nothing about the shell reaches
                                                in here: the sidebar is the drawer's panel, the bar is the
                                                navbar, and this region is the scroll box — the frame
                                                around it holds its height however long this runs.
                                            </p>
                                        ))}
                                    </Container>
                                </AppShell.Region>
                            </Row>
                        </AppShell.Main>
                    </AppShell.Body>
                </Drawer.Root>
            </AppShell.Root>
        </div>
    </>
), { name: 'AppShellDemos' });

export const appShellPage: PageEntry = {
    id: 'app-shell',
    title: 'App shell',
    category: 'Navigation & structure',
    Demos: AppShellDemos,
};
