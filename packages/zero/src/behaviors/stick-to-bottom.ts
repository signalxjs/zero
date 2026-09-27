/**
 * Stick to bottom — follow the tail of a scroll container (a chat transcript,
 * a log) until the reader scrolls up, and keep the row being read still
 * when content arrives above it.
 *
 * ```ts
 * const tail = createStickToBottom();
 * // <div ref={tail.viewportRef} style="overflow-y: auto">
 * //     <div ref={tail.contentRef}>{rows}</div>
 * // </div>
 * // <button hidden={tail.following()} onClick={tail.scrollToEnd}>Jump to latest</button>
 * ```
 *
 * - **Following.** While `following()`, every change to the content's size
 *   (an appended row, a last row streaming text, the viewport resizing)
 *   keeps the end in view. The content is watched by a `ResizeObserver`,
 *   whose callback runs after layout and before paint — so the tail is
 *   pinned in the same frame the row appears, with no flash of the old
 *   position. Setting `scrollTop` there resizes nothing, so it can never
 *   become a "ResizeObserver loop".
 * - **Letting go.** An upward scroll lets go — and so, a frame earlier, does
 *   the gesture that causes one: a wheel moving up, a touch dragging the
 *   content down. Only an UPWARD move lets go, so content growing faster
 *   than the scroll event fires can never be mistaken for the reader
 *   leaving, and a list the browser clamps as it shrinks is not the reader
 *   either. A gesture over a container with nothing to scroll lets go of
 *   nothing.
 * - **Resuming.** Scrolling back to the end (within `threshold`) follows
 *   again; `scrollToEnd()` jumps there and follows.
 * - **The anchor.** While not following, the first row (a direct child of
 *   the content) still showing at the top of the viewport is the anchor: a
 *   size change — rows prepended above it ("load earlier"), a row above it
 *   growing — scrolls by exactly the distance it moved, so the row being
 *   read stays put. The browser's own scroll anchoring is switched off on
 *   the viewport (`overflow-anchor: none`), where it exists: two correctors
 *   would fight, and WebKit has none to rely on.
 *
 * `contentRef` is optional: without it this is only the following state and
 * the gesture rules — `createVirtualList` uses it that way, and pins and
 * anchors through its own layout model (`onScroll`, `settle()`).
 *
 * SSR: setup never touches the DOM; everything attaches through the refs.
 * Call from a component's setup — it detaches on unmount.
 */
import { getCurrentInstance, onUnmounted, signal } from 'sigx';

export interface StickToBottomOptions {
    /**
     * The following state to drive — any `{ value }` cell, such as a
     * controllable model. Default: an internal one seeded by
     * `defaultFollowing`.
     */
    state?: { value: boolean };
    /** Seed of the internal state. Default true. */
    defaultFollowing?: boolean;
    /**
     * False turns following off entirely: `following()` stays false and no
     * gesture changes it (a plain windowed list). Default true.
     */
    enabled?: boolean;
    /** Distance from the end, in px, that still counts as AT the end. Default 24. */
    threshold?: number | (() => number);
    /** Called after every scroll event, once `following` has been updated. */
    onScroll?: (scrollTop: number) => void;
}

/**
 * The core both `createStickToBottom` and `createVirtualList` build on: the
 * following state and the rules that change it, attached to a viewport. It
 * pins and anchors nothing — each caller does that its own way (the DOM
 * here, the layout model in the virtual list) — which keeps a windowed
 * list from carrying the DOM anchor it never uses. No component lifecycle
 * of its own: the caller detaches it (`viewportRef(null)`) on unmount.
 */
export interface TailFollow {
    following(): boolean;
    setFollowing(following: boolean): void;
    readonly viewportRef: (el: HTMLElement | null) => void;
    settle(): void;
}

/** @internal */
export function followTail(options: StickToBottomOptions & { onLetGo?: () => void }): TailFollow {
    const enabled = options.enabled ?? true;
    const state = options.state ?? signal({ value: options.defaultFollowing ?? true });
    const threshold = (): number => {
        const t = options.threshold ?? 24;
        return typeof t === 'function' ? t() : t;
    };
    let viewport: HTMLElement | null = null;
    /** The last scrollTop seen — an upward move is what lets go. */
    let lastScrollTop = 0;
    /** Where a touch drag started, in client px. */
    let touchY: number | null = null;

    const following = (): boolean => enabled && state.value;
    const setFollowing = (next: boolean): void => {
        const v = enabled && next;
        if (state.value !== v) state.value = v;
        if (!v) options.onLetGo?.();
    };
    const scrollable = (): boolean => !!viewport && viewport.scrollHeight - viewport.clientHeight > 1;

    const onScroll = (): void => {
        const scrollTop = viewport!.scrollTop;
        if (enabled) {
            const gap = viewport!.scrollHeight - viewport!.clientHeight - scrollTop;
            // An upward move lets go FIRST, even inside `threshold`: a smooth
            // wheel scroll (WebKit) moves a few px in its first frame, and
            // still counting that as "at the end" snapped the reader back on
            // the next layout pass, cancelling the scroll (#134). Only a
            // position AT the end — the browser clamping a shrinking list —
            // is not the reader leaving.
            if (scrollTop < lastScrollTop - 1 && gap > 1) state.value = false;
            else if (gap <= threshold() && !state.value) state.value = true;
        }
        lastScrollTop = scrollTop;
        options.onScroll?.(scrollTop);
    };

    // The gestures that are about to scroll up let go before the scroll
    // lands, so no layout pass in between can pin the reader back.
    const onWheel = (e: WheelEvent): void => {
        if (e.deltaY < 0 && !e.ctrlKey && scrollable()) setFollowing(false);
    };
    const onTouchStart = (e: TouchEvent): void => {
        touchY = e.touches.length === 1 ? e.touches[0]!.clientY : null;
    };
    const onTouchMove = (e: TouchEvent): void => {
        // The finger moving DOWN drags the content down: a scroll up.
        if (touchY !== null && e.touches.length === 1 && e.touches[0]!.clientY - touchY > 4 && scrollable()) setFollowing(false);
    };
    const listeners: Array<[string, EventListener]> = [
        ['scroll', onScroll as EventListener],
        ['wheel', onWheel as EventListener],
        ['touchstart', onTouchStart as EventListener],
        ['touchmove', onTouchMove as EventListener],
    ];

    return {
        following,
        setFollowing,
        viewportRef: (el) => {
            if (viewport === el) return;
            // Only the scroll listener without following: the gestures have
            // nothing to let go of.
            for (const [type, fn] of enabled ? listeners : listeners.slice(0, 1)) {
                viewport?.removeEventListener(type, fn);
                el?.addEventListener(type, fn, { passive: true });
            }
            viewport = el;
            if (el) {
                el.style.overflowAnchor = 'none';
                lastScrollTop = el.scrollTop;
            }
        },
        settle: () => {
            if (viewport) lastScrollTop = viewport.scrollTop;
        },
    };
}


export interface StickToBottom {
    /** Following the tail. */
    following(): boolean;
    /** Follow (true) or let go (false) — no scrolling; `scrollToEnd()` jumps. */
    setFollowing(following: boolean): void;
    /** Ref for the scroll container. */
    readonly viewportRef: (el: HTMLElement | null) => void;
    /**
     * Ref for the element the rows render into, inside the viewport —
     * watched for size changes, and its direct children are what the anchor
     * picks from. Optional (see the module comment).
     */
    readonly contentRef: (el: HTMLElement | null) => void;
    /** Jump to the end and follow. */
    scrollToEnd(): void;
    /**
     * Put the viewport where the state says it belongs, now: at the end
     * while following, else wherever keeps the anchor row still.
     */
    pin(): void;
    /**
     * Record the viewport's current position as the reader's — call after
     * scrolling it programmatically, so the scroll event that follows is not
     * read as the reader moving up.
     */
    settle(): void;
    /** How far the viewport is from its end, in px (0 with no viewport). */
    distanceToEnd(): number;
}

export function createStickToBottom(options: StickToBottomOptions = {}): StickToBottom {
    if (!getCurrentInstance()) {
        throw new Error('[zero] createStickToBottom() must be called from a component\'s setup — it attaches through refs and detaches on unmount');
    }
    let viewport: HTMLElement | null = null;
    let content: HTMLElement | null = null;
    let observer: ResizeObserver | null = null;
    /** The row being read and its distance from the viewport's top edge. */
    let anchor: { el: Element; offset: number } | null = null;

    /** The top of the viewport's scrollport — below its border (`clientTop`). */
    const viewTop = (): number => viewport!.getBoundingClientRect().top + viewport!.clientTop;

    function captureAnchor(): void {
        anchor = null;
        if (!viewport || !content) return;
        const top = viewTop();
        for (const el of content.children) {
            const r = el.getBoundingClientRect();
            if (r.bottom > top) {
                anchor = { el, offset: r.top - top };
                return;
            }
        }
    }

    const tail = followTail({
        ...options,
        onLetGo: captureAnchor,
        onScroll: (scrollTop) => {
            if (!tail.following()) captureAnchor();
            options.onScroll?.(scrollTop);
        },
    });

    const toEnd = (): void => {
        const end = viewport!.scrollHeight - viewport!.clientHeight;
        if (Math.abs(viewport!.scrollTop - end) >= 1) viewport!.scrollTop = end;
    };

    const pin = (): void => {
        if (!viewport) return;
        if (tail.following()) {
            toEnd();
        } else if (content) {
            if (anchor && anchor.el.isConnected && content.contains(anchor.el)) {
                const moved = anchor.el.getBoundingClientRect().top - viewTop() - anchor.offset;
                if (Math.abs(moved) >= 1) viewport.scrollTop += moved;
            }
            captureAnchor();
        }
        tail.settle();
    };

    // Pinning runs inside the observer's callback — after layout, before
    // paint. It only scrolls, and a scroll resizes nothing, so it can never
    // become a "ResizeObserver loop".
    const watchSizes = (el: Element): void => {
        if (!observer && typeof ResizeObserver === 'function') observer = new ResizeObserver(pin);
        observer?.observe(el);
    };

    const viewportRef = (el: HTMLElement | null): void => {
        if (viewport === el) return;
        if (viewport) observer?.unobserve(viewport);
        tail.viewportRef(el);
        viewport = el;
        anchor = null;
        // Watched only alongside content: without it, the caller pins.
        if (el && content) watchSizes(el);
    };

    const contentRef = (el: HTMLElement | null): void => {
        if (content === el) return;
        if (content) observer?.unobserve(content);
        content = el;
        anchor = null;
        if (el) {
            watchSizes(el);
            if (viewport) watchSizes(viewport);
        }
    };

    onUnmounted(() => {
        viewportRef(null);
        contentRef(null);
        observer?.disconnect();
        observer = null;
    });

    return {
        following: tail.following,
        setFollowing: tail.setFollowing,
        viewportRef,
        contentRef,
        scrollToEnd: () => {
            tail.setFollowing(true);
            if (!viewport) return;
            toEnd();
            tail.settle();
        },
        pin,
        settle: tail.settle,
        distanceToEnd: () =>
            viewport ? Math.max(0, viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop) : 0,
    };
}
