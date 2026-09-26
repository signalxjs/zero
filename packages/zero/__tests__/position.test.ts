import { afterEach, describe, it, expect, vi } from 'vitest';
import { fixedPositionStrategy, pointAnchor } from '@sigx/zero';
import type { Placement } from '@sigx/zero';

function rectAt(x: number, y: number, width: number, height: number): DOMRect {
    return { x, y, width, height, top: y, left: x, right: x + width, bottom: y + height, toJSON: () => ({}) } as DOMRect;
}

function fakeFloating(width: number, height: number, parent: HTMLElement = document.body): HTMLElement {
    const el = document.createElement('div');
    Object.defineProperty(el, 'offsetWidth', { value: width });
    Object.defineProperty(el, 'offsetHeight', { value: height });
    parent.appendChild(el);
    return el;
}

/** A real element anchor with a fixed client rect, inside a `dir` container. */
function fakeAnchor(x: number, y: number, width: number, height: number, dir: 'ltr' | 'rtl' = 'ltr') {
    const host = document.createElement('div');
    host.setAttribute('dir', dir);
    host.style.direction = dir;
    const anchor = document.createElement('button');
    anchor.getBoundingClientRect = () => rectAt(x, y, width, height);
    host.appendChild(anchor);
    document.body.appendChild(host);
    return { host, anchor };
}

function place(anchor: HTMLElement | ReturnType<typeof pointAnchor>, floating: HTMLElement, placement: Placement, offset = 4) {
    const cleanup = fixedPositionStrategy.apply(anchor, floating, { placement, offset, flip: true });
    const out = {
        top: parseFloat(floating.style.top),
        left: parseFloat(floating.style.left),
        placement: floating.getAttribute('data-placement'),
    };
    cleanup();
    return out;
}

afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
});

describe('fixedPositionStrategy: main-axis flip', () => {
    it('a bottom-start menu in the bottom-right corner flips to top-start and shifts left', () => {
        const W = window.innerWidth;
        const H = window.innerHeight;
        const { anchor } = fakeAnchor(W - 40, H - 30, 30, 20);
        const floating = fakeFloating(200, 100);
        const r = place(anchor, floating, 'bottom-start');
        // Flipped on the block axis despite overflowing the inline axis on
        // both sides — that overflow is the shift's to fix.
        expect(r.placement).toBe('top-start');
        expect(r.top).toBe(H - 30 - 100 - 4);
        // Shifted on the cross axis only: the default 8px collision padding
        // off the viewport's right edge.
        expect(r.left).toBe(W - 8 - 200);
    });

    it('does not flip when only the cross axis overflows', () => {
        const W = window.innerWidth;
        const { anchor } = fakeAnchor(W - 40, 100, 30, 20);
        const floating = fakeFloating(200, 100);
        const r = place(anchor, floating, 'bottom-start');
        expect(r.placement).toBe('bottom-start');
        expect(r.top).toBe(124);
        expect(r.left).toBe(W - 8 - 200);
    });

    it('clamps the main axis only as a last resort, when neither side fits', () => {
        const H = window.innerHeight;
        const { anchor } = fakeAnchor(100, H / 2, 30, 20);
        const floating = fakeFloating(200, H); // taller than either side's room
        const r = place(anchor, floating, 'bottom-start');
        expect(r.placement).toBe('bottom-start');
        // The start edge wins inside the padding when the popup cannot fit.
        expect(r.top).toBe(8);
    });

    it('flips a right-side popup at the right edge to the left side', () => {
        const W = window.innerWidth;
        const { anchor } = fakeAnchor(W - 60, 100, 50, 20);
        const floating = fakeFloating(150, 80);
        const r = place(anchor, floating, 'right-start');
        expect(r.placement).toBe('left-start');
        expect(r.left).toBe(W - 60 - 150 - 4);
        expect(r.top).toBe(100);
    });
});

describe('fixedPositionStrategy: logical alignment under RTL', () => {
    it('bottom-start aligns left edges in LTR', () => {
        const { anchor } = fakeAnchor(300, 100, 120, 30, 'ltr');
        const r = place(anchor, fakeFloating(200, 50), 'bottom-start');
        expect(r.left).toBe(300);
        expect(r.placement).toBe('bottom-start');
    });

    it('bottom-start aligns RIGHT edges in RTL, and publishes the logical placement', () => {
        const { anchor } = fakeAnchor(300, 100, 120, 30, 'rtl');
        const floating = fakeFloating(200, 50);
        const r = place(anchor, floating, 'bottom-start');
        expect(r.left + 200).toBe(300 + 120);
        // Under RTL an over-constrained fixed box honours `right` over
        // `left`, so the UA popover's `inset: 0` must not survive.
        expect(floating.style.right).toBe('auto');
        expect(floating.style.bottom).toBe('auto');
        expect(r.placement).toBe('bottom-start');
    });

    it('bottom-end aligns left edges in RTL', () => {
        const { anchor } = fakeAnchor(300, 100, 120, 30, 'rtl');
        const r = place(anchor, fakeFloating(200, 50), 'bottom-end');
        expect(r.left).toBe(300);
    });

    it('an inline side keeps its block-axis alignment in RTL', () => {
        const { anchor } = fakeAnchor(300, 100, 120, 30, 'rtl');
        const r = place(anchor, fakeFloating(200, 50), 'right-end');
        expect(r.left).toBe(424);
        expect(r.top).toBe(130 - 50);
    });

    it('a virtual anchor reads the direction the floating element inherits', () => {
        const host = document.createElement('div');
        host.setAttribute('dir', 'rtl');
        host.style.direction = 'rtl';
        document.body.appendChild(host);
        const floating = fakeFloating(100, 40, host);
        const r = place(pointAnchor(500, 100), floating, 'bottom-start', 2);
        expect(r.left).toBe(400);
    });
});

describe('fixedPositionStrategy: bare start/end', () => {
    it("'start' is the inline-start side: left of the anchor in LTR", () => {
        const { anchor } = fakeAnchor(300, 100, 120, 30, 'ltr');
        const r = place(anchor, fakeFloating(100, 50), 'start');
        expect(r.left).toBe(300 - 100 - 4);
        expect(r.top).toBe(115 - 25);
        expect(r.placement).toBe('start');
    });

    it("'start' is right of the anchor in RTL, 'end' left of it", () => {
        const { anchor } = fakeAnchor(300, 100, 120, 30, 'rtl');
        expect(place(anchor, fakeFloating(100, 50), 'start').left).toBe(424);
        expect(place(anchor, fakeFloating(100, 50), 'end').left).toBe(300 - 100 - 4);
    });

    it("flips 'start' to 'end' (never 'undefined') when the inline-start side has no room", () => {
        const { anchor } = fakeAnchor(20, 100, 60, 30, 'ltr');
        const r = place(anchor, fakeFloating(100, 50), 'start');
        expect(r.placement).toBe('end');
        expect(r.left).toBe(84);
    });

    it("flips 'end' to 'start' in RTL when the inline-end (left) side has no room", () => {
        const { anchor } = fakeAnchor(20, 100, 60, 30, 'rtl');
        const r = place(anchor, fakeFloating(100, 50), 'end');
        expect(r.placement).toBe('start');
        expect(r.left).toBe(84);
    });
});

describe('fixedPositionStrategy: ResizeObserver repositioning', () => {
    class FakeResizeObserver {
        static instances: FakeResizeObserver[] = [];
        observed: Element[] = [];
        disconnected = false;
        constructor(public callback: ResizeObserverCallback) {
            FakeResizeObserver.instances.push(this);
        }
        observe(el: Element) { this.observed.push(el); }
        unobserve() {}
        disconnect() { this.disconnected = true; }
        fire() { this.callback([], this as unknown as ResizeObserver); }
    }

    it('observes the floating element and an element anchor, coalesces updates per frame, and disconnects', () => {
        FakeResizeObserver.instances = [];
        const frames: FrameRequestCallback[] = [];
        vi.stubGlobal('ResizeObserver', FakeResizeObserver);
        vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
        vi.stubGlobal('cancelAnimationFrame', () => {});

        let rect = rectAt(100, 100, 50, 20);
        const { anchor } = fakeAnchor(0, 0, 0, 0);
        anchor.getBoundingClientRect = () => rect;
        const floating = fakeFloating(80, 40);
        const cleanup = fixedPositionStrategy.apply(anchor, floating, { placement: 'bottom-start', offset: 4, flip: true });

        const ro = FakeResizeObserver.instances[0]!;
        expect(ro.observed).toEqual([floating, anchor]);
        // The initial measure-after-show frame.
        expect(frames).toHaveLength(1);
        frames.shift()!(0);
        expect(floating.style.top).toBe('124px');

        rect = rectAt(100, 200, 50, 20);
        ro.fire();
        ro.fire();
        // Coalesced: two callbacks, one frame; nothing written synchronously.
        expect(frames).toHaveLength(1);
        expect(floating.style.top).toBe('124px');
        frames.shift()!(0);
        expect(floating.style.top).toBe('224px');

        cleanup();
        expect(ro.disconnected).toBe(true);
    });

    it('observes only the floating element for a virtual anchor', () => {
        FakeResizeObserver.instances = [];
        vi.stubGlobal('ResizeObserver', FakeResizeObserver);
        const floating = fakeFloating(80, 40);
        const cleanup = fixedPositionStrategy.apply(pointAnchor(10, 10), floating, { placement: 'bottom', offset: 0, flip: true });
        expect(FakeResizeObserver.instances[0]!.observed).toEqual([floating]);
        cleanup();
    });

    it("observes a virtual anchor's contextElement, which can reflow under it", () => {
        FakeResizeObserver.instances = [];
        vi.stubGlobal('ResizeObserver', FakeResizeObserver);
        const floating = fakeFloating(80, 40);
        const input = document.createElement('textarea');
        const anchor = { ...pointAnchor(10, 10), contextElement: input };
        const cleanup = fixedPositionStrategy.apply(anchor, floating, { placement: 'bottom', offset: 0, flip: true });
        expect(FakeResizeObserver.instances[0]!.observed).toEqual([floating, input]);
        cleanup();
    });

    it('works without ResizeObserver', () => {
        vi.stubGlobal('ResizeObserver', undefined);
        const floating = fakeFloating(80, 40);
        const cleanup = fixedPositionStrategy.apply(pointAnchor(10, 10), floating, { placement: 'bottom-start', offset: 0, flip: true });
        expect(floating.style.left).toBe('10px');
        cleanup();
    });
});

describe('fixedPositionStrategy: collisionPadding', () => {
    it('keeps a shifted popup 8px off the edge by default', () => {
        const W = window.innerWidth;
        const { anchor } = fakeAnchor(W - 20, 100, 10, 20);
        const floating = fakeFloating(200, 50);
        const cleanup = fixedPositionStrategy.apply(anchor, floating, { placement: 'bottom-start', offset: 4, flip: true });
        expect(parseFloat(floating.style.left) + 200).toBe(W - 8);
        cleanup();
    });

    it('treats the padding as the edge when deciding a flip', () => {
        const H = window.innerHeight;
        // 50 tall + 4 offset from a bottom edge at H - 60 ends at H - 6:
        // inside the viewport, but inside the 8px padding too.
        const { anchor } = fakeAnchor(100, H - 80, 30, 20);
        const floating = fakeFloating(100, 50);
        expect(place(anchor, floating, 'bottom-start').placement).toBe('top-start');
        const cleanup = fixedPositionStrategy.apply(anchor, floating, { placement: 'bottom-start', offset: 4, flip: true, collisionPadding: 0 });
        expect(floating.getAttribute('data-placement')).toBe('bottom-start');
        cleanup();
    });

    it('takes a custom padding for the shift', () => {
        const { anchor } = fakeAnchor(0, 100, 10, 20);
        const floating = fakeFloating(200, 50);
        const cleanup = fixedPositionStrategy.apply(anchor, floating, { placement: 'bottom-end', offset: 4, flip: true, collisionPadding: 16 });
        expect(floating.style.left).toBe('16px');
        cleanup();
    });

    it('treats a negative padding as 0 and a non-finite one as the default', () => {
        const { anchor } = fakeAnchor(0, 100, 10, 20);
        const left = (collisionPadding: number) => {
            const floating = fakeFloating(200, 50);
            const cleanup = fixedPositionStrategy.apply(anchor, floating, { placement: 'bottom-end', offset: 4, flip: true, collisionPadding });
            const out = floating.style.left;
            cleanup();
            return out;
        };
        expect(left(-20)).toBe('0px');
        expect(left(Number.NaN)).toBe('8px');
        expect(left(Number.POSITIVE_INFINITY)).toBe('8px');
    });
});

describe('fixedPositionStrategy: alignOffset', () => {
    const apply = (anchor: HTMLElement, floating: HTMLElement, placement: Placement, alignOffset: number) => {
        const cleanup = fixedPositionStrategy.apply(anchor, floating, { placement, offset: 4, flip: true, alignOffset });
        const out = { left: parseFloat(floating.style.left), top: parseFloat(floating.style.top) };
        cleanup();
        return out;
    };

    it('moves a -start popup away from the aligned edge, in the reading direction', () => {
        const ltr = fakeAnchor(300, 100, 120, 30, 'ltr');
        expect(apply(ltr.anchor, fakeFloating(200, 50), 'bottom-start', 10).left).toBe(310);
        const rtl = fakeAnchor(300, 100, 120, 30, 'rtl');
        // Aligned right edges, moved leftward (forward in RTL).
        expect(apply(rtl.anchor, fakeFloating(200, 50), 'bottom-start', 10).left).toBe(420 - 200 - 10);
    });

    it('moves a -end popup back from its edge, and leaves a centred one alone', () => {
        const { anchor } = fakeAnchor(300, 100, 120, 30);
        expect(apply(anchor, fakeFloating(200, 50), 'bottom-end', 10).left).toBe(420 - 200 - 10);
        expect(apply(anchor, fakeFloating(200, 50), 'bottom', 10).left).toBe(360 - 100);
    });

    it('offsets an inline side along the block axis', () => {
        const { anchor } = fakeAnchor(300, 100, 120, 30);
        expect(apply(anchor, fakeFloating(100, 50), 'right-start', 6).top).toBe(106);
        expect(apply(anchor, fakeFloating(100, 20), 'right-end', 6).top).toBe(130 - 20 - 6);
    });

    it('ignores a non-finite offset', () => {
        const { anchor } = fakeAnchor(300, 100, 120, 30);
        expect(apply(anchor, fakeFloating(200, 50), 'bottom-start', Number.NaN).left).toBe(300);
        expect(apply(anchor, fakeFloating(200, 50), 'bottom-start', Number.POSITIVE_INFINITY).left).toBe(300);
    });
});

describe('fixedPositionStrategy: published geometry', () => {
    const vars = (el: HTMLElement) => Object.fromEntries(
        ['--anchor-width', '--anchor-height', '--available-width', '--available-height', '--transform-origin']
            .map((name) => [name, el.style.getPropertyValue(name)]),
    );

    it('publishes the anchor size, the room below, and a top-left origin for bottom-start', () => {
        const W = window.innerWidth;
        const H = window.innerHeight;
        const { anchor } = fakeAnchor(100, 100, 120.5, 30);
        const floating = fakeFloating(200, 50);
        const cleanup = fixedPositionStrategy.apply(anchor, floating, { placement: 'bottom-start', offset: 4, flip: true });
        expect(vars(floating)).toEqual({
            '--anchor-width': '120.5px',
            '--anchor-height': '30px',
            '--available-width': `${W - 16}px`,
            '--available-height': `${H - 8 - 134}px`,
            '--transform-origin': 'top left',
        });
        cleanup();
        // Kept after cleanup (a close): an exit transition still paints with them.
        expect(floating.style.getPropertyValue('--anchor-width')).toBe('120.5px');
    });

    it('resolves the origin through the reading direction', () => {
        const { anchor } = fakeAnchor(300, 100, 120, 30, 'rtl');
        const floating = fakeFloating(200, 50);
        const cleanup = fixedPositionStrategy.apply(anchor, floating, { placement: 'bottom-start', offset: 4, flip: true });
        expect(floating.style.getPropertyValue('--transform-origin')).toBe('top right');
        cleanup();
    });

    it('names the inline side facing the anchor for a side placement', () => {
        const { anchor } = fakeAnchor(300, 100, 120, 30);
        const floating = fakeFloating(100, 50);
        const cleanup = fixedPositionStrategy.apply(anchor, floating, { placement: 'right', offset: 4, flip: true });
        expect(floating.style.getPropertyValue('--transform-origin')).toBe('center left');
        expect(floating.style.getPropertyValue('--available-width')).toBe(`${window.innerWidth - 8 - 424}px`);
        expect(floating.style.getPropertyValue('--available-height')).toBe(`${window.innerHeight - 16}px`);
        cleanup();
    });

    it('rewrites the room and the origin after a flip', () => {
        const H = window.innerHeight;
        const frames: FrameRequestCallback[] = [];
        vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
        vi.stubGlobal('cancelAnimationFrame', () => {});
        let rect = rectAt(100, 100, 120, 30);
        const { anchor } = fakeAnchor(0, 0, 0, 0);
        anchor.getBoundingClientRect = () => rect;
        const floating = fakeFloating(200, 100);
        const cleanup = fixedPositionStrategy.apply(anchor, floating, { placement: 'bottom-start', offset: 4, flip: true, collisionPadding: 10 });
        expect(floating.getAttribute('data-placement')).toBe('bottom-start');
        expect(floating.style.getPropertyValue('--available-height')).toBe(`${H - 10 - 134}px`);

        // The anchor scrolls to the bottom edge: no room below, so it flips.
        rect = rectAt(100, H - 40, 120, 30);
        window.dispatchEvent(new Event('resize'));
        expect(floating.getAttribute('data-placement')).toBe('top-start');
        expect(floating.style.getPropertyValue('--available-height')).toBe(`${H - 40 - 4 - 10}px`);
        expect(floating.style.getPropertyValue('--transform-origin')).toBe('bottom left');
        cleanup();
    });

    it('never publishes a negative room', () => {
        const { anchor } = fakeAnchor(100, 2, 30, 2);
        const floating = fakeFloating(20, 20);
        const cleanup = fixedPositionStrategy.apply(anchor, floating, { placement: 'top', offset: 4, flip: false });
        expect(floating.style.getPropertyValue('--available-height')).toBe('0px');
        cleanup();
    });
});

describe('fixedPositionStrategy: arrow', () => {
    /** A popup with a `border`-px border and an `arrowSize`-px square arrow inside it. */
    function popupWithArrow(width: number, height: number, border = 0, arrowSize = 10) {
        const floating = fakeFloating(width, height);
        Object.defineProperty(floating, 'clientWidth', { value: width - 2 * border });
        Object.defineProperty(floating, 'clientHeight', { value: height - 2 * border });
        Object.defineProperty(floating, 'clientLeft', { value: border });
        Object.defineProperty(floating, 'clientTop', { value: border });
        const arrow = document.createElement('span');
        Object.defineProperty(arrow, 'offsetWidth', { value: arrowSize });
        Object.defineProperty(arrow, 'offsetHeight', { value: arrowSize });
        floating.appendChild(arrow);
        return { floating, arrow };
    }
    const vars = (arrow: HTMLElement) => ({
        x: arrow.style.getPropertyValue('--arrow-x'),
        y: arrow.style.getPropertyValue('--arrow-y'),
    });

    it('centres the arrow on the anchor along a top/bottom edge, from the padding edge', () => {
        // Anchor centre x = 360; the popup (200 wide, centred) sits at 260
        // with a 1px border, so the padding edge is at 261: 360 - 261 - 5.
        const { anchor } = fakeAnchor(300, 100, 120, 30);
        const { floating, arrow } = popupWithArrow(200, 50, 1);
        const cleanup = fixedPositionStrategy.apply(anchor, floating, { placement: 'bottom', offset: 4, flip: true, getArrow: () => arrow });
        expect(vars(arrow)).toEqual({ x: '94px', y: '' });
        cleanup();
        // Kept after cleanup, like the popup's own geometry.
        expect(vars(arrow).x).toBe('94px');
    });

    it('uses --arrow-y beside the anchor, and removes the other property', () => {
        const { anchor } = fakeAnchor(300, 100, 120, 30);
        const { floating, arrow } = popupWithArrow(100, 80);
        arrow.style.setProperty('--arrow-x', '12px');
        const cleanup = fixedPositionStrategy.apply(anchor, floating, { placement: 'right-start', offset: 4, flip: true, getArrow: () => arrow });
        // Popup top at 100; anchor centre y = 115: 115 - 100 - 5.
        expect(vars(arrow)).toEqual({ x: '', y: '10px' });
        cleanup();
    });

    it('still points at the anchor after a shift, clamped inside the arrow padding', () => {
        const W = window.innerWidth;
        // A small anchor 12px from the right edge: the centred popup shifts
        // left to W - 8 - 200, and the anchor centre (W - 6) lies past the
        // popup's end — so the arrow clamps to the far end, 8px in.
        const { anchor } = fakeAnchor(W - 12, 100, 12, 20);
        const { floating, arrow } = popupWithArrow(200, 50);
        const cleanup = fixedPositionStrategy.apply(anchor, floating, { placement: 'bottom', offset: 4, flip: true, getArrow: () => arrow });
        expect(parseFloat(floating.style.left)).toBe(W - 8 - 200);
        expect(vars(arrow).x).toBe(`${200 - 10 - 8}px`);
        cleanup();

        // The shift alone, without the clamp: the arrow follows the anchor,
        // not the popup's centre.
        const near = fakeAnchor(W - 60, 100, 20, 20);
        const second = popupWithArrow(200, 50);
        const c2 = fixedPositionStrategy.apply(near.anchor, second.floating, { placement: 'bottom', offset: 4, flip: true, getArrow: () => second.arrow });
        expect(vars(second.arrow).x).toBe(`${W - 50 - (W - 208) - 5}px`);
        c2();
    });

    it('clamps at the start end too, and honours a custom arrowPadding', () => {
        const { anchor } = fakeAnchor(0, 100, 10, 20);
        const { floating, arrow } = popupWithArrow(200, 50);
        const cleanup = fixedPositionStrategy.apply(anchor, floating, { placement: 'bottom', offset: 4, flip: true, getArrow: () => arrow, arrowPadding: 20 });
        expect(parseFloat(floating.style.left)).toBe(8);
        // Anchor centre 5, popup at 8: ideal -8, clamped to the 20px padding.
        expect(vars(arrow).x).toBe('20px');
        cleanup();
    });

    it('treats a negative arrowPadding as 0 and a non-finite one as the default 8', () => {
        const { anchor } = fakeAnchor(0, 100, 10, 20);
        const x = (arrowPadding: number) => {
            const { floating, arrow } = popupWithArrow(200, 50);
            const cleanup = fixedPositionStrategy.apply(anchor, floating, { placement: 'bottom', offset: 4, flip: true, getArrow: () => arrow, arrowPadding });
            cleanup();
            return vars(arrow).x;
        };
        expect(x(-5)).toBe('0px');
        expect(x(Number.NaN)).toBe('8px');
    });

    it('centres the arrow on a popup too short for it and both paddings', () => {
        const { anchor } = fakeAnchor(300, 100, 120, 30);
        const { floating, arrow } = popupWithArrow(20, 20);
        const cleanup = fixedPositionStrategy.apply(anchor, floating, { placement: 'bottom-start', offset: 4, flip: true, getArrow: () => arrow });
        expect(vars(arrow).x).toBe('5px');
        cleanup();
    });

    it('moves to the other axis when a re-measure lands the popup on an inline side', () => {
        const frames: FrameRequestCallback[] = [];
        vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
        vi.stubGlobal('cancelAnimationFrame', () => {});
        const { anchor } = fakeAnchor(300, 100, 120, 30);
        const { floating, arrow } = popupWithArrow(100, 50);
        let placement: Placement = 'bottom';
        const opts = { get placement() { return placement; }, offset: 4, flip: true, getArrow: () => arrow };
        const cleanup = fixedPositionStrategy.apply(anchor, floating, opts);
        expect(vars(arrow).y).toBe('');
        placement = 'left';
        window.dispatchEvent(new Event('resize'));
        expect(vars(arrow).x).toBe('');
        // Popup top = 115 - 25 = 90; anchor centre 115: 115 - 90 - 5.
        expect(vars(arrow).y).toBe('20px');
        cleanup();
    });

    it('writes nothing when no arrow is rendered', () => {
        const { anchor } = fakeAnchor(300, 100, 120, 30);
        const { floating, arrow } = popupWithArrow(200, 50);
        const cleanup = fixedPositionStrategy.apply(anchor, floating, { placement: 'bottom', offset: 4, flip: true, getArrow: () => null });
        expect(vars(arrow)).toEqual({ x: '', y: '' });
        cleanup();
    });
});
