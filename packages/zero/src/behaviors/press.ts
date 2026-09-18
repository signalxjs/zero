/**
 * Press feedback — the runtime half of pointer-anchored press effects.
 *
 * CSS can react to `:active`, but it cannot see *where* a press landed or let
 * a one-shot effect (Material's ink ripple, a stamp, a pulse) run past
 * release. This behavior publishes exactly that, as data a design system
 * consumes in pure CSS:
 *
 * - `data-pressed` — present while the pointer/key is physically down.
 * - `data-press-animating` — present from press-start until the design
 *   system's press animation ends, however it ends: finished, cancelled, or
 *   destroyed along with the stylesheet that declared it. NOT until release,
 *   so a 50ms tap still plays a full ripple. If the active design system
 *   attaches no animation to the flag, it is removed synchronously.
 * - `--press-x` / `--press-y` — press point in px, relative to the part's
 *   border box. Keyboard presses (Enter/Space) write the box center.
 * - `--press-r` — distance in px from the press point to the farthest
 *   corner, so a covering circle is `calc(var(--press-r) * 2)` wide without
 *   CSS trigonometry. Coordinates survive release deliberately: a release
 *   fade may still be reading them.
 *
 * The lifecycle rule: a press ends when the gesture ends, and pointer
 * capture defines the gesture. An uncaptured pointerleave cancels the press
 * (drag off a button to cancel); a captured pointer (a native range input
 * dragging, touch's implicit capture) keeps the press until pointerup or
 * pointercancel, which capture retargets to the element anyway.
 *
 * Handlers are à la carte: a component spreads the ones that make sense for
 * it. A drag surface (Slider) spreads no key handlers — arrow keys are value
 * changes, not presses — no pointerleave (the gesture survives leaving the
 * box), and passes `oneShot: false`. Releases that land off-element are
 * caught by a one-shot window listener installed at pointer-press-start.
 *
 * Writes are imperative (attribute/style on the node) rather than reactive:
 * restarting a CSS animation requires remove → reflow → re-add, and press
 * state is transient interaction data, not model state. Handlers only ever
 * run in a browser, so the factory is SSR-safe by construction.
 */

export interface PressFeedbackOptions {
    /** The part element to mark. Handlers no-op while it is null. */
    getElement(): HTMLElement | null;
    /** Pressing a disabled part produces no feedback. */
    isDisabled?: () => boolean;
    /**
     * When false, the `data-press-animating` machinery is skipped entirely:
     * a drag surface restarts it on every grab for no visual gain, and each
     * restart forces a reflow. `data-pressed` and the coordinates are still
     * published. Default true.
     */
    oneShot?: boolean;
}

/**
 * Handlers to spread into the part's bag. Every handler is a no-op when the
 * part is disabled or unmounted, so composing them is unconditional.
 */
export interface PressFeedbackHandlers {
    onPointerdown: (e: PointerEvent) => void;
    onPointerup: (e: PointerEvent) => void;
    onPointercancel: (e: PointerEvent) => void;
    onPointerleave: (e: PointerEvent) => void;
    /** Enter/Space (ignoring key repeat) presses at the box center. */
    onKeydown: (e: KeyboardEvent) => void;
    onKeyup: (e: KeyboardEvent) => void;
    /** Safety net: a key held across a focus move must not strand the flag. */
    onBlur: (e: FocusEvent) => void;
}

const isPressKey = (e: KeyboardEvent): boolean => e.key === 'Enter' || e.key === ' ';

export function createPressFeedback(opts: PressFeedbackOptions): PressFeedbackHandlers {
    let cleanupAnimation: (() => void) | null = null;
    let detachRelease: (() => void) | null = null;

    const pressStart = (el: HTMLElement, x: number, y: number): void => {
        const rect = el.getBoundingClientRect();
        const r = Math.hypot(Math.max(x, rect.width - x), Math.max(y, rect.height - y));
        el.style.setProperty('--press-x', `${x}px`);
        el.style.setProperty('--press-y', `${y}px`);
        el.style.setProperty('--press-r', `${r}px`);
        el.setAttribute('data-pressed', '');
        if (opts.oneShot === false) return;

        // One-shot flag. A re-press while the previous effect is still in
        // flight must restart it, and CSS only restarts an animation when the
        // rule stops matching for a frame — hence remove → forced reflow →
        // re-add.
        cleanupAnimation?.();
        if (el.hasAttribute('data-press-animating')) {
            el.removeAttribute('data-press-animating');
            void el.offsetWidth;
        }
        el.setAttribute('data-press-animating', '');

        const done = (e: AnimationEvent): void => {
            // Pseudo-element animations fire on the originating element with
            // `pseudoElement` set, so a plain target check covers ::after
            // ripples; bubbling animationend from children is not ours.
            if (e.target !== el) return;
            cleanupAnimation?.();
        };
        el.addEventListener('animationend', done);
        el.addEventListener('animationcancel', done);
        const cleanup = (): void => {
            el.removeEventListener('animationend', done);
            el.removeEventListener('animationcancel', done);
            el.removeAttribute('data-press-animating');
            if (cleanupAnimation === cleanup) cleanupAnimation = null;
        };
        cleanupAnimation = cleanup;

        // The active design system may style nothing on the flag — then no
        // animationend ever comes, and a dead attribute would linger. Reduced
        // motion is NOT that case: the kit collapses durations to 0.01ms,
        // deliberately nonzero so animationend still fires. `subtree: true`
        // because a pseudo-element ripple is only reported with it — but a
        // descendant's animation (a spinner inside the button) or a running
        // transition fires no animationend at this element, so only CSS
        // animations whose effect targets the part itself count. A
        // pseudo-element effect reports the originating element as target.
        if (typeof el.getAnimations === 'function') {
            const own = el.getAnimations({ subtree: true }).filter((a) => {
                if (typeof CSSAnimation !== 'undefined' && !(a instanceof CSSAnimation)) return false;
                const target = (a.effect as KeyframeEffect | null)?.target;
                return target === undefined || target === el;
            });
            if (own.length === 0) {
                cleanup();
                return;
            }

            // An animation can also VANISH rather than end. Remove the
            // stylesheet that declared it — a runtime design-system swap does
            // exactly that — and the running CSSAnimation is destroyed while
            // `animationcancel` is not reliably dispatched for it (measured on
            // the playground's swap: stranded in 19/20 webkit and 5/20 firefox
            // runs, listeners alone). `Animation.finished` is the signal that
            // cannot be skipped: finishing resolves it, cancelling — including
            // cancellation by stylesheet teardown — rejects it, and neither
            // depends on an event being dispatched. Nothing here guesses a
            // duration: a `--duration-*` token can be anything, and the
            // promise settles when the animation really ends.
            //
            // Keyed to THIS press by cleanup identity. A re-press restarts the
            // one-shot by cancelling the previous animation, and that
            // rejection arrives a microtask later — after the new press has
            // armed its own flag, which it must not clear.
            const settle = (): void => {
                if (cleanupAnimation === cleanup) cleanup();
            };
            for (const animation of own) {
                // Absent in test doubles and in engines predating Web
                // Animations promises; the events stay the fallback there.
                const finished = animation.finished as Promise<Animation> | undefined;
                void finished?.then(settle, settle);
            }
        }
    };

    const pressEnd = (): void => {
        detachRelease?.();
        // Only the held state ends here; the one-shot flag and the
        // coordinates follow their own lifecycles.
        opts.getElement()?.removeAttribute('data-pressed');
    };

    const guard = (): HTMLElement | null =>
        opts.isDisabled?.() ? null : opts.getElement();

    return {
        onPointerdown: (e) => {
            const el = guard();
            if (!el || e.button !== 0) return;
            const rect = el.getBoundingClientRect();
            pressStart(el, e.clientX - rect.left, e.clientY - rect.top);
            // The release may land anywhere: a drag surface (Slider spreads
            // no pointerleave — the gesture survives leaving the box) can be
            // released off-element, where the element's own pointerup never
            // fires. A one-shot window listener ends the press wherever the
            // gesture ends. NOT pointer capture: explicitly capturing breaks
            // WebKit's native range-drag value tracking.
            detachRelease?.();
            const pointerId = e.pointerId;
            const release = (ev: PointerEvent): void => {
                // Only the gesture's own pointer ends it — lifting another
                // finger mid-press must not clear the active interaction.
                if (ev.pointerId === pointerId) pressEnd();
            };
            window.addEventListener('pointerup', release, true);
            window.addEventListener('pointercancel', release, true);
            detachRelease = () => {
                window.removeEventListener('pointerup', release, true);
                window.removeEventListener('pointercancel', release, true);
                detachRelease = null;
            };
        },
        onPointerup: pressEnd,
        onPointercancel: pressEnd,
        onPointerleave: (e) => {
            // A captured pointer's gesture continues past the boundary: the
            // browser retargets pointerup/pointercancel to the capture
            // holder, and per spec suppresses boundary events entirely — but
            // any leave that does slip through mid-gesture must not end the
            // press. Capture is held by the pointerdown target, which in
            // cross-element wiring (checkables: handlers on the label row,
            // feedback on the control) is NOT the marked element — so check
            // the element this handler fired on as well as the marked one.
            const holders = [e.currentTarget as Element | null, opts.getElement()];
            if (holders.some((n) => n?.hasPointerCapture?.(e.pointerId))) return;
            pressEnd();
        },
        onKeydown: (e) => {
            const el = guard();
            if (!el || !isPressKey(e) || e.repeat) return;
            const rect = el.getBoundingClientRect();
            pressStart(el, rect.width / 2, rect.height / 2);
        },
        onKeyup: (e) => {
            if (isPressKey(e)) pressEnd();
        },
        onBlur: pressEnd,
    };
}
