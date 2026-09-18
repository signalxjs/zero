import { component } from 'sigx';
import type { PageEntry } from './registry';

const AboutDemos = component(() => () => (
    <>
        <p>
            Pick a design system in the toolbar — same components, different
            skin, no reload. A design system compiles to one stylesheet, so
            switching is a <code>&lt;link&gt;</code> swap: the new sheet is
            loaded and awaited before the old one is dropped, which is why
            there is no unstyled flash.
        </p>
        <p>
            Exactly one is ever live. Token blocks are scoped by{' '}
            <code>data-theme</code>, but recipe CSS is not — every design
            system writes the same{' '}
            <code>[data-scope][data-part]</code> selectors into the same{' '}
            <code>@layer zero.recipes</code>, so two sheets would blend into
            a chimera rather than replace one another.
        </p>
        <p>
            The swap leaves nothing behind. <code>@property</code>{' '}
            registrations sit outside the cascade layers, so you would expect
            a visited design system's roles — material-only ones like{' '}
            <code>--color-tertiary</code> — to stay registered for the life of
            the page. They don't — measured in Chromium: removing the
            stylesheet withdraws its registrations with it, so switching
            gets you the same result as loading that design system fresh.
        </p>
    </>
), { name: 'AboutDemos' });

export const aboutPage: PageEntry = {
    id: 'about',
    title: 'About',
    category: 'Concepts',
    Demos: AboutDemos,
};
