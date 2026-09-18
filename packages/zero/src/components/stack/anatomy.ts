import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Stack — the flex row or column an application layout is actually made of.
 *
 * Two attribute carriers and nothing else, like Join: every visual fact is
 * the design system's, and the only thing zero contributes is a closed,
 * machine-readable statement of which layout attributes each part may carry.
 *
 * Direction reuses the EXISTING `data-orientation` rather than inventing a
 * `direction` attribute. `Row` and `Col` are the same scope with a different
 * orientation, which is why they are presets rather than scopes: two scopes
 * would mean two recipes, two manifest entries and two chances for a skin to
 * paint them differently.
 *
 * `item` exists only so a child can opt into growing. It supports `asChild`
 * for Join's reason — a wrapper cannot grow the control inside it, because
 * `flex-grow` applies to the flex item itself — so the child should carry the
 * part attributes.
 *
 * No `role`: a stack is visual grouping. A consumer who means `list` or
 * `toolbar` writes that role on their own element through `asChild`.
 */
export const stackAnatomy = defineAnatomy('stack', {
    root: {
        element: 'div',
        layout: ['gap', 'gap-x', 'gap-y', 'pad', 'pad-x', 'pad-y', 'align', 'justify', 'wrap'],
    },
    item: {
        element: 'div',
        parent: 'root',
        layout: ['grow'],
        asChild: true,
    },
}, { orientation: true });
