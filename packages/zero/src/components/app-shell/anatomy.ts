import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * AppShell — the full-height frame an application sits in (#459).
 *
 * The layout tier lays content out, but nothing in it claims the viewport,
 * renders the `<main>` landmark without `asChild` markup, or gives a column
 * its own scroll. Those are elements plus geometry, which a layout attribute
 * cannot express — so this is a scope, and a geometry-only one: the kit's
 * `layoutRecipes` emits its recipe, the same in every design system.
 *
 * - `root` claims the viewport (`100dvh`), or its sized parent's height when
 *   embedded, and never scrolls itself.
 * - `body` is the row under the app bar: a docked sidebar beside `main`,
 *   filling the height that is left.
 * - `main` renders `<main>`.
 * - `region` renders a named `<section>` — a region landmark — and is the
 *   scroll box. It is always focusable, so a keyboard can scroll it.
 *
 * It complements the Navbar + Drawer + NavList composition (#133) rather
 * than replacing it: `Navbar` stays the banner, the docked `Drawer.Panel`
 * the sidebar and `NavList` the navigation. AppShell adds only the frame
 * and the `main`/region landmarks.
 *
 * `parent` names the containing part, not the immediate element: a region
 * can sit inside a foreign split pane, or in a sidebar outside `main`.
 *
 * No `layout`, `tokens`, `states` or `asChild` — the point of the scope is
 * to render these elements for you.
 */
export const appShellAnatomy = defineAnatomy('app-shell', {
    root: { element: 'div' },
    body: { element: 'div', parent: 'root' },
    main: { element: 'main', parent: 'root' },
    region: { element: 'section', parent: 'root' },
});
