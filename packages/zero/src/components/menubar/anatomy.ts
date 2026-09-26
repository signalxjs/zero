import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Menubar — the APG menubar over `Menu`.
 *
 * The scope renders only its own `root` (the `role="menubar"` row); the
 * menus inside are ordinary `menu` scope parts. A `Menu.Root` inside a
 * menubar reads the bar from context: its `Menu.Trigger` becomes a
 * `menuitem` in the bar's one-tab-stop roving row and its open state
 * follows the bar's `value`, so a design system styles a menu once, in a
 * bar or not. `root` restates `disabled` for a recipe that dims the whole
 * bar, and carries `data-orientation`.
 */
export const menubarAnatomy = defineAnatomy('menubar', {
    root: {
        element: 'div',
        flags: ['disabled'],
        tokens: ['color', 'size'],
    },
}, {
    orientation: true,
    models: [
        { concept: 'value', type: 'string' },
    ],
});
