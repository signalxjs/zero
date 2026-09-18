/**
 * Windowing — render only the rows of a long list that are near the
 * viewport, and follow the tail of a chat or log list.
 *
 * The consumer renders; this decides WHAT to render. A scroll container
 * (`viewportRef`), a list inside it whose block padding stands in for the
 * rows that are not rendered (`before()` / `after()`), and one element per
 * row in `rows()`, keyed by the row's key and measured through
 * `measureRef(key)`:
 *
 * ```tsx
 * const v = createVirtualList({
 *     count: () => state.messages.length,
 *     key: (i) => state.messages[i]!.id,
 *     estimateSize: 64,
 *     stickToBottom: true,
 * });
 * return () => (
 *     <div ref={v.viewportRef} role="log" style="overflow-y: auto; height: 24rem">
 *         <ol ref={v.listRef} style={`padding-block: ${v.before()}px ${v.after()}px`}>
 *             {v.rows().map((row) => (
 *                 <li key={row.key} ref={v.measureRef(row.key)}>{…state.messages[row.index]}</li>
 *             ))}
 *         </ol>
 *     </div>
 * );
 * ```
 *
 * - **Keyed rows, measured heights.** A row's height is measured in the task
 *   it renders in, watched from then on by one shared `ResizeObserver`, and
 *   remembered by KEY, so it survives the row leaving the window and the
 *   list shifting under it. Unmeasured rows count `estimateSize`. Rows stack
 *   in the block direction with no margins; the list's `gap` is `gap`.
 * - **Anchor-preserving.** Whatever row sits at the top of the viewport stays
 *   put when rows are prepended above it, or when a row above it turns out
 *   taller or shorter than its estimate. The browser's own scroll anchoring
 *   is switched off on the viewport (`overflow-anchor: none`) — two
 *   correctors would fight.
 * - **Stick to bottom.** With `stickToBottom`, the list follows the tail —
 *   every appended row or growing last row keeps the end in view — until the
 *   reader scrolls UP; scrolling back to the end (within `threshold`) or
 *   `scrollToEnd()` resumes it. Only an upward scroll unfollows, so content
 *   growing faster than the scroll event fires can never be mistaken for the
 *   reader leaving.
 *
 * SSR: setup never touches the DOM. Until mount, `rows()` is the first
 * `initialCount` rows — the LAST ones under `stickToBottom` — so the server
 * and the first client render agree; the real window is computed on mount.
 *
 * Call from the setup of the component that renders the rows: it binds to
 * that component's mount and unmount.
 */
import { batch, computed, getCurrentInstance, onMounted, onUnmounted, signal, watch } from 'sigx';

export interface VirtualListOptions {
    /** How many rows the list has, read reactively. */
    count: () => number;
    /**
     * The row's stable identity, read reactively — the measured height is
     * remembered by it, and it is what an anchor survives a prepend by.
     * Unique across the list.
     */
    key: (index: number) => string;
    /** The height of a row that has not been measured yet, in px. Default 40. */
    estimateSize?: number | ((index: number) => number);
    /**
     * Space between rows, in px — the same `gap` the list's CSS lays out, so
     * the arithmetic matches the paint. Default 0.
     */
    gap?: number;
    /** Rows rendered beyond each edge of the viewport. Default 4. */
    overscan?: number;
    /** Follow the tail until the reader scrolls up (a chat or log list). Default false. */
    stickToBottom?: boolean;
    /** Distance from the end, in px, that still counts as AT the end. Default 24. */
    threshold?: number;
    /** Rows rendered before mount (server, first client render). Default 20. */
    initialCount?: number;
}

/** One row of the window. */
export interface VirtualRow {
    readonly index: number;
    readonly key: string;
    /** The row's offset from the top of the list, in px. */
    readonly start: number;
    /** Its measured height, or the estimate until it has been measured. */
    readonly size: number;
}

export interface VirtualList {
    /** The rows to render, in order — the window. */
    rows(): VirtualRow[];
    /** Height of the rows above the window, in px — the list's block-start padding. */
    before(): number;
    /** Height of the rows below the window, in px — the list's block-end padding. */
    after(): number;
    /** The whole list's height, in px (measured where known, estimated elsewhere). */
    totalSize(): number;
    /** The row count — for `aria-setsize` where the list's semantics need it. */
    count(): number;
    /** Following the tail (`stickToBottom` only; always false otherwise). */
    following(): boolean;
    /** Ref for the scroll container. */
    readonly viewportRef: (el: HTMLElement | null) => void;
    /**
     * Ref for the list inside it — optional; wire it when anything scrolls
     * with the list above it (a "load earlier" button, a header), so its
     * offset is accounted for.
     */
    readonly listRef: (el: HTMLElement | null) => void;
    /** Ref for a row's element — measures it. Stable per key. */
    measureRef(key: string): (el: Element | null) => void;
    /** Scroll a row into view. `auto` (default) scrolls only as far as needed. */
    scrollToIndex(index: number, align?: 'start' | 'center' | 'end' | 'auto'): void;
    /** Jump to the end; under `stickToBottom`, resume following. */
    scrollToEnd(): void;
}

interface Layout {
    keys: string[];
    starts: number[];
    sizes: number[];
    total: number;
    indexOf(key: string): number;
}

/** The first row whose bottom edge is below `y` — binary search over the ascending starts. */
function rowAt(layout: Layout, y: number): number {
    let lo = 0;
    let hi = layout.keys.length - 1;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (layout.starts[mid]! + layout.sizes[mid]! <= y) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}

export function createVirtualList(options: VirtualListOptions): VirtualList {
    if (!getCurrentInstance()) {
        throw new Error('[zero] createVirtualList() must be called from a component\'s setup — it measures on mount and detaches on unmount');
    }
    const stick = options.stickToBottom ?? false;
    const gap = (): number => options.gap ?? 0;
    const threshold = (): number => options.threshold ?? 24;
    const overscan = (): number => Math.max(0, options.overscan ?? 4);
    const estimate = (index: number): number => {
        const e = options.estimateSize ?? 40;
        return typeof e === 'function' ? e(index) : e;
    };

    const st = signal({
        mounted: false,
        /** The viewport's scrollTop, in list coordinates (minus the list's offset). */
        top: 0,
        /** The viewport's inner height. */
        height: 0,
        /** Bumped when a measurement changes — the measured sizes live outside the signal. */
        version: 0,
        following: stick,
    });

    // Measured heights by key. Outside the signal on purpose: a Map in a
    // deep-proxied signal would track every read; `version` is the one bit
    // the layout needs to know.
    const measured = new Map<string, number>();

    const layout = computed<Layout>(() => {
        void st.version;
        const n = Math.max(0, options.count());
        const keys: string[] = [];
        const starts: number[] = [];
        const sizes: number[] = [];
        const g = gap();
        let y = 0;
        for (let i = 0; i < n; i++) {
            const key = options.key(i);
            const size = measured.get(key) ?? estimate(i);
            keys.push(key);
            starts.push(y);
            sizes.push(size);
            y += size + (i < n - 1 ? g : 0);
        }
        // Prune heights of keys that left, once they outnumber the live ones —
        // a filtered list cycles keys; a log only appends.
        if (measured.size > 2 * n + 64) {
            const live = new Set(keys);
            for (const key of measured.keys()) if (!live.has(key)) measured.delete(key);
        }
        let index: Map<string, number> | null = null;
        return {
            keys,
            starts,
            sizes,
            total: y,
            indexOf(key) {
                if (!index) {
                    index = new Map();
                    for (let i = 0; i < keys.length; i++) index.set(keys[i]!, i);
                }
                return index.get(key) ?? -1;
            },
        };
    });

    const range = computed(() => {
        const l = layout.value;
        const n = l.keys.length;
        if (n === 0) return { start: 0, end: 0 };
        if (!st.mounted) {
            const initial = Math.min(n, Math.max(0, options.initialCount ?? 20));
            return stick ? { start: n - initial, end: n } : { start: 0, end: initial };
        }
        const bottom = st.top + Math.max(st.height, 1);
        let start = rowAt(l, Math.max(0, st.top));
        let end = start;
        while (end < n && l.starts[end]! < bottom) end++;
        start = Math.max(0, start - overscan());
        end = Math.min(n, Math.max(end, start + 1) + overscan());
        return { start, end };
    });

    let viewport: HTMLElement | null = null;
    let list: HTMLElement | null = null;
    let observer: ResizeObserver | null = null;
    /** The list's offset inside the scrolled content. */
    let listOffset = 0;
    /** The last scrollTop seen — an upward move is what unfollows. */
    let lastScrollTop = 0;
    /** The row the reader is looking at, and how far into it: what a layout change must keep still. */
    let anchor: { key: string; offset: number } | null = null;
    const elementKeys = new WeakMap<Element, string>();
    const refs = new Map<string, (el: Element | null) => void>();
    /** Rows rendered since the last sync — measured there, synchronously. */
    const fresh = new Set<Element>();
    /** Rows waiting for the next frame to be observed. */
    const unobserved = new Set<Element>();
    let frame = 0;

    const readOffset = (): void => {
        if (!viewport || !list) {
            listOffset = 0;
            return;
        }
        // Scroll coordinates start at the viewport's PADDING box, below its
        // border — `clientTop` is that border.
        listOffset = list.getBoundingClientRect().top
            - (viewport.getBoundingClientRect().top + viewport.clientTop)
            + viewport.scrollTop;
    };

    const captureAnchor = (scrollTop: number): void => {
        const l = layout.value;
        if (l.keys.length === 0) {
            anchor = null;
            return;
        }
        const y = scrollTop - listOffset;
        const i = rowAt(l, Math.max(0, y));
        anchor = { key: l.keys[i]!, offset: y - l.starts[i]! };
    };

    /** Read the viewport into the window state (re-renders when it moved). */
    const publish = (): void => {
        if (!viewport) return;
        const top = viewport.scrollTop - listOffset;
        if (st.top !== top) st.top = top;
        if (st.height !== viewport.clientHeight) st.height = viewport.clientHeight;
    };

    const record = (key: string, size: number): boolean => {
        if (measured.get(key) === size) return false;
        measured.set(key, size);
        return true;
    };

    /**
     * Measure the rows that just rendered, now — in the same task as the
     * render, before paint. Waiting for the ResizeObserver would paint one
     * frame with their estimates, and a row entering above the reader at
     * its real height would visibly shove everything below it.
     */
    const measureFresh = (): void => {
        let changed = false;
        for (const el of fresh) {
            const key = elementKeys.get(el);
            if (key !== undefined && el.isConnected && record(key, el.getBoundingClientRect().height)) changed = true;
        }
        fresh.clear();
        if (changed) st.version++;
    };

    /**
     * Put the viewport where the model says it belongs after a layout
     * change: at the end while following, else wherever keeps the anchor
     * row still.
     */
    const sync = (): void => {
        if (!viewport) return;
        measureFresh();
        readOffset();
        let target: number | null = null;
        if (st.following) {
            target = viewport.scrollHeight - viewport.clientHeight;
        } else if (anchor) {
            const i = layout.value.indexOf(anchor.key);
            if (i >= 0) target = listOffset + layout.value.starts[i]! + anchor.offset;
        }
        if (target !== null && Math.abs(viewport.scrollTop - target) >= 1) {
            viewport.scrollTop = target;
        }
        lastScrollTop = viewport.scrollTop;
        if (!st.following) captureAnchor(viewport.scrollTop);
        publish();
    };

    let scheduled = false;
    const schedule = (): void => {
        if (scheduled || !viewport) return;
        scheduled = true;
        // A microtask: a signal write flushes the render synchronously, so by
        // now the DOM carries the new layout — and it is still before paint.
        queueMicrotask(() => {
            scheduled = false;
            sync();
        });
    };

    const onScroll = (): void => {
        if (!viewport) return;
        const scrollTop = viewport.scrollTop;
        if (stick) {
            const atEnd = viewport.scrollHeight - viewport.clientHeight - scrollTop <= threshold();
            if (atEnd) st.following = true;
            else if (scrollTop < lastScrollTop - 1) st.following = false;
        }
        lastScrollTop = scrollTop;
        // Capture BEFORE publishing: the re-render the publish causes must
        // restore THIS position, not the one before the reader scrolled.
        captureAnchor(scrollTop);
        publish();
    };

    const onResize = (entries: ResizeObserverEntry[]): void => {
        let changed = false;
        for (const entry of entries) {
            if (entry.target === viewport) continue;
            const key = elementKeys.get(entry.target);
            if (key === undefined) continue;
            const box = entry.borderBoxSize?.[0];
            if (record(key, box ? box.blockSize : entry.target.getBoundingClientRect().height)) changed = true;
        }
        if (changed) st.version++;
        // The viewport resizing moves nothing in the layout but everything in
        // the window: re-sync either way.
        schedule();
    };

    const observe = (el: Element): void => {
        if (!observer && typeof ResizeObserver === 'function') observer = new ResizeObserver(onResize);
        observer?.observe(el);
    };

    const observePending = (): void => {
        frame = 0;
        for (const el of unobserved) observe(el);
        unobserved.clear();
    };

    /**
     * Observe a row from the NEXT frame. Rows render inside the observer's
     * own callback (a measurement moves the window), and an element first
     * observed there is a notification the browser cannot deliver in that
     * frame — reported as "ResizeObserver loop completed with undelivered
     * notifications". The row is measured synchronously on render anyway;
     * the observer is only for later changes (streamed text, a late image).
     */
    const observeSoon = (el: Element): void => {
        unobserved.add(el);
        if (frame) return;
        if (typeof requestAnimationFrame === 'function') frame = requestAnimationFrame(observePending);
        else observePending();
    };

    const viewportRef = (el: HTMLElement | null): void => {
        if (viewport === el) return;
        if (viewport) {
            viewport.removeEventListener('scroll', onScroll);
            observer?.unobserve(viewport);
        }
        viewport = el;
        if (el) {
            el.style.overflowAnchor = 'none';
            el.addEventListener('scroll', onScroll, { passive: true });
            observe(el);
        }
    };

    const listRef = (el: HTMLElement | null): void => {
        if (list === el) return;
        list = el;
        // The offset is in the old list's coordinates: re-read it (0 with no
        // list) and re-sync, so the window never runs on a stale one.
        readOffset();
        schedule();
    };

    const measureRef = (key: string): ((el: Element | null) => void) => {
        let ref = refs.get(key);
        if (!ref) {
            let current: Element | null = null;
            ref = (el) => {
                if (current === el) return;
                if (current) {
                    observer?.unobserve(current);
                    unobserved.delete(current);
                    fresh.delete(current);
                    elementKeys.delete(current);
                }
                current = el;
                if (el) {
                    // Not measured here: a ref runs before the element has
                    // children or a parent. The sync after the render does it.
                    elementKeys.set(el, key);
                    fresh.add(el);
                    observeSoon(el);
                    schedule();
                } else {
                    refs.delete(key);
                }
            };
            refs.set(key, ref);
        }
        return ref;
    };

    // Any layout change — rows added, removed, re-keyed or re-measured.
    watch(() => layout.value, schedule);

    onMounted(() => {
        // One write: the first real window is computed from the real
        // viewport, not from a zero-height one that would unmount the
        // initial rows only to mount them again.
        batch(() => {
            readOffset();
            publish();
            st.mounted = true;
        });
        sync();
    });
    onUnmounted(() => {
        if (frame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
        frame = 0;
        unobserved.clear();
        fresh.clear();
        viewportRef(null);
        observer?.disconnect();
        observer = null;
        refs.clear();
    });

    const scrollToIndex = (index: number, align: 'start' | 'center' | 'end' | 'auto' = 'auto'): void => {
        const l = layout.value;
        if (!viewport || l.keys.length === 0) return;
        const i = Math.min(Math.max(0, index), l.keys.length - 1);
        readOffset();
        const start = listOffset + l.starts[i]!;
        const size = l.sizes[i]!;
        const height = viewport.clientHeight;
        const current = viewport.scrollTop;
        let target = current;
        if (align === 'start') target = start;
        else if (align === 'end') target = start + size - height;
        else if (align === 'center') target = start + size / 2 - height / 2;
        else if (start < current) target = start;
        else if (start + size > current + height) target = start + size - height;
        const max = viewport.scrollHeight - height;
        target = Math.min(Math.max(0, target), Math.max(0, max));
        if (stick) st.following = max - target <= threshold();
        // Anchor on the TARGET row, so its measurement landing keeps it where
        // it was asked to be rather than wherever its estimate put it.
        anchor = { key: l.keys[i]!, offset: target - start };
        viewport.scrollTop = target;
        lastScrollTop = viewport.scrollTop;
        publish();
    };

    const scrollToEnd = (): void => {
        if (stick) {
            st.following = true;
            sync();
        } else {
            scrollToIndex(layout.value.keys.length - 1, 'end');
        }
    };

    const endOf = (l: Layout, i: number): number => l.starts[i]! + l.sizes[i]!;

    return {
        rows() {
            const l = layout.value;
            const { start, end } = range.value;
            const out: VirtualRow[] = [];
            for (let i = start; i < end; i++) {
                out.push({ index: i, key: l.keys[i]!, start: l.starts[i]!, size: l.sizes[i]! });
            }
            return out;
        },
        before: () => {
            const { start, end } = range.value;
            return end > start ? layout.value.starts[start]! : 0;
        },
        after: () => {
            const l = layout.value;
            const { start, end } = range.value;
            return end > start ? l.total - endOf(l, end - 1) : l.total;
        },
        totalSize: () => layout.value.total,
        count: () => layout.value.keys.length,
        following: () => st.following,
        viewportRef,
        listRef,
        measureRef,
        scrollToIndex,
        scrollToEnd,
    };
}
