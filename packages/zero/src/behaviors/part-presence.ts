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
 * Server-rendered, a report would land too late: nothing re-renders on the
 * server after a part registers, and a Label or native Control is resting
 * content, not a closed popup. So a root that references resting content is
 * optimistic until it has mounted (`settleAfterMount`): the server writes
 * the reference a composed widget needs (the old unconditional markup), the
 * client's first render matches it for hydration, and a microtask after
 * mount — after every part's report — the real count takes over.
 */

/**
 * The root side of an optimistic reference: `settle` runs a microtask after
 * mount, queued behind the reports its parts made during setup. Never on the
 * server, where `onMounted` does not run.
 */
export function settleAfterMount(onMounted: (fn: () => void) => void, settle: () => void): void {
    onMounted(() => queueMicrotask(settle));
}

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
