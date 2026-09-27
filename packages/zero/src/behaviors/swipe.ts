/**
 * Swipe to dismiss — the one headless gesture behind a toast flicked off the
 * screen and a drawer sheet dragged back to its edge (#293).
 *
 * The behavior owns the gesture and publishes it as data; the design system
 * owns what it looks like:
 *
 * - `--swipe-x` / `--swipe-y` — the drag offset in px on the part, clamped to
 *   the dismiss axis (the other one stays `0px`). Toward the dismiss edge it
 *   follows the pointer 1:1; the opposite way it gives with resistance, a few
 *   pixels at most, so the part feels held rather than stuck.
 * - `data-swiping` — present while a drag is under way, once the pointer has
 *   moved past a 10px slop along the dismiss axis. A recipe suppresses its
 *   transition there, so the part tracks the pointer instead of chasing it.
 *
 * On release, a drag past `threshold` px — or a flick faster than `velocity`
 * px/ms toward the edge — dismisses: the flag goes, the offset STAYS (the
 * exit plays from where the part was let go) and `onDismiss` runs. Anything
 * shorter springs back: flag and offset are both cleared, and the recipe's
 * own transition carries the part home. `reset()` clears a kept offset — for
 * a part that is shown again after a swipe took it down.
 *
 * What does not start a swipe: a secondary button or a non-primary pointer;
 * a press on an interactive descendant (a button, a link, a field — its own
 * gesture wins); a press while text inside the part is selected; and a press
 * inside content that can still scroll the way the drag would scroll it —
 * a sheet's list is scrolled back to its edge first, then the sheet moves.
 * A drag that leaves the slop across the dismiss axis rather than along it
 * is not a swipe either.
 *
 * `start` / `end` are the logical pair, resolved against the part's reading
 * direction at the moment of the press (`direction.ts`), so a toast at the
 * reading end is flicked toward the end in both directions.
 *
 * Client-only: call it inside a mount hook, run through a `mountScope()` —
 * the listeners are removed when that scope stops (the component unmounts).
 */
import { onScopeDispose } from 'sigx';
import { isRtl } from './direction.js';

/** Which way a swipe dismisses: a physical edge, or the logical `start` / `end` pair. */
export type SwipeDirection = 'up' | 'down' | 'left' | 'right' | 'start' | 'end';

type PhysicalDirection = 'up' | 'down' | 'left' | 'right';

export interface SwipeOptions {
    /** The swiped part — it takes the pointer events, the flag and the offset. */
    el: HTMLElement;
    /** The dismiss direction, read at each press. */
    direction: () => SwipeDirection;
    /** Whether a press may start a swipe now (open, dismissible, …). Default always. */
    enabled?: () => boolean;
    /** Distance in px past which a release dismisses. Default 50. */
    threshold?: number;
    /** Speed in px/ms toward the edge past which a release dismisses. Default 0.11. */
    velocity?: number;
    /** The swipe dismissed the part. */
    onDismiss: () => void;
    /** `data-swiping` went on (true) or off (false). */
    onSwipingChange?: (swiping: boolean) => void;
}

export interface Swipe {
    /** Abandon a drag in flight and clear the published offset and flag. */
    reset(): void;
    /** Remove the listeners (also done when the enclosing scope stops). */
    destroy(): void;
}

/** Movement in px before a press becomes a swipe. */
const SLOP = 10;
/** How far, at most, the part gives the opposite way. */
const RESIST = 24;

/**
 * Descendants whose own press wins over the swipe. Matched from the press
 * target up to (not including) the part itself.
 */
const INTERACTIVE = [
    'a[href]', 'button', 'input', 'select', 'textarea', 'label', 'summary',
    '[contenteditable]:not([contenteditable="false"])',
    '[role="button"]', '[role="link"]', '[role="slider"]', '[role="checkbox"]',
    '[role="switch"]', '[role="tab"]', '[role="menuitem"]', '[role="option"]',
].join(', ');

function physical(direction: SwipeDirection, rtl: boolean): PhysicalDirection {
    if (direction === 'start') return rtl ? 'right' : 'left';
    if (direction === 'end') return rtl ? 'left' : 'right';
    return direction;
}

/**
 * Whether `node` can still scroll the way a drag toward `dir` would scroll
 * it — a finger moving down reveals what is above, so a list scrolled away
 * from its top keeps the gesture. `scrollLeft` runs negative in RTL.
 */
function canScrollAgainst(node: Element, dir: PhysicalDirection): boolean {
    const style = getComputedStyle(node);
    const vertical = dir === 'up' || dir === 'down';
    const overflow = vertical ? style.overflowY : style.overflowX;
    if (overflow !== 'auto' && overflow !== 'scroll') return false;
    if (vertical) {
        const max = node.scrollHeight - node.clientHeight;
        if (max <= 1) return false;
        return dir === 'down' ? node.scrollTop > 0 : node.scrollTop < max - 1;
    }
    const max = node.scrollWidth - node.clientWidth;
    if (max <= 1) return false;
    const rtl = style.direction === 'rtl';
    const min = rtl ? -max : 0;
    const top = rtl ? 0 : max;
    // A rightward drag reveals what is to the left: scrollLeft can still fall.
    return dir === 'right' ? node.scrollLeft > min + 1 : node.scrollLeft < top - 1;
}

/** A non-collapsed selection that touches the part. */
function selectsInside(el: HTMLElement): boolean {
    const selection = typeof getSelection === 'function' ? getSelection() : null;
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return false;
    return el.contains(selection.anchorNode) || el.contains(selection.focusNode);
}

interface Gesture {
    id: number;
    x: number;
    y: number;
    t: number;
    dir: PhysicalDirection;
    swiping: boolean;
    /** Signed distance toward the dismiss edge, px. */
    along: number;
}

export function createSwipe(opts: SwipeOptions): Swipe {
    const { el } = opts;
    const threshold = opts.threshold ?? 50;
    const velocity = opts.velocity ?? 0.11;
    let g: Gesture | null = null;

    const publish = (dir: PhysicalDirection, along: number): void => {
        // Toward the edge 1:1; the other way, a damped give that tends to RESIST.
        const offset = along >= 0 ? along : -RESIST * (1 - Math.exp(along / RESIST));
        const sign = dir === 'down' || dir === 'right' ? 1 : -1;
        const px = `${Math.round(offset * sign * 100) / 100}px`;
        const horizontal = dir === 'left' || dir === 'right';
        el.style.setProperty('--swipe-x', horizontal ? px : '0px');
        el.style.setProperty('--swipe-y', horizontal ? '0px' : px);
    };

    const clearOffset = (): void => {
        el.style.removeProperty('--swipe-x');
        el.style.removeProperty('--swipe-y');
    };

    const setSwiping = (on: boolean): void => {
        if (on) el.setAttribute('data-swiping', '');
        else el.removeAttribute('data-swiping');
        opts.onSwipingChange?.(on);
    };

    /** End the gesture; `dismissed` keeps the offset for the exit to start from. */
    const end = (dismissed: boolean): void => {
        const gesture = g;
        g = null;
        if (!gesture) return;
        try {
            if (el.hasPointerCapture?.(gesture.id)) el.releasePointerCapture(gesture.id);
        } catch { /* the pointer is already gone */ }
        if (!gesture.swiping) return;
        // WebKit extends a mouse drag's selection behind the move handler
        // (and `user-select` only stops it prefixed): the drag was a swipe, so
        // whatever it selected goes — or it would block the next press.
        if (selectsInside(el)) getSelection()?.removeAllRanges();
        // Flag first, then the offset, in the same frame: the part's own
        // transition is back by the time the offset changes, so it springs.
        setSwiping(false);
        if (!dismissed) clearOffset();
    };

    const onPointerdown = (e: PointerEvent): void => {
        // A press that never became a swipe may have been released off the
        // part (uncaptured, its pointerup went elsewhere): a new press replaces it.
        if (g?.swiping || !e.isPrimary || e.button !== 0) return;
        g = null;
        if (opts.enabled && !opts.enabled()) return;
        const target = e.target instanceof Element ? e.target : null;
        if (!target || !el.contains(target)) return;
        const hit = target.closest(INTERACTIVE);
        if (hit && hit !== el && el.contains(hit)) return;
        if (selectsInside(el)) return;
        const dir = physical(opts.direction(), isRtl(el));
        for (let node: Element | null = target; node; node = node.parentElement) {
            if (canScrollAgainst(node, dir)) return;
            if (node === el) break;
        }
        g = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, dir, swiping: false, along: 0 };
    };

    const onPointermove = (e: PointerEvent): void => {
        if (!g || e.pointerId !== g.id) return;
        const dx = e.clientX - g.x;
        const dy = e.clientY - g.y;
        const horizontal = g.dir === 'left' || g.dir === 'right';
        const sign = g.dir === 'down' || g.dir === 'right' ? 1 : -1;
        const along = (horizontal ? dx : dy) * sign;
        const across = horizontal ? dy : dx;
        if (!g.swiping) {
            if (Math.abs(along) < SLOP && Math.abs(across) < SLOP) return;
            // Out of the slop sideways: a scroll or a selection, not ours.
            if (Math.abs(across) > Math.abs(along)) {
                g = null;
                return;
            }
            if (opts.enabled && !opts.enabled()) {
                g = null;
                return;
            }
            g.swiping = true;
            try {
                el.setPointerCapture(g.id);
            } catch { /* not capturable (synthetic event): the drag still tracks */ }
            setSwiping(true);
        }
        // A mouse drag over text extends a selection as it goes.
        if (selectsInside(el)) getSelection()?.removeAllRanges();
        g.along = along;
        publish(g.dir, along);
    };

    const onPointerup = (e: PointerEvent): void => {
        if (!g || e.pointerId !== g.id) return;
        if (!g.swiping) {
            g = null;
            return;
        }
        const elapsed = Math.max(1, e.timeStamp - g.t);
        const dismiss = g.along >= threshold || (g.along > 0 && g.along / elapsed >= velocity);
        end(dismiss);
        if (dismiss) opts.onDismiss();
    };

    const onCancel = (e: PointerEvent): void => {
        if (!g || e.pointerId !== g.id) return;
        end(false);
    };

    el.addEventListener('pointerdown', onPointerdown);
    el.addEventListener('pointermove', onPointermove);
    el.addEventListener('pointerup', onPointerup);
    el.addEventListener('pointercancel', onCancel);
    el.addEventListener('lostpointercapture', onCancel);

    const destroy = (): void => {
        el.removeEventListener('pointerdown', onPointerdown);
        el.removeEventListener('pointermove', onPointermove);
        el.removeEventListener('pointerup', onPointerup);
        el.removeEventListener('pointercancel', onCancel);
        el.removeEventListener('lostpointercapture', onCancel);
    };
    onScopeDispose(destroy);

    return {
        reset: () => {
            end(false);
            clearOffset();
            el.removeAttribute('data-swiping');
        },
        destroy,
    };
}
