/**
 * Press feedback — the runtime half of pointer-anchored press effects.
 *
 * The DOM writes are the contract here: a design system consumes exactly
 * `data-pressed`, `data-press-animating` and `--press-x/y/r`, so the tests
 * assert those, not internal state. happy-dom reports all-zero layout rects,
 * so coordinate assertions check presence and the `px` unit rather than
 * geometry, and `getAnimations` (absent in happy-dom) is stubbed where the
 * no-animation guard is under test.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createPressFeedback } from '@sigx/zero';
import type { PressFeedbackHandlers } from '@sigx/zero';

const pointerdown = (x = 0, y = 0): PointerEvent =>
    new PointerEvent('pointerdown', { button: 0, clientX: x, clientY: y });

describe('createPressFeedback', () => {
    let el: HTMLElement;
    let disabled: boolean;
    let press: PressFeedbackHandlers;

    beforeEach(() => {
        el = document.createElement('button');
        document.body.appendChild(el);
        disabled = false;
        press = createPressFeedback({
            getElement: () => el,
            isDisabled: () => disabled,
        });
    });

    afterEach(() => {
        // End any press a test left running: each pointer press attaches a
        // window-level release listener, and a suite must not depend on
        // test order to detach them. Cancel every pointerId the file uses.
        for (const pointerId of [0, 7, 8, 9]) {
            window.dispatchEvent(new PointerEvent('pointercancel', { pointerId }));
        }
        el.remove();
    });

    it('marks a pointer press and publishes the press point', () => {
        press.onPointerdown(pointerdown());
        expect(el.hasAttribute('data-pressed')).toBe(true);
        expect(el.hasAttribute('data-press-animating')).toBe(true);
        expect(el.style.getPropertyValue('--press-x')).toBe('0px');
        expect(el.style.getPropertyValue('--press-y')).toBe('0px');
        expect(el.style.getPropertyValue('--press-r')).toBe('0px');
    });

    it('ignores non-primary buttons', () => {
        press.onPointerdown(new PointerEvent('pointerdown', { button: 2 }));
        expect(el.hasAttribute('data-pressed')).toBe(false);
    });

    it.each([
        ['onPointerup', () => press.onPointerup(new PointerEvent('pointerup'))],
        ['onPointercancel', () => press.onPointercancel(new PointerEvent('pointercancel'))],
        ['onPointerleave', () => press.onPointerleave(new PointerEvent('pointerleave'))],
        ['onBlur', () => press.onBlur(new FocusEvent('blur'))],
    ] as const)('%s ends the held state', (_name, end) => {
        press.onPointerdown(pointerdown());
        end();
        expect(el.hasAttribute('data-pressed')).toBe(false);
    });

    it('survives pointerleave while the pointer is captured', () => {
        // A press ends when the gesture ends, and capture defines the
        // gesture: a native range input implicitly captures during drag, so
        // a leave mid-drag must not cancel the held state.
        (el as HTMLElement & { hasPointerCapture: (id: number) => boolean })
            .hasPointerCapture = () => true;
        press.onPointerdown(pointerdown());
        press.onPointerleave(new PointerEvent('pointerleave'));
        expect(el.hasAttribute('data-pressed')).toBe(true);
        press.onPointerup(new PointerEvent('pointerup'));
        expect(el.hasAttribute('data-pressed')).toBe(false);
    });

    it('survives pointerleave when the HANDLER element holds capture', () => {
        // Cross-element wiring (checkables): pointer handlers live on the
        // label row while getElement() is the control. Capture is held by
        // the pointerdown target on the row, so the guard must consult the
        // element the leave fired on, not only the marked one.
        const row = document.createElement('label');
        document.body.appendChild(row);
        (row as HTMLElement & { hasPointerCapture: (id: number) => boolean })
            .hasPointerCapture = () => true;
        row.addEventListener('pointerleave', press.onPointerleave);
        press.onPointerdown(pointerdown());
        row.dispatchEvent(new PointerEvent('pointerleave'));
        expect(el.hasAttribute('data-pressed')).toBe(true);
        press.onPointerup(new PointerEvent('pointerup'));
        expect(el.hasAttribute('data-pressed')).toBe(false);
    });

    it('a release anywhere ends the press — one-shot window listener', () => {
        // A drag surface spreads no pointerleave; the release can land
        // off-element, where the element's own pointerup never fires.
        const drag = createPressFeedback({ getElement: () => el });
        drag.onPointerdown(new PointerEvent('pointerdown', { button: 0, pointerId: 7 }));
        expect(el.hasAttribute('data-pressed')).toBe(true);
        // another pointer lifting is not this gesture ending
        window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 8 }));
        expect(el.hasAttribute('data-pressed')).toBe(true);
        window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7 }));
        expect(el.hasAttribute('data-pressed')).toBe(false);
        // and the listener is one-shot: a later stray release of the SAME
        // pointer changes nothing
        el.setAttribute('data-pressed', '');
        window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7 }));
        expect(el.hasAttribute('data-pressed')).toBe(true);
        el.removeAttribute('data-pressed');
    });

    it('lets an uncaptured pointerleave cancel the press', () => {
        (el as HTMLElement & { hasPointerCapture: (id: number) => boolean })
            .hasPointerCapture = () => false;
        press.onPointerdown(pointerdown());
        press.onPointerleave(new PointerEvent('pointerleave'));
        expect(el.hasAttribute('data-pressed')).toBe(false);
    });

    it('oneShot: false publishes the held state but never the one-shot flag', () => {
        const drag = createPressFeedback({
            getElement: () => el,
            oneShot: false,
        });
        drag.onPointerdown(pointerdown());
        expect(el.hasAttribute('data-pressed')).toBe(true);
        expect(el.style.getPropertyValue('--press-x')).toBe('0px');
        expect(el.hasAttribute('data-press-animating')).toBe(false);
        drag.onPointerup(new PointerEvent('pointerup'));
        expect(el.hasAttribute('data-pressed')).toBe(false);
    });

    it('keeps the coordinates after release, for release fades', () => {
        press.onPointerdown(pointerdown());
        press.onPointerup(new PointerEvent('pointerup'));
        expect(el.style.getPropertyValue('--press-x')).toBe('0px');
        expect(el.style.getPropertyValue('--press-r')).toBe('0px');
    });

    it.each(['Enter', ' '])('presses at the box center on %j', (key) => {
        press.onKeydown(new KeyboardEvent('keydown', { key }));
        expect(el.hasAttribute('data-pressed')).toBe(true);
        expect(el.style.getPropertyValue('--press-x')).toBe('0px');
        press.onKeyup(new KeyboardEvent('keyup', { key }));
        expect(el.hasAttribute('data-pressed')).toBe(false);
    });

    it('ignores key repeat — holding Enter is one press, not a stream', () => {
        press.onKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));
        el.removeAttribute('data-pressed');
        press.onKeydown(new KeyboardEvent('keydown', { key: 'Enter', repeat: true }));
        expect(el.hasAttribute('data-pressed')).toBe(false);
    });

    it('ignores non-activation keys', () => {
        press.onKeydown(new KeyboardEvent('keydown', { key: 'a' }));
        expect(el.hasAttribute('data-pressed')).toBe(false);
    });

    it('does nothing while disabled', () => {
        disabled = true;
        press.onPointerdown(pointerdown());
        press.onKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(el.hasAttribute('data-pressed')).toBe(false);
        expect(el.hasAttribute('data-press-animating')).toBe(false);
        expect(el.style.getPropertyValue('--press-x')).toBe('');
    });

    it('does nothing before the element mounts', () => {
        const unmounted = createPressFeedback({ getElement: () => null });
        expect(() => unmounted.onPointerdown(pointerdown())).not.toThrow();
        expect(() => unmounted.onPointerup(new PointerEvent('pointerup'))).not.toThrow();
    });

    describe('the one-shot flag', () => {
        const stubAnimations = (count: number) => {
            el.getAnimations = () =>
                Array.from({ length: count }, () => ({} as Animation));
        };

        it('outlives release and clears on animationend', () => {
            stubAnimations(1);
            press.onPointerdown(pointerdown());
            press.onPointerup(new PointerEvent('pointerup'));
            expect(el.hasAttribute('data-press-animating')).toBe(true);
            el.dispatchEvent(new AnimationEvent('animationend'));
            expect(el.hasAttribute('data-press-animating')).toBe(false);
        });

        it('clears on animationcancel too', () => {
            stubAnimations(1);
            press.onPointerdown(pointerdown());
            el.dispatchEvent(new AnimationEvent('animationcancel'));
            expect(el.hasAttribute('data-press-animating')).toBe(false);
        });

        it('ignores animationend bubbling from a child', () => {
            stubAnimations(1);
            const child = document.createElement('span');
            el.appendChild(child);
            press.onPointerdown(pointerdown());
            child.dispatchEvent(new AnimationEvent('animationend', { bubbles: true }));
            expect(el.hasAttribute('data-press-animating')).toBe(true);
        });

        it('clears synchronously when the design system attaches no animation', () => {
            stubAnimations(0);
            press.onPointerdown(pointerdown());
            expect(el.hasAttribute('data-press-animating')).toBe(false);
            // The held state is untouched by the guard.
            expect(el.hasAttribute('data-pressed')).toBe(true);
        });

        it('ignores a descendant\'s animation when deciding the guard', () => {
            // A spinner inside the button is in the subtree report, but its
            // animationend never targets the part — counting it would strand
            // the flag. Only effects targeting the part itself (which is how
            // pseudo-element ripples report) keep it alive.
            const child = document.createElement('span');
            el.appendChild(child);
            el.getAnimations = () => [{ effect: { target: child } } as unknown as Animation];
            press.onPointerdown(pointerdown());
            expect(el.hasAttribute('data-press-animating')).toBe(false);
        });

        /**
         * An Animation double whose `finished` promise we settle by hand.
         *
         * happy-dom runs no animations at all — `getAnimations` does not exist
         * here — so it cannot destroy a live CSSAnimation the way removing a
         * stylesheet does in a browser. What these tests CAN pin is the wiring
         * that reacts to it: `finished` settling is what clears the flag, and
         * it is keyed to the press that armed it. That stylesheet teardown
         * really does reject that promise is proved in the browser, by
         * `examples/playground/e2e/press-feedback.spec.ts` › *a ripple
         * destroyed with its stylesheet still clears its own flag*.
         */
        const deferredAnimation = () => {
            let resolve!: () => void;
            let reject!: () => void;
            const finished = new Promise<Animation>((res, rej) => {
                resolve = () => res({} as Animation);
                // What a cancelled animation rejects with.
                reject = () => rej(new DOMException('cancelled', 'AbortError'));
            });
            return { animation: { finished } as unknown as Animation, resolve, reject };
        };

        it('clears the flag when the animation is cancelled without an event', async () => {
            // #243: an animation destroyed with the stylesheet that declared
            // it does not reliably dispatch `animationcancel`. `finished`
            // rejects regardless, and that is what the flag follows.
            const ripple = deferredAnimation();
            el.getAnimations = () => [ripple.animation];
            press.onPointerdown(pointerdown());
            expect(el.hasAttribute('data-press-animating')).toBe(true);
            ripple.reject();
            await Promise.resolve();
            expect(el.hasAttribute('data-press-animating')).toBe(false);
        });

        it('clears the flag when the animation finishes, event or not', async () => {
            const ripple = deferredAnimation();
            el.getAnimations = () => [ripple.animation];
            press.onPointerdown(pointerdown());
            ripple.resolve();
            await Promise.resolve();
            expect(el.hasAttribute('data-press-animating')).toBe(false);
        });

        it('a previous press\'s cancellation never clears the new press\'s flag', async () => {
            // The restart cancels the animation it replaces, so the OLD
            // promise rejects a microtask after the NEW flag is armed.
            // Unkeyed, that rejection would clear a press that just started.
            const first = deferredAnimation();
            const second = deferredAnimation();
            el.getAnimations = () => [first.animation];
            press.onPointerdown(pointerdown());
            el.getAnimations = () => [second.animation];
            press.onPointerdown(pointerdown());
            first.reject();
            await Promise.resolve();
            expect(el.hasAttribute('data-press-animating')).toBe(true);
            // …and the new press still resolves on its own animation.
            second.resolve();
            await Promise.resolve();
            expect(el.hasAttribute('data-press-animating')).toBe(false);
        });

        it('restarts on a re-press while still animating', () => {
            stubAnimations(1);
            press.onPointerdown(pointerdown());
            press.onPointerup(new PointerEvent('pointerup'));
            press.onPointerdown(pointerdown());
            expect(el.hasAttribute('data-press-animating')).toBe(true);
            // The first press's listeners were detached by the restart: one
            // animationend must not leave a second, stale pair behind that
            // would clear the NEXT press early.
            el.dispatchEvent(new AnimationEvent('animationend'));
            expect(el.hasAttribute('data-press-animating')).toBe(false);
            press.onPointerdown(pointerdown());
            expect(el.hasAttribute('data-press-animating')).toBe(true);
        });
    });
});
