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
    // A chosen value, rendered in the control before the input (the data
    // expansion does so under `multiple`; hand-written roots place
    // `Combobox.Tags` themselves). The label and the remove button are its
    // default content; a per-tag slot replaces it.
    tag: {
        element: 'span',
        parent: 'control',
        flags: ['disabled'],
        tokens: ['color', 'radius-selector', 'text'],
    },
    'tag-label': {
        element: 'span',
        parent: 'tag',
        tokens: ['text'],
    },
    // A real button in the tab order (`aria-label="Remove <label>"`) — the
    // one way to reach a tag other than the last, which Backspace on the
    // empty input removes.
    'tag-remove': {
        element: 'button',
        parent: 'tag',
        flags: ['disabled', 'focus-visible', 'pressed', 'press-animating'],
        tokens: ['color'],
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
    // Windowing (#96): under `virtual` the options near the scroll position
    // render, and an aria-hidden spacer stands in for each run that does not
    // (above, below, and either side of a highlighted option pinned apart).
    // Pure geometry — an inline block size, nothing for a recipe to paint.
    spacer: {
        element: 'div',
        parent: 'popup',
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
