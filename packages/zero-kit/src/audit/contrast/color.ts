/**
 * The colour math both matrices share — a port of `installColorMath` from
 * `examples/playground/e2e/contrast-audit.spec.ts`, one function for one.
 *
 * The browser spec resolves every colour through a 1×1 canvas: assigning
 * `fillStyle` is the one reliable way to turn `oklch()` / `color-mix()`
 * output into sRGB, and reading the pixel back composites semi-transparent
 * ink for free. There is no canvas here, so culori does the conversion and
 * the compositing is written out — and every intermediate is rounded to
 * 8-bit exactly where the canvas would have rounded it, so the number this
 * side reports is the number a pixel would have held. That is what lets the
 * parity gate (slice D) compare the two to a tolerance rather than to a
 * shrug.
 */
import { converter, parse } from 'culori';

export type RGB = [number, number, number];

export interface ParsedColor {
    /** sRGB, 0–255, NOT yet rounded — rounding happens at compositing. */
    rgb: [number, number, number];
    alpha: number;
}

const toRgb = converter('rgb');

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * A colour LITERAL to sRGB — hex, `rgb()`, `hsl()`, a named colour,
 * `transparent`, or any function culori evaluates. Out-of-gamut channels
 * are clipped, which is what a canvas does with an `oklch()` it cannot
 * display. `null` for anything that is not a colour.
 */
export function parseColor(value: string): ParsedColor | null {
    const parsed = parse(value.trim().toLowerCase());
    if (!parsed) return null;
    const rgb = toRgb(parsed);
    if (!rgb) return null;
    return {
        rgb: [clamp01(rgb.r) * 255, clamp01(rgb.g) * 255, clamp01(rgb.b) * 255],
        alpha: rgb.alpha ?? 1,
    };
}

const round8 = (n: number): number => Math.min(255, Math.max(0, Math.round(n)));

/** The spec's `resolve(color, under)`: the colour's own alpha composited over `under`. */
export function resolveOver(color: ParsedColor, under: RGB): RGB {
    const a = color.alpha;
    return [
        round8(under[0] + (color.rgb[0] - under[0]) * a),
        round8(under[1] + (color.rgb[1] - under[1]) * a),
        round8(under[2] + (color.rgb[2] - under[2]) * a),
    ];
}

/** The spec's `blend`: `over` seen through `t` opacity on top of `under`. */
export function blend(over: RGB, under: RGB, t: number): RGB {
    return [
        round8(under[0] + (over[0] - under[0]) * t),
        round8(under[1] + (over[1] - under[1]) * t),
        round8(under[2] + (over[2] - under[2]) * t),
    ];
}

const linear = (c: number): number => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

export const luminance = ([r, g, b]: RGB): number => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);

/** WCAG 2.x contrast on two 8-bit sRGB colours. */
export function contrast(a: RGB, b: RGB): number {
    const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
    return (l1 + 0.05) / (l2 + 0.05);
}

/** Rounded the way the spec rounds every reported ratio. */
export const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Does this colour put any paint on the page at all? */
export const hasInk = (color: ParsedColor | null): color is ParsedColor => color !== null && color.alpha > 0;

/** The `#rrggbb` a reading is reported with. */
export const hex = ([r, g, b]: RGB): string =>
    `#${[r, g, b].map((c) => round8(c).toString(16).padStart(2, '0')).join('')}`;
