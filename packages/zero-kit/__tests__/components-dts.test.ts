/**
 * The components artifact (issue #179): goldens plus the shape rules that
 * make the generated module safe.
 *
 * Both `.d.ts` goldens are written into `packages/zero/type-tests/components/`,
 * where `pnpm test:types` compiles them against zero's REAL source together
 * with a probe asserting the issue's gate — narrowed vendor props, rejected
 * zero names, rejected foreign vendor names — so the emitted files are not
 * just snapshot-compared, they are type-checked end to end. Unlike register
 * goldens they contain no `declare module`, so they could not leak into the
 * root program anyway; they live there for the compile gate, not for
 * quarantine. The `.js` golden lives under `__goldens__/components/`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import type { AdaptSpec } from '@sigx/zero/adapt';
import {
    compileComponentsDts,
    compileComponentsJs,
    compileDesignSystem,
    componentExportName,
    mergeManifests,
} from '@sigx/zero-kit';
import type { CompiledDesignSystem, DesignSystemInput, ManifestComponent, RecipeInput } from '@sigx/zero-kit';
import { anatomies } from '@sigx/zero/anatomy';
import * as zero from '@sigx/zero';
import { designSystem as herouiDS } from '@sigx/zero-heroui';
import { designSystem as daisyDS } from '@sigx/zero-daisyui';
import { designSystem as basicDS } from '@sigx/zero-basic';
import { fragment as extFragment, recipes as extRecipes } from '@sigx/zero-ext-example/fragment';
import * as carbonFixture from '../skills/design-system/conformance/carbon.js';

const manifest = {
    components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[],
};

const colors = {
    'base-100': 'oklch(100% 0 0)', 'base-200': 'oklch(96% 0 0)', 'base-300': 'oklch(92% 0 0)',
    'base-content': 'oklch(20% 0 0)',
    primary: 'oklch(50% 0.2 260)', 'primary-content': 'oklch(98% 0.01 260)',
};

/**
 * A Carbon-shaped probe: one button recipe wiring the fixture's whole
 * vocabulary, carrying the fixture's api. This is the values-remap case no
 * shipped design system exercises yet (`danger--tertiary`), kept honest at
 * the type level by the compile gate in `type-tests/components/`.
 */
const carbonProbe = (): DesignSystemInput => {
    const variantParts = Object.fromEntries(
        carbonFixture.vocabulary.variants.map((v) => [v, { root: { base: { color: 'var(--color-primary)' } } }]),
    );
    // The fixture's vocabulary is the PACKAGE's whole declared set, but its
    // members are scope facts: icon-only/expressive are button's, zebra the
    // data table's. The probe mirrors the package's narrowing so its golden
    // cannot claim `useZebraStyles` on Button (#340 review catch).
    const buttonMods = Object.fromEntries(
        (['icon-only', 'expressive'] as const).map((m) => [m, { root: { base: { padding: '0.5rem' } } }]),
    );
    return {
        name: 'carbon',
        recipes: [{
            component: 'button',
            parts: { root: { base: { padding: '0' } } },
            variants: { variant: variantParts },
            modifiers: buttonMods,
        } as RecipeInput, {
            component: 'table',
            parts: { root: { base: { padding: '0' } } },
            modifiers: { zebra: { root: { base: { background: 'var(--color-base-200)' } } } },
        } as RecipeInput],
        tokens: {
            roles: { primary: {} },
            variants: [...carbonFixture.vocabulary.variants],
            modifiers: [...carbonFixture.vocabulary.modifiers],
            scopes: {
                button: { modifiers: ['icon-only', 'expressive'] },
                table: { modifiers: ['zebra'] },
            },
            defaultLight: 'l',
            themes: { l: { colorScheme: 'light', colors } },
        } as DesignSystemInput['tokens'],
        api: carbonFixture.api,
    };
};

describe('components goldens', () => {
    it('heroui components.d.ts matches its golden (compiled end to end by test:types)', async () => {
        const compiled = compileDesignSystem(herouiDS as DesignSystemInput, manifest);
        await expect(compileComponentsDts(compiled))
            .toMatchFileSnapshot('../../zero/type-tests/components/heroui.components.d.ts');
    });

    it('heroui components.js matches its golden', async () => {
        const compiled = compileDesignSystem(herouiDS as DesignSystemInput, manifest);
        await expect(compileComponentsJs(compiled))
            .toMatchFileSnapshot('../__goldens__/components/heroui.components.js');
    });

    // daisyui (#332): the first api-declaring design system with the
    // recommended colour axis — its golden is the one where `color`, an
    // identity `variant` and six identity-named modifier booleans coexist
    // on one surface.
    it('daisyui components.d.ts matches its golden (compiled end to end by test:types)', async () => {
        const compiled = compileDesignSystem(daisyDS as DesignSystemInput, manifest);
        await expect(compileComponentsDts(compiled))
            .toMatchFileSnapshot('../../zero/type-tests/components/daisyui.components.d.ts');
    });

    it('daisyui components.js matches its golden', async () => {
        const compiled = compileDesignSystem(daisyDS as DesignSystemInput, manifest);
        await expect(compileComponentsJs(compiled))
            .toMatchFileSnapshot('../__goldens__/components/daisyui.components.js');
    });

    it('the carbon probe matches its golden (the values-remap compile gate)', async () => {
        const compiled = compileDesignSystem(carbonProbe(), manifest);
        await expect(compileComponentsDts(compiled))
            .toMatchFileSnapshot('../../zero/type-tests/components/carbon.components.d.ts');
    });
});

describe('api mode composed with an ecosystem fragment (#316)', () => {
    // Never composed before this test existed: the one DS that adopts the
    // fragment (zero-basic) declares no api, and the api-declaring DSes
    // adopt no fragment — so the emitter's import of
    // componentExportName('ext-stepper') from the fragment's package went
    // unresolved-by-anything while the package exported `Stepper`.
    const composed = (): CompiledDesignSystem => {
        const ds = basicDS as DesignSystemInput;
        return compileDesignSystem(
            { ...ds, recipes: [...ds.recipes, ...extRecipes], api: {} },
            mergeManifests(manifest, extFragment),
        );
    };

    it('imports the ecosystem scope from its package under the convention name', () => {
        const dts = compileComponentsDts(composed());
        expect(dts).toContain(
            "import type { ExtStepper as ZExtStepper } from '@sigx/zero-ext-example';",
        );
    });

    it('every import the emitted module writes actually resolves to an export', async () => {
        const compiled = composed();
        for (const scope of Object.keys(compiled.components)) {
            const name = componentExportName(scope);
            // Zero's per-scope subpaths have no vitest alias — load their
            // source modules directly; the package specifier the emitter
            // writes for an ecosystem scope resolves as-is.
            const specifier = compiled.externalScopes?.[scope]
                ?? resolve(process.cwd(), `packages/zero/src/components/${scope}/index.ts`);
            const mod = await import(specifier) as Record<string, unknown>;
            expect(mod[name], `${scope}: expected export ${name}`).toBeTypeOf('function');
        }
    });
});

/**
 * A probe for the #318 api surface: a respelled `size`, a DS-wide `variant`
 * rename, and a per-scope `components.button` override that replaces it.
 * Button is the only wired scope, so the override is observable end to end.
 */
const scopedProbe = (): DesignSystemInput => {
    const ds = carbonProbe();
    (ds.recipes[0] as RecipeInput).variants!['size'] = {
        sm: { root: { base: { padding: '0.25rem' } } },
        md: { root: { base: { padding: '0.5rem' } } },
    };
    ds.api = {
        size: { values: { sm: 'small', md: 'medium' } },
        variant: { as: 'kind' },
        components: { button: { variant: { as: 'buttonKind' } } },
    };
    return ds;
};

describe('per-scope overrides and the color/size surface (#318)', () => {
    it('the scoped golden compiles end to end (test:types)', async () => {
        const compiled = compileDesignSystem(scopedProbe(), manifest);
        await expect(compileComponentsDts(compiled))
            .toMatchFileSnapshot('../../zero/type-tests/components/scoped.components.d.ts');
    });

    it('a size respell routes like any axis, and the override replaces the DS-wide rename', () => {
        const api = compileDesignSystem(scopedProbe(), manifest).componentApi!['button']!;
        expect(api.props['size']).toEqual({ axis: 'size', values: { medium: 'md', small: 'sm' } });
        expect(api.props['buttonKind']).toEqual(expect.objectContaining({ axis: 'variant' }));
        expect(api.props['kind']).toBeUndefined();
    });

    it('the d.ts carries the respelled size union and the overridden prop name', () => {
        const dts = compileComponentsDts(compileDesignSystem(scopedProbe(), manifest));
        expect(dts).toContain("'size'?: 'small' | 'medium';");
        expect(dts).toContain("'buttonKind'?:");
        expect(dts).not.toContain("'kind'?:");
    });

    it('the js routes through adapt with the per-scope spec', () => {
        const js = compileComponentsJs(compileDesignSystem(scopedProbe(), manifest));
        expect(js).toContain("'size': { axis: 'size', values: { 'medium': 'md', 'small': 'sm' } },");
        expect(js).toContain("'buttonKind': { axis: 'variant' },");
        expect(js).not.toContain("'kind':");
    });
});

describe('the generated shapes', () => {
    const compiled = () => compileDesignSystem(carbonProbe(), manifest);

    it('routes carry the inverted, identity-free values map', () => {
        const api = compiled().componentApi!['button']!;
        expect(api.props['kind']).toEqual({
            axis: 'variant',
            values: { 'danger--ghost': 'danger-ghost', 'danger--tertiary': 'danger-tertiary' },
        });
        expect(api.props['hasIconOnly']).toEqual({ modifier: 'icon-only' });
        // Structural parity with the runtime: the emitted route data IS an
        // AdaptSpec props bag — the same-object guarantee the generated
        // components.js relies on.
        const spec: AdaptSpec = { props: api.props };
        expect(Object.keys(spec.props).sort()).toEqual(['hasIconOnly', 'isExpressive', 'kind']);
    });

    it('the d.ts respells the union and removes the mapped zero prop', () => {
        const dts = compileComponentsDts(compiled());
        expect(dts).toContain("'kind'?: 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger' | 'danger--tertiary' | 'danger--ghost';");
        expect(dts).toContain("'hasIconOnly'?: boolean;");
        // The mapped zero prop is in TRemove and never re-added.
        expect(dts).not.toMatch(/^\s+variant\?:/m);
        // Unwired axes are ABSENT, not never-typed — omission is the
        // self-contained module's `never`.
        expect(dts).not.toMatch(/color\?:/);
        expect(dts).not.toContain(': never');
    });

    it('a declared mapping for an unwired surface contributes nothing', () => {
        const ds = carbonProbe();
        // Strip the modifiers from the recipe: the api still declares them.
        (ds.recipes[0] as { modifiers?: unknown }).modifiers = undefined;
        const api = compileDesignSystem(ds, manifest).componentApi!['button']!;
        expect(Object.keys(api.props)).toEqual(['kind']);
    });

    it('an unrouted wired surface keeps zero\'s name, narrowed', () => {
        const ds = carbonProbe();
        ds.api = { modifiers: { 'icon-only': { as: 'hasIconOnly' }, expressive: { as: 'isExpressive' } } };
        const dts = compileComponentsDts(compileDesignSystem(ds, manifest));
        // variant unmapped → re-added under zero's own name with the wired union.
        expect(dts).toContain("variant?: 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger' | 'danger-tertiary' | 'danger-ghost';");
    });

    it('the js emits one PURE adapt call per routing component and nothing behavioural', () => {
        const js = compileComponentsJs(compiled());
        expect(js).toContain("import { adapt } from '@sigx/zero/adapt';");
        expect(js).toContain('export const Button = /* @__PURE__ */ adapt(ZButton, {');
        expect(js).toContain("'kind': { axis: 'variant', values: { 'danger--ghost': 'danger-ghost', 'danger--tertiary': 'danger-tertiary' } },");
        // Data only: no logic may ever appear here.
        expect(js).not.toMatch(/=>|function|if |for |while /);
    });

    it('a component whose routes are all trivial is re-exported, not adapted', () => {
        const ds = carbonProbe();
        // Same vocabulary, no renames, no respells: variant maps exactly.
        ds.api = { variant: {} };
        const js = compileComponentsJs(compileDesignSystem(ds, manifest));
        expect(js).toContain("export { Button } from '@sigx/zero/button';");
        expect(js).not.toContain('adapt(Z');
        expect(js).not.toContain("import { adapt }");
    });

    it('a design system with no api emits no components artifact, and the emitters fail fast', () => {
        const ds = carbonProbe();
        delete ds.api;
        const noApi = compileDesignSystem(ds, manifest);
        expect(noApi.componentApi).toBeUndefined();
        expect(() => compileComponentsDts(noApi)).toThrow(/declares no `api`/);
        expect(() => compileComponentsJs(noApi)).toThrow(/declares no `api`/);
    });

    it('compounds intersect AdaptedStatics; single-part components do not', () => {
        const compiledHeroui = compileDesignSystem(herouiDS as DesignSystemInput, manifest);
        const dts = compileComponentsDts(compiledHeroui);
        expect(dts).toContain('export declare const Tabs: TabsAdapted & AdaptedStatics<typeof ZTabs> & { Root: TabsAdapted };');
        expect(dts).toContain('export declare const Button: ButtonAdapted & { Root: ButtonAdapted };');
    });
});

describe('the conventions the js emitter relies on', () => {
    const exportsMap = JSON.parse(
        readFileSync(resolve(import.meta.dirname, '../../zero/package.json'), 'utf8'),
    ).exports as Record<string, unknown>;

    it.each(Object.keys(anatomies))('scope %s: PascalCase barrel export with .Root, and a subpath export', (scope) => {
        const name = componentExportName(scope);
        const factory = (zero as Record<string, unknown>)[name] as { Root?: unknown } | undefined;
        expect(factory, `@sigx/zero exports ${name}`).toBeDefined();
        expect(factory!.Root, `${name}.Root`).toBeDefined();
        expect(exportsMap[`./${scope}`], `package.json exports ./${scope}`).toBeDefined();
    });
});
