import { defineAnatomy } from '../../contract/anatomy.js';
import { PLACEMENT_VOCABULARY } from '../../contract/data-attrs.js';

export const comboboxAnatomy = defineAnatomy('combobox', {
    root: {
        element: 'div',
        flags: ['disabled', 'invalid', 'required', 'readonly'],
        tokens: ['color'],
    },
    // The bordered "field chrome" wrapping input + trigger. It mirrors the
    // input's focus-visible so design systems can draw the ring on the box.
    control: {
        element: 'div',
        parent: 'root',
        states: ['open', 'closed'],
        flags: ['disabled', 'invalid', 'focus-visible'],
        tokens: ['color', 'radius-field', 'size'],
    },
    // A real text input — no data-placeholder flag; use :placeholder-shown.
    input: {
        element: 'input',
        parent: 'control',
        states: ['open', 'closed'],
        flags: ['disabled', 'invalid', 'required', 'readonly', 'focus-visible'],
        tokens: ['color', 'text', 'size'],
    },
    trigger: {
        element: 'button',
        parent: 'control',
        states: ['open', 'closed'],
        flags: ['disabled', 'pressed', 'press-animating', 'focus-visible'],
        tokens: ['color'],
        asChild: true,
    },
    popup: {
        element: 'div',
        parent: 'root',
        states: ['open', 'closed'],
        placements: [...PLACEMENT_VOCABULARY],
        tokens: ['color', 'radius-box'],
    },
    // The optgroup equivalent (#325) — see select's anatomy note; identical
    // shape, and the consumer's filter simply renders or omits whole groups.
    group: {
        element: 'div',
        parent: 'popup',
    },
    'group-label': {
        element: 'div',
        parent: 'group',
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
    // Rendered by the CONSUMER when their filtered list is empty — zero only
    // styles it, it owns no emptiness logic.
    empty: {
        element: 'div',
        parent: 'popup',
        tokens: ['color', 'text'],
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
        { name: 'inputValue', concept: 'inputValue', type: 'string' },
    ],
});
