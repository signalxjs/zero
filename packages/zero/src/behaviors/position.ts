/**
 * Anchor positioning for top-layer popups.
 *
 * The `popover` attribute lifts an element into the top layer but does NOT
 * position it — that is this behavior's job. The strategy is pluggable: the
 * built-in one computes fixed coordinates from the anchor rect (placement +
 * offset + viewport flip) and tracks scroll/resize; apps can substitute a
 * richer engine (e.g. @floating-ui/dom) through the same interface without
 * zero depending on it.
 */
import { watch } from 'sigx';
import type { PlacementName } from '../contract/data-attrs.js';

// The strategy writes `data-placement` verbatim, so the type IS the
// contract's closed placement vocabulary — deriving it keeps the two from
// drifting.
export type Placement = PlacementName;

export interface PositionOptions {
    placement: Placement;
    /** Gap between anchor and floating element, px. */
    offset: number;
    /** Flip to the opposite side when there is no room (default true). */
    flip: boolean;
}

/**
 * Anything that can report a client rect — an element, or a virtual anchor
 * standing in for one (the floating-ui convention). Strategies only ever
 * read `getBoundingClientRect()`, so an `HTMLElement` satisfies this
 * structurally and a point in the viewport satisfies it via `pointAnchor`.
 */
export interface VirtualAnchor {
    getBoundingClientRect(): DOMRectReadOnly;
}

export type PositionAnchor = HTMLElement | VirtualAnchor;

/**
 * A virtual anchor at client coordinates — what a context menu anchors to.
 * The rect is captured once: a moved pointer means a new `pointAnchor` (plus
 * `AnchorPositionHandle.update()` when already open), not a live rect.
 *
 * The rect is built structurally rather than with `new DOMRect(...)`: the
 * constructor doesn't exist in non-DOM runtimes, and while positioning never
 * RUNS on the server, a component may still construct its anchors there.
 */
export function pointAnchor(x: number, y: number, size = 0): VirtualAnchor {
    const rect = {
        x, y, width: size, height: size,
        top: y, left: x, right: x + size, bottom: y + size,
        toJSON(): unknown {
            const { x: rx, y: ry, width, height, top, right, bottom, left } = this;
            return { x: rx, y: ry, width, height, top, right, bottom, left };
        },
    } as DOMRectReadOnly;
    return { getBoundingClientRect: () => rect };
}

export interface PositionStrategy {
    /**
     * Position `floating` relative to `anchor` and keep it positioned until
     * the returned cleanup runs.
     */
    apply(anchor: PositionAnchor, floating: HTMLElement, opts: PositionOptions): () => void;
}

function computeCoords(
    anchor: DOMRectReadOnly,
    floating: { width: number; height: number },
    placement: Placement,
    offset: number,
): { top: number; left: number } {
    const [side, align = 'center'] = placement.split('-') as [string, string?];
    let top = 0;
    let left = 0;

    if (side === 'top' || side === 'bottom') {
        top = side === 'top' ? anchor.top - floating.height - offset : anchor.bottom + offset;
        if (align === 'start') left = anchor.left;
        else if (align === 'end') left = anchor.right - floating.width;
        else left = anchor.left + anchor.width / 2 - floating.width / 2;
    } else {
        left = side === 'left' ? anchor.left - floating.width - offset : anchor.right + offset;
        if (align === 'start') top = anchor.top;
        else if (align === 'end') top = anchor.bottom - floating.height;
        else top = anchor.top + anchor.height / 2 - floating.height / 2;
    }
    return { top, left };
}

const OPPOSITE: Record<string, string> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

function overflows(coords: { top: number; left: number }, size: { width: number; height: number }): boolean {
    return (
        coords.top < 0 ||
        coords.left < 0 ||
        coords.top + size.height > window.innerHeight ||
        coords.left + size.width > window.innerWidth
    );
}

/** The built-in strategy: fixed coordinates + scroll/resize tracking. */
export const fixedPositionStrategy: PositionStrategy = {
    apply(anchor, floating, opts) {
        const update = () => {
            const anchorRect = anchor.getBoundingClientRect();
            const size = { width: floating.offsetWidth, height: floating.offsetHeight };

            let placement = opts.placement;
            let coords = computeCoords(anchorRect, size, placement, opts.offset);
            if (opts.flip && overflows(coords, size)) {
                const [side, align] = placement.split('-') as [string, string?];
                const flipped = `${OPPOSITE[side]}${align ? `-${align}` : ''}` as Placement;
                const flippedCoords = computeCoords(anchorRect, size, flipped, opts.offset);
                if (!overflows(flippedCoords, size)) {
                    placement = flipped;
                    coords = flippedCoords;
                }
            }
            // Shift: flip picks the side; this keeps the result on screen
            // when neither side fully fits (a tall submenu near the bottom
            // edge would otherwise render partly out of the viewport).
            coords.top = Math.min(Math.max(coords.top, 0), Math.max(0, window.innerHeight - size.height));
            coords.left = Math.min(Math.max(coords.left, 0), Math.max(0, window.innerWidth - size.width));

            floating.style.position = 'fixed';
            floating.style.top = `${Math.round(coords.top)}px`;
            floating.style.left = `${Math.round(coords.left)}px`;
            floating.style.margin = '0';
            floating.setAttribute('data-placement', placement);
        };

        update();
        // The open-state write and the showPopover() call race across
        // reactive callbacks: measured while still display:none the floating
        // size reads 0 and the shift clamp has nothing to clamp. One frame
        // later the popover is visible and measurable.
        const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => update()) : null;
        window.addEventListener('scroll', update, { capture: true, passive: true });
        window.addEventListener('resize', update, { passive: true });
        return () => {
            if (raf != null) cancelAnimationFrame(raf);
            window.removeEventListener('scroll', update, { capture: true });
            window.removeEventListener('resize', update);
        };
    },
};

export interface AnchorPositionInput {
    getAnchor(): PositionAnchor | null;
    getFloating(): HTMLElement | null;
    isOpen(): boolean;
    placement?: () => Placement;
    offset?: () => number;
    flip?: () => boolean;
    strategy?: PositionStrategy;
}

export interface AnchorPositionHandle {
    /**
     * Re-resolve the anchor and re-run the strategy now, while open — for
     * anchors that move without an open/close transition (a second
     * right-click re-anchoring an open context menu). No-op while closed.
     */
    update(): void;
}

/**
 * Keep a floating element positioned against its anchor while open. Call
 * from component setup; SSR-inert.
 */
export function createAnchorPosition(input: AnchorPositionInput): AnchorPositionHandle {
    if (typeof document === 'undefined') return { update: () => {} };

    let reapply: (() => void) | null = null;

    watch(
        () => input.isOpen(),
        (open, _prev, onCleanup) => {
            reapply = null;
            if (!open) return;
            const apply = (): (() => void) | null => {
                const anchor = input.getAnchor();
                const floating = input.getFloating();
                if (!anchor || !floating) return null;
                const strategy = input.strategy ?? fixedPositionStrategy;
                return strategy.apply(anchor, floating, {
                    placement: input.placement?.() ?? 'bottom',
                    offset: input.offset?.() ?? 6,
                    flip: input.flip?.() ?? true,
                });
            };
            let cleanup = apply();
            reapply = () => {
                cleanup?.();
                cleanup = apply();
            };
            onCleanup(() => {
                cleanup?.();
                reapply = null;
            });
        },
        { immediate: true },
    );

    // The isOpen() re-check covers the microtask window where the model has
    // flipped closed but the watch cleanup hasn't flushed yet — an update()
    // in that gap must not re-position a logically closed popup.
    return { update: () => { if (input.isOpen()) reapply?.(); } };
}
