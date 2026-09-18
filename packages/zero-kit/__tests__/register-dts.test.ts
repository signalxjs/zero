/**
 * The register artifact (docs/architecture.md, "The register artifact"):
 * per-design-system goldens plus the
 * shape rules that make the generated types safe.
 *
 * Material's golden is written into `packages/zero/type-tests/generated/`,
 * where `pnpm test:types` compiles it against zero's REAL source together
 * with a probe asserting the narrowing — so the emitted file is not just
 * snapshot-compared, it is type-checked end to end. (The probe re-states the
 * file's scope-validity assertion in a `.ts`, which `skipLibCheck` cannot
 * skip.) The other three goldens live under `__goldens__/register/` — NOT
 * under `__tests__`, whose files the root tsconfig compiles: a register
 * `.d.ts` inside that program would augment `ZeroVocabulary` repo-wide and
 * narrow every component's props (the leak the button axes tests canary).
 */
import { describe, it, expect } from 'vitest';
import { compileDesignSystem, compileRegisterDts, compileRegisterJs, resolveEcosystem } from '@sigx/zero-kit';
import type { DesignSystemInput, ManifestComponent, RecipeInput } from '@sigx/zero-kit';
import { anatomies } from '@sigx/zero/anatomy';
import { designSystem as basicDS } from '@sigx/zero-basic';
import { fragment as extFragment, recipes as extRecipes } from '@sigx/zero-ext-example/fragment';
import { designSystem as daisyDS } from '@sigx/zero-daisyui';
import { designSystem as materialDS } from '@sigx/zero-material';
import { designSystem as brutalistDS } from '@sigx/zero-brutalist';
import { designSystem as herouiDS } from '@sigx/zero-heroui';
import { designSystem as carbonDS } from '@sigx/zero-carbon';

const manifest = {
    components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[],
};

describe('register.d.ts goldens', () => {
    it.each<[string, DesignSystemInput, string]>([
        ['basic', basicDS as DesignSystemInput, '../../zero/type-tests/registered-components/basic.register.d.ts'],
        ['daisyui', daisyDS as DesignSystemInput, '../__goldens__/register/daisyui.register.d.ts'],
        ['material', materialDS as DesignSystemInput, '../../zero/type-tests/generated/material.register.d.ts'],
        ['brutalist', brutalistDS as DesignSystemInput, '../__goldens__/register/brutalist.register.d.ts'],
        ['heroui', herouiDS as DesignSystemInput, '../__goldens__/register/heroui.register.d.ts'],
        ['carbon', carbonDS as DesignSystemInput, '../__goldens__/register/carbon.register.d.ts'],
    ])('%s matches its golden', async (_name, ds, golden) => {
        const compiled = compileDesignSystem(ds, manifest);
        await expect(compileRegisterDts(compiled)).toMatchFileSnapshot(golden);
    });

    it('basic + the adopted ecosystem pack matches its golden (the Exclude-form compile gate)', async () => {
        // Driven through `resolveEcosystem`, the same path zero-basic's build
        // takes — not a hand-rolled imitation of it. The composition used to
        // be spelled out here, which meant the golden could stay green while
        // the shipped build emitted something else; that is the failure this
        // file's own docblock warns about.
        //
        // The pack is supplied rather than discovered: discovery reads
        // node_modules, and the point of this test is the composition, not
        // the walk. Like material's golden, the output lives in an isolated
        // type-tests project (`ecosystem/`) where `pnpm test:types` compiles
        // it against zero's real source — proving a register module carrying
        // an ecosystem scope typechecks with the scope excluded by name.
        const resolved = await resolveEcosystem({
            manifest,
            designSystem: basicDS as DesignSystemInput,
            ecosystem: {
                packs: [{
                    package: '@sigx/zero-ext-example',
                    source: '@sigx/zero-ext-example/fragment',
                    fragment: extFragment,
                    recipes: extRecipes,
                }],
            },
            defaultCwd: process.cwd(),
            logger: { log() {}, warn() {}, error() {} },
        });
        const compiled = compileDesignSystem(resolved.designSystem, resolved.manifest);
        await expect(compileRegisterDts(compiled))
            .toMatchFileSnapshot('../../zero/type-tests/ecosystem/basic-ext.register.d.ts');
    });
});

describe('the generated shapes', () => {
    const colors = {
        'base-100': 'oklch(100% 0 0)', 'base-200': 'oklch(96% 0 0)', 'base-300': 'oklch(92% 0 0)',
        'base-content': 'oklch(20% 0 0)',
        primary: 'oklch(50% 0.2 260)', 'primary-content': 'oklch(98% 0.01 260)',
    };
    const dsWith = (...recipes: RecipeInput[]): DesignSystemInput => ({
        name: 'probe',
        recipes,
        tokens: {
            roles: { primary: {} },
            defaultLight: 'l',
            themes: { l: { colorScheme: 'light', colors } },
        } as DesignSystemInput['tokens'],
    });
    const compile = (...recipes: RecipeInput[]) => compileDesignSystem(dsWith(...recipes), manifest);

    it('harvests variants keys and unions compoundVariants matches', () => {
        const compiled = compile({
            component: 'button',
            parts: { root: { base: { padding: '0' } } },
            variants: { color: { primary: { root: { base: { color: 'var(--color-primary)' } } } } },
            compoundVariants: [{
                match: { color: 'primary', size: 'lg' },
                parts: { root: { base: { padding: '1rem' } } },
            }],
        });
        expect(compiled.components['button']).toEqual({
            color: ['primary'],
            size: ['lg'],          // reaches the type through the compound match alone
            variant: [],
            axes: {},
            mods: [],
        });
    });

    it('blames an unwired axis on the recipe, not on the declaration', () => {
        // `tokens.variants` omitted means "declared nothing, check nothing" —
        // NOT "this design system has no variant axis". `compileDesignSystem`
        // normalises the omission to `[]`, so a naive emptiness check would
        // tell an author the axis does not exist when they simply never
        // declared the vocabulary.
        const dts = compileRegisterDts(compile({
            component: 'button',
            parts: { root: { base: { padding: '0' } } },
            variants: { color: { primary: { root: { base: { color: 'var(--color-primary)' } } } } },
        }));
        expect(dts).toContain('no probe recipe wires it');
        expect(dts).not.toContain('declares no variant axis at all');
    });

    it('says "declares no variant axis at all" under variants: []', () => {
        // The other half of the distinction above (#200/#295): an EMPTY
        // declaration is the claim, so the reason changes and the advice
        // with it — there is no variant to go and wire.
        const ds = dsWith({
            component: 'button',
            parts: { root: { base: { padding: '0' } } },
            variants: { color: { primary: { root: { base: { color: 'var(--color-primary)' } } } } },
        });
        ds.tokens = { ...ds.tokens, variants: [] };
        const dts = compileRegisterDts(compileDesignSystem(ds, manifest));
        expect(dts).toContain('Accepts `variant` at runtime, but probe declares no variant axis at all');
        expect(dts).toContain('variant: never;');
        expect(dts).not.toContain('Accepts `variant` at runtime, but no probe recipe wires it');
        // `size` is merely unwired here, and keeps the unwired reason.
        expect(dts).toContain('Accepts `size` at runtime, but no probe recipe wires it');
    });

    it('emits never for unwired axes and Record<string, never> for empty axes', () => {
        const dts = compileRegisterDts(compile({
            component: 'button',
            parts: { root: { base: { padding: '0' } } },
            variants: { color: { primary: { root: { base: { color: 'var(--color-primary)' } } } } },
        }));
        expect(dts).toContain("color: 'primary';");
        expect(dts).toContain('size: never;');
        expect(dts).toContain('variant: never;');
        expect(dts).toContain('axes: Record<string, never>;');
        expect(dts).toContain('mods: Record<string, never>;');
        // `{}` would be the top object type — the failure class this exists to remove.
        expect(dts).not.toMatch(/axes: \{\};/);
        expect(dts).not.toMatch(/mods: \{\};/);
    });

    it('harvests modifiers from both the modifiers block and compound matches', () => {
        const compiled = compile({
            component: 'button',
            parts: { root: { base: { padding: '0' } } },
            variants: { color: { primary: { root: { base: { color: 'var(--color-primary)' } } } } },
            modifiers: { block: { root: { base: { width: '100%' } } } },
            compoundVariants: [{
                match: { color: 'primary', 'icon-only': true },
                parts: { root: { base: { padding: '0.5rem' } } },
            }],
        });
        // `true` is a modifier, not an axis value: harvesting it as one would
        // offer the literal string "true" on a `data-icon-only` axis.
        expect(compiled.components['button']!.mods.sort()).toEqual(['block', 'icon-only']);
        expect(compiled.components['button']!.axes).toEqual({});
    });

    it('types modifiers as booleans, since a modifier has no vocabulary', () => {
        const dts = compileRegisterDts(compile({
            component: 'button',
            parts: { root: { base: { padding: '0' } } },
            modifiers: { block: { root: { base: { width: '100%' } } } },
        }));
        expect(dts).toContain("mods: { 'block': boolean };");
        expect(dts).toContain('button — mods.block wired.');
    });

    it('emits custom axes as a per-axis map, keys quoted for kebab-case names', () => {
        const dts = compileRegisterDts(compile({
            component: 'tabs',
            parts: { tab: { states: { 'focus-visible': { outline: '1px solid' } } } },
            variants: {
                density: { compact: { tab: { base: { padding: '0' } } }, comfortable: { tab: { base: { padding: '1rem' } } } },
                // A hyphenated axis name is valid vocabulary but not a valid
                // bare TS identifier — unquoted it is a syntax error.
                'tone-map': { high: { tab: { base: { filter: 'contrast(1.2)' } } } },
            },
        }));
        expect(dts).toContain("axes: { 'density': 'compact' | 'comfortable'; 'tone-map': 'high' };");
    });

    it('records defaultVariants in the manifest harvest without widening any union', () => {
        const compiled = compile({
            component: 'button',
            parts: { root: { base: { padding: '0' } } },
            variants: { color: { primary: { root: { base: { color: 'var(--color-primary)' } } } } },
            defaultVariants: { color: 'primary' },
        });
        expect(compiled.components['button']!.defaults).toEqual({ color: 'primary' });
        expect(compiled.components['button']!.color).toEqual(['primary']);
    });

    it('every emitted scope is a real anatomy scope, and the file carries the compile-time assertion', () => {
        const compiled = compileDesignSystem(basicDS as DesignSystemInput, manifest);
        const registryScopes = new Set(Object.keys(anatomies));
        for (const scope of Object.keys(compiled.components)) {
            expect(registryScopes.has(scope), scope).toBe(true);
        }
        const dts = compileRegisterDts(compiled);
        expect(dts).toContain("extends import('@sigx/zero').ZeroScope");
    });

    it('an empty breakpoints declaration emits never, not an empty union', () => {
        const dts = compileRegisterDts(compile({
            component: 'button',
            parts: { root: { base: { padding: '0' } } },
        }));
        expect(dts).toContain('breakpoint: never;');
    });

    it('the register.js stub is exactly an empty module', () => {
        const js = compileRegisterJs(compile({
            component: 'button',
            parts: { root: { base: { padding: '0' } } },
        }));
        expect(js).toContain('export {};');
        expect(js).not.toMatch(/import|function|const |let /);
    });

    it('the manifest carries the axes map keyed by scope', () => {
        const compiled = compileDesignSystem(daisyDS as DesignSystemInput, manifest);
        expect(Object.keys(compiled.components)).toEqual(Object.keys(compiled.componentCss));
        expect(compiled.components['button']!.variant).toEqual(['solid', 'outline', 'soft', 'ghost', 'dash', 'link']);
    });
});
