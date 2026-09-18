import { defineAnatomy } from '../../contract/anatomy.js';
import { PLACEMENT_VOCABULARY } from '../../contract/data-attrs.js';

export const menuAnatomy = defineAnatomy('menu', {
    trigger: {
        element: 'button',
        states: ['open', 'closed'],
        flags: ['disabled', 'focus-visible', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-field', 'size', 'text'],
        asChild: true,
    },
    popup: {
        element: 'div',
        states: ['open', 'closed'],
        placements: [...PLACEMENT_VOCABULARY],
        tokens: ['color', 'radius-box'],
    },
    item: {
        element: 'div',
        parent: 'popup',
        flags: ['disabled', 'highlighted', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-selector', 'text'],
        asChild: true,
    },
    // The stateful item pair (APG menuitemcheckbox / menuitemradio). Distinct
    // parts rather than item variants because they carry a `data-state` the
    // plain item is contractually without (item is flags-only), and a recipe
    // keys the mark on it.
    'checkbox-item': {
        element: 'div',
        parent: 'popup',
        states: ['checked', 'unchecked'],
        flags: ['disabled', 'highlighted', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-selector', 'text'],
        asChild: true,
    },
    'radio-item': {
        element: 'div',
        parent: 'popup',
        states: ['checked', 'unchecked'],
        flags: ['disabled', 'highlighted', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-selector', 'text'],
        asChild: true,
    },
    // The mark well inside a checkbox-item or radio-item, mirroring the item's
    // state (the radio-group idiom: always rendered, the recipe draws the mark
    // and hides it while unchecked). `parent` names the popup rather than one
    // of the two items because a part declares exactly one containing part and
    // both hosts sit inside the popup — the ancestor walk accepts either.
    'item-indicator': {
        element: 'span',
        parent: 'popup',
        states: ['checked', 'unchecked'],
        tokens: ['color'],
    },
    // A distinct part, not an item variant: it carries a data-state (item is
    // flags-only by contract), and recipes style [data-state="open"] to keep
    // it visually active after focus moves into the submenu.
    'sub-trigger': {
        element: 'div',
        parent: 'popup',
        states: ['open', 'closed'],
        flags: ['disabled', 'highlighted', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-selector', 'text'],
        asChild: true,
    },
    // Distinct from `popup` so a side-attached submenu can animate on its own
    // axis (translateX) without descendant selectors.
    'sub-popup': {
        element: 'div',
        parent: 'popup',
        states: ['open', 'closed'],
        placements: [...PLACEMENT_VOCABULARY],
        tokens: ['color', 'radius-box'],
    },
    // The right-click surface. Additive (context menu = the same menu opened
    // at pointer coordinates); typically the consumer's own content, so
    // recipes usually leave it unstyled. `focus-visible` is declared even so:
    // the surface is a tab stop whenever the consumer makes it one, Escape
    // restores focus to it, and without the flag a design system has nothing
    // to hang its own ring on — the UA default is the only alternative.
    'context-trigger': {
        element: 'div',
        states: ['open', 'closed'],
        flags: ['disabled', 'focus-visible'],
        asChild: true,
    },
    group: {
        element: 'div',
        parent: 'popup',
    },
    'group-label': {
        element: 'div',
        parent: 'group',
        tokens: ['color', 'text'],
    },
    separator: {
        element: 'div',
        parent: 'popup',
        tokens: ['color'],
    },
}, {
    models: [
        { concept: 'open', type: 'boolean' },
        { concept: 'checked', type: 'boolean', member: 'CheckboxItem' },
        { concept: 'value', type: 'string', member: 'RadioGroup' },
        { concept: 'open', type: 'boolean', member: 'Sub' },
    ],
});
