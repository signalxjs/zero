import { component } from 'sigx';
import { Navbar, Button } from '@sigx/zero';
import { activeVocabulary, pickRole, pickScopeVariant } from '../design-systems';
import { AxisLabel, DemoRow } from '../demo/Section';
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

/**
 * One bar per variant the live design system declares for navbar — Material
 * 3's top app bars (#419) — read from the manifest, so a skin with none
 * renders nothing here. The `center` part carries the headline, which the
 * medium and large bars set on a row of its own.
 */
const NavbarFlavors = component(() => {
    const flavors = () => activeVocabulary().perScope['navbar']?.variants ?? [];
    return () => (
        <>
            {flavors().map((variant) => (
                <DemoRow>
                    <AxisLabel>{variant}</AxisLabel>
                    <div style="flex: 1">
                        <Navbar.Root variant={variant}>
                            <Navbar.Start><span aria-hidden="true">☰</span></Navbar.Start>
                            <Navbar.Center>{`${variant} bar`}</Navbar.Center>
                            <Navbar.End><span aria-hidden="true">⋮</span></Navbar.End>
                        </Navbar.Root>
                    </div>
                </DemoRow>
            ))}
        </>
    );
}, { name: 'NavbarFlavors' });

/**
 * The scrolled-under state (#530): a bar over its own scroll box, watching
 * that box through `scrollContainer` rather than the document. Scroll the
 * box and the root carries `data-scrolled` — material fills it with
 * surface-container. The bars above watch the document, so scrolling the
 * page flags them the same way.
 */
const NavbarScrolled = component(() => {
    let box: HTMLElement | null = null;
    return () => (
        <>
            <p>
                Scrolled under: the bar below watches its own scroll box
                (<code>scrollContainer</code>), and carries{' '}
                <code>data-scrolled</code> once the box leaves the top.
            </p>
            <div
                data-demo="navbar-scroll-box"
                // A scroll box a keyboard can reach and scroll, named.
                role="region"
                aria-label="Inbox messages"
                tabIndex={0}
                style="block-size: 12rem; overflow: auto; border: 1px solid color-mix(in oklab, currentColor 25%, transparent)"
                ref={(el: HTMLElement | null) => { box = el; }}
            >
                <Navbar.Root scrollContainer={() => box} class="demo-sticky-bar">
                    <Navbar.Start><strong>Inbox</strong></Navbar.Start>
                    <Navbar.End><span aria-hidden="true">⋮</span></Navbar.End>
                </Navbar.Root>
                {Array.from({ length: 12 }, (_, i) => <p style="margin: 0.75rem 1rem">{`Message ${i + 1}`}</p>)}
            </div>
        </>
    );
}, { name: 'NavbarScrolled' });

const NavbarPage = component(() => () => (
    <>
        <NavbarDemos />
        <NavbarScrolled />
        <NavbarFlavors />
    </>
), { name: 'NavbarPage' });

export const navbarPage: PageEntry = {
    id: 'navbar',
    title: 'Navbar',
    category: 'Navigation & structure',
    Demos: NavbarPage,
};
