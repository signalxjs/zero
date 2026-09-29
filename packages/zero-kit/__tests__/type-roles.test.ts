/**
 * Composite type roles — `typography.roles` (#423).
 *
 * A role folds into the ramps it spans, so it emits exactly the custom
 * properties the parallel-keys spelling did; what it adds is the unit: the
 * validator checks a role whole, the manifest records it, and a recipe block
 * that reads two roles' tokens is warned about.
 */
import { describe, it, expect } from 'vitest';
import { compileDesignSystem, compileTokensCss, defineTokens, validateDesignSystem, withTypeRoles } from '@sigx/zero-kit';
import type { DesignSystemInput, ManifestComponent, RecipeInput } from '@sigx/zero-kit';
import { anatomies } from '@sigx/zero/anatomy';
import { designSystem as materialDS } from '@sigx/zero-material';
import { tokenVocabulary } from '../src/resolve/vocabulary.js';

const manifest = {
    components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[],
};
const colors = {
    'base-100': 'oklch(100% 0 0)', 'base-200': 'oklch(96% 0 0)',
    'base-300': 'oklch(92% 0 0)', 'base-content': 'oklch(20% 0 0)',
    primary: 'oklch(50% 0.2 260)', 'primary-content': 'oklch(98% 0.01 260)',
};

const titleMedium = { size: '1rem', leading: 1.5, weight: 500, tracking: '0.01rem', font: 'var(--font-sans)' };
const bodySmall = { size: '0.75rem', leading: 1.33333, weight: 400, tracking: '0.025rem' };

const tokens = (typography: Record<string, unknown>, theme: Record<string, unknown> = {}) => defineTokens({
    roles: { primary: {} },
    system: { typography: { fonts: { sans: 'Roboto, sans-serif' }, ...typography } } as never,
    defaultLight: 'l',
    themes: {
        l: { colorScheme: 'light', colors },
        big: { colorScheme: 'light', colors, ...theme } as never,
    },
});

const ds = (typography: Record<string, unknown>, recipes: RecipeInput[] = [], theme: Record<string, unknown> = {}): DesignSystemInput => ({
    name: 'probe',
    recipes,
    tokens: tokens(typography, theme) as DesignSystemInput['tokens'],
});

const messages = (input: DesignSystemInput, level: 'errors' | 'warnings' = 'errors') =>
    validateDesignSystem(input, manifest)[level].map((e) => e.message);

describe('typography.roles emission', () => {
    it('emits one property per field, in the ramp each belongs to', () => {
        const css = compileTokensCss(tokens({ roles: { 'title-medium': titleMedium } }));
        expect(css).toContain('--text-title-medium: 1rem;');
        expect(css).toContain('--leading-title-medium: 1.5;');
        expect(css).toContain('--weight-title-medium: 500;');
        expect(css).toContain('--tracking-title-medium: 0.01rem;');
        expect(css).toContain('--font-title-medium: var(--font-sans);');
        // A role emits its text key's fixed alias like any ramp key.
        expect(css).toContain('--text-fixed-title-medium: var(--text-title-medium);');
    });

    it('emits no --font-<role> for a role without a family', () => {
        const css = compileTokensCss(tokens({ roles: { 'body-small': bodySmall } }));
        expect(css).toContain('--text-body-small: 0.75rem;');
        expect(css).not.toContain('--font-body-small');
    });

    it('is the same CSS as the parallel-keys spelling', () => {
        const asRole = compileTokensCss(tokens({ roles: { 'body-small': bodySmall } }));
        const asRamps = compileTokensCss(tokens({
            sizes: { 'body-small': '0.75rem' },
            leading: { 'body-small': 1.33333 },
            weights: { 'body-small': 400 },
            tracking: { 'body-small': '0.025rem' },
        }));
        expect(asRole).toBe(asRamps);
    });

    it('lets a theme restate one field of a role', () => {
        const css = compileTokensCss(tokens(
            { roles: { 'title-medium': titleMedium } },
            { system: { typography: { roles: { 'title-medium': { size: '1.125rem' } } } } },
        ));
        const big = css.match(/\[data-theme="big"\] \{([^}]*)\}/)![1]!;
        expect(big).toContain('--text-title-medium: 1.125rem;');
        expect(big).not.toContain('--weight-title-medium');
    });

    it('folds into the ramps without replacing a tier\'s own keys', () => {
        const folded = withTypeRoles({ typography: { sizes: { md: '1rem' }, roles: { 'body-small': bodySmall } } });
        expect(folded.typography.sizes).toEqual({ 'body-small': '0.75rem', md: '1rem' });
        const plain = { typography: { sizes: { md: '1rem' } } };
        expect(withTypeRoles(plain)).toBe(plain);
    });
});

describe('typography.roles validation', () => {
    it('accepts a complete role', () => {
        expect(messages(ds({ roles: { 'title-medium': titleMedium } }))).toEqual([]);
    });

    it('requires size, leading, weight and tracking', () => {
        const { tracking: _t, ...partial } = bodySmall;
        expect(messages(ds({ roles: { 'body-small': partial } })))
            .toContainEqual(expect.stringContaining('role "body-small" is missing "tracking"'));
    });

    it('rejects an unknown field', () => {
        expect(messages(ds({ roles: { 'body-small': { ...bodySmall, lineHeight: 1.3 } } })))
            .toContainEqual(expect.stringContaining('unknown field "lineHeight"'));
    });

    it('holds each field to its category grammar — leading stays unitless', () => {
        expect(messages(ds({ roles: { 'body-small': { ...bodySmall, leading: '16px' } } })))
            .toContainEqual(expect.stringContaining('role "body-small".leading: "16px" is not a valid <number>'));
    });

    it('rejects a role and a ramp key that claim the same property', () => {
        expect(messages(ds({ roles: { 'body-small': bodySmall }, sizes: { 'body-small': '12px' } })))
            .toContainEqual(expect.stringContaining('both declare --text-body-small'));
    });

    it('rejects a name that is not a token key', () => {
        expect(messages(ds({ roles: { 'Body Small': bodySmall } })))
            .toContainEqual(expect.stringContaining('role "Body Small" is not a kebab-case identifier'));
    });

    it('accepts a theme restating a declared role, and refuses one naming an undeclared role', () => {
        const typography = { roles: { 'title-medium': titleMedium } };
        expect(messages(ds(typography, [], { system: { typography: { roles: { 'title-medium': { weight: 600 } } } } })))
            .toEqual([]);
        expect(messages(ds(typography, [], { system: { typography: { roles: { 'title-large': { weight: 600 } } } } })))
            .toContainEqual(expect.stringContaining('overrides type role "title-large"'));
    });

    it('accepts a theme restating a role-emitted key through its ramp', () => {
        expect(messages(ds(
            { roles: { 'title-medium': titleMedium } },
            [],
            { system: { typography: { sizes: { 'title-medium': '1.125rem' } } } },
        ))).toEqual([]);
    });

    it('resolves a role field\'s var() reference like a ramp value\'s', () => {
        expect(messages(ds({ roles: { 'body-small': { ...bodySmall, font: 'var(--font-snas)' } } })))
            .toContainEqual(expect.stringContaining('references "--font-snas"'));
    });
});

describe('a role is a unit', () => {
    const recipe = (base: Record<string, string>): RecipeInput => ({
        component: 'card',
        parts: { root: { base } },
    });
    const typography = { roles: { 'title-medium': titleMedium, 'body-small': bodySmall } };

    it('puts role tokens in the vocabulary recipes validate against', () => {
        const vocab = tokenVocabulary(tokens(typography));
        expect(vocab.names.has('--weight-title-medium')).toBe(true);
        expect(vocab.names.has('--text-fixed-body-small')).toBe(true);
        expect(vocab.typeRoles['body-small']).toEqual({
            size: '--text-body-small',
            leading: '--leading-body-small',
            weight: '--weight-body-small',
            tracking: '--tracking-body-small',
        });
    });

    it('warns when one declaration block reads two roles', () => {
        const warnings = messages(ds(typography, [recipe({
            fontSize: 'var(--text-title-medium)',
            lineHeight: 'var(--leading-body-small)',
        })]), 'warnings');
        expect(warnings).toContainEqual(expect.stringContaining(
            'mixes type roles (font-size from "title-medium", line-height from "body-small")',
        ));
    });

    it('stays quiet for one role, and for a role beside a plain ramp step', () => {
        const quiet = (base: Record<string, string>) =>
            messages(ds(typography, [recipe(base)]), 'warnings').filter((m) => m.includes('mixes type roles'));
        expect(quiet({
            fontSize: 'var(--text-title-medium)',
            lineHeight: 'var(--leading-title-medium)',
            fontWeight: 'var(--weight-title-medium)',
        })).toEqual([]);
        // `--text-md` belongs to no role: overriding one field of a role
        // with a ramp step is a deliberate choice, not a mis-keyed role.
        expect(quiet({
            fontSize: 'var(--text-md)',
            fontWeight: 'var(--weight-title-medium)',
        })).toEqual([]);
    });

    it('records each role in the compiled manifest', () => {
        const compiled = compileDesignSystem(ds(typography), manifest);
        expect(compiled.tokens.typeRoles).toEqual({
            'title-medium': {
                size: '--text-title-medium',
                leading: '--leading-title-medium',
                weight: '--weight-title-medium',
                tracking: '--tracking-title-medium',
                font: '--font-title-medium',
            },
            'body-small': {
                size: '--text-body-small',
                leading: '--leading-body-small',
                weight: '--weight-body-small',
                tracking: '--tracking-body-small',
            },
        });
        expect(compileDesignSystem(ds({}), manifest).tokens.typeRoles).toEqual({});
    });
});

describe('zero-material declares M3\'s type scale as roles', () => {
    const compiled = compileDesignSystem(materialDS, manifest);

    it('records all fifteen', () => {
        const names = Object.keys(compiled.tokens.typeRoles);
        expect(names).toHaveLength(15);
        for (const group of ['display', 'headline', 'title', 'body', 'label']) {
            for (const step of ['large', 'medium', 'small']) expect(names).toContain(`${group}-${step}`);
        }
    });

    it('keeps M3\'s weights on the roles rather than in a recipe helper', () => {
        expect(compiled.tokensCss).toContain('--weight-title-medium: 500;');
        expect(compiled.tokensCss).toContain('--weight-body-large: 400;');
        expect(compiled.tokensCss).toContain('--weight-label-small: 500;');
    });

    it('never mixes two roles in one block', () => {
        const mixed = validateDesignSystem(materialDS, manifest).warnings
            .filter((w) => w.message.includes('mixes type roles'));
        expect(mixed).toEqual([]);
    });
});
