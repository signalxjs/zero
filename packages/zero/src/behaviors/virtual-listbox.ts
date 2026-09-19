/**
 * A windowed listbox (#96) — Select's and Combobox's data-mode options
 * rendered through `createVirtualList`, so ten thousand items put a screenful
 * of options in the document rather than ten thousand.
 *
 * What windowing a listbox takes beyond windowing a list:
 *
 * - **The highlighted option is pinned.** `aria-activedescendant` must name
 *   an option that exists, and the reader can scroll away from it with the
 *   wheel — so the highlighted row stays rendered wherever the viewport is
 *   (the virtual list's `pinned` row), in the same render that highlights it.
 * - **Scrolling moves to the model.** A keyboard highlight (arrows,
 *   Home/End, PageUp/PageDown, typeahead) may land on a row that has never
 *   rendered, so the listbox's scroll-into-view is replaced by
 *   `scrollToIndex` over the layout — `auto`, as far as needed, like the
 *   `scrollIntoView({ block: 'nearest' })` it stands in for.
 * - **The popup is the viewport.** The rows' container is the listbox
 *   itself; the leading `spacer` part stands in for the rows above the
 *   window (and is the list's origin: the popup's own padding sits above
 *   it), the trailing one for the rows below.
 * - **Opening scrolls to the highlight** in the next frame, once the popup
 *   has a size — a hidden popover has none to scroll in.
 *
 * Call from the setup of the component that renders the rows, before any
 * other mount work that needs the viewport.
 */
import { computed, onMounted, onUnmounted, watch } from 'sigx';
import type { Collection } from './collection.js';
import type { Listbox } from './listbox.js';
import { createVirtualList, type VirtualList } from './virtual-list.js';

export interface VirtualListboxOptions<T> {
    listbox: Listbox<T>;
    collection: Collection<T, unknown>;
    /** Whether the popup is showing, read reactively. */
    open: () => boolean;
    /** The height of an option not yet measured, in px. Default 36. */
    estimateSize?: () => number | undefined;
    /**
     * Re-scroll when this changes (Combobox's query): to the highlight when
     * it survived the change, else to the top.
     */
    resetOn?: () => unknown;
}

/** One rendered option. */
export interface VirtualListboxRow<T> {
    readonly key: string;
    /** Position among the VISIBLE items — `aria-posinset` is this plus one. */
    readonly index: number;
    readonly item: T;
    /** Unrendered height before this row, in px — a spacer to render first (see `VirtualRow.skip`). */
    readonly skip: number;
}

export interface VirtualListbox<T> {
    rows(): VirtualListboxRow<T>[];
    /** The leading spacer's height. */
    before(): number;
    /** The trailing spacer's height. */
    after(): number;
    /** How many options are visible — `aria-setsize`. */
    setSize(): number;
    /** How many options one page (PageUp/PageDown) moves. */
    pageSize(): number;
    /** Ref for the leading spacer: the list's origin, inside the viewport. */
    readonly startRef: (el: HTMLElement | null) => void;
    /** Ref for an option's element — measures it. Stable per key. */
    measureRef(key: string): (el: Element | null) => void;
}

export function createVirtualListbox<T>(opts: VirtualListboxOptions<T>): VirtualListbox<T> {
    const { listbox, collection } = opts;
    // Cached: the virtual list reads a key per index, and the visible list
    // is a filter over every item.
    const items = computed(() => listbox.visibleItems());
    const keys = computed(() => items.value.map((item) => collection.keyOf(item)));
    const positions = computed(() => {
        const map = new Map<string, number>();
        keys.value.forEach((key, i) => map.set(key, i));
        return map;
    });
    const indexOf = (key: string | null): number => (key === null ? -1 : positions.value.get(key) ?? -1);

    let start: HTMLElement | null = null;
    let viewport: HTMLElement | null = null;
    let v: VirtualList | null = null;

    // Registered before the virtual list's own mount work, so the window's
    // first real computation already has the viewport.
    onMounted(() => {
        viewport = start?.parentElement ?? null;
        v?.viewportRef(viewport);
    });

    const list = createVirtualList({
        count: () => keys.value.length,
        key: (i) => keys.value[i]!,
        estimateSize: opts.estimateSize?.() ?? 36,
        pinned: () => indexOf(listbox.highlighted.value),
    });
    v = list;

    const scrollTo = (key: string | null, align: 'auto' | 'center'): void => {
        if (!viewport) return;
        const i = indexOf(key);
        // No highlight: the top — through the list, so the window follows
        // (a hidden popover forgot its scroll position; the window did not).
        if (i < 0) list.scrollToIndex(0, 'start');
        else list.scrollToIndex(i, align);
    };

    listbox.setScroller((key) => scrollTo(key, 'auto'));
    onUnmounted(() => listbox.setScroller(null));

    // A hidden popover has no height to scroll in: once it shows — the next
    // frame, before it paints, when every effect that shows it has run —
    // bring the highlight (the selection, on open) to the middle.
    const nextFrame = (fn: () => void): void => {
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(fn);
        else queueMicrotask(fn);
    };
    watch(opts.open, (open) => {
        if (open) nextFrame(() => { if (opts.open()) scrollTo(listbox.highlighted.value, 'center'); });
    });
    if (opts.resetOn) {
        watch(opts.resetOn, () => {
            queueMicrotask(() => scrollTo(listbox.highlighted.value, 'auto'));
        });
    }

    return {
        rows: () => {
            const all = items.value;
            return list.rows().map((row) => ({ key: row.key, index: row.index, item: all[row.index]!, skip: row.skip }));
        },
        before: list.before,
        after: list.after,
        setSize: () => keys.value.length,
        pageSize: () => {
            const rows = list.rows();
            if (!viewport || rows.length === 0) return 10;
            const average = rows.reduce((sum, row) => sum + row.size, 0) / rows.length;
            return Math.max(1, Math.floor(viewport.clientHeight / Math.max(1, average)));
        },
        startRef: (el) => {
            start = el;
            list.listRef(el);
        },
        measureRef: list.measureRef,
    };
}
