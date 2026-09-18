/**
 * Spin press — press-and-hold auto-repeat for increment/decrement triggers
 * (NumberInput's stepper buttons).
 *
 * One spin fires immediately on press; repetition starts after `delay` and
 * then ticks every `interval`. The gesture ends wherever the pointer is
 * released: a one-shot window listener (the same discipline as press.ts)
 * catches releases that land off-element, and dragging off the trigger
 * stops the repeat — you are no longer pressing the button.
 *
 * Keyboard needs none of this: a held ArrowUp/ArrowDown auto-repeats
 * keydown natively (`e.repeat`), so key spinning is just the component's
 * keydown handler.
 */

export interface SpinPressOptions {
    /** One step. Fires once on press, then per repeat tick. */
    onSpin(): void;
    /** Pressing a disabled trigger spins nothing; going disabled mid-hold stops. */
    isDisabled?: () => boolean;
    /** ms before auto-repeat starts (default 400). */
    delay?: () => number;
    /** ms between repeat ticks (default 64). */
    interval?: () => number;
}

export interface SpinPressHandlers {
    onPointerdown(e: PointerEvent): void;
    onPointerup(e: PointerEvent): void;
    onPointercancel(e: PointerEvent): void;
    onPointerleave(e: PointerEvent): void;
    /** Clear timers and listeners; call from onUnmounted. */
    stop(): void;
}

export function createSpinPress(opts: SpinPressOptions): SpinPressHandlers {
    let delayHandle: ReturnType<typeof setTimeout> | null = null;
    let repeatHandle: ReturnType<typeof setInterval> | null = null;
    let detachRelease: (() => void) | null = null;

    const stop = (): void => {
        if (delayHandle != null) clearTimeout(delayHandle);
        if (repeatHandle != null) clearInterval(repeatHandle);
        delayHandle = repeatHandle = null;
        detachRelease?.();
    };

    return {
        onPointerdown(e) {
            if (opts.isDisabled?.() || e.button !== 0) return;
            // The triggers are tabIndex=-1 satellites of the input: eating
            // the default keeps focus (and the caret) where it is instead of
            // letting the press blur the input.
            e.preventDefault();
            stop();
            opts.onSpin();
            // The first spin may have parked the value on a bound and
            // disabled the trigger — nothing left to repeat, so don't arm
            // timers or window listeners at all.
            if (opts.isDisabled?.()) return;
            delayHandle = setTimeout(() => {
                repeatHandle = setInterval(() => {
                    if (opts.isDisabled?.()) {
                        stop();
                        return;
                    }
                    opts.onSpin();
                }, opts.interval?.() ?? 64);
            }, opts.delay?.() ?? 400);

            const pointerId = e.pointerId;
            const release = (ev: PointerEvent): void => {
                if (ev.pointerId === pointerId) stop();
            };
            window.addEventListener('pointerup', release, true);
            window.addEventListener('pointercancel', release, true);
            detachRelease = () => {
                window.removeEventListener('pointerup', release, true);
                window.removeEventListener('pointercancel', release, true);
                detachRelease = null;
            };
        },
        onPointerup: stop,
        onPointercancel: stop,
        onPointerleave: stop,
        stop,
    };
}
