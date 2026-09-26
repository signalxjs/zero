import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * TreeView — the APG tree pattern.
 *
 * `branch` is the treeitem ELEMENT (it wraps its group, so aria-expanded
 * and aria-level sit on it — the APG shape); `branch-trigger` is the
 * visible clickable row inside it, the thing recipes highlight — it mirrors
 * the branch's state plus its own focus, so a ring draws on the row, never
 * around the whole subtree. `branch-content` is the role=group container
 * holding the subtree; the runtime hides it (the `hidden` attribute) while
 * `closed`, so recipes style its layout and leave its states alone.
 *
 * `loading` (a Branch whose children are being fetched): the indicator
 * reads it whatever the expansion, the content only while open — closed
 * content is hidden, so it stays `closed`.
 *
 * `multiple` (the model becomes `string[]`) adds no part and no state: the
 * tree carries `aria-multiselectable`, and each selected node the same
 * `selected` flag single mode sets.
 *
 * Checkable (`model:checkedValues`, or `checkable`): `node-checkbox` is the
 * paint hook — an `aria-hidden` box inside a node's row (an `item`, or a
 * branch's `branch-trigger`) mirroring the node's check state; the treeitem
 * itself carries `aria-checked`. A branch's state is DERIVED from its enabled
 * descendant leaves, never stored. `parent` names the containing `tree`
 * because the box sits in either row, and `paint.host` names the leaf row
 * the audit measures it on — the menu `item-indicator` shape, since a
 * branch row shares the item row's grammar in every skin.
 */
export const treeViewAnatomy = defineAnatomy('tree-view', {
    root: {
        element: 'div',
        flags: ['disabled'],
        tokens: ['color'],
    },
    label: {
        element: 'div',
        parent: 'root',
        tokens: ['color', 'text'],
    },
    tree: {
        element: 'div',
        parent: 'root',
        tokens: ['color'],
    },
    item: {
        element: 'div',
        parent: 'tree',
        flags: ['selected', 'disabled', 'focus-visible', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-selector', 'text'],
        asChild: true,
    },
    branch: {
        element: 'div',
        parent: 'tree',
        states: ['open', 'closed'],
        flags: ['selected', 'disabled'],
    },
    'branch-trigger': {
        element: 'div',
        parent: 'branch',
        states: ['open', 'closed'],
        flags: ['selected', 'disabled', 'focus-visible', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-selector', 'text'],
        asChild: true,
    },
    'branch-indicator': {
        element: 'span',
        paint: { glyph: '›' },
        parent: 'branch-trigger',
        states: ['open', 'closed', 'loading'],
    },
    'node-checkbox': {
        element: 'span',
        // No glyph: zero renders an empty span and the recipe draws the box
        // and its mark.
        paint: { host: 'item' },
        parent: 'tree',
        states: ['checked', 'unchecked', 'indeterminate'],
        flags: ['disabled'],
        tokens: ['color', 'radius-selector'],
    },
    'branch-content': {
        element: 'div',
        parent: 'branch',
        states: ['open', 'closed', 'loading'],
        // `loading` is only ever rendered while open, so it is visible.
        // A collapsed subtree is `hidden`, not merely collapsed — its nodes
        // keep their registration but leave the render entirely, so
        // `[data-state="closed"]` on branch-content can never paint.
        hiddenIn: ['closed'],
    },
}, {
    models: [
        { concept: 'value', type: 'string', multiple: true },
        { name: 'expandedValues', concept: 'expandedValues', type: 'string[]' },
        { name: 'checkedValues', concept: 'checkedValues', type: 'string[]' },
    ],
});
