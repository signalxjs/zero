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
        // Shifted on the cross axis only: flush with the viewport's right edge.
        expect(r.left).toBe(W - 200);
    });

    it('does not flip when only the cross axis overflows', () => {
        const W = window.innerWidth;
        const { anchor } = fakeAnchor(W - 40, 100, 30, 20);
        const floating = fakeFloating(200, 100);
        const r = place(anchor, floating, 'bottom-start');
        expect(r.placement).toBe('bottom-start');
        expect(r.top).toBe(124);
        expect(r.left).toBe(W - 200);
    });

    it('clamps the main axis only as a last resort, when neither side fits', () => {
        const H = window.innerHeight;
        const { anchor } = fakeAnchor(100, H / 2, 30, 20);
        const floating = fakeFloating(200, H); // taller than either side's room
        const r = place(anchor, floating, 'bottom-start');
        expect(r.placement).toBe('bottom-start');
        expect(r.top).toBe(0);
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
