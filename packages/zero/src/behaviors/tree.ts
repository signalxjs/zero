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
    /**
     * The VISIBLE nodes from `from` to `to` inclusive, in DOM order whichever
     * way round they are given — the span a Shift range selects. Empty when
     * either end is not visible (collapsed away, or not registered): a range
     * over nodes the user cannot see is not one they asked for. Disabled
     * nodes are included; the caller decides what may be selected.
     */
    range(from: string, to: string): TreeItem[];
    /**
     * Every registered LEAF under `value`, at any depth, in DOM order —
     * collapsed or not: what a checkable branch derives its state from and
     * toggles. Empty for a leaf, an unregistered value, or a branch whose
     * children have not registered (a lazily loaded subtree).
     */
    leavesOf(value: string): TreeItem[];
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
        range(from, to) {
            const visible = visibleItems();
            const a = visible.findIndex((i) => i.value === from);
            const b = visible.findIndex((i) => i.value === to);
            if (a === -1 || b === -1) return [];
            return visible.slice(Math.min(a, b), Math.max(a, b) + 1);
        },
        leavesOf(value) {
            // One parent index per call, so each ancestor hop is a lookup
            // rather than another scan of the registry: a branch's state is
            // derived at render time, once per rendered branch.
            const parentOf = new Map<string, string | null>();
            for (const i of registered) if (!parentOf.has(i.value)) parentOf.set(i.value, i.parentValue);
            const under = (item: TreeItem): boolean => {
                let parent = item.parentValue;
                for (let hops = 0; parent !== null && hops < registered.length; hops++) {
                    if (parent === value) return true;
                    parent = parentOf.get(parent) ?? null;
                }
                return false;
            };
            return sortByDomOrder(registered.filter((i) => !i.isBranch() && under(i)));
        },
    };
}
