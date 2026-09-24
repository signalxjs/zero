/**
 * The role-pair contrast reading the validator's `contrast-floor` rule and
 * the report's per-theme table share (#185), so the two can never disagree
 * about what a pair measures.
 *
 * Two things culori's `wcagContrast` does not do on raw strings, done here:
 *
 * - **Case.** culori matches function names case-sensitively, CSS does not —
 *   `OKLCH(…)` is a colour a browser paints and `bakeColor` accepts, so the
 *   gate lower-cases before it parses (every part of a CSS colour is
 *   case-insensitive, so nothing is damaged).
 * - **Alpha.** culori's WCAG luminance drops alpha, so a 10%-opacity ink
 *   measured 21:1 on white. A translucent colour is read where it lands:
 *   the ink composited over its surface, and a translucent surface
 *   composited over `base-100` — the page surface every role sits on.
 */
import { interpolate, parse, wcagContrast } from 'culori';
import type { Color } from 'culori';

/** A CSS colour literal parsed the way CSS reads it: case-insensitively. */
export function parseCssColor(value: string): Color | undefined {
    return parse(value.trim().toLowerCase());
}

/** `color` (with its own alpha) painted over the opaque `under`. */
export function compositeOver(color: Color, under: Color): Color {
    const alpha = color.alpha ?? 1;
    return alpha < 1 ? interpolate([under, { ...color, alpha: 1 }], 'rgb')(alpha) : color;
}

export type RolePairReading =
    /** `bg` / `fg` are the colours as painted (composited); `translucentFg` says the ink carried alpha. */
    | { ratio: number; bg: Color; fg: Color; translucentFg: boolean }
    | { unmeasured: string };

/**
 * One role pair's contrast in one theme, or `undefined` when either side is
 * missing or unparseable (the validator errors on exactly those, naming the
 * token). `unmeasured` when the surface is translucent and nothing opaque
 * sits under it to composite over.
 */
export function measureRolePair(colors: Record<string, string>, bg: string, fg: string): RolePairReading | undefined {
    const rawBg = colors[bg];
    const rawFg = colors[fg];
    const b = rawBg ? parseCssColor(rawBg) : undefined;
    const f = rawFg ? parseCssColor(rawFg) : undefined;
    if (!b || !f) return undefined;
    let surface = b;
    if ((b.alpha ?? 1) < 1) {
        const page = bg === 'base-100' || !colors['base-100'] ? undefined : parseCssColor(colors['base-100']);
        if (!page || (page.alpha ?? 1) < 1) {
            return { unmeasured: `${bg} is translucent and there is no opaque base-100 under it to read it against` };
        }
        surface = compositeOver(b, page);
    }
    const ink = compositeOver(f, surface);
    return { ratio: wcagContrast(ink, surface), bg: surface, fg: f, translucentFg: (f.alpha ?? 1) < 1 };
}
