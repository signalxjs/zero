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
 * - **Groups flatten into the window (#127).** A `group` element contains
 *   its options, so it cannot be split across a window; windowed, each group
 *   is a `group-heading` ROW instead, laid out and measured like an option,
 *   and every option under it names it through `aria-describedby`. The
 *   heading is `aria-hidden`: the listbox holds options only, and the
 *   description is how its text reaches each option.
 *
 * Call from the setup of the component that renders the rows, before any
 * other mount work that needs the viewport.
 */
import { computed, onMounted, onUnmounted, watch } from 'sigx';
import type { JSXElement } from 'sigx';
import type { Collection } from './collection.js';
import type { Listbox } from './listbox.js';
import { createVirtualList, type VirtualList } from './virtual-list.js';

export interface VirtualListboxOptions<T> {
    listbox: Listbox<T>;
    collection: Collection<T, unknown>;
    /** Prefix for the heading rows' ids — `<idBase>-group-<n>`. */
    idBase: string;
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
export interface VirtualListboxOptionRow<T> {
    readonly kind: 'option';
    readonly key: string;
    /** Position among the VISIBLE options — `aria-posinset` is this plus one. */
    readonly index: number;
    readonly item: T;
    /** The id of the heading of the group it is in — its `aria-describedby`. */
    readonly heading?: string;
    /** Unrendered height before this row, in px — a spacer to render first (see `VirtualRow.skip`). */
    readonly skip: number;
}

/** One rendered group heading: a row of its own, not an option. */
export interface VirtualListboxHeadingRow {
    readonly kind: 'heading';
    /** NUL-prefixed, so no item key can collide with it. */
    readonly key: string;
    readonly group: string;
    readonly id: string;
    readonly skip: number;
}

export type VirtualListboxRow<T> = VirtualListboxOptionRow<T> | VirtualListboxHeadingRow;

export interface VirtualListbox<T> {
    rows(): VirtualListboxRow<T>[];
    /** The leading spacer's height. */
    before(): number;
    /** The trailing spacer's height. */
    after(): number;
    /** How many options are visible — `aria-setsize`. Headings are not options. */
    setSize(): number;
    /** How many options one page (PageUp/PageDown) moves. */
    pageSize(): number;
    /** Ref for the leading spacer: the list's origin, inside the viewport. */
    readonly startRef: (el: HTMLElement | null) => void;
    /** Ref for a row's element (an option's or a heading's) — measures it. Stable per key. */
    measureRef(key: string): (el: Element | null) => void;
}

/**
 * What a Select or Combobox root hands its windowing strategy (#119): one
 * object, built once in the root's setup, that the window reads and writes.
 */
export interface ListboxWindowHost {
    /** The root's `data-scope` — the `spacer` parts carry it. */
    readonly scope: string;
    readonly listbox: Listbox<unknown>;
    readonly collection: Collection<unknown, unknown>;
    /** Whether the popup is showing, read reactively. */
    open(): boolean;
    /** `estimateItemSize`: an option's height before it is measured, in px. */
    estimateSize(): number | undefined;
    /** Re-scroll when this changes (Combobox's query) — see `VirtualListboxOptions.resetOn`. */
    resetOn?(): unknown;
    /** Prefix for the heading rows' ids — the root's base id. */
    readonly idBase: string;
    /**
     * One option as the root renders it, told its place in the whole visible
     * list and, in a group, its heading's id.
     */
    item(item: unknown, index: number, setSize: number, heading?: string): JSXElement;
    /** One group heading row: the `group-heading` part, measured through `ref`. */
    heading(group: string, id: string, ref: (el: Element | null) => void): JSXElement;
    /**
     * The live window while one is rendered — set by the strategy, read by
     * the root (PageUp/PageDown) and by each option (its measuring ref).
     */
    current: VirtualListbox<unknown> | null;
}

/**
 * The value `virtual` takes on `Select.Root` / `Combobox.Root`: a windowing
 * strategy, imported from its own subpath so an app pays for windowing only
 * where it windows —
 *
 * ```tsx
 * import { virtualListbox } from '@sigx/zero/virtual-listbox';
 * <Select.Root items={zones} virtual={virtualListbox} />
 * ```
 */
export interface ListboxWindowing {
    /** Renders the windowed options into the popup, which is the scroll viewport. */
    render(host: ListboxWindowHost): JSXElement;
}

export function createVirtualListbox<T>(opts: VirtualListboxOptions<T>): VirtualListbox<T> {
    const { listbox, collection } = opts;
    // The rows, cached: the virtual list reads a key per index, and the
    // visible list is a filter over every item. Grouped, each group's
    // options follow a heading row — the visible list is already in segment
    // order (the listbox walks it that way), so a group is a contiguous run.
    type Row = { key: string; item: T; index: number; heading?: string } | { key: string; group: string; id: string };
    const layout = computed(() => {
        const rows: Row[] = [];
        let options = 0;
        let current: { group: string; id: string } | undefined;
        let groups = 0;
        for (const item of listbox.visibleItems()) {
            const group = collection.groupOf(item);
            if (group !== undefined && group !== current?.group) {
                current = { group, id: `${opts.idBase}-group-${groups++}` };
                rows.push({ key: `\0group:${group}`, ...current });
            } else if (group === undefined) {
                current = undefined;
            }
            rows.push({ key: collection.keyOf(item), item, index: options++, heading: current?.id });
        }
        const positions = new Map<string, number>();
        rows.forEach((row, i) => positions.set(row.key, i));
        return { rows, options, positions };
    });
    const indexOf = (key: string | null): number => (key === null ? -1 : layout.value.positions.get(key) ?? -1);
    /** The key of the heading row above row `i` — the nearest one before it. */
    const headingKey = (i: number): string | null => {
        const rows = layout.value.rows;
        for (let j = i - 1; j >= 0; j--) if ('group' in rows[j]!) return rows[j]!.key;
        return null;
    };

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
        count: () => layout.value.rows.length,
        key: (i) => layout.value.rows[i]!.key,
        estimateSize: opts.estimateSize?.() ?? 36,
        // The highlight, and its group's heading: the option the active
        // descendant names says its group through that heading.
        pinned: () => {
            const i = indexOf(listbox.highlighted.value);
            const row = layout.value.rows[i];
            return row && 'item' in row && row.heading !== undefined ? [i, indexOf(headingKey(i))] : i;
        },
    });
    v = list;

    const scrollTo = (key: string | null, align: 'auto' | 'center'): void => {
        if (!viewport) return;
        const i = indexOf(key);
        // No highlight: the top — through the list, so the window follows
        // (a hidden popover forgot its scroll position; the window did not).
        if (i < 0) {
            list.scrollToIndex(0, 'start');
            return;
        }
        list.scrollToIndex(i, align);
        // A group's first option brings its heading along: `auto` from the
        // row above is a no-op while the heading shows, and scrolls it in
        // (the option, right below it, stays shown) once it has scrolled off.
        if (i > 0 && 'group' in layout.value.rows[i - 1]!) list.scrollToIndex(i - 1, 'auto');
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
            const all = layout.value.rows;
            const window = list.rows();
            // An option names its heading only while that heading is in the
            // document — a reference to an unrendered id is dangling ARIA.
            // The highlighted option's always is (pinned, above); an option
            // deep in a group whose heading scrolled off simply says less.
            const shown = new Set<string>();
            for (const row of window) {
                const r = all[row.index]!;
                if ('group' in r) shown.add(r.id);
            }
            return window.map((row): VirtualListboxRow<T> => {
                const r = all[row.index]!;
                return 'group' in r
                    ? { kind: 'heading', key: r.key, group: r.group, id: r.id, skip: row.skip }
                    : {
                        kind: 'option',
                        key: r.key,
                        index: r.index,
                        item: r.item,
                        heading: r.heading !== undefined && shown.has(r.heading) ? r.heading : undefined,
                        skip: row.skip,
                    };
            });
        },
        before: list.before,
        after: list.after,
        setSize: () => layout.value.options,
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
