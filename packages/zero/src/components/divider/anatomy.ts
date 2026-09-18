import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Divider — a rule between things, with the semantics the platform already
 * has for one: `role="separator"` plus `aria-orientation`.
 *
 * Single part, and no `label`. A divider with words in the middle of it is a
 * layout pattern (a captioned section break), not a separator — the ARIA role
 * has no text alternative, and giving one a text-bearing part would put a
 * label under a non-text carrier for no gain. Radix's Separator and Ark's
 * Divider both stop here too.
 *
 * Distinct from `menu.separator`, which is a part of the menu's own anatomy
 * and carries the menu's chrome; this is the standalone one.
 */
export const dividerAnatomy = defineAnatomy('divider', {
    root: {
        element: 'div',
        tokens: ['color', 'size'],
    },
}, { orientation: true });
