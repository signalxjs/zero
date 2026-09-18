/**
 * Ecosystem manifest fragments (the building-on-top-of-zero track): a peer
 * package ships `{ package, components }`, a design system merges it, and the
 * merged scope flows through validate → compile → artifacts with provenance —
 * excluded by name from the register artifact's ZeroScope compile gate, and
 * imported from its owning package under api mode.
 */
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
    compileComponentsDts,
    compileComponentsJs,
    compileDesignSystem,
    compileRegisterDts,
    defineApi,
    mergeManifests,
    validateDesignSystem,
    writeArtifacts,
} from '@sigx/zero-kit';
import type { DesignSystemInput, ManifestComponent, ManifestFragment, RecipeInput } from '@sigx/zero-kit';
import { anatomies, defineAnatomy } from '@sigx/zero/anatomy';

const baseManifest = () => ({
    components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[],
});

// An ecosystem anatomy, minted with the same public helper a real peer
// package uses — vendor-prefixed scope, per the documented convention.
// States drawn from the governed vocabulary: the merge now enforces it, and
// the original `idle | stepping` fixture was the first thing it rejected.
const stepperAnatomy = defineAnatomy('acme-stepper', {
    'root': { element: 'div', states: ['active', 'inactive'] },
    'step': { element: 'button', parent: 'root', states: ['active', 'inactive'], flags: ['disabled'] },
});

const fragment = (): ManifestFragment => ({
    version: 1,
    package: '@acme/zero-stepper',
    components: [stepperAnatomy.toJSON() as ManifestComponent],
});

const colors = {
    'base-100': 'oklch(100% 0 0)', 'base-200': 'oklch(96% 0 0)', 'base-300': 'oklch(92% 0 0)',
    'base-content': 'oklch(20% 0 0)',
    primary: 'oklch(50% 0.2 260)', 'primary-content': 'oklch(98% 0.01 260)',
};

const stepperRecipe = (): RecipeInput => ({
    component: 'acme-stepper',
    parts: {
        root: { base: { display: 'flex' } },
        step: {
            base: { color: 'var(--color-primary)' },
            states: { active: { fontWeight: '700' }, inactive: {}, disabled: { opacity: '0.4' } },
        },
    },
});

const stepperDS = (extra: Partial<DesignSystemInput> = {}): DesignSystemInput => ({
    name: 'ext-test',
    recipes: [stepperRecipe()],
    tokens: {
        roles: { primary: {} },
        defaultLight: 'l',
        themes: { l: { colorScheme: 'light', colors } },
    } as DesignSystemInput['tokens'],
    ...extra,
});

describe('mergeManifests', () => {
    it('appends fragment components stamped with their owning package, inputs untouched', () => {
        const base = baseManifest();
        const before = base.components.length;
        const merged = mergeManifests(base, fragment());
        expect(base.components.length).toBe(before);
        expect(merged.components.length).toBe(before + 1);
        const stepper = merged.components.find((c) => c.scope === 'acme-stepper')!;
        expect(stepper.package).toBe('@acme/zero-stepper');
        // Zero-origin components stay unmarked — absence IS the provenance.
        expect(merged.components.find((c) => c.scope === 'tabs')!.package).toBeUndefined();
    });

    it('hard-errors on a scope collision, naming both owners', () => {
        const shadowing: ManifestFragment = {
            version: 1,
            package: '@acme/zero-tabs',
            components: [{ scope: 'tabs', parts: [{ name: 'root', element: 'div', selectors: {} }] }],
        };
        expect(() => mergeManifests(baseManifest(), shadowing))
            .toThrow(/redeclares scope "tabs", already owned by @sigx\/zero/);
        expect(() => mergeManifests(baseManifest(), fragment(), fragment()))
            .toThrow(/redeclares scope "acme-stepper", already owned by @acme\/zero-stepper/);
    });

    it('rejects a fragment without a version, or with one this kit does not know', () => {
        // Pre-version fragments merged silently whatever contract era they
        // were built in (a pre-hiddenIn fragment slid straight through) —
        // required, so the mistake is a named error at the merge (#317 item 5).
        const { version: _dropped, ...unversioned } = fragment();
        expect(() => mergeManifests(baseManifest(), unversioned as ManifestFragment))
            .toThrow(/declares no "version"/);
        expect(() => mergeManifests(baseManifest(), { ...fragment(), version: 2 }))
            .toThrow(/fragment version 2.*version 1/s);
    });

    it('rejects a fragment without provenance or without components', () => {
        expect(() => mergeManifests(baseManifest(), { components: fragment().components } as ManifestFragment))
            .toThrow(/declares no "package"/);
        expect(() => mergeManifests(baseManifest(), { version: 1, package: '@acme/zero-stepper', components: [] }))
            .toThrow(/no "components" array/);
        expect(() => mergeManifests(baseManifest(), { version: 1, package: '@acme/x', components: [{} as ManifestComponent] }))
            .toThrow(/without a "scope" and "parts"/);
    });

    it('rejects a package specifier that could not survive interpolation into generated code', () => {
        // The specifier lands inside single quotes in emitted import
        // statements — a quote, backslash or whitespace must never get there.
        for (const bad of ["@acme/x'; import 'y", '@acme/x y', 'UPPER/case', '@acme\\x']) {
            expect(() => mergeManifests(baseManifest(), { ...fragment(), package: bad }))
                .toThrow(/not a package specifier/);
        }
    });

    it('rejects a component whose parts are not anatomy-shaped', () => {
        const malformed: ManifestFragment = {
            version: 1,
            package: '@acme/zero-stepper',
            components: [{ scope: 'acme-stepper', parts: [{ name: 'root' } as ManifestComponent['parts'][number]] }],
        };
        expect(() => mergeManifests(baseManifest(), malformed))
            .toThrow(/part without "name", "element" and "selectors"/);
    });

    // ── Vocabulary governance on the ecosystem surface (#317 item 3) ──
    // `defineAnatomy` accepts any flag/state name (it is on every component's
    // size budget), and zero's own anatomies are checked by zero's test
    // suite. A published fragment had NEITHER check — `flags: ['busy']`
    // sailed through — so the merge is where the "no synonyms" rule finally
    // binds for ecosystem packages.

    const withPart = (part: Partial<ManifestComponent['parts'][number]>): ManifestFragment => ({
        version: 1,
        package: '@acme/zero-stepper',
        components: [{
            scope: 'acme-stepper',
            parts: [{ name: 'root', element: 'div', selectors: {}, ...part }],
        }],
    });

    it('rejects a fragment flag outside the shared vocabulary', () => {
        expect(() => mergeManifests(baseManifest(), withPart({ flags: ['busy'] })))
            .toThrow(/flag "busy".*vocabulary/s);
    });

    it('rejects a fragment state outside the governed vocabulary, naming the synonym', () => {
        expect(() => mergeManifests(baseManifest(), withPart({ states: ['expanded', 'collapsed'] })))
            .toThrow(/state "expanded".*use "open"/s);
        expect(() => mergeManifests(baseManifest(), withPart({ states: ['levitating'] })))
            .toThrow(/state "levitating"/);
    });

    it('rejects a fragment placement outside the placement vocabulary', () => {
        expect(() => mergeManifests(baseManifest(), withPart({ placements: ['center'] })))
            .toThrow(/placement "center"/);
    });

    it('accepts a fragment part declaring layout attributes', () => {
        expect(() => mergeManifests(baseManifest(), withPart({ layout: ['gap', 'pad-x'] }))).not.toThrow();
    });

    it('rejects an explicitly empty layout, which claims a fact where there is none', () => {
        // The schema says minItems: 1, but that only binds a JSON fragment.
        // This is the programmatic entrypoint, so a hand-built object has to
        // be held to the same "absent, never empty" rule `models` follows.
        expect(() => mergeManifests(baseManifest(), withPart({ layout: [] })))
            .toThrow(/"layout" that is not a non-empty array/);
    });

    it('rejects a fragment layout attribute outside the layout vocabulary', () => {
        // The ecosystem surface is where the layout vocabulary finally binds:
        // zero's own anatomies are governed by its test suite, and
        // `defineAnatomy` carries no runtime guard, so a published fragment
        // inventing `gutter` has to be caught here or it reaches a manifest.
        expect(() => mergeManifests(baseManifest(), withPart({ layout: ['gutter'] })))
            .toThrow(/layout attribute "gutter"/);
    });

    it('rejects hiddenIn naming a state the part does not declare', () => {
        expect(() => mergeManifests(baseManifest(), withPart({ states: ['open', 'closed'], hiddenIn: ['inactive'] })))
            .toThrow(/hiddenIn "inactive"/);
    });

    // ── The naming rule on the ecosystem surface (#451) ──
    const withModels = (models: unknown): ManifestFragment => ({
        version: 1,
        package: '@acme/zero-stepper',
        components: [{
            scope: 'acme-stepper',
            parts: [{ name: 'root', element: 'div', selectors: {} }],
            models: models as ManifestComponent['models'],
        }],
    });

    it('accepts a fragment model that follows the naming rule, and carries it through', () => {
        const model = { concept: 'step', type: 'string', default: 'defaultStep', change: 'stepChange' };
        const merged = mergeManifests(baseManifest(), withModels([model]));
        expect(merged.components.find((c) => c.scope === 'acme-stepper')!.models).toEqual([model]);
    });

    it('rejects a fragment model whose companions do not derive from its concept', () => {
        expect(() => mergeManifests(baseManifest(), withModels([{ concept: 'step', type: 'string', default: 'defaultStep', change: 'change' }])))
            .toThrow(/the change event of concept "step" is "stepChange", not "change"/);
        expect(() => mergeManifests(baseManifest(), withModels([{ concept: 'step', type: 'string', default: 'initialStep', change: 'stepChange' }])))
            .toThrow(/the seed prop of concept "step" is "defaultStep", not "initialStep"/);
    });

    it('rejects a fragment model without a camelCase concept or a type, and a named model whose concept is not its name', () => {
        expect(() => mergeManifests(baseManifest(), withModels([{ concept: 'active-step', type: 'string', default: 'defaultActive-step', change: 'active-stepChange' }])))
            .toThrow(/needs a camelCase "concept"/);
        expect(() => mergeManifests(baseManifest(), withModels([{ concept: 'step', default: 'defaultStep', change: 'stepChange' }])))
            .toThrow(/needs a "type"/);
        expect(() => mergeManifests(baseManifest(), withModels([{ name: 'open', concept: 'expanded', type: 'boolean', default: 'defaultExpanded', change: 'expandedChange' }])))
            .toThrow(/a named model's concept IS its name/);
        expect(() => mergeManifests(baseManifest(), withModels({ concept: 'step' })))
            .toThrow(/"models" that is not a non-empty array/);
    });

    it("holds a fragment model to the schema's shape: no empty block, camelCase name, PascalCase member, presence-only flags", () => {
        const ok = { concept: 'step', type: 'string', default: 'defaultStep', change: 'stepChange' };
        expect(() => mergeManifests(baseManifest(), withModels([]))).toThrow(/not a non-empty array — omit the key/);
        expect(() => mergeManifests(baseManifest(), withModels([{ ...ok, name: 'Step' }]))).toThrow(/"name" is the camelCase model:<name> key/);
        expect(() => mergeManifests(baseManifest(), withModels([{ ...ok, member: 'checkbox-item' }]))).toThrow(/"member" is a PascalCase compound member/);
        expect(() => mergeManifests(baseManifest(), withModels([{ ...ok, multiple: false }]))).toThrow(/"multiple" is presence-only/);
        expect(() => mergeManifests(baseManifest(), withModels([{ ...ok, formControl: 'yes' }]))).toThrow(/"formControl" is presence-only/);
        // The entry is closed, as the schema's $defs/model is.
        expect(() => mergeManifests(baseManifest(), withModels([{ ...ok, event: 'stepChange' }]))).toThrow(/unknown key "event"/);
        expect(() => mergeManifests(baseManifest(), withModels([{ ...ok, member: 'Track', multiple: true, formControl: true }]))).not.toThrow();
    });

    it('rejects a dangling or self-referential parent', () => {
        expect(() => mergeManifests(baseManifest(), withPart({ parent: 'ghost' })))
            .toThrow(/parent "ghost"/);
        expect(() => mergeManifests(baseManifest(), withPart({ parent: 'root' })))
            .toThrow(/its own parent/);
    });
});

describe('a merged ecosystem scope in the pipeline', () => {
    const merged = () => mergeManifests(baseManifest(), fragment());

    it('validates and compiles like any manifest scope, with provenance on the compiled form', () => {
        const ds = stepperDS();
        const result = validateDesignSystem(ds, merged() as Parameters<typeof validateDesignSystem>[1]);
        expect(result.errors).toEqual([]);
        const compiled = compileDesignSystem(ds, merged());
        expect(Object.keys(compiled.componentCss)).toEqual(['acme-stepper']);
        expect(compiled.componentCss['acme-stepper']).toContain('[data-scope="acme-stepper"][data-part="step"][data-state="active"]');
        expect(compiled.externalScopes).toEqual({ 'acme-stepper': '@acme/zero-stepper' });
    });

    it('still rejects a scope no manifest declares', () => {
        const ds = stepperDS({ recipes: [{ ...stepperRecipe(), component: 'acme-mystery' }] });
        expect(() => compileDesignSystem(ds, merged())).toThrow(/unknown component "acme-mystery"/);
    });

    it('the register artifact excludes external scopes by name and keeps the gate otherwise', () => {
        const dts = compileRegisterDts(compileDesignSystem(stepperDS(), merged()));
        expect(dts).toContain("Exclude<keyof import('@sigx/zero').ZeroVocabulary['components'], 'acme-stepper'>");
        expect(dts).toContain("extends import('@sigx/zero').ZeroScope");
        expect(dts).toContain('//   acme-stepper — @acme/zero-stepper');
        // A design system with no external scopes emits the plain gate, byte
        // for byte what it emitted before fragments existed.
        const zeroOnly = stepperDS({ recipes: [{ component: 'tabs', parts: { root: { base: { display: 'flex' } } } }] });
        const plain = compileRegisterDts(compileDesignSystem(zeroOnly, baseManifest()));
        expect(plain).toContain("keyof import('@sigx/zero').ZeroVocabulary['components'] extends import('@sigx/zero').ZeroScope");
        expect(plain).not.toContain('Exclude<');
    });

    it('api-mode emitters import an external scope from its owning package', () => {
        const ds = stepperDS({
            recipes: [{ ...stepperRecipe(), variants: { variant: { solid: { root: { base: { padding: '0' } } } } } }],
            api: defineApi({ variants: ['solid'] }, { variant: { as: 'kind' } }),
        });
        const compiled = compileDesignSystem(ds, merged());
        expect(compileComponentsDts(compiled)).toContain("from '@acme/zero-stepper';");
        expect(compileComponentsJs(compiled)).toContain("from '@acme/zero-stepper';");
        expect(compileComponentsDts(compiled)).not.toContain('@sigx/zero/acme-stepper');
    });
});

describe('fragment hardening (#318)', () => {
    const rawFragment = (component: Partial<ManifestComponent>): ManifestFragment => ({
        version: 1,
        package: '@acme/zero-evil',
        components: [{
            scope: 'acme-widget',
            parts: [{ name: 'root', element: 'div', selectors: {} }],
            ...component,
        } as ManifestComponent],
    });

    it('rejects a scope that is not a kebab-case identifier', () => {
        // A fragment's scope becomes `[data-scope="…"]` selectors AND the
        // artifact filename `dist/css/components/<scope>.css` — both closed
        // by one grammar. `../../escape` is the filesystem half of that.
        for (const scope of ['../../escape', 'Bad Scope', 'x"] html [x="']) {
            expect(() => mergeManifests(baseManifest(), rawFragment({ scope })), scope)
                .toThrow(/kebab-case/);
        }
    });

    it('rejects a part name that is not a kebab-case identifier', () => {
        expect(() => mergeManifests(baseManifest(), rawFragment({
            parts: [{ name: 'root"] [data-x="', element: 'div', selectors: {} }],
        }))).toThrow(/kebab-case/);
    });

    it('rejects a selectors value that would break out of its rule', () => {
        expect(() => mergeManifests(baseManifest(), rawFragment({
            parts: [{
                name: 'root',
                element: 'div',
                states: ['open'],
                selectors: { open: '[data-state="open"] { } html { color: red' },
            }],
        }))).toThrow(/brace, semicolon or newline/);
    });

    it('accepts the shapes real anatomies emit', () => {
        expect(() => mergeManifests(baseManifest(), fragment())).not.toThrow();
    });

    it('writeArtifacts refuses a scope that could escape the components dir', async () => {
        const out = mkdtempSync(join(tmpdir(), 'zero-kit-artifacts-'));
        const compiled = compileDesignSystem(stepperDS(), mergeManifests(baseManifest(), fragment()));
        compiled.componentCss['../../escape'] = '/* out of tree */';
        await expect(writeArtifacts(compiled, join(out, 'nested', 'dist')))
            .rejects.toThrow(/kebab-case/);
        // `dist/css/components/../../escape.css` resolves to `dist/escape.css`.
        expect(existsSync(resolve(out, 'nested', 'dist', 'escape.css'))).toBe(false);
    });
});
