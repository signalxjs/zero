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
 * mirrors free. Distinguishing modal from inline in CSS needs no attribute
 * either: `:modal` is the platform's own spelling of exactly that split.
 *
 * Width is `measure` on the panel (`data-l-measure`, the design system's
 * `--measure-*` ramp), consumed by the recipes as `--l-measure`, a cap: the
 * panel fills its container inline, or the viewport as a modal sheet, up to
 * it — so `full` is a full-screen sheet. Unset, each design system's own
 * panel width applies.
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
        layout: ['measure'],
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
        tokens: ['color', 'radius-field', 'size'],
        asChild: true,
    },
}, {
    models: [
        { concept: 'open', type: 'boolean' },
    ],
});
