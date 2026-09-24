/**
 * `-soft` tint derivation (#179): the `:root` default pair, the unrounded
 * mix percentage, and the `softMix` range.
 *
 * Written red-first: on main the root emitted the LIGHT side (its explicit
 * value, or its `softMix`) for both schemes whenever the two themes did not
 * both spell `<role>-soft`, so system dark with no `data-theme` painted the
 * light tint — stock zero-basic (softMix 0.10 / 0.14) included. The web and
 * the validator rounded the percentage the baker (lynx, audit) evaluates
 * exactly, and a `softMix` of 16 validated clean and compiled to an invalid
 * `color-mix(… 1600% …)`.
 */
import { describe, expect, it } from 'vitest';
import { anatomies } from '@sigx/zero/anatomy';
import type { ManifestComponent, TokensInput } from '@sigx/zero-kit';
import { compileTokensCss, validateDesignSystem } from '@sigx/zero-kit';
import { tokens as basicTokens } from '@sigx/zero-basic';

const manifest = { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] };

/** The `:root` block — everything before the first theme block. */
const root = (css: string): string => css.slice(0, css.indexOf('[data-theme'));
const softDecl = (css: string, role = 'primary'): string | undefined =>
    css.match(new RegExp(`--color-${role}-soft: [^;]*;`))?.[0];

const clone = (): TokensInput => structuredClone(basicTokens) as unknown as TokensInput;
const themes = (t: TokensInput) => t.themes as Record<string, { softMix?: number; colors: Record<string, string> }>;

describe(':root -soft under light-dark()', () => {
    it('carries each theme its own softMix (stock zero-basic: 10% light, 14% dark)', () => {
        expect(softDecl(root(compileTokensCss(basicTokens as unknown as TokensInput)))).toBe(
            '--color-primary-soft: light-dark('
            + 'color-mix(in oklab, var(--color-primary) 10%, var(--color-base-100)), '
            + 'color-mix(in oklab, var(--color-primary) 14%, var(--color-base-100)));',
        );
    });

    it('keeps a light-only explicit value out of the dark scheme', () => {
        const t = clone();
        themes(t).basic.colors['primary-soft'] = 'oklch(95% 0.02 205)';
        expect(softDecl(root(compileTokensCss(t)))).toBe(
            '--color-primary-soft: light-dark(oklch(95% 0.02 205), '
            + 'color-mix(in oklab, var(--color-primary) 14%, var(--color-base-100)));',
        );
    });

    it('honours a dark-only explicit value', () => {
        const t = clone();
        themes(t)['basic-dark'].colors['primary-soft'] = 'oklch(30% 0.05 205)';
        expect(softDecl(root(compileTokensCss(t)))).toBe(
            '--color-primary-soft: light-dark('
            + 'color-mix(in oklab, var(--color-primary) 10%, var(--color-base-100)), oklch(30% 0.05 205));',
        );
    });

    it('writes one value when both sides agree', () => {
        const t = clone();
        themes(t)['basic-dark'].softMix = themes(t).basic.softMix;
        expect(softDecl(root(compileTokensCss(t)))).toBe(
            '--color-primary-soft: color-mix(in oklab, var(--color-primary) 10%, var(--color-base-100));',
        );
    });
});

describe('softMix percentage', () => {
    it('is emitted unrounded, as the baker evaluates it', () => {
        const t = clone();
        themes(t).basic.softMix = 0.125;
        const css = compileTokensCss(t);
        expect(css).toContain('var(--color-primary) 12.5%');
        expect(css).not.toContain('var(--color-primary) 13%');
    });

    it('carries no float noise', () => {
        const t = clone();
        themes(t).basic.softMix = 0.145; // 0.145 * 100 === 14.499999999999998
        const css = compileTokensCss(t);
        expect(css).toContain('var(--color-primary) 14.5%,');
        expect(css).not.toContain('14.49999');
    });
});

describe('softMix range', () => {
    const softErrors = (value: number) => {
        const t = clone();
        themes(t).basic.softMix = value;
        return validateDesignSystem({ name: 'probe', tokens: t, recipes: [] }, manifest)
            .errors.filter((e) => /softMix/.test(e.message));
    };

    it.each([16, -0.1, 1.01, Number.NaN, Number.POSITIVE_INFINITY])('rejects %s', (value) => {
        const errs = softErrors(value);
        expect(errs).toHaveLength(1);
        expect(errs[0].where).toBe('themes.basic');
    });

    it.each([0, 0.125, 1])('accepts %s', (value) => {
        expect(softErrors(value)).toEqual([]);
    });
});
