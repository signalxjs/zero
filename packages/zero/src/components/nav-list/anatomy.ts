import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * NavList — the navigation list an app shell's sidebar is made of (#132):
 * a `<nav>` landmark over one or more groups of links, the current page
 * marked, each link with room for an icon and a trailing count.
 *
 * Breadcrumbs' shape, one level down: the link for the page the user is on
 * carries `aria-current="page"`, and that is a STATE (`active`, the
 * synonym table's spelling for `current`), never a flag — one `active`
 * link, the rest `inactive`, tabs' pair. Unordered (`<ul>`), because
 * unlike a breadcrumb trail the order of a sidebar is convention, not
 * meaning.
 *
 * Navbar's `<header>` deliberately holds no `<nav>` of its own (the
 * banner routinely contains a logo, a search field, an account menu); this
 * is the `<nav>` it points at — exactly the links, and nothing else. Give
 * it a `label` when a page has more than one navigation landmark.
 *
 * `group` is optional structure: a section of the sidebar ("Projects",
 * "Settings"), a `role="group"` and not a nested `<nav>` — one landmark per
 * sidebar. Its `heading` names it (`aria-labelledby`, written only while a
 * heading is rendered, so the reference never dangles); a group without one
 * is unnamed, and takes `aria-label` if it needs a name. `icon` is
 * decorative; `meta` is the trailing slot (an unread count as a `Badge`, a
 * `Kbd` hint) that every skin pushes to the far edge.
 */
export const navListAnatomy = defineAnatomy('nav-list', {
    root: {
        element: 'nav',
        tokens: ['color', 'size'],
    },
    group: {
        element: 'div',
        parent: 'root',
    },
    heading: {
        element: 'div',
        parent: 'group',
        tokens: ['color', 'text'],
    },
    list: {
        element: 'ul',
        parent: 'root',
    },
    item: {
        element: 'li',
        parent: 'list',
    },
    link: {
        element: 'a',
        parent: 'item',
        states: ['active', 'inactive'],
        tokens: ['color', 'radius-field', 'text'],
        asChild: true,
    },
    icon: {
        element: 'span',
        parent: 'link',
        tokens: ['color'],
    },
    meta: {
        element: 'span',
        parent: 'link',
        tokens: ['color', 'text'],
    },
});
