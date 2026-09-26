/**
 * createTopLayerExit (#17) — when the native close runs.
 *
 * happy-dom has neither `overlay` nor Web Animations, so the engines are
 * simulated: `CSS.supports` and `Element.getAnimations` are stubbed per test
 * and frames are driven by fake timers. The real-engine half (the fade
 * actually playing in Firefox/WebKit) is `e2e/top-layer-exit.spec.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAnimatedExit, createTopLayerExit } from '../src/behaviors/top-layer-exit.js';

interface FakeAnimation {
    effect: { getComputedTiming(): { endTime: number } };
    currentTime: number;
    playbackRate: number;
    finished: Promise<unknown>;
}

function fakeAnimation(endTime: number, currentTime = 0): FakeAnimation & { end(): void; abort(): void } {
    let end!: () => void;
    let abort!: () => void;
    const finished = new Promise<unknown>((resolve, reject) => { end = () => resolve(undefined); abort = () => reject(new Error('cancelled')); });
    return { effect: { getComputedTiming: () => ({ endTime }) }, currentTime, playbackRate: 1, finished, end, abort };
}

function element(animations: FakeAnimation[]): Element {
    const el = document.createElement('div');
    (el as unknown as { getAnimations(): FakeAnimation[] }).getAnimations = () => animations;
    return el;
}

const flush = async (): Promise<void> => { await Promise.resolve(); await Promise.resolve(); };

let supportsOverlay = false;

beforeEach(() => {
    vi.useFakeTimers();
    supportsOverlay = false;
    vi.stubGlobal('CSS', { supports: (prop: string) => prop === 'overlay' && supportsOverlay });
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 16) as unknown as number);
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('createTopLayerExit', () => {
    it('hides at once where CSS overlay is supported (Chromium stays pure CSS)', () => {
        supportsOverlay = true;
        const hide = vi.fn();
        createTopLayerExit().close(element([fakeAnimation(150)]), hide);
        expect(hide).toHaveBeenCalledTimes(1);
    });

    it('hides at once when the engine has no Web Animations', () => {
        const hide = vi.fn();
        createTopLayerExit().close(document.createElement('div'), hide);
        expect(hide).toHaveBeenCalledTimes(1);
    });

    it('without overlay, waits for the exit animation to finish', async () => {
        const anim = fakeAnimation(150);
        const hide = vi.fn();
        createTopLayerExit().close(element([anim]), hide);
        expect(hide).not.toHaveBeenCalled();
        vi.advanceTimersByTime(16);
        await flush();
        expect(hide).not.toHaveBeenCalled();
        anim.end();
        await flush();
        expect(hide).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(1000);
        expect(hide).toHaveBeenCalledTimes(1);
    });

    it('a cancelled animation also ends the wait', async () => {
        const anim = fakeAnimation(150);
        const hide = vi.fn();
        createTopLayerExit().close(element([anim]), hide);
        vi.advanceTimersByTime(16);
        anim.abort();
        await flush();
        expect(hide).toHaveBeenCalledTimes(1);
    });

    it('never wedges: a stalled animation is cut off at its computed end', async () => {
        const hide = vi.fn();
        createTopLayerExit().close(element([fakeAnimation(150, 50)]), hide);
        vi.advanceTimersByTime(16);
        vi.advanceTimersByTime(100 + 49);
        expect(hide).not.toHaveBeenCalled();
        vi.advanceTimersByTime(2);
        expect(hide).toHaveBeenCalledTimes(1);
    });

    it('a withheld frame (hidden or throttled tab) cannot hold the close back', () => {
        vi.stubGlobal('requestAnimationFrame', () => 0);
        const hide = vi.fn();
        createTopLayerExit().close(element([]), hide);
        vi.advanceTimersByTime(99);
        expect(hide).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(hide).toHaveBeenCalledTimes(1);
    });

    it('closes on the next frame when nothing is animating, and ignores loops', () => {
        const hide = vi.fn();
        createTopLayerExit().close(element([fakeAnimation(Infinity)]), hide);
        expect(hide).not.toHaveBeenCalled();
        vi.advanceTimersByTime(16);
        expect(hide).toHaveBeenCalledTimes(1);
    });

    it('cancel() drops a pending exit — a reopen never closes', async () => {
        const anim = fakeAnimation(150);
        const hide = vi.fn();
        const exit = createTopLayerExit();
        exit.close(element([anim]), hide);
        vi.advanceTimersByTime(16);
        exit.cancel();
        anim.end();
        await flush();
        vi.advanceTimersByTime(1000);
        expect(hide).not.toHaveBeenCalled();
    });

    it('a second close while one is pending is a no-op', async () => {
        const anim = fakeAnimation(150);
        const hide = vi.fn();
        const exit = createTopLayerExit();
        const el = element([anim]);
        exit.close(el, hide);
        exit.close(el, hide);
        vi.advanceTimersByTime(16);
        anim.end();
        await flush();
        expect(hide).toHaveBeenCalledTimes(1);
    });
});

describe('createAnimatedExit (#276)', () => {
    it('waits for the exit even where CSS overlay is supported — no top-layer short-circuit', async () => {
        supportsOverlay = true;
        const anim = fakeAnimation(150);
        const hide = vi.fn();
        createAnimatedExit().close(element([anim]), hide);
        vi.advanceTimersByTime(16);
        await flush();
        expect(hide).not.toHaveBeenCalled();
        anim.end();
        await flush();
        expect(hide).toHaveBeenCalledTimes(1);
    });

    it('immediate() skips the wait', () => {
        const hide = vi.fn();
        createAnimatedExit({ immediate: () => true }).close(element([fakeAnimation(150)]), hide);
        expect(hide).toHaveBeenCalledTimes(1);
    });
});
