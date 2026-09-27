/**
 * Document scroll lock for modal overlays (#277).
 *
 * A modal `<dialog>` makes the page behind it inert, but not still: a wheel
 * or a touch drag over the backdrop scrolls the document underneath. The
 * lock sets `overflow: hidden` on the root element while any modal holds it,
 * and pads the root's inline end by the scrollbar's width so the layout does
 * not shift sideways when the scrollbar disappears — unless the page
 * already reserves that space with `scrollbar-gutter: stable`, where the
 * gutter stays and padding would double it.
 *
 * Ref-counted: two modals open at once (a confirm over a sheet) hold one
 * lock between them, and the root's own styles come back only when the last
 * holder releases. The counter is module state, and client-only like the
 * dismiss layer stack — nothing here runs during SSR.
 *
 * Internal: not exported from the behaviors barrel.
 */

interface Saved {
    overflow: string;
    paddingInlineEnd: string;
}

let holders = 0;
let saved: Saved | null = null;

/** The width the root's vertical scrollbar takes from the layout, px. */
function scrollbarWidth(root: HTMLElement): number {
    const view = root.ownerDocument.defaultView;
    // No layout (a simulated DOM) measures the root as 0 wide: no scrollbar.
    if (!view || root.clientWidth === 0) return 0;
    return Math.max(0, view.innerWidth - root.clientWidth);
}

function gutterReserved(root: HTMLElement): boolean {
    const view = root.ownerDocument.defaultView;
    const gutter = view?.getComputedStyle(root).getPropertyValue('scrollbar-gutter') ?? '';
    return gutter.includes('stable');
}

function lock(root: HTMLElement): void {
    const style = root.style;
    saved = { overflow: style.overflow, paddingInlineEnd: style.paddingInlineEnd };
    // Measured before the overflow change, while the scrollbar still shows.
    const width = gutterReserved(root) ? 0 : scrollbarWidth(root);
    if (width > 0) {
        const view = root.ownerDocument.defaultView;
        const current = parseFloat(view?.getComputedStyle(root).paddingInlineEnd ?? '') || 0;
        style.paddingInlineEnd = `${current + width}px`;
    }
    style.overflow = 'hidden';
}

function unlock(root: HTMLElement): void {
    if (!saved) return;
    root.style.overflow = saved.overflow;
    root.style.paddingInlineEnd = saved.paddingInlineEnd;
    saved = null;
}

/**
 * Take a hold on the document scroll lock; returns its release, which is
 * idempotent — a holder releasing twice gives up only its own hold.
 */
export function acquireScrollLock(): () => void {
    if (typeof document === 'undefined') return () => {};
    const root = document.documentElement;
    if (holders++ === 0) lock(root);
    let held = true;
    return () => {
        if (!held) return;
        held = false;
        if (--holders === 0) unlock(root);
    };
}

/** Holders right now — for tests. */
export function scrollLockHolders(): number {
    return holders;
}

/**
 * A component's hold on the lock: `hold()` takes it (once — a second call
 * while held is a no-op), `release()` gives it back. Release on close and on
 * unmount.
 */
export interface ScrollLockHold {
    hold(): void;
    release(): void;
}

export function createScrollLockHold(): ScrollLockHold {
    let release: (() => void) | null = null;
    return {
        hold() {
            if (!release) release = acquireScrollLock();
        },
        release() {
            const r = release;
            release = null;
            r?.();
        },
    };
}
