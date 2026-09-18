/**
 * `fitRecipesToVocabulary` — the scaffold's baseline adapter.
 *
 * Two claims, both load-bearing for `@sigx/create-zero-ds`:
 *
 * 1. **Identity for the recommended shape.** Every in-repo skin round-trips
 *    deep-equal through the fit against its own tokens, so a design system
 *    that keeps its declared vocabulary pays nothing for the call the
 *    generated `recipes.ts` makes at module scope.
 * 2. **zero-basic's recipes fit riso's tokens.** The one brief in the pack
 *    that declines the colour and size axes and fuses `variant` is the
 *    shape the fit exists for: basic's 50 recipes plus riso's Button must
 *    validate with zero errors under riso's tokens.
 *
 * Shown red first: with the size rule stubbed out, the riso case reports
 * "declares no size axis" errors; with the rewrite stubbed out, "references
 * `--color-primary`, which this design system never declares".
 */
import { describe, expect, it } from 'vitest';
import { anatomies } from '@sigx/zero/anatomy';
import { explainFit, fitRecipesToVocabulary, validateDesignSystem } from '@sigx/zero-kit';
import type { DesignSystemInput, ManifestComponent, RecipeInput, TokensInput } from '@sigx/zero-kit';
import { designSystem as basicDS } from '@sigx/zero-basic';
import { designSystem as daisyDS } from '@sigx/zero-daisyui';
import { designSystem as materialDS } from '@sigx/zero-material';
import { designSystem as brutalistDS } from '@sigx/zero-brutalist';
import { designSystem as heroDS } from '@sigx/zero-heroui';
import { designSystem as carbonDS } from '@sigx/zero-carbon';
import * as riso from '../skills/design-system/briefs/riso.js';

const manifest = {
    components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[],
};

const SYSTEMS = [
    ['zero-basic', basicDS],
    ['zero-daisyui', daisyDS],
    ['zero-material', materialDS],
    ['zero-brutalist', brutalistDS],
    ['zero-heroui', heroDS],
    ['zero-carbon', carbonDS],
] as const;

describe('fitRecipesToVocabulary is the identity for a design system that already fits', () => {
    it.each(SYSTEMS)('%s round-trips deep-equal', (_name, ds) => {
        const fitted = fitRecipesToVocabulary(ds.recipes, ds.tokens as TokensInput);
        expect(fitted).toEqual(ds.recipes);
        expect(explainFit(ds.recipes, ds.tokens as TokensInput).identity).toBe(true);
    });

    it('returns new objects — the input is never mutated or aliased', () => {
        const before = JSON.stringify(basicDS.recipes);
        const fitted = fitRecipesToVocabulary(basicDS.recipes, basicDS.tokens);
        expect(JSON.stringify(basicDS.recipes)).toBe(before);
        expect(fitted[0]).not.toBe(basicDS.recipes[0]);
    });
});

describe("zero-basic's recipes fit riso's tokens (roles: {}, sizes: [], fused variant)", () => {
    const baseline = fitRecipesToVocabulary(basicDS.recipes, riso.tokens).filter((r) => r.component !== 'button');
    const ds = { name: 'riso', tokens: riso.tokens, recipes: [...baseline, riso.button] } as DesignSystemInput;
    const result = validateDesignSystem(ds, manifest);

    it('validates with no errors', () => {
        expect(result.errors.map((e) => `${e.where}: ${e.message}`)).toEqual([]);
    });

    it('leaves no role reference the design system never declares', () => {
        const text = JSON.stringify(baseline);
        expect(text).not.toMatch(/var\(--color-(?!base-)/);
    });

    it('drops every color and size block, and the defaults that named them', () => {
        for (const recipe of baseline) {
            expect(recipe.variants?.color, recipe.component).toBeUndefined();
            expect(recipe.variants?.size, recipe.component).toBeUndefined();
            expect(recipe.defaultVariants?.color, recipe.component).toBeUndefined();
            expect(recipe.defaultVariants?.size, recipe.component).toBeUndefined();
        }
    });

    it('reports what it changed, and the counts are pinned', () => {
        // Pinned to the measured basic × riso fit. A change here means either
        // basic's recipes moved (fine — update the pin) or a rule changed
        // what it keeps (read the diff before updating).
        const report = explainFit(basicDS.recipes, riso.tokens);
        expect(report.identity).toBe(false);
        expect(report).toMatchInlineSnapshot(`
          {
            "collapsedCategoryRefs": 11,
            "droppedAxisValues": 0,
            "droppedColorValues": 408,
            "droppedCompounds": 0,
            "droppedDefaults": 9,
            "droppedModifiers": 2,
            "droppedSizeValues": 254,
            "droppedVariantBlocks": 3,
            "droppedVariantValues": 5,
            "identity": false,
            "rewrittenRoleRefs": 150,
          }
        `);
    });
});

describe('each rule in isolation', () => {
    const recipe: RecipeInput = {
        component: 'button',
        tokens: { '--btn-accent': 'var(--color-primary)', '--btn-ink': 'var(--color-primary-content, white)' },
        parts: {
            root: {
                base: { color: 'var(--color-base-content)', background: 'var(--color-secondary-soft)' },
                states: { 'focus-visible': { outline: '2px solid var(--color-primary)' } },
                at: { sm: { base: { borderColor: 'var(--color-error)' } } },
            },
        },
        variants: {
            color: { primary: { root: { base: {} } }, brand: { root: { base: {} } } },
            size: { sm: { root: { base: {} } }, md: { root: { base: {} } }, huge: { root: { base: {} } } },
            variant: { solid: { root: { base: {} } }, dash: { root: { base: {} } } },
            density: { compact: { root: { base: {} } } },
        },
        modifiers: { wide: { root: { base: {} } }, glass: { root: { base: {} } } },
        compoundVariants: [
            { match: { color: 'primary', variant: 'solid' }, parts: { root: { base: {} } } },
            { match: { color: 'brand' }, parts: { root: { base: {} } } },
            { match: { wide: true }, parts: { root: { base: {} } } },
            { match: { glass: true }, parts: { root: { base: {} } } },
        ],
        defaultVariants: { color: 'primary', size: 'huge', variant: 'solid' },
        keyframes: { pulse: 'from { color: var(--color-warning) } to { color: var(--color-warning-content) }' },
        css: '.x { border-color: var(--color-info-soft); }',
        targets: {
            lynx: { variants: { color: { brand: { root: { base: {} } } } }, modifiers: { glass: { root: { base: {} } } } },
        },
    };
    const light = { colorScheme: 'light' as const, colors: {} };

    it('keeps everything when nothing is declared beyond the recommended roles', () => {
        const [out] = fitRecipesToVocabulary([recipe], { themes: { light }, defaultLight: 'light' } as TokensInput);
        // Undeclared size/variant/axes/modifiers are unchecked by the validator,
        // so the fit keeps them; only `brand` (not a recommended role) goes.
        expect(Object.keys(out!.variants!.color!)).toEqual(['primary']);
        expect(Object.keys(out!.variants!.size!)).toEqual(['sm', 'md', 'huge']);
        expect(Object.keys(out!.variants!.variant!)).toEqual(['solid', 'dash']);
        expect(Object.keys(out!.variants!.density!)).toEqual(['compact']);
        expect(Object.keys(out!.modifiers!)).toEqual(['wide', 'glass']);
        expect(out!.compoundVariants).toHaveLength(3);
        expect(out!.defaultVariants).toEqual({ color: 'primary', size: 'huge', variant: 'solid' });
        expect(out!.targets!.lynx!.variants).toBeUndefined();
    });

    it('filters sizes, variants, axes and modifiers once each is declared', () => {
        const tokens = {
            sizes: ['sm', 'md'], variants: ['solid'], axes: { density: ['comfortable'] }, modifiers: ['wide'],
            themes: { light }, defaultLight: 'light',
        } as unknown as TokensInput;
        const [out] = fitRecipesToVocabulary([recipe], tokens);
        expect(Object.keys(out!.variants!.size!)).toEqual(['sm', 'md']);
        expect(Object.keys(out!.variants!.variant!)).toEqual(['solid']);
        expect(out!.variants!.density).toBeUndefined();
        expect(Object.keys(out!.modifiers!)).toEqual(['wide']);
        expect(out!.compoundVariants!.map((c) => c.match)).toEqual([{ color: 'primary', variant: 'solid' }, { wide: true }]);
        // `huge` is off the ramp, so its default goes with it.
        expect(out!.defaultVariants).toEqual({ color: 'primary', variant: 'solid' });
        expect(out!.targets!.lynx!.modifiers).toBeUndefined();
        const report = explainFit([recipe], tokens);
        expect(report).toMatchObject({
            droppedColorValues: 2, droppedSizeValues: 1, droppedVariantValues: 1, droppedAxisValues: 1,
            droppedModifiers: 2, droppedDefaults: 1, droppedCompounds: 2, identity: false,
        });
    });

    it('drops a variant block whole when the fitted values no longer cover the scope vocabulary (#422)', () => {
        // basic's badge wires solid|soft|outline. Under a fused vocabulary
        // that shares only `outline`, keeping `outline` alone would be the
        // ramp-with-a-hole the audit refuses, and claiming the rest with empty
        // entries trips its ambiguous-base rule — so the block goes, and the
        // compound that matched it goes with it.
        const badge = {
            component: 'badge',
            parts: { root: { base: {} } },
            variants: { variant: { solid: { root: { base: { color: 'red' } } }, outline: { root: { base: { color: 'blue' } } } } },
            compoundVariants: [{ match: { variant: 'outline' }, parts: { root: { base: { padding: '0' } } } }],
            defaultVariants: { variant: 'solid' },
        } as unknown as RecipeInput;
        const fused = { variants: ['key', 'spot', 'outline'], themes: { light }, defaultLight: 'light' } as unknown as TokensInput;
        const [out] = fitRecipesToVocabulary([badge], fused);
        expect(out!.variants).toBeUndefined();
        expect(out!.compoundVariants).toBeUndefined();
        expect(out!.defaultVariants).toBeUndefined();
        expect(explainFit([badge], fused)).toMatchObject({ droppedVariantValues: 1, droppedVariantBlocks: 1, droppedCompounds: 1, droppedDefaults: 1 });
        // A scope narrowing (`tokens.scopes`) is the vocabulary that counts:
        // basic's own badge covers its narrowed set exactly, so it survives.
        const narrowed = {
            variants: ['key', 'spot', 'outline', 'solid'], scopes: { badge: { variants: ['solid', 'outline'] } },
            themes: { light }, defaultLight: 'light',
        } as unknown as TokensInput;
        const [kept] = fitRecipesToVocabulary([badge], narrowed);
        expect(Object.keys(kept!.variants!.variant!)).toEqual(['solid', 'outline']);
        expect(explainFit([badge], narrowed).identity).toBe(true);
    });

    it('rewrites undeclared role references to the base surfaces, in every string position', () => {
        const tokens = { roles: {}, themes: { light }, defaultLight: 'light' } as unknown as TokensInput;
        const [out] = fitRecipesToVocabulary([recipe], tokens);
        expect(out!.tokens).toEqual({
            '--btn-accent': 'var(--color-base-content)',
            '--btn-ink': 'var(--color-base-100, white)',
        });
        expect(out!.parts.root!.base).toEqual({ color: 'var(--color-base-content)', background: 'var(--color-base-200)' });
        expect(out!.parts.root!.states!['focus-visible']!.outline).toBe('2px solid var(--color-base-content)');
        expect(out!.parts.root!.at!.sm!.base!.borderColor).toBe('var(--color-base-content)');
        expect(out!.keyframes!.pulse).toBe('from { color: var(--color-base-content) } to { color: var(--color-base-100) }');
        expect(out!.css).toBe('.x { border-color: var(--color-base-200); }');
        expect(out!.variants!.color).toBeUndefined();
        expect(explainFit([recipe], tokens).rewrittenRoleRefs).toBe(8);
    });

    it('collapses an undeclared category step to the resting step, and leaves component tokens alone', () => {
        const tokens = { themes: { light }, defaultLight: 'light' } as unknown as TokensInput;
        const withSteps: RecipeInput = {
            component: 'button',
            tokens: { '--btn-pad': 'var(--space-3xl)' },
            parts: {
                root: {
                    base: {
                        transition: 'opacity var(--duration-fast) var(--ease-exit)',
                        padding: 'var(--btn-pad) var(--space-md)',
                        boxShadow: 'var(--shadow-hover, none)',
                        color: 'var(--app-ink, currentColor)',
                    },
                },
            },
        };
        const [out] = fitRecipesToVocabulary([withSteps], tokens);
        expect(out!.tokens).toEqual({ '--btn-pad': 'var(--space-md)' });
        expect(out!.parts.root!.base).toEqual({
            transition: 'opacity var(--duration-fast) var(--ease-standard)',
            padding: 'var(--btn-pad) var(--space-md)',
            boxShadow: 'var(--shadow-md, none)',
            color: 'var(--app-ink, currentColor)',
        });
        expect(explainFit([withSteps], tokens).collapsedCategoryRefs).toBe(3);
        // Declaring the step keeps it.
        const declared = { ...tokens, system: { motion: { easings: { exit: 'ease-in' } } } } as unknown as TokensInput;
        expect(fitRecipesToVocabulary([withSteps], declared)[0]!.parts.root!.base!.transition)
            .toBe('opacity var(--duration-fast) var(--ease-exit)');
    });

    it('treats a role opting out of -content / -soft as not declaring those tokens', () => {
        const tokens = {
            roles: { primary: { content: false }, secondary: { soft: false } },
            themes: { light }, defaultLight: 'light',
        } as unknown as TokensInput;
        const [out] = fitRecipesToVocabulary([recipe], tokens);
        expect(out!.tokens!['--btn-accent']).toBe('var(--color-primary)');
        expect(out!.tokens!['--btn-ink']).toBe('var(--color-base-100, white)');
        expect(out!.parts.root!.base!.background).toBe('var(--color-base-200)');
    });
});
