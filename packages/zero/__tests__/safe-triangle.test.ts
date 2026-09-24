import { describe, it, expect, vi } from 'vitest';
import { createPointerGrace, pointInTriangle, safeTriangle } from '../src/behaviors/safe-triangle';

// A submenu to the right of the trigger: its near (left) edge at x=200,
// spanning y 100..300. The pointer leaves the trigger at (180, 120).
const popup = { left: 200, top: 100, right: 360, bottom: 300 };

describe('safeTriangle (#19)', () => {
    it('spans from the exit point (pulled back by slack) to the near edge — right-hand popup', () => {
        expect(safeTriangle({ x: 180, y: 120 }, popup)).toEqual([
            { x: 176, y: 120 },
            { x: 200, y: 100 },
            { x: 200, y: 300 },
        ]);
    });

    it('aims at the right edge for a popup on the left (RTL, or flipped)', () => {
        const left = { left: 0, top: 100, right: 150, bottom: 300 };
        expect(safeTriangle({ x: 170, y: 120 }, left, 2)).toEqual([
            { x: 172, y: 120 },
            { x: 150, y: 100 },
            { x: 150, y: 300 },
        ]);
    });

    it('has no triangle when the popup overlaps the exit point horizontally', () => {
        expect(safeTriangle({ x: 250, y: 120 }, popup)).toBeNull();
    });

    it('has no triangle for an unmeasured popup (no layout)', () => {
        expect(safeTriangle({ x: 0, y: 0 }, { left: 0, top: 0, right: 0, bottom: 0 })).toBeNull();
    });
});

describe('pointInTriangle', () => {
    const tri = safeTriangle({ x: 180, y: 120 }, popup)!;

    it('accepts the diagonal path toward the popup', () => {
        // Down and to the right, the path that crosses sibling items.
        expect(pointInTriangle({ x: 185, y: 130 }, tri)).toBe(true);
        expect(pointInTriangle({ x: 195, y: 250 }, tri)).toBe(true);
        expect(pointInTriangle({ x: 180, y: 120 }, tri)).toBe(true);
    });

    it('rejects a pointer moving away — straight down, back, or past the popup', () => {
        expect(pointInTriangle({ x: 180, y: 200 }, tri)).toBe(false);
        expect(pointInTriangle({ x: 150, y: 120 }, tri)).toBe(false);
        expect(pointInTriangle({ x: 190, y: 90 }, tri)).toBe(false);
        expect(pointInTriangle({ x: 205, y: 150 }, tri)).toBe(false);
    });

    it('counts the edges as inside, whatever the winding', () => {
        expect(pointInTriangle({ x: 200, y: 200 }, tri)).toBe(true);
        const reversed = [tri[2], tri[1], tri[0]] as const;
        expect(pointInTriangle({ x: 185, y: 130 }, reversed)).toBe(true);
        expect(pointInTriangle({ x: 180, y: 200 }, reversed)).toBe(false);
    });
});

describe('createPointerGrace', () => {
    const inside = { x: 1, y: 1 };
    const outside = { x: 9, y: 9 };
    const region = (p: { x: number }) => p.x < 5;

    it('holds nothing without an active grace', () => {
        const grace = createPointerGrace();
        expect(grace.holds(inside, () => {})).toBe(false);
    });

    it('holds a hover inside the region and hands it back when its owner ends', () => {
        const grace = createPointerGrace();
        const owner = {};
        const hover = vi.fn();
        grace.start(owner, region);
        expect(grace.holds(outside, hover)).toBe(false);
        expect(grace.isHeld(hover)).toBe(false);
        expect(grace.holds(inside, hover)).toBe(true);
        expect(grace.isHeld(hover)).toBe(true);
        expect(grace.end({})).toBeNull(); // not the owner: no-op
        expect(grace.end(owner)).toBe(hover);
        expect(grace.holds(inside, hover)).toBe(false);
    });

    it('keeps one held hover — the latest — and release drops it', () => {
        const grace = createPointerGrace();
        const owner = {};
        const a = vi.fn();
        const b = vi.fn();
        grace.start(owner, region);
        grace.holds(inside, a);
        grace.holds(inside, b);
        expect(grace.isHeld(a)).toBe(false);
        grace.release(a); // not held: no-op
        expect(grace.isHeld(b)).toBe(true);
        grace.release(b);
        expect(grace.end(owner)).toBeNull();
    });

    it('a new start replaces the previous owner and forgets its held hover', () => {
        const grace = createPointerGrace();
        const first = {};
        const second = {};
        grace.start(first, region);
        grace.holds(inside, () => {});
        grace.start(second, () => false);
        expect(grace.end(first)).toBeNull();
        expect(grace.holds(inside, () => {})).toBe(false);
        expect(grace.end(second)).toBeNull();
    });
});
