import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Drawer — the edge panel, on the same native `<dialog>` machinery as
 * Dialog (top layer, `showModal()` focus containment, Escape via `cancel`,
 * native focus restore) and deliberately sharing its decisions: the
 * backdrop is a pseudo part projecting onto `::backdrop`, the labelling is
 * presence-tracked, and non-modal mode covers dismissal and focus restore
 * itself because `show()` provides neither.
 *
 * What is Drawer's own is the EDGE. The panel declares
 * `data-placement="start|end"` from the logical pair — an edge panel
 * anchors to the reading direction (a navigation drawer sits at the
 * reading start in both directions), so spelling it physically would be
 * wrong in one of them; recipes pin it with `inset-inline-*` and RTL
 * mirrors free.
 *
 * Modal from inline is `data-l-dock="sheet|inline"` on the panel (#83), not
 * `:modal`. The platform's pseudo-class stops matching the moment `close()`
 * runs, while the panel is still in the top layer for its exit transition —
 * so geometry keyed on it fell back to the inline box mid-exit, and a slide
 * out would travel from the wrong place. The attribute is the regime, not
 * the open state, so it holds through the exit.
 *
 * Width is `measure` on the panel (`data-l-measure`, the design system's
 * `--measure-*` ramp), consumed by the recipes as `--l-measure`, a cap: the
 * panel fills its container inline, or the viewport as a modal sheet, up to
 * it — so `full` is a full-screen sheet. Unset, each design system's own
 * panel width applies.
 *
 * The responsive regime split (`modal={{ below: 'md' }}`, #82) is a
 * breakpoint-valued layout attribute: `data-l-dock-above="md"` on the
 * trigger, the panel and the close. The breakpoint is the VALUE, as
 * `Table.Root stack="md"` spells it — the rule for every attribute that
 * switches a mode at a breakpoint (#122); the per-breakpoint NAME form
 * (`data-l-md-gap`) is only for a responsive value. It lets
 * `@sigx/zero-kit` emit the per-breakpoint structure from the design
 * system's own ramp — the only place a media query can learn a
 * breakpoint's width, and so the only way the server's markup is right on
 * first paint. At or above the breakpoint the trigger and close are hidden
 * and the panel is docked open inline; below it the docked panel is hidden
 * unless it is up as a modal sheet. The panel's live regime is the plain
 * `data-l-dock="sheet|inline"` (#83) beside it.
 *
 * No `description` part and a `label` prop instead: a drawer is a
 * container (navigation, filters, a cart), not a message — it often has no
 * visible heading at all, which is why the accessible name can come from
 * `label` when no `title` renders. No `footer`: the drawer's content is
 * the consumer's own layout.
 */
export const drawerAnatomy = defineAnatomy('drawer', {
    trigger: {
        element: 'button',
        states: ['open', 'closed'],
        flags: ['disabled', 'focus-visible', 'pressed', 'press-animating'],
        // Hidden at or above a responsive drawer's breakpoint — there is no
        // sheet to open while the panel is docked.
        layout: ['dock-above'],
        tokens: ['color', 'radius-field', 'size', 'text'],
        asChild: true,
    },
    panel: {
        element: 'dialog',
        states: ['open', 'closed'],
        placements: ['start', 'end'],
        // The panel's width, from the `--measure-*` ramp — Container's
        // reasoning for a layout attribute over the `size` axis, plus one of
        // Drawer's own: `size` rides the trigger (the carrier), and the
        // panel is not inside it, so no trigger-carried axis can reach it.
        layout: ['measure', 'dock', 'dock-above'],
        tokens: ['color'],
    },
    backdrop: {
        element: 'dialog',
        states: ['open', 'closed'],
        tokens: ['color'],
        pseudo: { of: 'panel', selector: '::backdrop' },
    },
    title: {
        element: 'h2',
        parent: 'panel',
        tokens: ['color', 'text'],
        visuallyHidden: true,
    },
    close: {
        element: 'button',
        parent: 'panel',
        flags: ['disabled', 'focus-visible', 'pressed', 'press-animating'],
        // Hidden with the trigger: a docked panel does not close.
        layout: ['dock-above'],
        tokens: ['color', 'radius-field', 'size'],
        asChild: true,
    },
}, {
    models: [
        { concept: 'open', type: 'boolean' },
    ],
});
