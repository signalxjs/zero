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
        flags: ['disabled', 'focus-visible', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-selector', 'size', 'text'],
        asChild: true,
    },
    indicator: {
        element: 'span',
        parent: 'item',
        states: ['active', 'complete', 'inactive'],
        tokens: ['color', 'radius-selector', 'size', 'text'],
    },
    separator: {
        element: 'span',
        parent: 'item',
        states: ['complete', 'inactive'],
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
}, {
    orientation: true,
    models: [
        { concept: 'step', type: 'string' },
    ],
});
