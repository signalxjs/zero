import { component } from 'sigx';
import { Badge, Button, Container, Drawer, NavList, Navbar, Row, Stack } from '@sigx/zero';
import type { PartProps } from '@sigx/zero';
import { pickRole, pickScopeVariant, pickSize } from '../design-systems';
import type { PageEntry } from './registry';

/**
 * The app shell as a COMPOSITION (#133): nothing here is a new scope. A
 * `Drawer.Root` with `modal={{ below: 'md' }}` wraps the whole shell — it
 * renders no element, so it can — which is what lets the trigger live in
 * the Navbar while the panel is the sidebar beside `<main>`. At or above
 * `md` the panel docks open in flow and the trigger hides (the kit's
 * `zero.structure` block, from the design system's own breakpoint); below
 * it the navigation is a sheet the trigger opens. One NavList, rendered
 * once, either way.
 */
const AppShellDemos = component(() => () => (
    <>
        <p>
            An app shell is a composition, not a component: a <code>Navbar</code>{' '}
            for the top bar, a responsive <code>Drawer</code> for the sidebar
            with a <code>NavList</code> inside it, and a <code>Container</code>{' '}
            for <code>&lt;main&gt;</code>. The <code>Drawer.Root</code> renders
            no element, so it wraps the whole shell and its trigger can sit in
            the bar. Resize below <code>md</code>: the sidebar becomes a sheet
            and the menu button appears — the navigation is rendered once.
        </p>
        <div data-demo="app-shell" style="border: 1px solid color-mix(in oklch, currentColor 20%, transparent); border-radius: 0.5rem; overflow: hidden">
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
                <Row align="start" gap="none">
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
                    <Stack.Item grow asChild>
                        {(p: PartProps) => (
                            <main {...p}>
                                <Container measure="md" padY="lg">
                                    <h3 style="margin-top: 0">Overview</h3>
                                    <p>
                                        The page. Nothing about the shell reaches in here: the
                                        sidebar is the drawer's panel, the bar is the navbar, and
                                        this is a <code>Container</code> in a growing{' '}
                                        <code>Stack.Item</code>.
                                    </p>
                                </Container>
                            </main>
                        )}
                    </Stack.Item>
                </Row>
            </Drawer.Root>
        </div>
    </>
), { name: 'AppShellDemos' });

export const appShellPage: PageEntry = {
    id: 'app-shell',
    title: 'App shell',
    category: 'Navigation & structure',
    Demos: AppShellDemos,
};
