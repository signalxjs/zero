import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Steps — a wizard's step rail, promoted from the ecosystem `ext-stepper`
 * pattern (#339). `packages/zero-ext-example` REMAINS as the ecosystem
 * acceptance test with its own `ext-stepper` scope; this scope is the
 * first-class version, richer by exactly the parts a design system needs
 * to paint a real rail: the numbered `indicator` disc, the `separator`
 * line between steps, and the `title`/`description` text bands.
 *
 * The item is a real `<button>` (a step you can click IS a button), so
 * every band inside it is a `<span>` — a button's content model excludes
 * flow content. The separator lives INSIDE the item (the timeline
 * connector's move: the line from this step toward the next is this
 * step's own geometry) and is `aria-hidden` with `pointer-events: none`
 * expected from recipes, since it bridges past the button's own box.
 *
 * States are the existing `active|complete|inactive` family — `complete`
 * is position-derived (a step BEFORE the current one), which is exactly
 * the kind of state a design system wants to paint: the walk of a wizard
 * is told by ink, not by position alone. The indicator mirrors its item's
 * phase; the separator carries only the walked pair (`complete` once its
 * OWN item is complete, else `inactive` — an active item's separator is
 * a line the walk has reached, not crossed). The title/description bands
 * deliberately carry no states: recipes that want an emphasized active
 * title reach it through the item's state, which the part tree makes a
 * bounded descendant selector.
 *
 * The item RE-CARRIES the colour axis (`PartSpec.carries`, #112, the
 * mechanism #94 introduced for timeline's marker): a `color` on
 * `Steps.Item` renders `data-color` on that item and outranks the root's,
 * so one step can say "error" while the rail stays primary — daisyUI's
 * per-step `step-error`. Everything inside the item (indicator,
 * separator, title) follows the item's value; an item without one
 * follows the root.
 *
 * The wizard half (#296): `content` is one panel per step (`value`
 * matches an item's), `role="region"` labelled by its step's title and
 * `hidden` unless its step is active — hence `hiddenIn: ['inactive']`,
 * the Tabs.Panel shape. `prev-trigger`/`next-trigger` step through the
 * enabled items in DOM order; at a bound they stay focusable and render
 * `aria-disabled` + `data-disabled` (the carousel/pagination convention,
 * #270), so the press that reaches the last step keeps keyboard focus.
 * A root `linear` renders every item past the next reachable one
 * `data-disabled`/`aria-disabled` — still focusable and still roved, so
 * its title is read, but not activatable. An item's `invalid` renders the
 * shared `data-invalid` flag on the item, its indicator and its
 * separator, so a design system paints the whole step as erroneous.
 */
export const stepsAnatomy = defineAnatomy('steps', {
    root: {
        element: 'div',
        flags: ['disabled'],
        tokens: ['color', 'size'],
    },
    item: {
        element: 'button',
        parent: 'root',
        states: ['active', 'complete', 'inactive'],
        flags: ['disabled', 'focus-visible', 'pressed', 'press-animating', 'invalid'],
        // Per-step colour (#112): the item re-carries `color`, so one step's
        // disc and bridge can paint a tone of their own.
        carries: ['color'],
        tokens: ['color', 'radius-selector', 'size', 'text'],
        asChild: true,
    },
    indicator: {
        element: 'span',
        parent: 'item',
        states: ['active', 'complete', 'inactive'],
        flags: ['invalid'],
        tokens: ['color', 'radius-selector', 'size', 'text'],
    },
    separator: {
        element: 'span',
        parent: 'item',
        states: ['complete', 'inactive'],
        flags: ['invalid'],
        tokens: ['color'],
    },
    title: {
        element: 'span',
        parent: 'item',
        tokens: ['color', 'text'],
    },
    description: {
        element: 'span',
        parent: 'item',
        tokens: ['color', 'text'],
    },
    content: {
        element: 'div',
        parent: 'root',
        states: ['active', 'inactive'],
        // The runtime sets `hidden` on every panel but the active step's, so
        // `[data-state="inactive"]` on a content panel can never paint.
        hiddenIn: ['inactive'],
        tokens: ['color', 'radius-box', 'text'],
    },
    'prev-trigger': {
        element: 'button',
        parent: 'root',
        flags: ['disabled', 'focus-visible', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-field', 'size', 'text'],
    },
    'next-trigger': {
        element: 'button',
        parent: 'root',
        flags: ['disabled', 'focus-visible', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-field', 'size', 'text'],
    },
}, {
    orientation: true,
    models: [
        { concept: 'step', type: 'string' },
    ],
});
