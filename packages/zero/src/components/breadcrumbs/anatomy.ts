import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Breadcrumbs — the trail from the hierarchy's root to the current page.
 *
 * The APG breadcrumb pattern verbatim: a `<nav>` landmark named
 * "Breadcrumb" (the `label` prop renames it for localisation) wrapping an
 * ORDERED list — order is the meaning, so `<ol>`, never `<ul>`. The link
 * for the page the user is on carries `aria-current="page"`.
 *
 * The current page is a STATE, not a new flag: `data-current` is not in
 * `FLAG_VOCABULARY` and the synonym table already rules on the spelling
 * (`current → active`), so the link carries the activation pair — one
 * `active` link, the rest `inactive`, exactly tabs' shape. No `disabled`
 * flag either: an anchor that must not navigate is an anchor the consumer
 * does not render as a link.
 *
 * The separator is punctuation for the eye (`aria-hidden` — the list
 * structure already separates the items for the ear), rendered INSIDE the
 * item after its link so the `<ol>` keeps only `<li>` children. It carries
 * a replaceable glyph (default `/`); a design system that wants its own
 * mark hides the glyph and paints. Its declared parent is the LIST, not the
 * item, because the ellipsis carries one too (below).
 *
 * Collapse (#295) is presence, not a new vocabulary: with `maxItems`
 * exceeded, the middle items render `hidden` with `data-state="closed"`
 * (every item is `open` otherwise), and the `ellipsis` — an `<li>` the
 * consumer places after the leading items — is `open` only while a
 * collapse is active, `hidden` and `closed` the rest of the time. A hidden
 * item's separator sits inside it and hides with it. The `ellipsis-trigger`
 * is the disclosure (`aria-expanded="false"`, named "Show N more
 * breadcrumbs"): activating it sets `model:expanded` and moves focus to the
 * first revealed link. A recipe styles the trigger; it never needs a
 * `closed` rule for a part the runtime hides.
 */
export const breadcrumbsAnatomy = defineAnatomy('breadcrumbs', {
    root: {
        element: 'nav',
        tokens: ['color', 'size'],
    },
    list: {
        element: 'ol',
        parent: 'root',
    },
    item: {
        element: 'li',
        parent: 'list',
        states: ['open', 'closed'],
        hiddenIn: ['closed'],
    },
    link: {
        element: 'a',
        parent: 'item',
        states: ['active', 'inactive'],
        tokens: ['color', 'text'],
        asChild: true,
    },
    separator: {
        element: 'span',
        parent: 'list',
        tokens: ['color'],
    },
    ellipsis: {
        element: 'li',
        parent: 'list',
        states: ['open', 'closed'],
        hiddenIn: ['closed'],
    },
    'ellipsis-trigger': {
        element: 'button',
        parent: 'ellipsis',
        flags: ['focus-visible', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-field'],
        asChild: true,
    },
}, {
    models: [
        { name: 'expanded', concept: 'expanded', type: 'boolean' },
    ],
});
