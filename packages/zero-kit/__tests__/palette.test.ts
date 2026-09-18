/**
 * Palette derivation (#402): a theme's colours from seed hues, with the
 * contrast floors holding by construction.
 *
 * The oracle is culori, not the module under test: every guarantee below
 * is measured by parsing the FORMATTED strings with culori's own parser and
 * `wcagContrast` / `displayable`, because the emitted string is the only
 * thing a design system ships. The hand-rolled conversion is separately
 * pinned against culori to 1e-6 — that parity is what lets `/define` carry
 * no dependency and still make a claim in WCAG's units.
 *
 * Written red-first: with `solveContentLightness` stubbed to return its
 * input, the floor sweep fails on the first mid-grey role.
 */
import { describe, expect, it } from 'vitest';
import { converter, displayable, formatHex, interpolate, parse, wcagContrast } from 'culori';
import { anatomies } from '@sigx/zero/anatomy';
import type { DesignSystemInput, ManifestComponent, RolesDecl } from '@sigx/zero-kit';
import {
    clampChroma,
    contrastPairs,
    contrastRatio,
    derivePalette,
    deriveThemePair,
    formatOklch,
    requiredColorTokens,
    resolveRoles,
    solveContentLightness,
    validateDesignSystem,
} from '@sigx/zero-kit';
import type { Oklch } from '@sigx/zero-kit';
import { roles as materialRoles } from '@sigx/zero-material';
import { designSystem as basicDS } from '@sigx/zero-basic';

const toOklch = converter('oklch');

/** A deterministic xorshift32 — the same seeds every run, no dependency. */
function rng(seed: number): () => number {
    let x = seed >>> 0 || 1;
    return () => {
        x ^= x << 13;
        x >>>= 0;
        x ^= x >>> 17;
        x ^= x << 5;
        x >>>= 0;
        return x / 0x1_0000_0000;
    };
}

const SCHEMES = ['light', 'dark'] as const;
const VOCABULARIES: Record<string, RolesDecl> = {
    recommended: resolveRoles(undefined),
    material: materialRoles,
    none: {},
};

describe('the hand-rolled colour math agrees with culori', () => {
    it('contrastRatio matches wcagContrast within 1e-6 over 1000 random oklch pairs', () => {
        const next = rng(0xc0ffee);
        const sample = (): Oklch => ({ l: next(), c: next() * 0.4, h: next() * 360 });
        for (let i = 0; i < 1000; i++) {
            const a = sample();
            const b = sample();
            const expected = wcagContrast(
                { mode: 'oklch', l: a.l, c: a.c, h: a.h },
                { mode: 'oklch', l: b.l, c: b.c, h: b.h },
            );
            expect(Math.abs(contrastRatio(a, b) - expected)).toBeLessThan(1e-6);
        }
    });

    it('clampChroma lands inside sRGB by culori\'s strict test, hue and lightness untouched', () => {
        const next = rng(42);
        for (let i = 0; i < 500; i++) {
            const input: Oklch = { l: 0.05 + next() * 0.9, c: next() * 0.5, h: next() * 360 };
            const clamped = clampChroma(input);
            expect(displayable(formatOklch(clamped))).toBe(true);
            expect(clamped.l).toBeCloseTo(input.l, 3);
            expect(clamped.h).toBeCloseTo(input.h, 1);
            // Never wider than the input beyond the 0.001 grid it is snapped onto.
            expect(clamped.c).toBeLessThanOrEqual(Math.round(input.c * 1000) / 1000 + 1e-9);
        }
    });

    it('formatOklch round-trips through culori to the quantized value', () => {
        const s = formatOklch({ l: 0.48123, c: 0.16049, h: 255.04 });
        expect(s).toBe('oklch(48.1% 0.16 255)');
        const parsed = toOklch(parse(s)!)!;
        expect(parsed.l).toBeCloseTo(0.481, 10);
        expect(parsed.c).toBeCloseTo(0.16, 10);
        expect(parsed.h).toBeCloseTo(255, 10);
    });
});

describe('solveContentLightness', () => {
    it('returns the input when it already passes', () => {
        const fg: Oklch = { l: 0.98, c: 0.01, h: 205 };
        const bg: Oklch = { l: 0.45, c: 0.11, h: 205 };
        expect(solveContentLightness(fg, bg, 4.5)).toEqual(clampChroma(fg));
    });

    it('moves lightness to the nearest passing side and keeps hue + chroma', () => {
        // A content colour too close to its role: L 0.6 on a 0.48 role.
        const bg: Oklch = { l: 0.48, c: 0.13, h: 260 };
        const solved = solveContentLightness({ l: 0.6, c: 0.03, h: 260 }, bg, 4.5)!;
        expect(solved).not.toBeNull();
        expect(solved.h).toBe(260);
        expect(solved.c).toBeCloseTo(0.03, 3);
        expect(wcagContrast(formatOklch(solved), formatOklch(bg))).toBeGreaterThanOrEqual(4.5);
        // "Nearest": the passing set is two-sided; the light side is closer to 0.6.
        expect(solved.l).toBeGreaterThan(0.6);
        // And it is the EDGE, not white: one grid step darker fails.
        expect(wcagContrast(formatOklch({ ...solved, l: solved.l - 0.002 }), formatOklch(bg))).toBeLessThan(4.5);
    });

    it('returns null when no lightness can reach the floor', () => {
        // A mid-grey background: neither black nor white clears 7:1.
        const mid: Oklch = { l: 0.6, c: 0, h: 0 };
        expect(solveContentLightness({ l: 0.9, c: 0, h: 0 }, mid, 7)).toBeNull();
    });
});

describe.each(SCHEMES)('derivePalette (%s)', (scheme) => {
    describe.each(Object.entries(VOCABULARIES))('over the %s vocabulary', (_label, roles) => {
        const required = requiredColorTokens(roles);
        const pairs = contrastPairs(roles);
        const roleNames = Object.keys(roles);

        it('holds every guarantee for 400 seeded palettes', () => {
            const next = rng(scheme === 'light' ? 7 : 11);
            for (let i = 0; i < 400; i++) {
                // Seed a random subset of roles with random hues/chromas so
                // every code path (seeded, harmony-derived, semantic,
                // unknown-role fallback) is exercised.
                const seeds: Record<string, number | { hue: number; chroma?: number; lightness?: number }> = {};
                for (const name of roleNames) {
                    const r = next();
                    if (r < 0.4) seeds[name] = next() * 360;
                    else if (r < 0.6) seeds[name] = { hue: next() * 360, chroma: next() * 0.3, lightness: 0.2 + next() * 0.6 };
                }
                const harmony = (['analogous', 'complementary', 'split', 'triadic'] as const)[i % 4];
                const colors = derivePalette({ roles, scheme, seeds, harmony }) as Record<string, string>;

                // Exactly the contract's keys, in its order — never `-soft`.
                expect(Object.keys(colors)).toEqual(required);

                for (const [token, value] of Object.entries(colors)) {
                    expect(value, token).toMatch(/^oklch\([\d.]+% [\d.]+ [\d.]+\)$/);
                    expect(displayable(value), `${token} ${value} is outside sRGB`).toBe(true);
                }

                for (const [bg, fg] of pairs) {
                    const floor = bg === 'base-100' ? 7 : 4.5;
                    const ratio = wcagContrast(colors[bg]!, colors[fg]!);
                    expect(ratio, `${bg} vs ${fg}: ${colors[bg]} / ${colors[fg]} (seeds ${JSON.stringify(seeds)})`)
                        .toBeGreaterThanOrEqual(floor);
                }

                // The ink floor (#422): every role reads at 3:1 on base-200 and
                // on its own soft surface, derived the way the compiler does —
                // the recommended recipes spend a role as ink on outline, soft
                // and ghost variants and as an indicator fill.
                for (const name of roleNames) {
                    const role = colors[name]!;
                    // `color-mix(in oklab, role 16%, base-100)` is 16% ROLE into the base — the compiler's spelling.
                    const soft = formatHex(interpolate([colors['base-100']!, role], 'oklab')(0.16));
                    expect(wcagContrast(role, colors['base-200']!), `${name} ${role} on base-200 ${colors['base-200']} (seeds ${JSON.stringify(seeds)})`)
                        .toBeGreaterThanOrEqual(3 - 1e-6);
                    expect(wcagContrast(role, soft), `${name} ${role} on its soft ${soft} (seeds ${JSON.stringify(seeds)})`)
                        .toBeGreaterThanOrEqual(3 - 1e-6);
                }

                // A seeded hue survives to the tenth of a degree wherever it
                // carries enough chroma to have one.
                for (const [name, seed] of Object.entries(seeds)) {
                    const hue = typeof seed === 'number' ? seed : seed.hue;
                    const parsed = toOklch(parse(colors[name]!)!)!;
                    if ((parsed.c ?? 0) > 0.02) {
                        const delta = Math.abs((((parsed.h ?? 0) - hue) % 360 + 540) % 360 - 180);
                        expect(delta, `${name} hue drifted from ${hue} to ${parsed.h}`).toBeLessThanOrEqual(1);
                    }
                }

                // Deterministic: same seeds, same strings.
                expect(derivePalette({ roles, scheme, seeds, harmony })).toEqual(colors);
            }
        });
    });
});

describe('derivePalette defaults', () => {
    it('one hue is enough — the default-seed light theme', () => {
        expect(derivePalette({ scheme: 'light', seeds: { primary: 260 } })).toMatchInlineSnapshot(`
          {
            "accent": "oklch(48% 0.095 230)",
            "accent-content": "oklch(98% 0.01 230)",
            "base-100": "oklch(98.6% 0.006 260)",
            "base-200": "oklch(96% 0.006 260)",
            "base-300": "oklch(91.5% 0.006 260)",
            "base-content": "oklch(26% 0.012 260)",
            "error": "oklch(48% 0.12 25)",
            "error-content": "oklch(98% 0.009 25)",
            "info": "oklch(48% 0.12 245)",
            "info-content": "oklch(98% 0.01 245)",
            "neutral": "oklch(30% 0.012 260)",
            "neutral-content": "oklch(98% 0.009 260)",
            "primary": "oklch(48% 0.13 260)",
            "primary-content": "oklch(98% 0.009 260)",
            "secondary": "oklch(48% 0.052 290)",
            "secondary-content": "oklch(98% 0.01 290)",
            "success": "oklch(48% 0.118 155)",
            "success-content": "oklch(98% 0.01 155)",
            "warning": "oklch(61% 0.12 85)",
            "warning-content": "oklch(18% 0.036 85)",
          }
        `);
    });

    it('gives the semantic roles their fixed hues and the harmony pair its rotations', () => {
        const colors = derivePalette({ scheme: 'light', seeds: { primary: 200 }, harmony: 'triadic' }) as Record<string, string>;
        const hue = (token: string): number => toOklch(parse(colors[token]!)!)!.h!;
        expect(hue('info')).toBeCloseTo(245, 0);
        expect(hue('success')).toBeCloseTo(155, 0);
        expect(hue('warning')).toBeCloseTo(85, 0);
        expect(hue('error')).toBeCloseTo(25, 0);
        expect(hue('secondary')).toBeCloseTo(320, 0);
        expect(hue('accent')).toBeCloseTo(80, 0);
        expect(hue('neutral')).toBeCloseTo(200, 0);
    });

    it('honours content: false and produces only the base surfaces for roles: {}', () => {
        const withHairline = derivePalette({
            roles: { primary: {}, outline: { content: false } },
            scheme: 'dark',
            seeds: { primary: 30 },
        }) as Record<string, string>;
        expect(Object.keys(withHairline)).toEqual(['primary', 'primary-content', 'outline', 'base-100', 'base-200', 'base-300', 'base-content']);
        expect(Object.keys(derivePalette({ roles: {}, scheme: 'light' }))).toEqual(['base-100', 'base-200', 'base-300', 'base-content']);
    });

    it('nudges a mid-grey role until a readable content exists', () => {
        // L 0.62 at zero chroma: white gives ~3.9:1 and black ~5.4:1, so 4.5
        // is reachable — but 7:1 is not from either side, forcing the nudge.
        const colors = derivePalette({
            roles: { primary: {} },
            scheme: 'light',
            seeds: { primary: { hue: 0, chroma: 0, lightness: 0.62 } },
            floors: { content: 7 },
        }) as Record<string, string>;
        expect(wcagContrast(colors.primary!, colors['primary-content']!)).toBeGreaterThanOrEqual(7);
        expect(toOklch(parse(colors.primary!)!)!.l).toBeLessThan(0.62);
    });
});

describe('deriveThemePair', () => {
    const manifest = { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] };

    it('spreads into themes and validates clean with zero-basic\'s recipes', () => {
        const themes = deriveThemePair({
            roles: basicDS.tokens.roles,
            seeds: { primary: 205, accent: 55 },
            light: 'ink',
            dark: 'ink-dark',
        });
        expect(themes.ink).toMatchObject({ colorScheme: 'light', pair: 'ink-dark', softMix: 0.10 });
        expect(themes['ink-dark']).toMatchObject({ colorScheme: 'dark', pair: 'ink', softMix: 0.14 });

        const ds: DesignSystemInput = {
            ...basicDS,
            name: 'derived',
            tokens: { ...basicDS.tokens, themes, defaultLight: 'ink', defaultDark: 'ink-dark' },
        };
        const result = validateDesignSystem(ds, manifest);
        expect(result.errors).toEqual([]);
        expect(result.warnings.filter((w) => /contrast/.test(w.message))).toEqual([]);
    });

    it('takes one softMix for both and refuses a shared name', () => {
        const themes = deriveThemePair({ light: 'a', dark: 'b', softMix: 0.2 });
        expect(themes.a!.softMix).toBe(0.2);
        expect(themes.b!.softMix).toBe(0.2);
        expect(() => deriveThemePair({ light: 'x', dark: 'x' })).toThrow(/share the name/);
    });
});
