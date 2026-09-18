/**
 * Pure number math for NumberInput — DOM-free and unit-testable.
 *
 * The float trap this file exists for: `0.1 + 0.2 → 0.30000000000000004`,
 * so repeated stepping by a decimal step accumulates noise unless every
 * result is rounded back to the precision the inputs actually have.
 */

/** Decimal places of a number as written (`0.25 → 2`, `10 → 0`). */
export function precisionOf(n: number): number {
    const s = String(n);
    const e = s.indexOf('e-');
    // 1e-7 stringifies exponentially; its precision is the exponent.
    if (e !== -1) return parseInt(s.slice(e + 2), 10);
    const dot = s.indexOf('.');
    return dot === -1 ? 0 : s.length - dot - 1;
}

export function clamp(v: number, min?: number, max?: number): number {
    if (min !== undefined && v < min) return min;
    if (max !== undefined && v > max) return max;
    return v;
}

/**
 * Snap to the step grid anchored at `min` (APG: with min 1 and step 2 the
 * valid values are 1, 3, 5…, not 0, 2, 4…). Without a min the grid anchors
 * at 0. The result is rounded to the combined precision of step and anchor
 * so stepping never accumulates float noise.
 */
export function snapToStep(v: number, step: number, min?: number): number {
    const base = min ?? 0;
    const precision = Math.max(precisionOf(step), precisionOf(base));
    // The quotient carries its own float noise — 0.35/0.1 is
    // 3.4999999999999996, which Math.round would pull DOWN across the
    // midpoint the decimal arithmetic sits exactly on. Rounding the quotient
    // to 10 decimals first restores the intended half-up behavior.
    const steps = Math.round(Number(((v - base) / step).toFixed(10)));
    return Number((steps * step + base).toFixed(precision));
}
