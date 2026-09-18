/**
 * Hierarchical item registration for TreeView.
 *
 * The design decision that keeps a tree tractable: the controller
 * IMPLEMENTS the flat `ListController` interface, where `items()` /
 * `enabledItems()` return only the VISIBLE nodes — every ancestor branch
 * expanded — in DOM order. Roving keyboard navigation and typeahead then
 * work on a tree UNCHANGED: Up/Down move through what the user can see,
 * which is exactly the APG tree pattern's definition of next/previous.
 *
 * Registration stays flat and SSR-safe (registration order is depth-first
 * render order, the same fallback the flat list uses); hierarchy comes from
 * `parentValue`, provided by the component's nested branch context.
 * Expansion state lives in the COMPONENT (a controllable model) — the
 * controller only asks `isExpanded(value)`.
 */
import { sortByDomOrder, type ListController, type ListItem } from './list.js';

export interface TreeItem extends ListItem {
    /** Value of the parent branch; null at the root level. */
    parentValue: string | null;
    /** True for branch nodes (they render aria-expanded). */
    isBranch(): boolean;
}

export interface TreeController extends ListController {
    registerNode(item: TreeItem): () => void;
    /** The visible nodes, DOM-ordered — the same array items() returns, typed. */
    visibleItems(): TreeItem[];
    /** 1-based depth for aria-level (1 = root level). */
    level(value: string): number;
    /** Ordered siblings under a parent — aria-posinset / aria-setsize. */
    childrenOf(parentValue: string | null): TreeItem[];
    findNode(value: string): TreeItem | undefined;
}

export function createTreeController(opts: {
    isExpanded(value: string): boolean;
}): TreeController {
    const registered: TreeItem[] = [];

    const findNode = (value: string): TreeItem | undefined =>
        registered.find((i) => i.value === value);

    const isVisible = (item: TreeItem): boolean => {
        let parent = item.parentValue;
        // Cycle guard: a malformed parent chain must not hang navigation.
        for (let hops = 0; parent !== null && hops < registered.length; hops++) {
            if (!opts.isExpanded(parent)) return false;
            parent = findNode(parent)?.parentValue ?? null;
        }
        return true;
    };

    const visibleItems = (): TreeItem[] => sortByDomOrder(registered.filter(isVisible));

    return {
        register(item) {
            // The flat signature; tree consumers use registerNode.
            return this.registerNode(item as TreeItem);
        },
        registerNode(item) {
            registered.push(item);
            return () => {
                const idx = registered.indexOf(item);
                if (idx !== -1) registered.splice(idx, 1);
            };
        },
        items: visibleItems,
        enabledItems: () => visibleItems().filter((i) => !i.disabled()),
        find: (value) => {
            const node = findNode(value);
            return node && isVisible(node) ? node : undefined;
        },
        visibleItems,
        level(value) {
            let depth = 1;
            let parent = findNode(value)?.parentValue ?? null;
            for (let hops = 0; parent !== null && hops < registered.length; hops++) {
                depth++;
                parent = findNode(parent)?.parentValue ?? null;
            }
            return depth;
        },
        childrenOf: (parentValue) =>
            sortByDomOrder(registered.filter((i) => i.parentValue === parentValue)),
        findNode,
    };
}
