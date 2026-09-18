/**
 * Item registration for compound list components (Tabs, Menu, Select, …) —
 * the platform-neutral core. `list.ts` re-exports all of this specialized to
 * `HTMLElement` (the shape every web component and test has always seen);
 * `core.ts` re-exports it open, for platforms without DOM types.
 *
 * Items register themselves from their setup and unregister on unmount; the
 * container navigates the collection in element order. Registration order is
 * the fallback wherever elements are absent — on the server, and on platforms
 * that never hand the controller an element at all (a Lynx runtime registers
 * `el: () => null` and registration order — depth-first render order — IS its
 * visual order). Once elements are mounted, `items()` sorts by document
 * position so visual order wins even when items are rendered conditionally or
 * out of order.
 */

/**
 * What ordering needs from an element — the two members of `HTMLElement`
 * that `sortByDomOrder` reads, stated structurally so this module never
 * needs `lib.dom`. Any DOM element satisfies it.
 */
export interface ItemElement {
    readonly isConnected: boolean;
    compareDocumentPosition(other: ItemElement): number;
}

/** `Node.DOCUMENT_POSITION_FOLLOWING`, inlined for the same reason. */
const DOCUMENT_POSITION_FOLLOWING = 4;

export interface ListItem<E extends ItemElement = ItemElement> {
    id: string;
    value: string;
    disabled(): boolean;
    el(): E | null;
    textValue(): string;
}

export interface ListController<E extends ItemElement = ItemElement> {
    /** Register an item; returns the unregister function for onUnmounted. */
    register(item: ListItem<E>): () => void;
    /** All items, DOM-ordered when mounted, registration-ordered otherwise. */
    items(): ListItem<E>[];
    /** Items that are not disabled. */
    enabledItems(): ListItem<E>[];
    /** Find the registered item for a value. */
    find(value: string): ListItem<E> | undefined;
}

/**
 * DOM-order a registered collection: items with mounted elements sort by
 * document position, items without keep registration order at the end
 * (the SSR-safe fallback). Shared by the flat list and the tree.
 *
 * "Mounted" means CONNECTED, not merely created (#339): during the first
 * render pass an item's element exists before the tree is attached, and
 * `compareDocumentPosition` across two disconnected nodes is
 * implementation-defined — an arbitrary order that read as real. Steps'
 * indicator was the first reader to evaluate order in that window (an
 * item-level derivation runs before the item's own element exists, so the
 * `< 2` fallback always covered it; a CHILD of the item runs after) and it
 * derived phases from the arbitrary answer. Disconnected elements now take
 * the registration-order fallback exactly like absent ones.
 */
export function sortByDomOrder<T extends ListItem>(registered: readonly T[]): T[] {
    const withEl = registered.filter((i) => i.el()?.isConnected);
    if (withEl.length < 2) return [...registered];
    const sorted = [...withEl].sort((a, b) => {
        const ae = a.el()!, be = b.el()!;
        if (ae === be) return 0;
        return ae.compareDocumentPosition(be) & DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
    const withoutEl = registered.filter((i) => !i.el()?.isConnected);
    return [...sorted, ...withoutEl];
}

/** One step of listbox-highlight movement: relative, or straight to an edge. */
export type HighlightStep = 1 | -1 | 'first' | 'last';

/**
 * Move a `highlighted` ref through the enabled items of a list — the shared
 * listbox-highlight step Select and Combobox both drive from their keyboard
 * handlers (previously duplicated byte-for-byte in each). Relative steps
 * clamp at the edges (APG listbox: no wrap).
 */
export function moveHighlight(
    list: ListController,
    highlighted: { value: string | null },
    step: HighlightStep,
): void {
    const items = list.enabledItems();
    if (items.length === 0) return;
    if (step === 'first') { highlighted.value = items[0]!.value; return; }
    if (step === 'last') { highlighted.value = items[items.length - 1]!.value; return; }
    const current = items.findIndex((i) => i.value === highlighted.value);
    const next = Math.min(items.length - 1, Math.max(0, current === -1 ? 0 : current + step));
    highlighted.value = items[next]!.value;
}

export function createListController<E extends ItemElement = ItemElement>(): ListController<E> {
    const registered: ListItem<E>[] = [];

    const items = (): ListItem<E>[] => sortByDomOrder(registered);

    return {
        register(item) {
            registered.push(item);
            return () => {
                const idx = registered.indexOf(item);
                if (idx !== -1) registered.splice(idx, 1);
            };
        },
        items,
        enabledItems: () => items().filter((i) => !i.disabled()),
        find: (value) => registered.find((i) => i.value === value),
    };
}
