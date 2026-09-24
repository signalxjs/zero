/**
 * Token-layer validation added by issue #318: name grammar on the two
 * previously unchecked declaration surfaces (`tokens.custom`, `theme.extra`),
 * then var-reference resolution and cycle detection over token VALUES —
 * the checks the recipe layer has had all along, mirrored where the tokens
 * themselves are declared.
 *
 * Written red-first: every rejected input below compiled and validated clean
 * before the checks existed (`--My Token: …` was emitted verbatim and
 * silently dropped by the browser; `var(--color-brnad)` in tokens.system
 * resolved to nothing at runtime).
 */
import { describe, expect, it } from 'vitest';
import { oklch, wcagContrast } from 'culori';
import { anatomies } from '@sigx/zero/anatomy';
import type { DesignSystemInput, ManifestComponent, TokensInput } from '@sigx/zero-kit';
import { buildReport, compileDesignSystem, compileTokensCss, suggestContrastFix, validateDesignSystem } from '@sigx/zero-kit';

const manifest = { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] };

const colors = {
    'base-100': 'oklch(100% 0 0)', 'base-200': 'oklch(96% 0 0)', 'base-300': 'oklch(92% 0 0)',
    'base-content': 'oklch(22% 0.01 285)',
    primary: 'oklch(45% 0.2 300)', 'primary-content': 'oklch(97% 0.01 300)',
};

/** A minimal valid design system the cases below break one piece of. */
const ds = (mutate: (tokens: TokensInput) => void): DesignSystemInput => {
    const tokens: TokensInput = {
        roles: { primary: {} },
        themes: { day: { colorScheme: 'light', colors: { ...colors } } },
        defaultLight: 'day',
    } as TokensInput;
    mutate(tokens);
    return { name: 'probe', tokens, recipes: [] };
};

const errors = (input: DesignSystemInput) =>
    validateDesignSystem(input, manifest).errors.map((e) => `${e.where}: ${e.message}`).join('\n');
const warnings = (input: DesignSystemInput) =>
    validateDesignSystem(input, manifest).warnings.map((w) => `${w.where}: ${w.message}`).join('\n');

describe('declared token names', () => {
    it('rejects a tokens.custom name that is not a kebab-case identifier', () => {
        // `--My Token: 12px` is emitted verbatim and the browser drops the
        // whole declaration silently — the incident input from the review.
        const result = errors(ds((t) => {
            t.custom = { 'My Token': {} };
            t.themes['day']!.custom = { 'My Token': '12px' };
        }));
        expect(result).toContain('"My Token" is not a kebab-case identifier');
    });

    it('rejects a theme.extra name that is not a kebab-case identifier', () => {
        const result = errors(ds((t) => {
            t.themes['day']!.extra = { 'Focus Ring': '2px' };
        }));
        expect(result).toContain('"Focus Ring" is not a kebab-case identifier');
    });

    it('accepts kebab names spelled with or without the -- prefix', () => {
        const result = errors(ds((t) => {
            t.custom = { 'glass-blur': {}, '--focus-ring': {} };
            t.themes['day']!.custom = { 'glass-blur': '12px', 'focus-ring': '2px' };
        }));
        expect(result).toBe('');
    });
});

describe('token-value var() references', () => {
    it('errors on an undeclared reference in tokens.system, with a nearest hint', () => {
        // The incident input: `var(--color-brnad)` compiled clean and shipped
        // a shadow that resolves to nothing.
        const result = errors(ds((t) => {
            t.system = { shadow: { md: '0 0 8px var(--color-primry)' } };
        }));
        expect(result).toContain('references "--color-primry"');
        expect(result).toContain('did you mean "--color-primary"');
    });

    it('downgrades to a warning when the reference has a fallback', () => {
        const input = ds((t) => {
            t.system = { shadow: { md: '0 0 8px var(--color-primry, black)' } };
        });
        expect(errors(input)).toBe('');
        expect(warnings(input)).toContain('undeclared token "--color-primry"');
    });

    it('errors on undeclared references in systemDark, theme.system, theme.custom and theme.extra', () => {
        const result = errors(ds((t) => {
            t.systemDark = { shadow: { md: '0 0 8px var(--color-primry)' } };
            t.custom = { 'focus-ring': {} };
            t.themes['day']!.system = { motion: { durations: { fast: 'var(--duration-fastt)' } } };
            t.themes['day']!.custom = { 'focus-ring': '0 0 0 2px var(--color-primry)' };
            t.themes['day']!.extra = { halo: 'var(--color-primry)' };
        }));
        expect(result).toContain('tokens.systemDark');
        expect(result).toContain('themes.day.system');
        expect(result).toContain('themes.day.custom');
        expect(result).toContain('themes.day.extra');
        expect(result).toContain('--duration-fastt');
    });

    it('accepts references to declared tokens, recommended keys and derived aliases', () => {
        const result = errors(ds((t) => {
            t.custom = { 'focus-ring': {} };
            t.system = { shadow: { md: '0 0 8px var(--color-primary-soft)' } };
            t.themes['day']!.custom = {
                'focus-ring': '0 0 0 calc(var(--border, 1px) * 2) var(--color-primary)',
            };
            t.themes['day']!.extra = { halo: 'var(--text-fixed-sm)' };
        }));
        expect(result).toBe('');
    });
});

describe('custom-property definition cycles', () => {
    it('errors on two tokens that reference each other', () => {
        // `--a: var(--b); --b: var(--a)` — CSS marks every property in the
        // cycle invalid at computed-value time, fallbacks included. Passed
        // validation clean before this check.
        const result = errors(ds((t) => {
            t.custom = { 'ring-width': {}, 'ring-gap': {} };
            t.themes['day']!.custom = {
                'ring-width': 'var(--ring-gap)',
                'ring-gap': 'var(--ring-width, 2px)',
            };
        }));
        expect(result).toMatch(/--ring-width.*--ring-gap|--ring-gap.*--ring-width/);
        expect(result).toContain('cycle');
    });

    it('errors on a self-reference', () => {
        const result = errors(ds((t) => {
            t.custom = { 'ring-width': {} };
            t.themes['day']!.custom = { 'ring-width': 'var(--ring-width, 2px)' };
        }));
        expect(result).toContain('cycle');
    });

    it('a chain without a cycle is fine', () => {
        const result = errors(ds((t) => {
            t.custom = { 'ring-width': {}, 'ring-gap': {} };
            t.themes['day']!.custom = {
                'ring-width': 'calc(var(--ring-gap) * 2)',
                'ring-gap': '2px',
            };
        }));
        expect(result).toBe('');
    });
});

describe('contrast failures suggest the nearest passing value (#412)', () => {
    /** Same fixture, one pair broken: a mid-lightness primary with a near-identical content ink. */
    const lowPrimaryContent = 'oklch(55% 0.2 300)';
    const broken = ds((t) => {
        t.themes.day.colors.primary = 'oklch(45% 0.2 300)';
        t.themes.day.colors['primary-content'] = lowPrimaryContent;
    });
    const contrastIssue = (input: DesignSystemInput, level: 'error' | 'warning', token: string) => {
        const result = validateDesignSystem(input, manifest);
        return (level === 'error' ? result.errors : result.warnings).find(
            (i) => i.message.startsWith('contrast') && i.message.includes(` vs ${token} `),
        );
    };

    it('an error carries a structured suggestion that clears AA, on the same hue', () => {
        const issue = contrastIssue(broken, 'error', 'primary-content');
        expect(issue).toBeDefined();
        expect(issue!.rule).toBe('contrast-floor');
        expect(issue!.suggest).toEqual({ token: 'primary-content', value: expect.stringMatching(/^oklch\(/) });
        expect(issue!.message).toContain(`suggest primary-content: ${issue!.suggest!.value}`);
        // culori is the oracle, on the formatted string the author would paste.
        expect(wcagContrast('oklch(45% 0.2 300)', issue!.suggest!.value)).toBeGreaterThanOrEqual(4.5);
        const hue = oklch(issue!.suggest!.value)!.h ?? 0;
        expect(Math.abs(hue - 300)).toBeLessThanOrEqual(1);
    });

    it('pasting the suggestion back validates that pair clean', () => {
        const suggested = contrastIssue(broken, 'error', 'primary-content')!.suggest!.value;
        const fixed = ds((t) => {
            t.themes.day.colors.primary = 'oklch(45% 0.2 300)';
            t.themes.day.colors['primary-content'] = suggested;
        });
        expect(contrastIssue(fixed, 'error', 'primary-content')).toBeUndefined();
        expect(contrastIssue(fixed, 'warning', 'primary-content')).toBeUndefined();
    });

    it('a warning-tier pair (3–4.5:1) suggests the AA value', () => {
        // 3.6:1 against the primary above.
        const nearMiss = ds((t) => {
            t.themes.day.colors.primary = 'oklch(45% 0.2 300)';
            t.themes.day.colors['primary-content'] = 'oklch(78% 0.05 300)';
        });
        const issue = contrastIssue(nearMiss, 'warning', 'primary-content');
        expect(issue).toBeDefined();
        expect(issue!.rule).toBe('contrast-floor');
        expect(wcagContrast('oklch(45% 0.2 300)', issue!.suggest!.value)).toBeGreaterThanOrEqual(4.5);
    });

    it('when no lightness can reach the floor, the helper says so (unreachable at AA, reachable at 7:1)', () => {
        // Against a mid-grey, black clears 4.5:1 from below or white from
        // above — there is no lightness the AA floor cannot reach, so the
        // validator's "move the role" branch never fires at 4.5. It exists
        // for a stricter floor: at 7:1 a background near 60% L is out of
        // reach from both sides, and the helper reports null rather than a
        // value it cannot vouch for.
        expect(suggestContrastFix('oklch(60% 0 0)', 'oklch(58% 0 0)', 7)).toBeNull();
        const atAA = suggestContrastFix('oklch(60% 0 0)', 'oklch(58% 0 0)', 4.5);
        expect(atAA).not.toBeNull();
        expect(wcagContrast('oklch(60% 0 0)', atAA!)).toBeGreaterThanOrEqual(4.5);
        expect(suggestContrastFix('not a colour', 'oklch(58% 0 0)', 4.5)).toBeNull();
    });

    it('issues from other rules carry neither field', () => {
        const missing = ds((t) => { delete (t.themes.day.colors as Record<string, string>)['primary-content']; });
        const issue = validateDesignSystem(missing, manifest).errors.find((e) => e.message.includes('missing color token'));
        expect(issue).toBeDefined();
        expect(issue!.rule).toBeUndefined();
        expect(issue!.suggest).toBeUndefined();
    });
});

describe('@property initial-value must be computationally independent (#184)', () => {
    // css-properties-values-api: a registration whose initial-value is not
    // computationally independent is an invalid rule — the browser drops the
    // whole `@property`, and the token silently loses its typing. The light
    // theme's value becomes the initial-value, so a relative unit or a
    // reference there must never reach the emitted rule.
    const withCustom = (syntax: string, value: string) => ds((t) => {
        t.custom = { gap: { syntax } };
        t.themes['day']!.custom = { gap: value };
    });
    const registration = (input: DesignSystemInput) =>
        compileTokensCss(input.tokens).split('\n').find((line) => line.includes('@property --gap')) ?? null;

    it.each([
        ['<length>', '1em'],
        ['<length>', '1.5rem'],
        ['<length>', 'calc(4px + 2ch)'],
        ['<length>', '10cqi'],
        ['<color>', 'var(--color-primary)'],
        ['<color>', 'currentColor'],
        ['<color>', 'light-dark(white, black)'],
        ['<length>', 'env(safe-area-inset-top)'],
    ])('skips a %s registration whose light value is %s, and warns', (syntax, value) => {
        const input = withCustom(syntax, value);
        expect(registration(input)).toBeNull();
        // The value itself still ships — only the typing is lost.
        expect(compileTokensCss(input.tokens)).toContain(`--gap: ${value};`);
        expect(errors(input)).toBe('');
        expect(warnings(input)).toMatch(/themes\.day: custom token "gap" .*not computationally independent.*@property --gap is not registered/);
    });

    it("registers a universal ('*') syntax without the dependent initial-value", () => {
        const input = withCustom('*', 'var(--color-primary)');
        expect(registration(input)).toContain("@property --gap { syntax: '*'; inherits: true; }");
        expect(warnings(input)).not.toContain('computationally independent');
    });

    it("keeps a universal ('*') initial-value that is only a relative unit", () => {
        const input = withCustom('*', '1em');
        expect(registration(input)).toContain("@property --gap { syntax: '*'; inherits: true; initial-value: 1em; }");
        expect(warnings(input)).not.toContain('computationally independent');
    });

    it.each([
        ['<length>', '-1em'],
        ['<length>', '.5rem'],
    ])('skips a %s registration whose light value is %s', (syntax, value) => {
        expect(registration(withCustom(syntax, value))).toBeNull();
    });

    it.each([
        ['<length>', '12px'],
        ['<url>', 'url(icon2ex.svg)'],
        ['<url>', 'url("var(--x)-2em.svg")'],
        ['<string>', '"2em"'],
        ['<length>', '50vw'],
        ['<length-percentage>', '50%'],
        ['<color>', 'oklch(45% 0.2 300)'],
        ['<number>', '1.5'],
        ['<time>', '150ms'],
    ])('keeps a %s registration whose light value is %s', (syntax, value) => {
        const input = withCustom(syntax, value);
        expect(registration(input)).toContain(`initial-value: ${value};`);
        expect(warnings(input)).not.toContain('computationally independent');
    });
});

describe('role-pair contrast reads alpha, and colour functions parse case-insensitively (#185)', () => {
    const measured = (input: DesignSystemInput, fg: string) =>
        buildReport(compileDesignSystem(input, manifest), input, manifest).themes[0]!.pairs
            .find((p) => p.fg === fg);

    // A 10%-opacity ink on a dark primary: nearly invisible as painted.
    const faint = ds((t) => { t.themes.day.colors['primary-content'] = 'oklch(97% 0.01 300 / 0.1)'; });

    it('the validator composites a translucent -content colour over its role before measuring', () => {
        const result = validateDesignSystem(faint, manifest);
        const issue = result.errors.find((e) => e.rule === 'contrast-floor' && e.message.includes('vs primary-content'));
        expect(issue, errors(faint)).toBeDefined();
        // Composited as the browser paints it, the pair reads ~1.23:1 — not
        // the 7.57:1 culori reports when it drops the alpha.
        expect(issue!.message).toMatch(/is 1\.2\d:1/);
        expect(issue!.message).toContain('translucent');
        // No lightness suggestion: a translucent ink's lightness is not its paint.
        expect(issue!.suggest).toBeUndefined();
    });

    it('the report scores the same composited ratio', () => {
        expect(measured(faint, 'primary-content')!.ratio).toBeLessThan(1.3);
    });

    it('a translucent role is composited over base-100 before its -content is measured against it', () => {
        // Black at 10% over white paints near-white; white ink on it is unreadable.
        const input = ds((t) => {
            t.themes.day.colors.primary = 'oklch(0% 0 0 / 0.1)';
            t.themes.day.colors['primary-content'] = 'oklch(100% 0 0)';
        });
        expect(errors(input)).toMatch(/contrast primary vs primary-content is 1\.\d\d:1/);
        // …and says why: the surface's alpha, not the ink, is the cause.
        expect(errors(input)).toContain('primary is translucent, composited over base-100');
        expect(measured(input, 'primary-content')!.ratio).toBeLessThan(1.5);
    });

    it('accepts an uppercase colour function, as CSS and bakeColor do', () => {
        const input = ds((t) => {
            t.themes.day.colors.primary = 'OKLCH(45% 0.2 300)';
            t.themes.day.colors['primary-content'] = 'Oklch(97% 0.01 300)';
        });
        expect(errors(input)).toBe('');
        // …and the report measures it rather than skipping it as unparseable.
        expect(measured(input, 'primary-content')!.ratio).toBeGreaterThan(7);
    });
});
