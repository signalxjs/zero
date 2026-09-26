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
import { POSITION_PROPERTIES } from '../contract/position-properties.js';
import { isRtl } from './direction.js';

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
    /**
     * The margin, px, the popup keeps from the viewport edges: the flip
     * treats it as the edge, the shift clamps inside it, and
     * `--available-width`/`--available-height` subtract it. Default 8.
     */
    collisionPadding?: number;
    /**
     * Cross-axis offset, px, from a `-start`/`-end` alignment — positive
     * moves the popup away from the aligned edge, toward the anchor's other
     * end (in the reading direction for an inline alignment). Ignored for a
     * centred placement. Default 0.
     */
    alignOffset?: number;
}

/** `PositionOptions.collisionPadding` when a caller leaves it out. */
export const DEFAULT_COLLISION_PADDING = 8;

/** `value` when it is a finite number (raised to `min`, if given), else `fallback`. */
function finiteOr(value: number | undefined, fallback: number, min = -Infinity): number {
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, value) : fallback;
}

/**
 * Anything that can report a client rect — an element, or a virtual anchor
 * standing in for one (the floating-ui convention). Strategies only ever
 * read `getBoundingClientRect()`, so an `HTMLElement` satisfies this
 * structurally and a point in the viewport satisfies it via `pointAnchor`.
 */
export interface VirtualAnchor {
    getBoundingClientRect(): DOMRectReadOnly;
    /**
     * The element the virtual anchor stands in for, when there is one (the
     * floating-ui convention) — a caret anchor's text control. The built-in
     * strategy reads the reading direction from it; without one, from the
     * floating element.
     */
    contextElement?: Element;
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
    const rect = rectAt(x, y, size, size);
    return { getBoundingClientRect: () => rect };
}

/** A client rect built structurally (see `pointAnchor`). */
export function rectAt(x: number, y: number, width: number, height: number): DOMRectReadOnly {
    return {
        x, y, width, height,
        top: y, left: x, right: x + width, bottom: y + height,
        toJSON(): unknown {
            const { x: rx, y: ry, width: w, height: h, top, right, bottom, left } = this;
            return { x: rx, y: ry, width: w, height: h, top, right, bottom, left };
        },
    } as DOMRectReadOnly;
}

export interface PositionStrategy {
    /**
     * Position `floating` relative to `anchor` and keep it positioned until
     * the returned cleanup runs.
     */
    apply(anchor: PositionAnchor, floating: HTMLElement, opts: PositionOptions): () => void;
}

type Side = 'top' | 'bottom' | 'left' | 'right';

/**
 * Split a placement into its PHYSICAL side and its alignment. Bare
 * `start`/`end` name the inline-start/inline-end side, so they resolve
 * through the reading direction; `top`/`bottom`/`left`/`right` are already
 * physical. The alignment stays logical here — `computeCoords` resolves it.
 */
function resolveSide(placement: Placement, rtl: boolean): { side: Side; align: string } {
    const [raw, align = 'center'] = placement.split('-') as [string, string?];
    let side = raw as Side;
    if (raw === 'start') side = rtl ? 'right' : 'left';
    else if (raw === 'end') side = rtl ? 'left' : 'right';
    return { side, align };
}

function computeCoords(
    anchor: DOMRectReadOnly,
    floating: { width: number; height: number },
    placement: Placement,
    offset: number,
    rtl: boolean,
    alignOffset = 0,
): { top: number; left: number } {
    const { side, align } = resolveSide(placement, rtl);
    let top = 0;
    let left = 0;
    // Away from the aligned edge: forward from a start edge, back from an
    // end edge; a centred popup has no edge to be offset from.
    const shift = align === 'start' ? alignOffset : align === 'end' ? -alignOffset : 0;

    if (side === 'top' || side === 'bottom') {
        top = side === 'top' ? anchor.top - floating.height - offset : anchor.bottom + offset;
        // `-start`/`-end` on a block side is an INLINE alignment: the reading
        // start edge, which is the right edge in RTL.
        const alignLeft = anchor.left;
        const alignRight = anchor.right - floating.width;
        if (align === 'start') left = rtl ? alignRight : alignLeft;
        else if (align === 'end') left = rtl ? alignLeft : alignRight;
        else left = anchor.left + anchor.width / 2 - floating.width / 2;
        // Forward along the inline axis is leftward in RTL.
        left += rtl ? -shift : shift;
    } else {
        left = side === 'left' ? anchor.left - floating.width - offset : anchor.right + offset;
        // On an inline side the alignment is block-axis, which the reading
        // direction does not turn.
        if (align === 'start') top = anchor.top;
        else if (align === 'end') top = anchor.bottom - floating.height;
        else top = anchor.top + anchor.height / 2 - floating.height / 2;
        top += shift;
    }
    return { top, left };
}

/** Every side in the placement vocabulary has an opposite — `start`/`end` included, so a flip never builds `undefined`. */
const OPPOSITE: Readonly<Record<string, string>> = {
    top: 'bottom', bottom: 'top', left: 'right', right: 'left', start: 'end', end: 'start',
};

/**
 * Whether the popup fits the viewport on its MAIN axis — the axis it leaves
 * the anchor along. Only that axis decides a flip: a bottom-start menu at a
 * right-hand corner overflows the inline axis on both the bottom and the top
 * side, and that overflow is the shift's to fix, not a reason to stay put.
 */
function fitsMainAxis(
    side: Side,
    coords: { top: number; left: number },
    size: { width: number; height: number },
    pad: number,
): boolean {
    return side === 'top' || side === 'bottom'
        ? coords.top >= pad && coords.top + size.height <= window.innerHeight - pad
        : coords.left >= pad && coords.left + size.width <= window.innerWidth - pad;
}

/** Keep `[value, value + extent]` inside `[pad, viewport - pad]`; the start edge wins when it cannot fit. */
const clamp = (value: number, extent: number, viewport: number, pad: number): number =>
    Math.min(Math.max(value, pad), Math.max(pad, viewport - pad - extent));

/**
 * The room the popup has once placed on `side`: from the anchor's facing
 * edge (plus the offset) to the viewport edge on the main axis, the whole
 * viewport on the cross axis — both less the collision padding, never
 * negative.
 */
function availableSize(side: Side, anchor: DOMRectReadOnly, offset: number, pad: number): { width: number; height: number } {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let width = vw - 2 * pad;
    let height = vh - 2 * pad;
    if (side === 'bottom') height = vh - pad - (anchor.bottom + offset);
    else if (side === 'top') height = anchor.top - offset - pad;
    else if (side === 'right') width = vw - pad - (anchor.right + offset);
    else width = anchor.left - offset - pad;
    return { width: Math.max(0, width), height: Math.max(0, height) };
}

/**
 * `--transform-origin` for a placement: the anchor-facing edge, then the
 * aligned point on it — physical keywords, the alignment resolved through
 * the reading direction exactly as `computeCoords` resolves it.
 */
function transformOrigin(side: Side, align: string, rtl: boolean): string {
    const facing = OPPOSITE[side] as Side;
    if (side === 'top' || side === 'bottom') {
        const x = align === 'start' ? (rtl ? 'right' : 'left')
            : align === 'end' ? (rtl ? 'left' : 'right')
            : 'center';
        return `${facing} ${x}`;
    }
    const y = align === 'start' ? 'top' : align === 'end' ? 'bottom' : 'center';
    return `${y} ${facing}`;
}

const px = (n: number): string => `${n}px`;

function isElement(anchor: PositionAnchor): anchor is HTMLElement {
    return typeof Element !== 'undefined' && anchor instanceof Element;
}

/** The built-in strategy: fixed coordinates + scroll/resize tracking. */
export const fixedPositionStrategy: PositionStrategy = {
    apply(anchor, floating, opts) {
        const update = () => {
            const anchorRect = anchor.getBoundingClientRect();
            const size = { width: floating.offsetWidth, height: floating.offsetHeight };
            // Resolved per update: a `dir` change while open re-reads here.
            // A virtual anchor has no direction of its own: its context
            // element's stands in, else the floating element's (inherited
            // from where the popup lives).
            const rtl = isRtl(isElement(anchor) ? anchor : anchor.contextElement ?? floating);

            // Both feed comparisons and clamps: a NaN/Infinity would make
            // every flip test false and the clamp unbounded, and a negative
            // padding would let the popup past the edge it exists to keep.
            const pad = finiteOr(opts.collisionPadding, DEFAULT_COLLISION_PADDING, 0);
            const alignOffset = finiteOr(opts.alignOffset, 0);

            let placement = opts.placement;
            let coords = computeCoords(anchorRect, size, placement, opts.offset, rtl, alignOffset);
            let { side } = resolveSide(placement, rtl);
            let fits = fitsMainAxis(side, coords, size, pad);
            if (opts.flip && !fits) {
                const [logicalSide, align] = placement.split('-') as [string, string?];
                const flipped = `${OPPOSITE[logicalSide]}${align ? `-${align}` : ''}` as Placement;
                const flippedCoords = computeCoords(anchorRect, size, flipped, opts.offset, rtl, alignOffset);
                const flippedSide = resolveSide(flipped, rtl).side;
                if (fitsMainAxis(flippedSide, flippedCoords, size, pad)) {
                    placement = flipped;
                    coords = flippedCoords;
                    side = flippedSide;
                    fits = true;
                }
            }
            // Shift: flip picks the side; the cross axis is always clamped
            // on screen, the main axis only as a last resort when neither
            // side fits (a tall submenu near the bottom edge would otherwise
            // render partly out of the viewport).
            const blockSide = side === 'top' || side === 'bottom';
            if (blockSide || !fits) coords.left = clamp(coords.left, size.width, window.innerWidth, pad);
            if (!blockSide || !fits) coords.top = clamp(coords.top, size.height, window.innerHeight, pad);

            floating.style.position = 'fixed';
            floating.style.top = `${Math.round(coords.top)}px`;
            floating.style.left = `${Math.round(coords.left)}px`;
            // The UA's `[popover] { inset: 0 }` leaves `right`/`bottom` set,
            // which over-constrains the box — and under RTL an
            // over-constrained fixed box honours `right` and drops `left`,
            // pinning every popup to the viewport's right edge.
            floating.style.right = 'auto';
            floating.style.bottom = 'auto';
            floating.style.margin = '0';
            // The LOGICAL placement — what was asked for, or its flip — never
            // the physical side it resolved to.
            floating.setAttribute('data-placement', placement);
            // The geometry a stylesheet cannot know (`POSITION_PROPERTIES`):
            // the anchor's size, the room on the side the popup resolved to,
            // and where a scale-in should grow from. Unrounded — a popup
            // sized to the anchor must not come out half a pixel narrower.
            const room = availableSize(side, anchorRect, opts.offset, pad);
            const [anchorW, anchorH, availW, availH, origin] = POSITION_PROPERTIES;
            floating.style.setProperty(anchorW, px(anchorRect.width));
            floating.style.setProperty(anchorH, px(anchorRect.height));
            floating.style.setProperty(availW, px(room.width));
            floating.style.setProperty(availH, px(room.height));
            floating.style.setProperty(origin, transformOrigin(side, resolveSide(placement, rtl).align, rtl));
        };

        update();
        // Every re-measure after the first runs through one coalesced frame:
        // any number of triggers in a frame cost one update, and a
        // ResizeObserver callback never writes layout synchronously (which is
        // what raises the "ResizeObserver loop" error).
        const hasRaf = typeof requestAnimationFrame === 'function';
        let raf: number | null = null;
        const schedule = () => {
            if (!hasRaf) { update(); return; }
            if (raf != null) return;
            raf = requestAnimationFrame(() => {
                raf = null;
                update();
            });
        };
        // The open-state write and the showPopover() call race across
        // reactive callbacks: measured while still display:none the floating
        // size reads 0 and the shift clamp has nothing to clamp. One frame
        // later the popover is visible and measurable.
        if (hasRaf) schedule();
        // Size changes that move no scroll and fire no resize: the popup's
        // content growing (async options, a filter narrowing a list) or the
        // anchor reflowing.
        let observer: ResizeObserver | null = null;
        if (typeof ResizeObserver !== 'undefined') {
            observer = new ResizeObserver(schedule);
            observer.observe(floating);
            // A virtual anchor has no box of its own, but the element it
            // derives from (a caret anchor's input) can still reflow.
            const anchorEl = isElement(anchor) ? anchor : anchor.contextElement;
            if (anchorEl) observer.observe(anchorEl);
        }
        window.addEventListener('scroll', update, { capture: true, passive: true });
        window.addEventListener('resize', update, { passive: true });
        return () => {
            if (raf != null) cancelAnimationFrame(raf);
            raf = null;
            observer?.disconnect();
            // The published properties are NOT cleared here, like the
            // coordinates and `data-placement` beside them: this runs on
            // close, while an exit transition may still be painting the
            // popup, and falling back mid-fade would jump its width and its
            // origin. The next open rewrites all of them before it paints.
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
    /** `PositionOptions.collisionPadding` — default 8. */
    collisionPadding?: () => number | undefined;
    /** `PositionOptions.alignOffset` — default 0. */
    alignOffset?: () => number | undefined;
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
                    collisionPadding: input.collisionPadding?.() ?? DEFAULT_COLLISION_PADDING,
                    alignOffset: input.alignOffset?.() ?? 0,
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
