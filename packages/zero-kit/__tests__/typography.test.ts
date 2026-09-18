/**
 * Typography: families, weights, leading, tracking, and the modular scale.
 *
 * `--font-*` is FAMILIES. That is a deliberate contract decision, not an
 * accident of naming: the whole ecosystem spells it that way, and a
 * `--font-sans` that meant a size would be actively confusing. Sizes are
 * `--text-*`.
 */
import { describe, it, expect } from 'vitest';
import { compileTokensCss, defineTokens, generateTypeScale, validateDesignSystem } from '@sigx/zero-kit';
import type { DesignSystemInput, ManifestComponent } from '@sigx/zero-kit';
import { anatomies } from '@sigx/zero/anatomy';
import { tokenVocabulary } from '../src/resolve/vocabulary.js';

const manifest = {
    components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[],
};
const colors = {
    'base-100': 'oklch(100% 0 0)', 'base-200': 'oklch(96% 0 0)',
    'base-300': 'oklch(92% 0 0)', 'base-content': 'oklch(20% 0 0)',
    primary: 'oklch(50% 0.2 260)', 'primary-content': 'oklch(98% 0.01 260)',
};
const roles = { primary: {} } as const;

const compile = (typography: Record<string, unknown>) => compileTokensCss(defineTokens({
    roles,
    system: { typography } as never,
    defaultLight: 'l',
    themes: { l: { colorScheme: 'light', colors } },
}));

const RAMP = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'] as const;

describe('the modular scale generator', () => {
    it('steps geometrically out from the origin', () => {
        // base 1rem at `md` (index 2), ratio 2 — powers of two either side,
        // so the arithmetic is checkable by eye rather than by re-running it.
        expect(generateTypeScale({ base: '1rem', ratio: 2 }, RAMP)).toEqual({
            xs: '0.25rem',
            sm: '0.5rem',
            md: '1rem',
            lg: '2rem',
            xl: '4rem',
            '2xl': '8rem',
            '3xl': '16rem',
        });
    });

    it('rounds without mangling integers', () => {
        // `(100).toFixed(4)` is "100.0000"; a naive /\.?0+$/ trim turns that
        // into "1". Trailing-zero trimming has to anchor on the decimal point.
        expect(generateTypeScale({ base: '100px', ratio: 10, steps: ['a', 'b'], origin: 'a' }, RAMP))
            .toEqual({ a: '100px', b: '1000px' });
    });

    it('keeps the requested precision', () => {
        const scale = generateTypeScale({ base: '1rem', ratio: 1.25 }, RAMP);
        expect(scale.md).toBe('1rem');
        expect(scale.lg).toBe('1.25rem');
        expect(scale.xl).toBe('1.5625rem');
        expect(scale['2xl']).toBe('1.9531rem'); // 1.953125 at default precision 4
    });

    it('honours custom steps and origin', () => {
        expect(generateTypeScale(
            { base: '16px', ratio: 1.5, steps: ['body', 'lead', 'hero'], origin: 'body' },
            RAMP,
        )).toEqual({ body: '16px', lead: '24px', hero: '36px' });
    });

    it.each([
        ['a base with no unit', { base: '1', ratio: 1.25 }, /has no unit/],
        ['a non-numeric base', { base: 'clamp(1rem, 2vw, 2rem)', ratio: 1.25 }, /must be a number with a unit/],
        ['a ratio of 1', { base: '1rem', ratio: 1 }, /greater than 1/],
        ['an origin outside the steps', { base: '1rem', ratio: 1.25, origin: 'nope' }, /is not one of steps/],
    ])('rejects %s', (_label, scale, message) => {
        expect(() => generateTypeScale(scale as never, RAMP)).toThrow(message);
    });
});

describe('typography emission', () => {
    it('emits families, weights, leading and tracking', () => {
        const css = compile({
            fonts: { sans: 'Inter, system-ui', mono: 'JetBrains Mono, monospace' },
            weights: { normal: 400, bold: 700 },
            leading: { tight: 1.2 },
            tracking: { wide: '0.08em' },
        });
        expect(css).toContain('--font-sans: Inter, system-ui;');
        expect(css).toContain('--font-mono: JetBrains Mono, monospace;');
        expect(css).toContain('--weight-bold: 700;');
        expect(css).toContain('--leading-tight: 1.2;');
        expect(css).toContain('--tracking-wide: 0.08em;');
    });

    it('generates the --text-* ramp from a scale', () => {
        const css = compile({ scale: { base: '1rem', ratio: 2 } });
        expect(css).toContain('--text-md: 1rem;');
        expect(css).toContain('--text-lg: 2rem;');
        expect(css).toContain('--text-xs: 0.25rem;');
    });

    it('lets an explicit size override one generated step', () => {
        // A generated ramp with one hand-tuned display size is a normal thing
        // to want, so `sizes` wins per key rather than replacing the ramp.
        const css = compile({
            scale: { base: '1rem', ratio: 2 },
            sizes: { '3xl': 'clamp(2rem, 5vw, 4rem)' },
        });
        expect(css).toContain('--text-lg: 2rem;');                   // still generated
        expect(css).toContain('--text-3xl: clamp(2rem, 5vw, 4rem);'); // overridden
    });

    it('keeps --font-* for families only', () => {
        // The contract decision, asserted: nothing in the font namespace is a
        // size, and nothing in the text namespace is a family.
        const css = compile({ fonts: { sans: 'Inter' }, scale: { base: '1rem', ratio: 1.25 } });
        const fontDecls = [...css.matchAll(/--font-[\w-]+:\s*([^;]+);/g)].map((m) => m[1]!);
        expect(fontDecls.every((v) => !/^[\d.]+(rem|px|em)$/.test(v.trim()))).toBe(true);
        expect(css).toMatch(/--text-md:\s*[\d.]+rem;/);
    });
});

describe('the --text-fixed-* aliases', () => {
    const themeBlock = (css: string, name: string): string => {
        const match = css.match(new RegExp(`\\[data-theme="${name}"\\] \\{([^}]*)\\}`));
        expect(match, `theme block "${name}"`).toBeTruthy();
        return match![1]!;
    };

    it('emits a var() alias for every text key, declared or generated', () => {
        const css = compile({
            scale: { base: '1rem', ratio: 2 },
            sizes: { display: '4rem' },
        });
        expect(css).toContain('--text-fixed-md: var(--text-md);');
        expect(css).toContain('--text-fixed-xs: var(--text-xs);');
        expect(css).toContain('--text-fixed-display: var(--text-display);');
    });

    it('lets a literal fixed-* key win over the derived alias', () => {
        const css = compile({ sizes: { md: '1rem', 'fixed-md': '17px' } });
        expect(css).toContain('--text-fixed-md: 17px;');
        expect(css).not.toContain('--text-fixed-md: var(--text-md);');
    });

    it('restates the alias in exactly the theme blocks that re-emit the key', () => {
        // An alias substitutes its var() where DECLARED, so a theme scope that
        // redeclares --text-md without restating --text-fixed-md would keep
        // :root's captured value — the same trap as color-referencing tokens.
        const css = compileTokensCss(defineTokens({
            roles,
            system: { typography: { sizes: { md: '1rem', sm: '0.875rem' } } },
            defaultLight: 'plain',
            themes: {
                plain: { colorScheme: 'light', colors },
                big: {
                    colorScheme: 'light',
                    colors,
                    system: { typography: { sizes: { md: '1.25rem' } } },
                },
            },
        }));
        const big = themeBlock(css, 'big');
        expect(big).toContain('--text-md: 1.25rem;');
        expect(big).toContain('--text-fixed-md: var(--text-md);');
        // The untouched key stays inherited — no dead restatement.
        expect(big).not.toContain('--text-sm');
        expect(themeBlock(css, 'plain')).not.toContain('--text-fixed');
    });

    it('is part of the vocabulary recipes validate against', () => {
        const vocab = tokenVocabulary(defineTokens({
            roles,
            system: { typography: { sizes: { display: '4rem', 'fixed-md': '17px' } } },
            defaultLight: 'l',
            themes: { l: { colorScheme: 'light', colors } },
        }));
        expect(vocab.names.has('--text-fixed-display')).toBe(true); // declared key
        expect(vocab.names.has('--text-fixed-sm')).toBe(true);      // recommended key
        // A literal fixed-* key is itself in the vocabulary but mints no
        // second-order alias — the compiler never emits one, and accepting
        // `var(--text-fixed-fixed-md)` would validate a token that doesn't exist.
        expect(vocab.names.has('--text-fixed-md')).toBe(true);
        expect(vocab.names.has('--text-fixed-fixed-md')).toBe(false);
    });
});

describe('unitless token validation', () => {
    const ds = (typography: Record<string, unknown>): DesignSystemInput => ({
        name: 'probe',
        recipes: [],
        tokens: {
            roles,
            system: { typography },
            defaultLight: 'l',
            themes: { l: { colorScheme: 'light', colors } },
        } as DesignSystemInput['tokens'],
    });
    const errors = (t: Record<string, unknown>) =>
        validateDesignSystem(ds(t), manifest).errors.map((e) => e.message);

    it('rejects a weight with a unit', () => {
        // `font-weight: 600px` is dropped silently, same failure mode as a
        // unitless duration.
        expect(errors({ weights: { bold: '700px' } }))
            .toContainEqual(expect.stringContaining('not a valid <number>'));
    });

    it('rejects a line-height with a unit', () => {
        expect(errors({ leading: { normal: '1.5rem' } }))
            .toContainEqual(expect.stringContaining('not a valid <number>'));
    });

    it('accepts unitless numbers and functional values', () => {
        expect(errors({ weights: { bold: 700 }, leading: { normal: '1.5', tight: 'var(--leading-normal)' } }))
            .toEqual([]);
    });

    it('leaves tracking alone, since it is a length', () => {
        expect(errors({ tracking: { wide: '0.05em' } })).toEqual([]);
    });
});

describe('degenerate values', () => {
    it('rejects a step that rounds away to zero', () => {
        // `0rem` is valid CSS, so nothing downstream would complain about a
        // ramp step that renders invisible text.
        expect(() => generateTypeScale(
            { base: '0.00001rem', ratio: 2, steps: ['a', 'b'], origin: 'a' },
            RAMP,
        )).toThrow(/rounds to 0rem at precision 4/);
    });

    it('trims trailing zeros without emptying the value', () => {
        expect(generateTypeScale({ base: '1rem', ratio: 2, steps: ['a'], origin: 'a' }, RAMP))
            .toEqual({ a: '1rem' });
    });
});

describe('functional values must be the whole value', () => {
    const ds = (typography: Record<string, unknown>): DesignSystemInput => ({
        name: 'probe',
        recipes: [],
        tokens: {
            roles, system: { typography }, defaultLight: 'l',
            themes: { l: { colorScheme: 'light', colors } },
        } as DesignSystemInput['tokens'],
    });
    const errors = (t: Record<string, unknown>) =>
        validateDesignSystem(ds(t), manifest).errors.map((e) => e.message);

    it.each([
        ['trailing junk', 'var(--x)junk'],
        ['leading value', '700 var(--x)'],
        ['unbalanced', 'calc(1 + 2'],
    ])('rejects %s', (_label, value) => {
        expect(errors({ weights: { bold: value } }))
            .toContainEqual(expect.stringContaining('not a valid <number>'));
    });

    it('accepts a whole functional value, including nested calls', () => {
        expect(errors({ weights: { bold: 'calc(var(--weight-normal) + max(100, 200))' } })).toEqual([]);
    });
});

describe('scale input guards', () => {
    it.each([
        ['a negative base', { base: '-1rem', ratio: 2 }, /positive finite length/],
        ['an infinite ratio', { base: '1rem', ratio: Infinity }, /finite number greater than 1/],
        ['a negative precision', { base: '1rem', ratio: 2, precision: -1 }, /integer between 0 and 20/],
        ['an absurd precision', { base: '1rem', ratio: 2, precision: 200 }, /integer between 0 and 20/],
        ['a fractional precision', { base: '1rem', ratio: 2, precision: 1.5 }, /integer between 0 and 20/],
    ])('rejects %s with a targeted message', (_label, scale, message) => {
        // Without these, toFixed throws a bare RangeError or the ramp fills
        // with NaN/negative sizes that nothing downstream would question.
        expect(() => generateTypeScale(scale as never, RAMP)).toThrow(message);
    });
});

describe('generated step names', () => {
    it('rejects a step that could escape the declaration', () => {
        // Steps become the tail of `--text-<step>`, so a `;` or `}` would
        // break out into the surrounding rule. Generated CSS is not a place
        // to trust input.
        expect(() => generateTypeScale(
            { base: '1rem', ratio: 2, steps: ['a; } :root { --hacked: 1', 'ok'], origin: 'ok' },
            RAMP,
        )).toThrow(/not a kebab-case identifier/);
    });

    it('rejects a duplicated step', () => {
        // Object.fromEntries keeps only the last, so the ramp would come out
        // a step short with nothing to indicate why.
        expect(() => generateTypeScale(
            { base: '1rem', ratio: 2, steps: ['md', 'md'], origin: 'md' },
            RAMP,
        )).toThrow(/more than once/);
    });

    it('allows a leading digit, as the token grammar does', () => {
        expect(generateTypeScale({ base: '1rem', ratio: 2, steps: ['md', '2xl'], origin: 'md' }, RAMP))
            .toEqual({ md: '1rem', '2xl': '2rem' });
    });
});

describe('value grammar accepts what CSS accepts', () => {
    const ds = (typography: Record<string, unknown>): DesignSystemInput => ({
        name: 'probe',
        recipes: [],
        tokens: {
            roles, system: { typography }, defaultLight: 'l',
            themes: { l: { colorScheme: 'light', colors } },
        } as DesignSystemInput['tokens'],
    });
    const errors = (t: Record<string, unknown>) =>
        validateDesignSystem(ds(t), manifest).errors.map((e) => e.message);

    it('allows a leading + on a number', () => {
        expect(errors({ weights: { bold: '+700' } })).toEqual([]);
    });

    it('allows an uppercase function name', () => {
        // CSS function names are case-insensitive.
        expect(errors({ weights: { bold: 'VAR(--app-weight)' } })).toEqual([]);
    });
});

describe('scale belongs to the base tier', () => {
    it('rejects a scale smuggled into a per-theme override', () => {
        // A scale MINTS --text-* keys, so allowing it in an override would let
        // a theme introduce keys behind the "override only declared keys"
        // rule. ThemeSystem has no `scale` field; this is the runtime half.
        const ds: DesignSystemInput = {
            name: 'probe',
            recipes: [],
            tokens: {
                roles,
                system: { typography: { sizes: { md: '1rem' } } },
                defaultLight: 'l',
                themes: {
                    l: { colorScheme: 'light', colors },
                    big: {
                        colorScheme: 'light',
                        colors,
                        system: { typography: { scale: { base: '2rem', ratio: 2 } } },
                    },
                },
            } as DesignSystemInput['tokens'],
        };
        const r = validateDesignSystem(ds, manifest);
        expect(r.errors.map((e) => e.message))
            .toContainEqual(expect.stringContaining('belongs in tokens.system.typography'));
        // …and the keys must not have been minted regardless.
        expect(compileTokensCss(ds.tokens)).not.toContain('--text-xs');
    });
});

describe('scale base units', () => {
    it('rejects a mistyped unit', () => {
        // `1rme` would generate a whole ramp the browser drops on sight, and
        // the failure would surface much later as unstyled text.
        expect(() => generateTypeScale({ base: '1rme', ratio: 2 }, RAMP))
            .toThrow(/not a CSS length unit/);
    });

    it.each(['1rem', '16px', '1.5em', '2vw', '100%', '1DVH', '12pt'])('accepts %s', (base) => {
        expect(() => generateTypeScale({ base, ratio: 1.25 }, RAMP)).not.toThrow();
    });
});
