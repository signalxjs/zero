import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Navbar — the landmark header bar: branding at one end, actions at the
 * other, an optional centre.
 *
 * The root is a `<header>`, NOT a `<nav>` — deliberately, per the APG
 * landmark guidance. A navbar routinely holds non-navigation content
 * (a logo, a search field, an account menu), and a `<nav>` around all of it
 * would put every one of those into a navigation landmark it does not belong
 * to. `<header>` scoped to the document is the *banner* landmark — the
 * page-level bar this component is — and the actual link set gets its
 * `<nav>` from the consumer, INSIDE a section, wrapped around exactly the
 * links and nothing else — `NavList` (#132) is that `<nav>`. Zero cannot
 * know which section holds the links, so the one landmark it can honestly
 * emit here is the banner.
 *
 * No states and one behavior: the bar is otherwise pure composition —
 * three optional sections on a flex row the recipes lay out. `start`/`end`
 * are the logical pair (reading edge / far edge), so RTL mirrors for free.
 *
 * The behavior is the root's `scrolled` flag (#530): present while the
 * content the bar sits over is scrolled past its block-start edge — the
 * document scroller by default, or the container the root's
 * `scrollContainer` prop names (an app shell's `<main>`). It is the
 * scrolled-under state a top app bar fills itself on (Material 3's
 * surface-container), which CSS cannot derive for a bar that is not inside
 * its scroller. Set after mount only, so server markup never carries it.
 */
export const navbarAnatomy = defineAnatomy('navbar', {
    root: {
        element: 'header',
        flags: ['scrolled'],
        tokens: ['color', 'size'],
    },
    start: {
        element: 'div',
        parent: 'root',
    },
    center: {
        element: 'div',
        parent: 'root',
    },
    end: {
        element: 'div',
        parent: 'root',
    },
});
