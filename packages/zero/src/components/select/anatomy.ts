import { defineAnatomy } from '../../contract/anatomy.js';
import { PLACEMENT_VOCABULARY } from '../../contract/data-attrs.js';

export const selectAnatomy = defineAnatomy('select', {
    root: {
        element: 'div',
        flags: ['disabled', 'invalid', 'required'],
        tokens: ['color'],
    },
    trigger: {
        element: 'button',
        parent: 'root',
        states: ['open', 'closed'],
        flags: ['disabled', 'invalid', 'focus-visible', 'placeholder', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-field', 'size', 'text'],
        asChild: true,
    },
    value: {
        element: 'span',
        parent: 'trigger',
        flags: ['placeholder'],
        tokens: ['color', 'text'],
    },
    indicator: {
        element: 'span',
        parent: 'trigger',
        states: ['open', 'closed'],
        tokens: ['color'],
    },
    popup: {
        element: 'div',
        parent: 'root',
        states: ['open', 'closed'],
        placements: [...PLACEMENT_VOCABULARY],
        tokens: ['color', 'radius-box'],
    },
    // The optgroup equivalent (#325): role=group inside the listbox, named
    // by its group-label (presence-tracked — an unlabelled group stays
    // anonymous rather than dangling). Labels never register as options, so
    // typeahead and the highlight walk straight through.
    group: {
        element: 'div',
        parent: 'popup',
    },
    'group-label': {
        element: 'div',
        parent: 'group',
        tokens: ['color', 'text'],
    },
    // A group windowed (#127): under `virtual` a `group` cannot be split
    // across the window, so each heading is a row of its own — a sibling of
    // the options, laid out and measured like one, aria-hidden and named by
    // each option under it through aria-describedby. What `group-label` says
    // inside a `group`, this says in a flat window.
    'group-heading': {
        element: 'div',
        parent: 'popup',
        tokens: ['color', 'text'],
    },
    item: {
        element: 'div',
        parent: 'popup',
        flags: ['selected', 'highlighted', 'disabled', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-selector', 'text'],
        asChild: true,
    },
    'item-indicator': {
        element: 'span',
        parent: 'item',
        flags: ['selected'],
        tokens: ['color'],
    },
    // Windowing (#96): under `virtual` the options near the scroll position
    // render, and an aria-hidden spacer stands in for each run that does not
    // (above, below, and either side of a highlighted option pinned apart).
    // Pure geometry — an inline block size, nothing for a recipe to paint.
    spacer: {
        element: 'div',
        parent: 'popup',
    },
    // A real <select>, visually hidden: the form control the platform
    // validates (required), resets, autofills and posts. Rendered only
    // while the root carries a name.
    'hidden-input': {
        element: 'select',
        parent: 'root',
    },
}, {
    models: [
        { concept: 'value', type: 'T | null', multiple: true, formControl: true },
        { name: 'open', concept: 'open', type: 'boolean' },
    ],
});
