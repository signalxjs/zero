/**
 * Part presence — how an optional part (a Label, a native Control) tells
 * its root it is rendered, so the root's IDREFs (`aria-labelledby`, `for`)
 * never point at an element that does not exist (#169).
 *
 * Both writes are deferred a microtask. A write made during a render pass is
 * invisible to the root rendering it: the mount happens while the root's
 * render effect is running (the Dialog/NavList `present` seam), and so does
 * an unmount when the root's own re-render drops the part. The root counts
 * rather than flags, so a part swapped for another in one patch — the old
 * one's withdrawal and the new one's report landing in either order — still
 * reads as present.
 *
 * Server-rendered, the report lands at hydration: nothing re-renders on the
 * server after a part registers.
 */

/** The root side: one report applied to a count (read `> 0`). */
export function countPresence(count: number, present: boolean): number {
    return Math.max(0, count + (present ? 1 : -1));
}

/** The part side: report on setup, withdraw on unmount — both deferred. */
export function reportPresence(set: (present: boolean) => void, onUnmounted: (fn: () => void) => void): void {
    let alive = true;
    let reported = false;
    queueMicrotask(() => {
        if (!alive) return;
        reported = true;
        set(true);
    });
    onUnmounted(() => {
        alive = false;
        if (reported) queueMicrotask(() => set(false));
    });
}
