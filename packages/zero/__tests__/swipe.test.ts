import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { effectScope } from 'sigx';
import { createSwipe } from '@sigx/zero';
import type { SwipeDirection, SwipeOptions } from '@sigx/zero';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function pointer(el: Element, type: string, x: number, y: number, init: PointerEventInit = {}): void {
    el.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, button: 0, clientX: x, clientY: y, ...init,
    }));
}

describe('createSwipe', () => {
    let el: HTMLElement;
    let scope: ReturnType<typeof effectScope>;
    beforeEach(() => {
        el = document.createElement('div');
        el.innerHTML = '<p>text</p><button type="button">act</button>';
        document.body.appendChild(el);
        scope = effectScope();
    });
    afterEach(() => {
        scope.stop();
        el.remove();
    });

    function swipe(direction: SwipeDirection, extra: Partial<SwipeOptions> = {}) {
        const onDismiss = vi.fn();
        const onSwipingChange = vi.fn();
        const handle = scope.run(() => createSwipe({ el, direction: () => direction, onDismiss, onSwipingChange, ...extra }))!;
        return { onDismiss, onSwipingChange, handle };
    }

    const offset = () => [el.style.getPropertyValue('--swipe-x'), el.style.getPropertyValue('--swipe-y')];

    it('a drag past the threshold dismisses, keeping the offset for the exit', () => {
        const { onDismiss, onSwipingChange } = swipe('right');
        const text = el.querySelector('p')!;
        pointer(text, 'pointerdown', 0, 0);
        pointer(text, 'pointermove', 5, 0);
        // Inside the slop: nothing yet.
        expect(el.hasAttribute('data-swiping')).toBe(false);
        pointer(text, 'pointermove', 30, 2);
        expect(el.hasAttribute('data-swiping')).toBe(true);
        expect(onSwipingChange).toHaveBeenLastCalledWith(true);
        // Clamped to the dismiss axis.
        expect(offset()).toEqual(['30px', '0px']);
        pointer(text, 'pointermove', 80, 0);
        pointer(text, 'pointerup', 80, 0);
        expect(onDismiss).toHaveBeenCalledTimes(1);
        expect(el.hasAttribute('data-swiping')).toBe(false);
        expect(onSwipingChange).toHaveBeenLastCalledWith(false);
        expect(offset()).toEqual(['80px', '0px']);
    });

    it('a slow, short drag springs back: flag and offset both cleared', async () => {
        const { onDismiss } = swipe('down');
        pointer(el, 'pointerdown', 0, 0);
        pointer(el, 'pointermove', 0, 20);
        expect(offset()).toEqual(['0px', '20px']);
        await wait(300); // 20px in 300ms: under 0.11px/ms
        pointer(el, 'pointerup', 0, 20);
        expect(onDismiss).not.toHaveBeenCalled();
        expect(el.hasAttribute('data-swiping')).toBe(false);
        expect(offset()).toEqual(['', '']);
    });

    it('a quick flick short of the threshold still dismisses', () => {
        const { onDismiss } = swipe('up');
        pointer(el, 'pointerdown', 0, 100);
        pointer(el, 'pointermove', 0, 80);
        pointer(el, 'pointerup', 0, 80);
        expect(onDismiss).toHaveBeenCalledTimes(1);
        expect(offset()).toEqual(['0px', '-20px']);
    });

    it('the opposite way gives with resistance and never dismisses', () => {
        const { onDismiss } = swipe('right');
        pointer(el, 'pointerdown', 200, 0);
        pointer(el, 'pointermove', 0, 0);
        const x = parseFloat(offset()[0]!);
        expect(x).toBeLessThan(0);
        expect(x).toBeGreaterThan(-25);
        pointer(el, 'pointerup', 0, 0);
        expect(onDismiss).not.toHaveBeenCalled();
        expect(offset()).toEqual(['', '']);
    });

    it('a drag across the dismiss axis is not a swipe', () => {
        const { onDismiss, onSwipingChange } = swipe('right');
        pointer(el, 'pointerdown', 0, 0);
        pointer(el, 'pointermove', 3, 40);
        pointer(el, 'pointermove', 90, 40);
        pointer(el, 'pointerup', 90, 40);
        expect(onSwipingChange).not.toHaveBeenCalled();
        expect(onDismiss).not.toHaveBeenCalled();
    });

    it('ignores presses on interactive descendants, secondary buttons and while disabled', () => {
        let enabled = true;
        const { onSwipingChange } = swipe('right', { enabled: () => enabled });
        const button = el.querySelector('button')!;
        pointer(button, 'pointerdown', 0, 0);
        pointer(button, 'pointermove', 90, 0);
        pointer(button, 'pointerup', 90, 0);
        pointer(el, 'pointerdown', 0, 0, { button: 2 });
        pointer(el, 'pointermove', 90, 0);
        pointer(el, 'pointerup', 90, 0);
        enabled = false;
        pointer(el, 'pointerdown', 0, 0);
        pointer(el, 'pointermove', 90, 0);
        pointer(el, 'pointerup', 90, 0);
        expect(onSwipingChange).not.toHaveBeenCalled();
    });

    it('pointercancel springs back', () => {
        const { onDismiss } = swipe('left');
        pointer(el, 'pointerdown', 100, 0);
        pointer(el, 'pointermove', 20, 0);
        expect(offset()).toEqual(['-80px', '0px']);
        pointer(el, 'pointercancel', 20, 0);
        expect(onDismiss).not.toHaveBeenCalled();
        expect(el.hasAttribute('data-swiping')).toBe(false);
        expect(offset()).toEqual(['', '']);
    });

    it('resolves start/end against the reading direction', () => {
        el.style.direction = 'rtl';
        const { onDismiss } = swipe('end');
        pointer(el, 'pointerdown', 100, 0);
        pointer(el, 'pointermove', 30, 0);
        // End is leftward in RTL.
        expect(offset()).toEqual(['-70px', '0px']);
        pointer(el, 'pointerup', 30, 0);
        expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('content that can still scroll the way the drag goes keeps the gesture', () => {
        const list = document.createElement('div');
        list.style.overflowY = 'auto';
        el.appendChild(list);
        Object.defineProperty(list, 'scrollHeight', { configurable: true, value: 500 });
        Object.defineProperty(list, 'clientHeight', { configurable: true, value: 100 });
        list.scrollTop = 40;
        const { onSwipingChange } = swipe('down');
        pointer(list, 'pointerdown', 0, 0);
        pointer(list, 'pointermove', 0, 90);
        pointer(list, 'pointerup', 0, 90);
        expect(onSwipingChange).not.toHaveBeenCalled();
        // Scrolled back to its top edge, the drag moves the part.
        list.scrollTop = 0;
        pointer(list, 'pointerdown', 0, 0);
        pointer(list, 'pointermove', 0, 90);
        expect(onSwipingChange).toHaveBeenLastCalledWith(true);
    });

    it('reset clears a kept offset; stopping the scope removes the listeners', () => {
        const { onSwipingChange, handle } = swipe('right');
        pointer(el, 'pointerdown', 0, 0);
        pointer(el, 'pointermove', 90, 0);
        pointer(el, 'pointerup', 90, 0);
        expect(offset()).toEqual(['90px', '0px']);
        handle.reset();
        expect(offset()).toEqual(['', '']);
        onSwipingChange.mockClear();
        scope.stop();
        pointer(el, 'pointerdown', 0, 0);
        pointer(el, 'pointermove', 90, 0);
        expect(onSwipingChange).not.toHaveBeenCalled();
        expect(el.hasAttribute('data-swiping')).toBe(false);
    });
});
