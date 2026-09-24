/**
 * Colour baking — evaluating an author colour to the sRGB literal it means
 * in one theme.
 *
 * Born in the lynx target (`targets/lynx/capabilities.ts`), whose engine
 * parses hex/rgb()/hsl() only, so every `oklch()`, `color-mix()` and
 * `light-dark()` a design system writes has to be evaluated at compile time
 * against that theme's own colours. The static contrast matrix (#403, the
 * audit's `contrast/*` rules) needs exactly the same evaluation — what does
 * `var(--color-primary-soft)` come to under the dark theme — so the
 * evaluator moved here, target-neutral, and lynx imports it back. One
 * evaluator serving both is the point: a recipe's baked lynx paint and its
 * audited web paint can never disagree about a colour.
 *
 * Two entry points on the same machinery. `bakeColorValue` THROWS on
 * anything it cannot resolve, which is the right verdict for an emitter —
 * the author wrote paint, and silence would ship a stylesheet that quietly
 * never renders it. `tryBakeColorValue` returns the reason instead, which is
 * the right verdict for an auditor: a cell it cannot judge is reported as
 * `unmeasured`, never as a pass and never as a crash.
 */
import type { Color } from 'culori';
import { converter, formatHex, formatHex8, interpolate, interpolateWithPremultipliedAlpha, parse } from 'culori';

/**
 * Fold `calc()` of NUMERIC LITERALS to the number it computes —
 * `calc(1 * 0.1)` → `0.1`. daisyUI spells constant alphas that way
 * (`oklch(0% 0 0 / calc(1 * 0.1))`), and culori cannot parse calc. Only pure
 * numbers and `+ - * /` fold; anything carrying a unit or a `var()` is left
 * for the caller's error path. A tiny recursive-descent evaluator, not
 * `eval` — the grammar is five tokens.
 */
export function foldConstantCalc(text: string): string {
    // No parens inside the expression — a nested group would let the greedy
    // class swallow the closing paren of the surrounding color function.
    // `calc((1 + 2) * 0.5)` therefore does not fold; it surfaces through the
    // caller's error path if a design system ever writes one.
    return text.replace(/calc\(([0-9.+\-*/\s]+)\)/g, (whole, expr: string) => {
        const tokens = expr.match(/\d*\.?\d+|[+\-*/()]/g);
        if (!tokens || tokens.join('').replace(/\s/g, '') !== expr.replace(/\s/g, '')) return whole;
        let pos = 0;
        const peek = () => tokens[pos];
        const parseExpr = (): number => {
            let left = parseTerm();
            while (peek() === '+' || peek() === '-') {
                const op = tokens[pos++];
                const right = parseTerm();
                left = op === '+' ? left + right : left - right;
            }
            return left;
        };
        const parseTerm = (): number => {
            let left = parseFactor();
            while (peek() === '*' || peek() === '/') {
                const op = tokens[pos++];
                const right = parseFactor();
                left = op === '*' ? left * right : left / right;
            }
            return left;
        };
        const parseFactor = (): number => {
            if (peek() === '(') {
                pos++;
                const inner = parseExpr();
                pos++; // ')'
                return inner;
            }
            return Number(tokens[pos++]);
        };
        const result = parseExpr();
        return pos === tokens.length && Number.isFinite(result)
            ? String(Math.round(result * 1e6) / 1e6)
            : whole;
    });
}

/**
 * Bake one author color to a literal lynx's engine parses. Hex when opaque,
 * 8-digit hex with alpha. Throws on anything culori cannot parse — an
 * unresolvable color is a reject, not a drop: the author wrote a value and
 * silence would paint the platform default instead.
 */
export function bakeColor(value: string, where: string): string {
    // Lower-cased for culori, which matches function names case-sensitively
    // while CSS does not — `OKLCH(…)` is a real colour a browser accepts, and
    // before the patterns above went case-insensitive it slipped past the gate
    // into the emitted stylesheet instead of being baked. Every part of a CSS
    // colour (keywords, hex digits, function names) is case-insensitive, so
    // there is nothing here that lower-casing can damage.
    const parsed = parse(foldConstantCalc(value).toLowerCase());
    if (!parsed) {
        throw new Error(
            `[zero-kit] ${where}: cannot resolve "${value}" to a literal color for the lynx target — `
            + `lynx parses hex/rgb()/hsl() only, and this value is not a color culori can evaluate`,
        );
    }
    const alpha = parsed.alpha ?? 1;
    return alpha >= 1 ? formatHex(parsed) : formatHex8(parsed);
}

/**
 * The soft-tint derivation, baked: the same oklab mix the web writes as live
 * `color-mix(in oklab, var(--color-<role>) <mix>%, var(--color-base-100))`,
 * evaluated at compile time against this theme's own colors. Every emit
 * target derives soft the same way — this is that promise, kept with culori
 * instead of the CSS function.
 */
export function bakeSoft(role: string, base: string, mix: number, where: string): string {
    const mixer = interpolate([bakeColor(base, where), bakeColor(role, where)], 'oklab');
    return formatHex(mixer(mix));
}

/**
 * Two colours converted to `space` with each one's missing components
 * (`undefined` in culori) taken from the other, so the interpolation never
 * invents a hue for an achromatic endpoint. Exported for the test that pins
 * the carry-over against the browser's reading.
 *
 * `written` is each colour as the author spelled it, when that is known. A
 * component is missing only when a CONVERSION made it powerless (CSS Color 4
 * §4.4): `#fff` into oklch has no hue, but `oklch(100% 0 0)` mixed `in oklch`
 * is never converted, and its hue of 0 is a real endpoint the browser
 * interpolates toward (#123). A colour written in the mix's own space keeps
 * the components it wrote that the hex round trip dropped; one written in any
 * other space was converted, so the drop stands. `none` stays missing.
 */
export function carryMissingComponents(
    a: string,
    b: string,
    space: MixSpace,
    written: readonly [Color | undefined, Color | undefined] = [undefined, undefined],
): [Color, Color] {
    const to = converter(space);
    const pa = parse(a);
    const pb = parse(b);
    if (!pa || !pb) throw new Error(`[zero-kit] carryMissingComponents: cannot parse "${pa ? b : a}" as a colour`);
    const ca = { ...to(pa) } as Record<string, unknown>;
    const cb = { ...to(pb) } as Record<string, unknown>;
    const keepWritten = (c: Record<string, unknown>, w: Color | undefined): void => {
        if (!w || w.mode !== space) return;
        for (const [k, v] of Object.entries(w)) {
            if (k !== 'mode' && k !== 'alpha' && c[k] === undefined && v !== undefined) c[k] = v;
        }
    };
    keepWritten(ca, written[0]);
    keepWritten(cb, written[1]);
    for (const k of new Set([...Object.keys(ca), ...Object.keys(cb)])) {
        if (k === 'mode' || k === 'alpha') continue;
        if (ca[k] === undefined && cb[k] !== undefined) ca[k] = cb[k];
        else if (cb[k] === undefined && ca[k] !== undefined) cb[k] = ca[k];
    }
    return [ca as unknown as Color, cb as unknown as Color];
}

/** An interpolation space the baker mixes in — the values of `MIX_SPACES`. */
export type MixSpace = 'oklab' | 'oklch' | 'rgb' | 'hsl' | 'lab' | 'lch';

/** The interpolation spaces `color-mix(in <space>, …)` may name here. */
export const MIX_SPACES: Record<string, MixSpace> = {
    oklab: 'oklab', oklch: 'oklch', srgb: 'rgb', hsl: 'hsl', lab: 'lab', lch: 'lch',
};

/** Index just past the matching `)` for the `(` at `open`. */
export function balancedEnd(text: string, open: number): number {
    let depth = 0;
    for (let i = open; i < text.length; i++) {
        if (text[i] === '(') depth++;
        else if (text[i] === ')' && --depth === 0) return i + 1;
    }
    return -1;
}

/** Split on top-level commas only — arguments may themselves hold parens. */
export function splitTopLevel(text: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '(') depth++;
        else if (text[i] === ')') depth--;
        else if (text[i] === ',' && depth === 0) {
            parts.push(text.slice(start, i));
            start = i + 1;
        }
    }
    parts.push(text.slice(start));
    return parts.map((p) => p.trim());
}

export const COLOR_FN_START = /\b(oklch|oklab|lch|lab|color-mix|light-dark|color|hwb)\(/i;

/**
 * Bake every color-FUNCTION occurrence inside a longer value (a shadow, a
 * gradient stop, a border shorthand) to a literal, resolving `var(--color-*)`
 * references against the theme's own baked colors first — legal because on
 * this target every theme block is a full restatement, so the baked result is
 * exactly what the live function would have computed in that theme.
 *
 * - `light-dark(a, b)` picks the side this theme's `colorScheme` names.
 * - `color-mix(in <space>, A p%?, B q%?)` is evaluated with culori in that
 *   space, CSS-normalized weights.
 * - plain color functions parse directly.
 *
 * Bare `var(--color-*)` references OUTSIDE a color function are left alone —
 * single-level color `var()` is the one lynx-proven indirection, and leaving
 * it live keeps the emitted blocks smaller.
 *
 * Throws where nothing can be resolved: the author wrote paint, and silence
 * would ship a stylesheet that quietly never renders it.
 */
export function bakeColorValue(
    value: string,
    colors: Record<string, string>,
    colorScheme: 'light' | 'dark',
    where: string,
    /**
     * The same tokens as the author wrote them, when `colors` holds baked
     * literals — read only for what a literal cannot carry: the hue of an
     * achromatic `oklch()` token a `color-mix()` interpolates (#123).
     */
    written?: Record<string, string>,
): string {
    const substituteColorVars = (text: string): string =>
        text.replace(/var\(\s*--color-([a-z0-9-]+)\s*(?:,\s*([^()]*))?\)/g, (whole, token: string, fallback?: string) => {
            const resolved = colors[token] ?? fallback?.trim();
            if (!resolved) {
                throw new Error(
                    `[zero-kit] ${where}: a color function reads var(--color-${token}), which this theme does not define — nothing to bake with`,
                );
            }
            return resolved;
        });

    /**
     * `expr` parsed as written, when it is one plain colour — the source
     * `carryMissingComponents` reads a mix operand's own components from. A
     * mix or anything unparseable has no written form here: undefined.
     */
    const writtenColor = (expr: string): Color | undefined => {
        const match = COLOR_FN_START.exec(expr);
        // No colour function (a hex literal, a keyword): a plain colour.
        const fn = match ? match[1]!.toLowerCase() : undefined;
        if (fn === 'color-mix') return undefined;
        if (fn === 'light-dark') {
            const open = expr.indexOf('(', match!.index);
            const args = splitTopLevel(expr.slice(open + 1, balancedEnd(expr, open) - 1));
            return args.length === 2 ? writtenColor(args[colorScheme === 'dark' ? 1 : 0]!) : undefined;
        }
        try {
            const text = written
                ? expr.replace(/var\(\s*--color-([a-z0-9-]+)\s*(?:,\s*([^()]*))?\)/g, (whole, token: string, fallback?: string) =>
                    written[token] ?? colors[token] ?? fallback?.trim() ?? whole)
                : substituteColorVars(expr);
            return parse(foldConstantCalc(text).toLowerCase()) ?? undefined;
        } catch {
            return undefined;
        }
    };

    const bakeOne = (expr: string): string => {
        const match = COLOR_FN_START.exec(expr);
        if (!match) return bakeColor(substituteColorVars(expr), where);
        // Lower-cased for the same reason as `bakeColor`: CSS function
        // names are case-insensitive, so the dispatch below must not be.
        const fn = match[1]!.toLowerCase();
        if (fn === 'light-dark') {
            const open = expr.indexOf('(', match.index);
            const args = splitTopLevel(expr.slice(open + 1, balancedEnd(expr, open) - 1));
            if (args.length !== 2) throw new Error(`[zero-kit] ${where}: light-dark() takes exactly two colors`);
            return bakeOne(args[colorScheme === 'dark' ? 1 : 0]!);
        }
        if (fn === 'color-mix') {
            const open = expr.indexOf('(', match.index);
            const args = splitTopLevel(expr.slice(open + 1, balancedEnd(expr, open) - 1));
            const spaceMatch = /^in\s+([a-z-]+)/i.exec(args[0] ?? '');
            const space = spaceMatch && MIX_SPACES[spaceMatch[1]!.toLowerCase()];
            if (!space || args.length !== 3) {
                throw new Error(
                    `[zero-kit] ${where}: cannot evaluate "${expr}" — color-mix() needs "in <space>, <color> <pct>?, <color> <pct>?" with a known space (${Object.keys(MIX_SPACES).join(', ')})`,
                );
            }
            // CSS allows the percentage on either side of the colour:
            // `red 30%` and `30% red` are the same operand.
            const component = (arg: string): { color: string; pct?: number } => {
                const trailing = /\s([0-9.]+)%\s*$/.exec(arg);
                if (trailing) return { color: arg.slice(0, trailing.index).trim(), pct: Number(trailing[1]) };
                const leading = /^\s*([0-9.]+)%\s+/.exec(arg);
                if (leading) return { color: arg.slice(leading[0].length).trim(), pct: Number(leading[1]) };
                return { color: arg.trim() };
            };
            const a = component(args[1]!);
            const b = component(args[2]!);
            // CSS normalization: a missing percentage takes the complement;
            // both missing is 50/50.
            const pa = a.pct ?? (b.pct !== undefined ? 100 - b.pct : 50);
            const pb = b.pct ?? 100 - pa;
            const sum = pa + pb;
            // CSS Color 5: two percentages summing to zero make the whole
            // function invalid — not black, which is what t = NaN formats as.
            if (sum === 0) {
                throw new Error(`[zero-kit] ${where}: "${expr}" is invalid — color-mix() percentages sum to 0%`);
            }
            const t = pb / sum;
            // PREMULTIPLIED, as CSS Color 5 specifies for color-mix(): a
            // colour mixed toward `transparent` keeps its own lightness and
            // hue and only loses alpha. Plain interpolation drags it toward
            // black — `color-mix(in oklch, #e8e9ea 70%, transparent)` came
            // out `#909091b3` instead of `#e8e9eab3`, a dark-shifted ink on
            // lynx that the static contrast matrix was the first to notice.
            // MISSING COMPONENTS carried over, as CSS Color 4 §12.3 specifies
            // for interpolation: an achromatic colour has no hue in a polar
            // space (`black`, `white`, `transparent`, any grey), and the mix
            // takes the OTHER colour's hue rather than interpolating toward
            // an arbitrary one. culori marks a missing component `undefined`
            // and, left alone, drifted the hue — `color-mix(in oklch,
            // #0087a0 86%, black)` baked to `#00716a` where Chrome paints
            // `#006d82`; the browser parity gate (#403, slice D) is what
            // noticed. `alpha` is not carried: an absent alpha means opaque.
            // An operand WRITTEN in the mix's space keeps what it wrote — see
            // `carryMissingComponents`: an `oklch(100% 0 0)` endpoint pulls
            // an `in oklch` mix toward hue 0, as the browser paints it (#123).
            const carried = carryMissingComponents(
                bakeOne(a.color),
                bakeOne(b.color),
                space,
                [writtenColor(a.color), writtenColor(b.color)],
            );
            const mixer = interpolateWithPremultipliedAlpha(carried, space);
            const mixed = mixer(t);
            // CSS Color 5: a sum under 100% is an alpha multiplier on the
            // result — `red 30%, blue 30%` is the 50/50 purple at alpha 0.6.
            const alpha = (mixed.alpha ?? 1) * (sum < 100 ? sum / 100 : 1);
            if (alpha < 1) mixed.alpha = alpha;
            return alpha >= 1 ? formatHex(mixed) : formatHex8(mixed);
        }
        return bakeColor(substituteColorVars(expr), where);
    };

    // No iteration cap: every pass replaces one top-level colour function
    // with a hex literal (or throws), so the loop ends when none are left.
    // A fixed cap (16, before #182) silently left the rest of a long
    // gradient or many-layer shadow raw for a target that cannot parse it.
    let out = value;
    for (;;) {
        const match = COLOR_FN_START.exec(out);
        if (!match) break;
        const open = out.indexOf('(', match.index);
        const end = balancedEnd(out, open);
        if (end === -1) throw new Error(`[zero-kit] ${where}: unbalanced parentheses in "${value}"`);
        const span = out.slice(match.index, end);
        out = out.slice(0, match.index) + bakeOne(span) + out.slice(end);
    }
    return out;
}

/** What `tryBakeColorValue` says when it cannot say a colour. */
export type BakeFailure = 'unresolved-var' | 'unparseable-color';

/**
 * `bakeColorValue` without the throw: `{ hex }` on success, else the reason
 * — a `var(--color-*)` this theme does not define, or a value culori cannot
 * evaluate (including a `calc()` with units inside a colour, which
 * `foldConstantCalc` leaves alone). The auditor's entry point; the message
 * is discarded because the reason is what the cell records.
 */
export function tryBakeColorValue(
    value: string,
    colors: Record<string, string>,
    colorScheme: 'light' | 'dark',
): { hex: string } | { unresolved: BakeFailure } {
    try {
        return { hex: bakeColorValue(value, colors, colorScheme, 'audit') };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { unresolved: message.includes('which this theme does not define') ? 'unresolved-var' : 'unparseable-color' };
    }
}
