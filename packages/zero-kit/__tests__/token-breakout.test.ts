/**
 * CSS break-out guards on the TOKEN surfaces (#183). The recipe compiler has
 * refused a brace, semicolon or newline in a declaration value since #318
 * (`assertDeclaration`); the token emitters wrote every non-colour value —
 * `system` / `systemDark` / `theme.system`, `theme.custom`, `theme.extra` —
 * and each `custom[].syntax` into the stylesheet verbatim, and the validator
 * flagged none of it. A value like `1rem; } body { display:none } :root {`
 * closed the token block and opened a rule the design system never declared.
 *
 * Also an explicit `-soft` colour value: the validator only parses the
 * REQUIRED colours (roles, `-content`, base surfaces), so a soft override
 * reached the web emitter unchecked too.
 *
 * Written red-first: every rejected input below validated and compiled clean
 * before the guards.
 */
import { describe, expect, it } from 'vitest';
import { anatomies } from '@sigx/zero/anatomy';
import type { DesignSystemInput, ManifestComponent, TokensInput } from '@sigx/zero-kit';
import { compileTokensCss, validateDesignSystem } from '@sigx/zero-kit';
import { compileLynxTokensCss, emptyReport } from '../src/targets/lynx/index.js';

const manifest = { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] };

const colors = {
    'base-100': 'oklch(100% 0 0)', 'base-200': 'oklch(96% 0 0)', 'base-300': 'oklch(92% 0 0)',
    'base-content': 'oklch(22% 0.01 285)',
    primary: 'oklch(45% 0.2 300)', 'primary-content': 'oklch(97% 0.01 300)',
};

const tokens = (mutate: (tokens: TokensInput) => void): TokensInput => {
    const t = {
        roles: { primary: {} },
        system: { radius: { md: '0.5rem' } },
        themes: { day: { colorScheme: 'light', colors: { ...colors } } },
        defaultLight: 'day',
    } as unknown as TokensInput;
    mutate(t);
    return t;
};

const ds = (t: TokensInput): DesignSystemInput => ({ name: 'probe', tokens: t, recipes: [] });
const errors = (t: TokensInput) =>
    validateDesignSystem(ds(t), manifest).errors.map((e) => `${e.where}: ${e.message}`).join('\n');

const day = (t: TokensInput) => t.themes['day']! as { custom?: Record<string, string>; extra?: Record<string, string>; system?: unknown; colors: Record<string, string> };

/** Each incident input from the issue, one per unguarded surface. */
const CASES: readonly (readonly [string, (t: TokensInput) => void, RegExp])[] = [
    ['a system value', (t) => {
        (t.system as { radius: Record<string, string> }).radius.md = '1rem; } body { display:none } :root {';
    }, /tokens\.system\.radius: "md":.*brace, semicolon or newline/],
    ['a systemDark value', (t) => {
        t.systemDark = { radius: { md: '2px; } body{x:y} :root{' } } as never;
    }, /tokens\.systemDark\.radius: "md":.*brace, semicolon or newline/],
    ['a theme.system value', (t) => {
        day(t).system = { radius: { md: '2px; } body{x:y} :root{' } };
    }, /themes\.day\.system\.radius: "md":.*brace, semicolon or newline/],
    ['a theme.custom value', (t) => {
        t.custom = { ink: {} };
        day(t).custom = { ink: 'red; } body { display:none } :root {' };
    }, /themes\.day\.custom: "ink":.*brace, semicolon or newline/],
    ['a theme.extra value', (t) => {
        day(t).extra = { evil: 'red; } body { display:none } :root {' };
    }, /themes\.day\.extra: "evil":.*brace, semicolon or newline/],
    ['an explicit -soft colour', (t) => {
        day(t).colors['primary-soft'] = 'red; } body { display:none } :root {';
    }, /themes\.day: color token "primary-soft":.*brace, semicolon or newline/],
];

describe('token values: validator', () => {
    it.each(CASES)('reports %s that would break out of its declaration', (_label, mutate, expected) => {
        expect(errors(tokens(mutate))).toMatch(expected);
    });

    it('reports a custom[].syntax that could close its quoted @property string', () => {
        const result = errors(tokens((t) => {
            t.custom = { ink: { syntax: "<color>'; } body{x:y} @property --z {syntax:'*" } };
            day(t).custom = { ink: 'red' };
        }));
        expect(result).toMatch(/tokens\.custom: custom token "ink" has syntax .* which cannot hold a quote, backslash, brace, semicolon or newline/);
    });

    it('still accepts the values a real design system writes', () => {
        const result = errors(tokens((t) => {
            (t.system as Record<string, unknown>)['shadow'] = { md: '0 1px 2px oklch(0% 0 0 / 0.2), 0 0 0 1px var(--color-primary)' };
            (t.system as Record<string, unknown>)['typography'] = { fonts: { sans: '"Inter Variable", system-ui, sans-serif' } };
            t.custom = { ink: { syntax: '<length> | <percentage>' }, list: { syntax: '<color>#' } };
            day(t).custom = { ink: '1px', list: 'red, blue' };
            day(t).extra = { noise: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27/%3E")' };
        }));
        expect(result).toBe('');
    });
});

/** `systemDark` only reaches a dark theme, and the probe has none: no emission, nothing to break out of. */
const EMITTED = CASES.filter(([label]) => label !== 'a systemDark value');

describe('token values: web emitter', () => {
    it.each(EMITTED)('refuses to emit %s that would break out of its declaration', (_label, mutate) => {
        expect(() => compileTokensCss(tokens(mutate))).toThrow(/cannot hold a brace, semicolon or newline/);
    });

    it('refuses to emit a custom[].syntax that could close its quoted @property string', () => {
        expect(() => compileTokensCss(tokens((t) => {
            t.custom = { ink: { syntax: "<color>'; } body{x:y} @property --z {syntax:'*" } };
            day(t).custom = { ink: 'red' };
        }))).toThrow(/syntax .* cannot hold a quote, backslash, brace, semicolon or newline/);
    });
});

describe('token values: lynx emitter', () => {
    // The colour case is excluded: lynx bakes every colour through culori,
    // which already throws on anything that is not a colour.
    it.each(EMITTED.filter(([label]) => !label.includes('colour')))(
        'refuses to emit %s that would break out of its declaration',
        (_label, mutate) => {
            expect(() => compileLynxTokensCss(tokens(mutate), emptyReport())).toThrow(/cannot hold a brace, semicolon or newline/);
        },
    );
});
