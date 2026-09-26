/**
 * Hover-intent timers — the open/close delays a hover-driven surface waits
 * out before it acts (Tooltip, HoverCard).
 *
 * One pending transition at a time: asking to open cancels a pending close,
 * asking to close cancels a pending open (and a pending close, which the new
 * delay replaces). A delay of 0 acts at once. The owner decides the delays —
 * a group's skip window, a grace period — and calls {@link HoverIntent.cancel}
 * on unmount so no timer fires into a dead component.
 *
 * DOM-free, setup-time: no module state, nothing leaks across SSR requests.
 */

export interface HoverIntent {
    /** Open after `delay` ms (at once when `<= 0`), cancelling a pending close. */
    open(delay: number): void;
    /** Close after `delay` ms (at once when `<= 0`), cancelling a pending open. */
    close(delay: number): void;
    /** Cancel a pending close only — the pointer came back in time. */
    cancelClose(): void;
    /** Cancel both pending transitions. */
    cancel(): void;
}

export function createHoverIntent(setOpen: (open: boolean) => void): HoverIntent {
    let openTimer: ReturnType<typeof setTimeout> | undefined;
    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    const cancel = () => {
        clearTimeout(openTimer);
        clearTimeout(closeTimer);
        openTimer = closeTimer = undefined;
    };
    return {
        open(delay) {
            cancel();
            if (delay <= 0) setOpen(true);
            else openTimer = setTimeout(() => { openTimer = undefined; setOpen(true); }, delay);
        },
        close(delay) {
            cancel();
            if (delay <= 0) setOpen(false);
            else closeTimer = setTimeout(() => { closeTimer = undefined; setOpen(false); }, delay);
        },
        cancelClose() {
            clearTimeout(closeTimer);
            closeTimer = undefined;
        },
        cancel,
    };
}
