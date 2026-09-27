import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Divider — a rule between things, with the semantics the platform already
 * has for one: `role="separator"` plus `aria-orientation`.
 *
 * `label` (#298) is the words a captioned section break carries ("or",
 * "Continue with"). A separator's children are presentational — text put
 * inside one is not read — so a rendered Label is the root's name instead:
 * the root points `aria-labelledby` at it, and only while it is actually
 * rendered (part presence, #169). It sits centred on the rule unless
 * `data-placement` names a logical edge (`start` | `end`); recipes draw the
 * line segments around it, so RTL mirrors free.
 *
 * `decorative` drops the semantics for a purely visual rule: `role="none"`,
 * no `aria-orientation`, and no name — a Label inside a decorative divider is
 * ordinary text. No new part and no state: it changes what the root says,
 * not what it looks like.
 *
 * Distinct from `menu.separator`, which is a part of the menu's own anatomy
 * and carries the menu's chrome; this is the standalone one.
 */
export const dividerAnatomy = defineAnatomy('divider', {
    root: {
        element: 'div',
        tokens: ['color', 'size'],
    },
    label: {
        element: 'span',
        parent: 'root',
        placements: ['start', 'end'],
        tokens: ['color', 'text'],
    },
}, { orientation: true });
