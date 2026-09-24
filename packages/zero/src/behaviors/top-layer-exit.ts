/**
 * Deferred top-layer exit — the runtime half of popup presence on engines
 * without CSS `overlay` (#17).
 *
 * The recipes animate a popup's exit purely in CSS: `data-state` flips to
 * `closed`, and transitioning `display` and `overlay` with `allow-discrete`
 * keeps the element rendered — and in the top layer — for the length of the
 * fade. `overlay` is Chromium-only, and without it the element leaves the top
 * layer (and turns `display: none`) the moment `close()`/`hidePopover()`
 * returns, so Firefox and WebKit cut the exit to nothing.
 *
 * On those engines this holds the native close back until the exit the flip
 * started has played: one frame for the render to land `data-state="closed"`
 * and the transition to start, then the element's own finite animations'
 * `finished`, with a timeout at their computed end so a stalled or
 * cancelled animation can never leave a popup stuck open. No running
 * animation (reduced motion, a recipe with no exit) closes on that frame.
 * Where `overlay` is supported — or the engine has no Web Animations, as in
 * a simulated DOM — the close is immediate, exactly as before: Chromium's
 * path stays pure CSS.
 *
 * Only a close zero performs goes through here. A close the platform
 * performs on its own — `popover="auto"` light dismiss, a
 * `<form method="dialog">` submit — has already happened by the time zero
 * hears of it, and stays instant outside Chromium.
 */

export interface TopLayerExit {
    /**
     * Run `hide` — the native close — once `node`'s exit has played. A no-op
     * while an exit is already pending. `hide` runs later than the call, so it
     * must re-check that the element is still showing and should still close.
     */
    close(node: Element, hide: () => void): void;
    /** Drop a pending exit (the popup reopened): its `hide` never runs. */
    cancel(): void;
}

/** Slack past an animation's computed end before the timeout closes anyway. */
const SLACK_MS = 50;
/**
 * The longest the look for the exit waits on a frame. A hidden or throttled
 * tab can hold `requestAnimationFrame` back indefinitely, and the close must
 * not be held back with it.
 */
const FRAME_FALLBACK_MS = 100;

function overlaySupported(): boolean {
    return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('overlay', 'auto');
}

export function createTopLayerExit(): TopLayerExit {
    let pending: (() => void) | null = null;

    const cancel = (): void => {
        const stop = pending;
        pending = null;
        stop?.();
    };

    const close = (node: Element, hide: () => void): void => {
        if (pending) return;
        if (
            overlaySupported()
            || typeof node.getAnimations !== 'function'
            || typeof requestAnimationFrame !== 'function'
        ) {
            hide();
            return;
        }
        let live = true;
        let sampled = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const stop = (): void => {
            live = false;
            cancelAnimationFrame(frame);
            clearTimeout(frameFallback);
            if (timer !== undefined) clearTimeout(timer);
        };
        const finish = (): void => {
            if (!live) return;
            stop();
            pending = null;
            hide();
        };
        // The closing render is a scheduled job, not part of the write that
        // got here — a frame later `data-state="closed"` has landed and the
        // transition it starts is visible to getAnimations(). Whichever of
        // the frame and the fallback timeout comes first looks.
        const sample = (): void => {
            if (!live || sampled) return;
            sampled = true;
            clearTimeout(frameFallback);
            cancelAnimationFrame(frame);
            let remaining = 0;
            const exits: Promise<unknown>[] = [];
            for (const animation of node.getAnimations()) {
                const timing = animation.effect?.getComputedTiming();
                const end = Number(timing?.endTime ?? 0);
                // A loop never ends; waiting on it would wedge the close.
                if (!Number.isFinite(end)) continue;
                const now = Number(animation.currentTime ?? 0);
                remaining = Math.max(remaining, (end - now) / (animation.playbackRate || 1));
                // `finished` rejects when the animation is cancelled — a
                // reversal or a style change — which also means "done here".
                exits.push(animation.finished.catch(() => undefined));
            }
            if (exits.length === 0) return finish();
            void Promise.all(exits).then(finish);
            timer = setTimeout(finish, Math.max(0, remaining) + SLACK_MS);
        };
        const frame = requestAnimationFrame(sample);
        const frameFallback = setTimeout(sample, FRAME_FALLBACK_MS);
        pending = stop;
    };

    return { close, cancel };
}
