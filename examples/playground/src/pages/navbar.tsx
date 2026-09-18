import { component } from 'sigx';
import { Navbar, Button } from '@sigx/zero';
import { pickRole, pickScopeVariant } from '../design-systems';
import type { PageEntry } from './registry';

const NavbarDemos = component(() => () => (
    <>
        <p>
            The landmark header bar. The root is a <code>&lt;header&gt;</code>{' '}
            (the banner landmark at document scope), not a{' '}
            <code>&lt;nav&gt;</code> — a bar holds branding and actions too, so
            the navigation landmark is the consumer's own labelled{' '}
            <code>&lt;nav&gt;</code> around exactly the links, inside a
            section. Start/end are the logical pair; RTL mirrors free.
        </p>
        <Navbar.Root>
            <Navbar.Start><strong>Acme</strong></Navbar.Start>
            <Navbar.Center>
                <nav aria-label="Primary">
                    <a href="#/navbar">Docs</a>
                </nav>
            </Navbar.Center>
            <Navbar.End>
                <Button.Root size="sm">Sign in</Button.Root>
            </Navbar.End>
        </Navbar.Root>
        <p>Without a centre, the ends keep the edges:</p>
        <Navbar.Root size="sm">
            <Navbar.Start><strong>Console</strong></Navbar.Start>
            <Navbar.End>
                <Button.Root size="sm" variant={pickScopeVariant('button', 'ghost')}>Help</Button.Root>
            </Navbar.End>
        </Navbar.Root>
        <p>Coloured — the app-bar vernacular, where the vocabulary has roles:</p>
        <Navbar.Root color={pickRole('primary')}>
            <Navbar.Start><strong>Acme</strong></Navbar.Start>
            <Navbar.End>Signed in as andii</Navbar.End>
        </Navbar.Root>
    </>
), { name: 'NavbarDemos' });

export const navbarPage: PageEntry = {
    id: 'navbar',
    title: 'Navbar',
    category: 'Navigation & structure',
    Demos: NavbarDemos,
};
