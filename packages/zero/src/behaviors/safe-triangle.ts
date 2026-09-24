/**
 * Safe-triangle pointer prediction for submenus (#19).
 *
 * A pointer leaving an open sub-trigger on its way to the submenu travels a
 * diagonal that usually crosses sibling items of the parent level. Hover on
 * a sibling would move focus there and close the submenu the user was
 * heading for. The safe triangle is the region between the point where the
 * pointer left the trigger and the submenu's near edge; while the pointer
 * stays inside it, sibling items do not take hover.
 *
 * Pure geometry plus a DOM-free holder; the menu wires both. The existing
 * hover-intent close delay stays the fallback — it bounds how long a
 * pointer may linger inside the triangle before the submenu closes anyway.
 */

export interface Point {
    x: number;
    y: number;
}

/** The subset of `DOMRect` the geometry reads. */
export interface RectLike {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

export type Triangle = readonly [Point, Point, Point];

/**
 * The triangle from `exit` (where the pointer left the trigger) to the
 * edge of `target` that faces it. The apex is pulled back `slack` px away
 * from the target so the first samples after the exit, which sit on or a
 * hair behind the trigger's edge, still count as heading for the submenu.
 *
 * Returns `null` when there is no facing edge — the target overlaps the
 * exit point horizontally or has no box (not laid out, or no layout at
 * all) — and the caller falls back to the hover-intent delays alone.
 */
export function safeTriangle(exit: Point, target: RectLike, slack = 4): Triangle | null {
    if (target.right <= target.left || target.bottom <= target.top) return null;
    if (exit.x <= target.left) {
        return [
            { x: exit.x - slack, y: exit.y },
            { x: target.left, y: target.top },
            { x: target.left, y: target.bottom },
        ];
    }
    if (exit.x >= target.right) {
        return [
            { x: exit.x + slack, y: exit.y },
            { x: target.right, y: target.top },
            { x: target.right, y: target.bottom },
        ];
    }
    return null;
}

/** Whether `p` lies inside `tri`, edges included. Winding-agnostic. */
export function pointInTriangle(p: Point, tri: Triangle): boolean {
    const [a, b, c] = tri;
    const cross = (o: Point, u: Point, v: Point): number =>
        (u.x - o.x) * (v.y - o.y) - (u.y - o.y) * (v.x - o.x);
    const d1 = cross(a, b, p);
    const d2 = cross(b, c, p);
    const d3 = cross(c, a, p);
    const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
    const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(hasNeg && hasPos);
}

/**
 * One menu level's hover grace. An open submenu `start`s it when the
 * pointer leaves its trigger; the level's items ask `holds` before taking
 * hover. A held hover is remembered (one at a time — the item under the
 * pointer) so it can be replayed if the grace ends without the pointer
 * reaching the submenu.
 */
export interface PointerGrace {
    /** Begin a grace owned by `owner` over the region `contains` accepts. */
    start(owner: object, contains: (p: Point) => boolean): void;
    /**
     * End `owner`'s grace (a no-op for any other owner) and hand back the
     * held hover, if one is waiting, for the caller to replay or drop.
     */
    end(owner: object): (() => void) | null;
    /**
     * True while `p` is inside the active grace region: the item must not
     * take hover now, and `hover` is kept as the one to replay.
     */
    holds(p: Point, hover: () => void): boolean;
    /** Whether `hover` is the held one. */
    isHeld(hover: () => void): boolean;
    /** Drop the held hover — only `hover` when given, any otherwise. */
    release(hover?: () => void): void;
}

export function createPointerGrace(): PointerGrace {
    let owner: object | null = null;
    let contains: ((p: Point) => boolean) | null = null;
    let held: (() => void) | null = null;
    return {
        start(o, test) {
            owner = o;
            contains = test;
            held = null;
        },
        end(o) {
            if (owner !== o) return null;
            const replay = held;
            owner = contains = held = null;
            return replay;
        },
        holds(p, hover) {
            if (!contains || !contains(p)) return false;
            held = hover;
            return true;
        },
        isHeld: (hover) => held === hover,
        release(hover) {
            if (!hover || held === hover) held = null;
        },
    };
}
