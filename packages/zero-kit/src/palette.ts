/**
 * Palette derivation — a complete, contrast-clean theme from a handful of
 * seed hues.
 *
 * Every theme colour in a design system used to be authored by hand (or by
 * a model), and the only thing standing between a guess and a shipped
 * 2.8:1 label was the validator's contrast check *after* the fact. This
 * module is the other direction: given the hues that carry the brief, it
 * derives every token `requiredColorTokens(roles)` asks for — base
 * surfaces, roles, `-content` pairs — and solves each pair's lightness so
 * the floor holds **by construction**. The validator still measures; it
 * just has nothing to say.
 *
 * Runtime-safe by contract. This module sits on `@sigx/zero-kit/define`,
 * the one kit surface a design system's `tokens.ts` may value-import in a
 * browser bundle, so it may only reach relative modules
 * (`ds-runtime-imports.test.ts` walks the graph). That is why the colour
 * math is hand-rolled rather than imported from culori: the oklch → oklab
 * → linear-sRGB conversion below uses the same matrices culori does
 * (Björn Ottosson's), and `palette.test.ts` pins the two against each
 * other to 1e-6 over a thousand samples — culori stays the validator's
 * parser, this stays dependency-free.
 *
 * Everything is deterministic: no randomness, no clock, integer-stepped
 * bisections with a fixed budget. The same seeds always derive the same
 * strings, which is what lets a derived theme sit in a byte-pinned golden.
 *
 * Two honesty rules the numbers obey:
 *
 * - **The guarantee is checked on what is emitted.** Every colour is
 *   quantized to the precision `formatOklch` prints (L to 0.1%, chroma to
 *   0.001, hue to 0.1°) *before* it is evaluated, so rounding can never eat
 *   the margin — what the validator re-parses is what the solver measured.
 * - **In gamut means in gamut.** Chroma is clamped into sRGB at every probe
 *   with a small inner margin, so a value the solver accepts is one
 *   culori's `displayable()` accepts too, rather than one a browser clips
 *   to a different colour than the one measured.
 */
import type { RoleDecl } from './contract.js';
import { requiredColorTokens, resolveRoles } from './contract.js';
import type { RolesDecl, ThemeColors, ThemeInput } from './tokens.js';
import type { SystemTokens } from './tokens.js';

/** A colour in oklch. `l` is 0–1 (not percent), `c` ≥ 0, `h` in degrees. */
export interface Oklch {
    l: number;
    c: number;
    h: number;
}

/** A role's seed: a hue, optionally with its own chroma and lightness. */
export interface RoleSeed {
    hue: number;
    /** oklch chroma. Defaults per role (see `derivePalette`). */
    chroma?: number;
    /** oklch lightness 0–1. Defaults per scheme (see `derivePalette`). */
    lightness?: number;
}

/** How `secondary` and `accent` relate to `primary` when not seeded. */
export type Harmony = 'analogous' | 'complementary' | 'split' | 'triadic';

export interface DerivePaletteOptions<R extends RolesDecl = RolesDecl> {
    /**
     * The design system's role vocabulary. Omitted → the recommended eight,
     * exactly as `TokensInput.roles` reads it. `{}` → base surfaces only.
     * The result carries **exactly** `requiredColorTokens(roles)`: no
     * `-content` for a `content: false` role, never a `-soft` (the compiler
     * derives those from `softMix`).
     */
    roles?: R;
    scheme: 'light' | 'dark';
    /**
     * Seeds per role — a bare number is a hue. `{ primary: 260 }` is enough:
     * the semantic four take fixed hues, `secondary`/`accent` follow the
     * `harmony` rotation, `neutral` is the primary hue desaturated, and any
     * other declared role falls back to the primary hue at an index-derived
     * lightness step (seed it for a real colour).
     */
    seeds?: Partial<Record<keyof R & string, number | RoleSeed>>;
    /** Rotation rule for the unseeded `secondary`/`accent`. Default `analogous`. */
    harmony?: Harmony;
    /** Tint of the base surfaces. Defaults to the primary hue at a paper-tint chroma. */
    base?: { hue?: number; chroma?: number };
    /**
     * Contrast floors. `content` for every `<role>`/`<role>-content` pair
     * (default 4.5); `base` for `base-100`/`base-content` (default 7); `ink`
     * for every role against `base-200` (default 3) — the recommended recipes
     * spend a role as INK on the page surfaces (outline, soft and ghost
     * variants, indicator fills), not only as a fill under its `-content`, so
     * a role has to read there too. `base-200` is the nearer surface; clearing
     * it clears `base-100`.
     */
    floors?: { content?: number; base?: number; ink?: number };
    /** The theme's `softMix` — the ink floor is also measured against each role's own `-soft` surface, derived the way the compiler does (`color-mix(in oklab, role <softMix>, base-100)`). Default 0.16, the compiler's. */
    softMix?: number;
}

export interface DeriveThemePairOptions<R extends RolesDecl = RolesDecl>
    extends Omit<DerivePaletteOptions<R>, 'scheme' | 'softMix'> {
    /** Name of the light theme. */
    light: string;
    /** Name of the dark theme. */
    dark: string;
    /** `softMix` per theme. One number applies to both. Default `{ light: 0.10, dark: 0.14 }`. */
    softMix?: number | { light: number; dark: number };
}

// ─── Colour math ────────────────────────────────────────────────────────────
//
// oklch → oklab → LMS → linear sRGB → (gamma) sRGB, and WCAG luminance from
// the linear channels. The matrices are Ottosson's, transcribed at the same
// precision culori carries (`oklab/convertOklabToLrgb.js`), which is what
// makes the parity test a 1e-6 assertion rather than a "close enough".

interface Lrgb {
    r: number;
    g: number;
    b: number;
}

const DEG = Math.PI / 180;

function toLrgb({ l, c, h }: Oklch): Lrgb {
    const a = c ? c * Math.cos(h * DEG) : 0;
    const b = c ? c * Math.sin(h * DEG) : 0;
    const L = (l + 0.3963377773761749 * a + 0.2158037573099136 * b) ** 3;
    const M = (l - 0.1055613458156586 * a - 0.0638541728258133 * b) ** 3;
    const S = (l - 0.0894841775298119 * a - 1.2914855480194092 * b) ** 3;
    return {
        r: 4.0767416360759574 * L - 3.3077115392580616 * M + 0.2309699031821044 * S,
        g: -1.2684379732850317 * L + 2.6097573492876887 * M - 0.3413193760026573 * S,
        b: -0.0041960761386756 * L - 0.7034186179359362 * M + 1.7076146940746117 * S,
    };
}

/**
 * Inner margin on the sRGB gamut test. culori's `displayable()` is a strict
 * `0 ≤ channel ≤ 1`; a colour sitting exactly on the boundary can round to
 * `1.0000000000000002` in one implementation and `1` in the other. Staying
 * this far inside means both agree.
 */
const GAMUT_MARGIN = 1e-6;

function inGamut(color: Oklch): boolean {
    const { r, g, b } = toLrgb(color);
    const ok = (v: number): boolean => v >= GAMUT_MARGIN && v <= 1 - GAMUT_MARGIN;
    return ok(r) && ok(g) && ok(b);
}

/** WCAG relative luminance from the linear channels. */
function luminance(color: Oklch): number {
    const { r, g, b } = toLrgb(color);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * WCAG 2 contrast ratio between two oklch colours (order-independent).
 * Computed on the unclipped linear channels, exactly as culori's
 * `wcagContrast` does, so the parity test holds for out-of-gamut samples
 * as well as in-gamut ones.
 */
/** `color-mix(in oklab, a t, b)` — the compiler's soft-surface derivation, so the floor sees the surface a reader sees. */
function mixOklab(a: Oklch, b: Oklch, t: number): Oklch {
    const A = { l: a.l, a: a.c * Math.cos((a.h * Math.PI) / 180), b: a.c * Math.sin((a.h * Math.PI) / 180) };
    const B = { l: b.l, a: b.c * Math.cos((b.h * Math.PI) / 180), b: b.c * Math.sin((b.h * Math.PI) / 180) };
    const l = A.l * t + B.l * (1 - t);
    const aa = A.a * t + B.a * (1 - t);
    const bb = A.b * t + B.b * (1 - t);
    const c = Math.hypot(aa, bb);
    const h = c < 1e-9 ? b.h : ((Math.atan2(bb, aa) * 180) / Math.PI + 360) % 360;
    return { l, c, h };
}

export function contrastRatio(a: Oklch, b: Oklch): number {
    const la = luminance(a);
    const lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// ─── Quantization and formatting ───────────────────────────────────────────

/** Round `value` to `places` decimals as a number (not a string). */
function round(value: number, places: number): number {
    const f = 10 ** places;
    return Math.round(value * f) / f;
}

/**
 * Snap a colour to the grid `formatOklch` prints on — L to 0.1% (three
 * decimals of the 0–1 value), chroma to 0.001, hue to 0.1°. Every
 * evaluation in this module happens on quantized values, so the guarantee
 * is about the emitted string and not about a float that rounds away.
 */
function quantize({ l, c, h }: Oklch): Oklch {
    const hue = ((h % 360) + 360) % 360;
    return { l: round(l, 3), c: round(c, 3), h: round(hue, 1) };
}

/** `1.2000` → `1.2`, `45.0` → `45`, integers untouched. */
function trim(value: string): string {
    return value.includes('.') ? value.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') : value;
}

/**
 * The repo's spelling: `oklch(48% 0.16 255)` — lightness as a percentage
 * with at most one decimal, chroma with at most three, hue with at most one,
 * trailing zeros trimmed. The number of decimals is the quantization grid,
 * which is what lets the solver's verdict survive the round trip through
 * this string and culori's parser.
 */
export function formatOklch(color: Oklch): string {
    const q = quantize(color);
    return `oklch(${trim((q.l * 100).toFixed(1))}% ${trim(q.c.toFixed(3))} ${trim(q.h.toFixed(1))})`;
}

// ─── Gamut clamp ───────────────────────────────────────────────────────────

/** Bisection steps for the chroma clamp and the lightness solver. */
const BISECTION_STEPS = 24;

/**
 * Largest chroma at this lightness and hue that is inside sRGB (on the
 * quantized grid), keeping `l` and `h` fixed. Chroma 0 is always in gamut
 * for 0 < l < 1, so the search is bounded below by a passing value.
 */
export function clampChroma(color: Oklch): Oklch {
    const q = quantize(color);
    if (inGamut(q)) return q;
    let lo = 0;
    let hi = q.c;
    for (let i = 0; i < BISECTION_STEPS; i++) {
        const mid = (lo + hi) / 2;
        if (inGamut({ ...q, c: mid })) lo = mid;
        else hi = mid;
    }
    // Snap DOWN onto the grid — rounding up could step back out.
    let c = Math.floor(lo * 1000) / 1000;
    while (c > 0 && !inGamut({ ...q, c })) c = round(c - 0.001, 3);
    return { ...q, c };
}

// ─── Lightness solver ──────────────────────────────────────────────────────

/**
 * Move `fg`'s lightness — hue and chroma fixed, chroma clamped into gamut
 * at every probe — to the nearest value whose contrast against `against`
 * meets `floor`. Returns the quantized, in-gamut colour, or `null` when no
 * lightness reaches the floor (a mid-grey `against` that neither black nor
 * white clears at 7:1, say — then the *background* has to move).
 *
 * Contrast against a fixed colour is V-shaped in lightness (it falls until
 * the two luminances meet, then rises), so the passing set is "dark
 * enough" ∪ "light enough". The solver bisects toward each edge from
 * `fg.l` and keeps the closer one. Numeric in and out so a caller that
 * parsed arbitrary CSS with culori can hand it the oklch triplet.
 */
export function solveContentLightness(fg: Oklch, against: Oklch, floor: number): Oklch | null {
    const bg = quantize(against);
    const at = (l: number): Oklch => clampChroma({ ...fg, l });
    const passes = (l: number): boolean => contrastRatio(at(l), bg) >= floor;
    const start = quantize(fg);
    if (passes(start.l)) return at(start.l);

    /** Bisect between a passing bound and the failing start; return the passing edge. */
    const edge = (passing: number): number => {
        let pass = passing;
        let fail = start.l;
        for (let i = 0; i < BISECTION_STEPS; i++) {
            const mid = (pass + fail) / 2;
            if (passes(mid)) pass = mid;
            else fail = mid;
        }
        // Snap onto the grid in the passing direction, then walk until it
        // holds on the grid too (quantization can shave the last 0.0004).
        const dir = passing < start.l ? -1 : 1;
        let l = dir < 0 ? Math.floor(pass * 1000) / 1000 : Math.ceil(pass * 1000) / 1000;
        for (let i = 0; i < 20 && !passes(l); i++) l = round(l + dir * 0.001, 3);
        return l;
    };

    const down = passes(0) ? edge(0) : null;
    const up = passes(1) ? edge(1) : null;
    if (down === null && up === null) return null;
    if (down === null) return at(up!);
    if (up === null) return at(down);
    return at(start.l - down <= up - start.l ? down : up);
}

// ─── Derivation ────────────────────────────────────────────────────────────

/** The hues the recommended semantic roles take unless seeded (zero-basic's). */
const SEMANTIC_HUES: Record<string, number> = { info: 245, success: 155, warning: 85, error: 25 };

/** Rotations from the primary hue for `[secondary, accent]`. */
const HARMONY: Record<Harmony, readonly [number, number]> = {
    analogous: [30, -30],
    complementary: [180, 150],
    split: [150, 210],
    triadic: [120, 240],
};

const DEFAULT_ROLE_CHROMA = 0.13;
const NEUTRAL_CHROMA = 0.012;
const SEMANTIC_CHROMA = 0.12;

interface SchemePreset {
    role: number;
    warning: number;
    neutral: number;
    base: readonly [number, number, number];
    baseChroma: number;
    /** `base-content` starting lightness. */
    ink: number;
    /** `-content` candidates in preference order: [l, c]. */
    content: readonly (readonly [number, number])[];
}

/**
 * Per-scheme starting points, lifted from zero-basic's themes so a derived
 * theme reads like a hand-tuned one: mid-dark roles on paper in light, lit
 * roles on slate in dark; warning brighter than its siblings (amber has to
 * read as amber); neutral an ink rather than a fill — which in dark means a
 * LIGHT neutral (0.33 on a 0.19 surface was 1.5:1, invisible; #422).
 */
const PRESET: Record<'light' | 'dark', SchemePreset> = {
    light: {
        role: 0.48, warning: 0.65, neutral: 0.30,
        base: [0.986, 0.96, 0.915], baseChroma: 0.006, ink: 0.26,
        content: [[0.98, 0.01], [0.18, 0.04]],
    },
    dark: {
        role: 0.74, warning: 0.80, neutral: 0.80,
        base: [0.19, 0.23, 0.285], baseChroma: 0.012, ink: 0.91,
        content: [[0.18, 0.04], [0.98, 0.01]],
    },
};

function seedOf(seed: number | RoleSeed | undefined): RoleSeed | undefined {
    return typeof seed === 'number' ? { hue: seed } : seed;
}

function normHue(h: number): number {
    return ((h % 360) + 360) % 360;
}

/**
 * A `-content` colour for `role`: the scheme's preferred candidate if it
 * clears the floor, else the other, else the nearest lightness the solver
 * finds from the preferred one.
 */
function contentFor(role: Oklch, preset: SchemePreset, floor: number): Oklch | null {
    for (const [l, c] of preset.content) {
        const candidate = clampChroma({ l, c, h: role.h });
        if (contrastRatio(candidate, role) >= floor) return candidate;
    }
    const [l, c] = preset.content[0]!;
    return solveContentLightness({ l, c, h: role.h }, role, floor);
}

/**
 * Derive one theme's colour tokens from seed hues.
 *
 * Guarantees, measured on the emitted strings: every `<role>` /
 * `<role>-content` pair ≥ `floors.content` (default 4.5:1); every role
 * against `base-200` and against its own soft surface ≥ `floors.ink`
 * (default 3:1);
 * `base-100`/`base-content` ≥ `floors.base` (default 7:1) with
 * `base-200`/`base-300` ≥ 4.5:1 against the same ink; every value inside
 * the sRGB gamut; a seeded hue preserved to the tenth of a degree.
 *
 * When a role is so mid-toned that no `-content` lightness can reach the
 * floor, the role's own lightness is nudged 0.02 per step away from the
 * scheme's surfaces until one can. That is the one case where a seed's
 * explicit `lightness` is not honoured verbatim.
 */
export function derivePalette<R extends RolesDecl = RolesDecl>(opts: DerivePaletteOptions<R>): ThemeColors<R> {
    const roles = resolveRoles(opts.roles) as Record<string, RoleDecl>;
    const preset = PRESET[opts.scheme];
    const contentFloor = opts.floors?.content ?? 4.5;
    const baseFloor = opts.floors?.base ?? 7;
    const inkFloor = opts.floors?.ink ?? 3;
    const softMix = opts.softMix ?? 0.16;
    const seeds = (opts.seeds ?? {}) as Partial<Record<string, number | RoleSeed>>;
    const rotation = HARMONY[opts.harmony ?? 'analogous'];

    // The anchor hue: `primary`'s seed, else the first seed given, else the
    // base tint, else 260 (the slate zero-basic grounds itself on).
    const firstSeed = Object.values(seeds).map(seedOf).find((s) => s !== undefined);
    const anchor = seedOf(seeds.primary) ?? firstSeed ?? { hue: opts.base?.hue ?? 260 };
    const anchorHue = normHue(anchor.hue);
    const anchorChroma = anchor.chroma ?? DEFAULT_ROLE_CHROMA;

    const out: Record<string, string> = {};

    // ── Base surfaces ──
    const baseHue = normHue(opts.base?.hue ?? anchorHue);
    const baseChroma = opts.base?.chroma ?? preset.baseChroma;
    const surfaces = preset.base.map((l) => clampChroma({ l, c: baseChroma, h: baseHue }));
    const [base100, base200, base300] = surfaces as [Oklch, Oklch, Oklch];
    let ink: Oklch | null = clampChroma({ l: preset.ink, c: Math.min(baseChroma * 2, 0.015), h: baseHue });
    if (contrastRatio(ink, base100) < baseFloor) ink = solveContentLightness(ink, base100, baseFloor);
    // base-300 is the surface closest to the ink; clearing AA there only
    // moves the ink further from base-100, so the first floor still holds.
    if (ink && contrastRatio(ink, base300) < 4.5) ink = solveContentLightness(ink, base300, 4.5);
    if (!ink) {
        throw new Error(
            `[zero-kit] derivePalette: no base-content lightness reaches ${baseFloor}:1 against base-100 ` +
            `${formatOklch(base100)} — lower floors.base or change base.chroma`,
        );
    }
    out['base-100'] = formatOklch(base100);
    out['base-200'] = formatOklch(surfaces[1]!);
    out['base-300'] = formatOklch(base300);
    out['base-content'] = formatOklch(ink);

    // ── Roles ──
    const names = Object.keys(roles);
    let unknownIndex = 0;
    for (const name of names) {
        const seed = seedOf(seeds[name]);
        let hue: number;
        let chroma: number;
        let lightness: number;
        if (seed) {
            hue = normHue(seed.hue);
            chroma = seed.chroma ?? (name === 'neutral' ? NEUTRAL_CHROMA : name in SEMANTIC_HUES ? SEMANTIC_CHROMA : anchorChroma);
            lightness = seed.lightness ?? (name === 'warning' ? preset.warning : name === 'neutral' ? preset.neutral : preset.role);
        } else if (name === 'primary') {
            hue = anchorHue;
            chroma = anchorChroma;
            lightness = anchor.lightness ?? preset.role;
        } else if (name === 'secondary') {
            hue = normHue(anchorHue + rotation[0]);
            chroma = anchorChroma * 0.4;
            lightness = preset.role;
        } else if (name === 'accent') {
            hue = normHue(anchorHue + rotation[1]);
            chroma = anchorChroma;
            lightness = preset.role;
        } else if (name === 'neutral') {
            hue = anchorHue;
            chroma = NEUTRAL_CHROMA;
            lightness = preset.neutral;
        } else if (name in SEMANTIC_HUES) {
            hue = SEMANTIC_HUES[name]!;
            chroma = SEMANTIC_CHROMA;
            lightness = name === 'warning' ? preset.warning : preset.role;
        } else {
            // A role this module has no opinion about (material's `tertiary`,
            // a `surface-container` tone): the anchor hue, muted, stepped in
            // lightness by declaration order so two unknowns never collide.
            // Deterministic, and deliberately dull — seed it for a real colour.
            const step = ((unknownIndex % 4) - 1.5) * 0.06;
            unknownIndex++;
            hue = anchorHue;
            chroma = anchorChroma * 0.6;
            lightness = preset.role + step;
        }

        let role = clampChroma({ l: lightness, c: chroma, h: hue });
        // The ink floor: the role must read against the nearer page surface
        // AND against its own soft tint (which carries a little of the role,
        // so it is the harder of the two). Hue and chroma stay; only the
        // lightness moves, and only as far as the floor needs — a preset
        // warning at 0.65 lands near 0.6 in light. The soft surface moves with
        // the role, so this iterates; three rounds settle it.
        // The check runs on the QUANTIZED role — the value that gets printed —
        // with a margin of 0.05: the reader (the browser, the audit, culori)
        // measures the soft surface as an 8-bit pixel, and the tenth-of-a-
        // percent lightness rounding plus that pixel rounding are worth a few
        // hundredths of a ratio. Without the margin a printed role lands at
        // 2.99 against a #rrggbb soft.
        const inkMargin = 0.05;
        for (let i = 0; i < 4; i++) {
            const printed = quantize(role);
            const soft = mixOklab(printed, base100, softMix);
            const softLimits = contrastRatio(printed, soft) < contrastRatio(printed, base200);
            const against = softLimits ? soft : base200;
            if (contrastRatio(printed, against) >= inkFloor + inkMargin) { role = printed; break; }
            const inked = solveContentLightness(role, against, inkFloor + inkMargin * 1.5);
            if (!inked) {
                throw new Error(
                    `[zero-kit] derivePalette: no ${name} lightness reaches ${inkFloor}:1 against ` +
                    (softLimits
                        ? `its own soft surface ${formatOklch(soft)} (softMix ${softMix}) — lower floors.ink, lower softMix, or change base.chroma`
                        : `base-200 ${formatOklch(base200)} — lower floors.ink or change base.chroma`),
                );
            }
            role = inked;
        }
        const wantsContent = roles[name]!.content !== false;
        let content: Oklch | null = wantsContent ? contentFor(role, preset, contentFloor) : null;
        // Mid-grey escape: walk the role away from the surfaces until a
        // readable content exists. Bounded; every step is a visible change.
        const direction = opts.scheme === 'light' ? -1 : 1;
        for (let i = 0; wantsContent && content === null && i < 25; i++) {
            role = clampChroma({ ...role, l: round(role.l + direction * 0.02, 3) });
            content = contentFor(role, preset, contentFloor);
        }
        if (wantsContent && content === null) {
            throw new Error(
                `[zero-kit] derivePalette: no ${name}-content lightness reaches ${contentFloor}:1 against ` +
                `${name} ${formatOklch(role)} — lower floors.content or seed a different lightness`,
            );
        }
        out[name] = formatOklch(role);
        if (content) out[`${name}-content`] = formatOklch(content);
    }

    // Exactly the contract's key set, in the contract's order — nothing the
    // validator would call undeclared, nothing it would call missing.
    const ordered: Record<string, string> = {};
    for (const token of requiredColorTokens(roles)) ordered[token] = out[token]!;
    return ordered as ThemeColors<R>;
}

/**
 * A light and a dark theme from the same seeds, already wired to each other
 * — `colorScheme`, `pair` and `softMix` set — so the result spreads straight
 * into `TokensInput.themes`:
 *
 * ```ts
 * themes: {
 *     ...deriveThemePair({ roles, seeds: { primary: 205, accent: 55 }, light: 'ink', dark: 'ink-dark' }),
 * }
 * ```
 */
export function deriveThemePair<R extends RolesDecl = RolesDecl, T extends SystemTokens = SystemTokens>(
    opts: DeriveThemePairOptions<R>,
): Record<string, ThemeInput<R, T>> {
    const { light, dark, softMix, ...rest } = opts;
    if (light === dark) throw new Error(`[zero-kit] deriveThemePair: light and dark themes share the name "${light}"`);
    const mix = typeof softMix === 'number' ? { light: softMix, dark: softMix } : (softMix ?? { light: 0.10, dark: 0.14 });
    return {
        [light]: {
            colorScheme: 'light',
            pair: dark,
            softMix: mix.light,
            colors: derivePalette<R>({ ...rest, scheme: 'light', softMix: mix.light }),
        },
        [dark]: {
            colorScheme: 'dark',
            pair: light,
            softMix: mix.dark,
            colors: derivePalette<R>({ ...rest, scheme: 'dark', softMix: mix.dark }),
        },
    };
}
