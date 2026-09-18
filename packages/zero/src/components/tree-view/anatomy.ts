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
        parent: 'branch-trigger',
        states: ['open', 'closed'],
    },
    'branch-content': {
        element: 'div',
        parent: 'branch',
        states: ['open', 'closed'],
        // A collapsed subtree is `hidden`, not merely collapsed — its nodes
        // keep their registration but leave the render entirely, so
        // `[data-state="closed"]` on branch-content can never paint.
        hiddenIn: ['closed'],
    },
}, {
    models: [
        { concept: 'value', type: 'string' },
        { name: 'expandedValues', concept: 'expandedValues', type: 'string[]' },
    ],
});
