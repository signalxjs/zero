/**
 * Composing a discovered pack's recipes into a design system.
 *
 * The load-bearing decision here is that **precedence is de-dup, not
 * ordering**. The obvious design — spread the pack's recipes first so the
 * design system's own recipe wins — cannot work: `compileDesignSystem` throws
 * on a second recipe for one scope in either order, so "I like the pack but
 * my stepper is square" would kill the build with a message naming neither
 * package. The first test below pins that throw, so the reason this code
 * exists cannot quietly stop being true.
 *
 * The other three: recipes are FITTED to whatever vocabulary the adopting
 * skin actually has (a pack written to the recommended grammar has to compile
 * under a design system with no colour axis); packs are APPENDED, because
 * recipe order is the key order of `compiled.components` and therefore of
 * manifest.json, register.d.ts and report.json; and a pack may only style the
 * scopes its own fragment declares.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { compileDesignSystem, resolveEcosystem, runStandardBuild, validateDesignSystem } from '@sigx/zero-kit';
import { attributeFindings, externalPackage, packagesByScope, whereWithOwner } from '@sigx/zero-kit';
import { compileDesignSystemLynx, LynxRuntimePropertyError } from '../src/targets/lynx/index.js';
import type {
    DesignSystemInput,
    EcosystemPack,
    ManifestComponent,
    RecipeInput,
    TokensInput,
    ValidationIssue,
    ZeroManifest,
} from '@sigx/zero-kit';
import { anatomies, defineAnatomy } from '@sigx/zero/anatomy';

const dirs: string[] = [];
afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const outDir = () => {
    const dir = mkdtempSync(join(tmpdir(), 'zero-ecosystem-build-'));
    dirs.push(dir);
    return dir;
};

const logger = () => ({ log: vi.fn<(m: string) => void>(), warn: vi.fn<(m: string) => void>(), error: vi.fn<(m: string) => void>() });

const stepper = defineAnatomy('acme-stepper', {
    'root': { element: 'div' },
    'item': { element: 'button', parent: 'root', states: ['active', 'inactive'] },
});

/** Zero's own anatomies. The pack's fragment is what adds `acme-stepper`. */
const baseManifest = (): ZeroManifest => ({
    components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[],
} as ZeroManifest);

/** The merged result, for the tests that compile without going through resolve. */
const withStepper = (): ZeroManifest => ({
    components: [...baseManifest().components, stepper.toJSON()] as ManifestComponent[],
} as ZeroManifest);

/** No colour axis and no size ramp — the shape a fit actually has to survive. */
const bareTokens: TokensInput = {
    roles: {},
    sizes: [],
    themes: {
        day: {
            colorScheme: 'light',
            colors: { 'base-100': 'white', 'base-200': 'white', 'base-300': 'white', 'base-content': 'black' },
        },
    },
    defaultLight: 'day',
};

/** The same, but keeping the recommended colour roles the pack is written to. */
const recommendedTokens: TokensInput = {
    ...bareTokens,
    roles: { primary: {} },
    themes: {
        day: {
            colorScheme: 'light',
            colors: {
                'base-100': 'white', 'base-200': 'white', 'base-300': 'white', 'base-content': 'black',
                'primary': 'blue', 'primary-content': 'white',
            },
        },
    },
};

const ds = (tokens: TokensInput, recipes: RecipeInput[] = []): DesignSystemInput =>
    ({ name: 'fixture', tokens, recipes }) as DesignSystemInput;

/** A pack recipe in the recommended grammar: a colour axis over a declared role. */
const packRecipe: RecipeInput = {
    component: 'acme-stepper',
    parts: {
        root: { base: { display: 'flex' } },
        item: { base: { color: 'var(--color-base-content)' }, states: { active: { fontWeight: '700' }, inactive: {} } },
    },
    variants: { color: { primary: { item: { base: { color: 'var(--color-primary)' } } } } },
};

const packOf = (name: string, recipes: readonly RecipeInput[]): EcosystemPack => ({
    package: name,
    source: `/somewhere/${name}/dist/fragment.js`,
    fragment: { version: 1, package: name, components: [stepper.toJSON()] as ManifestComponent[] },
    recipes,
});

const resolve = (designSystem: DesignSystemInput, packs: EcosystemPack[], log = logger()) =>
    resolveEcosystem({
        manifest: baseManifest(),
        designSystem,
        ecosystem: { packs },
        defaultCwd: outDir(),
        logger: log,
    });

describe('recipe precedence', () => {
    it('the compiler throws on two recipes for one scope, whichever order', () => {
        // Why de-dup exists. If this ever stops throwing, "prepend so the
        // design system wins" becomes possible and this whole design is moot.
        const both = [packRecipe, { ...packRecipe, parts: { root: { base: { display: 'grid' } } } }];
        expect(() => compileDesignSystem(ds(recommendedTokens, both), withStepper()))
            .toThrow(/duplicate recipe for component "acme-stepper"/);
        expect(() => compileDesignSystem(ds(recommendedTokens, [...both].reverse()), withStepper()))
            .toThrow(/duplicate recipe for component "acme-stepper"/);
    });

    it("drops the pack's recipe for a scope the design system already styles, and says so", async () => {
        const mine: RecipeInput = { component: 'acme-stepper', parts: { root: { base: { display: 'grid' } } } };
        const log = logger();
        const out = await resolve(ds(recommendedTokens, [mine]), [packOf('@acme/stepper', [packRecipe])], log);

        expect(out.designSystem.recipes).toEqual([mine]);
        expect(log.log).toHaveBeenCalledWith(expect.stringContaining('recipe for "acme-stepper" skipped'));
        // And the composed design system compiles, which is the whole point.
        expect(() => compileDesignSystem(out.designSystem, out.manifest)).not.toThrow();
    });

    it('appends, so the pack lands last in every ordered artifact', async () => {
        const mine: RecipeInput = { component: 'button', parts: { root: { base: { appearance: 'none' } } } };
        const out = await resolve(ds(recommendedTokens, [mine]), [packOf('@acme/stepper', [packRecipe])]);

        expect(out.designSystem.recipes.map((r) => r.component)).toEqual(['button', 'acme-stepper']);
        const compiled = compileDesignSystem(out.designSystem, out.manifest);
        expect(Object.keys(compiled.components)).toEqual(['button', 'acme-stepper']);
    });

    it('refuses a pack that ships recipes for scopes it does not declare — entirely', async () => {
        // Otherwise an installed dependency could restyle the design system's
        // own button. Refused BEFORE the merge, so the pack contributes
        // nothing: dropping only its recipes would leave its scopes in the
        // manifest styled by nobody, which is a half-adoption of a package
        // that just tried to restyle its host.
        const log = logger();
        const foreign: RecipeInput = { component: 'button', parts: { root: { base: { appearance: 'none' } } } };
        const out = await resolve(ds(recommendedTokens), [packOf('@acme/stepper', [packRecipe, foreign])], log);

        expect(out.designSystem.recipes).toEqual([]);
        expect(out.packs).toEqual([]);
        expect(out.manifest.components.some((c) => c.scope === 'acme-stepper')).toBe(false);
        expect(log.error).toHaveBeenCalledWith(expect.stringMatching(/ships recipes for scopes it does not declare.*"button"/s));
    });
});

describe('the vocabulary fit', () => {
    it('fits a pack written to the recommended grammar onto a skin with no colour axis', async () => {
        const out = await resolve(ds(bareTokens), [packOf('@acme/stepper', [packRecipe])]);
        const css = compileDesignSystem(out.designSystem, out.manifest).componentCss['acme-stepper'] ?? '';

        // The colour axis is gone (the role is not declared), the recipe still
        // compiles, and the undeclared role reference was redrawn on the base
        // surfaces rather than left dangling.
        expect(css).not.toContain('data-color');
        expect(css).not.toContain('var(--color-primary)');
        expect(css).toContain('var(--color-base-content)');
    });

    it('reports what the fit cost, and stays quiet when it cost nothing', async () => {
        const noisy = logger();
        await resolve(ds(bareTokens), [packOf('@acme/stepper', [packRecipe])], noisy);
        expect(noisy.log).toHaveBeenCalledWith(expect.stringMatching(/fitted to fixture's vocabulary — .*colour value/));

        const quiet = logger();
        await resolve(ds(recommendedTokens), [packOf('@acme/stepper', [packRecipe])], quiet);
        expect(quiet.log).not.toHaveBeenCalledWith(expect.stringContaining('fitted to'));
    });
});

describe('the lynx target', () => {
    /** `var(--press-x)` is published by zero's own web press-feedback behavior. */
    const pressy: RecipeInput = {
        component: 'acme-stepper',
        parts: {
            root: { base: { display: 'flex' } },
            item: {
                base: { color: 'var(--color-base-content)', backgroundPosition: 'var(--press-x) var(--press-y)' },
                states: { active: { fontWeight: '700' }, inactive: {} },
            },
        },
    };

    it("drops a discovered pack's web-only scope instead of failing the build", async () => {
        // The design system's author neither wrote this recipe nor can fix it;
        // failing their build over it would be the wrong trade.
        const dir = outDir();
        const log = logger();
        const { result } = await runStandardBuild({
            designSystem: ds(bareTokens, [{
                component: 'button',
                // A focus ring, or the validator refuses the build before the
                // lynx target is ever reached.
                parts: { root: { base: { appearance: 'none' }, states: { 'focus-visible': { outline: '2px solid black' } } } },
            }]),
            manifest: baseManifest(),
            ecosystem: { packs: [packOf('@acme/stepper', [pressy])] },
            targets: ['web', 'lynx'],
            audit: false,
            outDir: dir,
            logger: log,
        });

        expect(result.ok).toBe(true);
        const report = JSON.parse(readFileSync(join(dir, 'report.json'), 'utf8')) as {
            lynx?: { webOnly?: { scope: string; package: string }[] };
        };
        expect(report.lynx?.webOnly).toEqual([
            expect.objectContaining({ scope: 'acme-stepper', package: '@acme/stepper' }),
        ]);
        expect(log.error).toHaveBeenCalledWith(expect.stringContaining('is web-only'));
        // The web target still carries it — only lynx lost the scope.
        expect(readFileSync(join(dir, 'css/components/acme-stepper.css'), 'utf8')).toContain('--press-x');
        expect(readFileSync(join(dir, 'lynx/index.css'), 'utf8')).not.toContain('acme-stepper');
    });

    it('degrades on the runtime-property refusal specifically, by type', () => {
        // The degradation is gated on `instanceof LynxRuntimePropertyError`,
        // not on matching a message, so that it cannot silently widen to every
        // lynx failure the next time one is reworded. This pins the other half
        // of that contract: the emitter really does throw that class.
        //
        // There is no companion test driving a DIFFERENT lynx error through a
        // whole build, because one is not constructible today — validation and
        // the web compile reject everything else first, which is itself why
        // the narrow gate costs nothing.
        expect(() => compileDesignSystemLynx(ds(bareTokens, [pressy]), withStepper()))
            .toThrow(LynxRuntimePropertyError);
    });

    it('still fails when the AUTHORED recipe for a pack-declared scope is the web-only one', async () => {
        // The trap: the pack declares this scope, so attributing by fragment
        // would degrade the design system's OWN recipe on the pack's behalf.
        // De-dup kept the authored recipe, so it must fail the build like any
        // other first-party recipe — attribution follows what a pack actually
        // contributed, not what its fragment declares.
        await expect(runStandardBuild({
            designSystem: ds(bareTokens, [pressy]),
            manifest: baseManifest(),
            ecosystem: { packs: [packOf('@acme/stepper', [packRecipe])] },
            targets: ['web', 'lynx'],
            audit: false,
            outDir: outDir(),
            logger: logger(),
        })).rejects.toThrow(/--press-x/);
    });

    it('still fails the build for a first-party recipe in the same position', async () => {
        await expect(runStandardBuild({
            designSystem: ds(bareTokens, [pressy]),
            manifest: withStepper(),
            targets: ['web', 'lynx'],
            audit: false,
            outDir: outDir(),
            logger: logger(),
        })).rejects.toThrow(/--press-x/);
    });
});

describe('attribution and provenance', () => {
    /** A pack recipe that draws a warning the design system's author did not cause. */
    const unstyled: RecipeInput = {
        component: 'acme-stepper',
        parts: {
            root: { base: { display: 'flex' } },
            // Three declared states, nothing drawn — the state-legibility rule
            // fires, and it must not read as the adopter's own mistake.
            item: { base: { color: 'var(--color-base-content)' }, states: { active: {}, inactive: {} } },
        },
    };

    it('names the owning package on a finding about a pack scope', async () => {
        const out = await resolve(ds(bareTokens), [packOf('@acme/stepper', [unstyled])]);
        const owners = packagesByScope(out.manifest);
        expect(owners).toEqual({ 'acme-stepper': '@acme/stepper' });

        const issues: ValidationIssue[] = [
            { level: 'warning', where: 'recipes.acme-stepper', message: 'x', scope: 'acme-stepper' },
            { level: 'warning', where: 'recipes.button', message: 'y', scope: 'button' },
        ];
        attributeFindings(issues, owners);

        expect(issues[0]!.package).toBe('@acme/stepper');
        expect(whereWithOwner(issues[0]!)).toBe('recipes.acme-stepper (from @acme/stepper)');
        // A first-party scope stays unannotated — silence is the signal that
        // this one IS yours.
        expect(issues[1]!.package).toBeUndefined();
        expect(whereWithOwner(issues[1]!)).toBe('recipes.button');
    });

    it('tags a finding with the scope it is about, and nothing else', () => {
        // The tag is a mutable variable threaded through the recipe loop, so
        // the failure mode is silent misattribution: a design-system-level
        // warning inheriting the last recipe's scope, or a per-scope coverage
        // warning inheriting it in place of its own.
        const tokens: TokensInput = {
            ...bareTokens,
            // Declared and wired by nobody — a design-system-level warning
            // that must carry no scope at all.
            modifiers: ['loud'],
        };
        const recipes: RecipeInput[] = [{
            component: 'button',
            parts: { root: { base: { appearance: 'none' }, states: { 'focus-visible': { outline: '2px solid black' } } } },
        }];
        const issues = validateDesignSystem(ds(tokens, recipes), baseManifest());
        const all = [...issues.errors, ...issues.warnings];

        const unwired = all.find((i) => i.where === 'tokens.modifiers');
        expect(unwired, 'expected the unwired-modifier warning').toBeDefined();
        expect(unwired?.scope).toBeUndefined();

        for (const issue of all.filter((i) => i.where.startsWith('recipes.'))) {
            expect(issue.scope).toBe('button');
        }
    });

    it('tags a finding raised after the recipe loop with the scope it names', () => {
        // The cross-component colour-axis warning is raised once per scope
        // AFTER the loop, so it has no ambient tag to inherit — it names its
        // own scope, rather than the scope being recovered from `where`.
        const tokens: TokensInput = {
            ...recommendedTokens,
            roles: { primary: {}, secondary: {} },
            themes: {
                day: {
                    colorScheme: 'light',
                    colors: {
                        'base-100': 'white', 'base-200': 'white', 'base-300': 'white', 'base-content': 'black',
                        'primary': 'blue', 'primary-content': 'white',
                        'secondary': 'green', 'secondary-content': 'white',
                    },
                },
            },
        };
        const ring = { 'focus-visible': { outline: '2px solid black' } };
        const recipes: RecipeInput[] = [
            {
                component: 'button',
                parts: { root: { base: { appearance: 'none' }, states: ring } },
                variants: {
                    color: {
                        primary: { root: { base: { background: 'blue' } } },
                        secondary: { root: { base: { background: 'green' } } },
                    },
                },
            },
            {
                // Wires one of the two roles button wires — the inconsistency
                // the cross-component check exists to catch.
                component: 'badge',
                parts: { root: { base: { display: 'inline-flex' } } },
                variants: { color: { primary: { root: { base: { background: 'blue' } } } } },
            },
        ];
        const { errors, warnings } = validateDesignSystem(ds(tokens, recipes), baseManifest());
        const cross = [...errors, ...warnings].find((i) => i.where === 'recipes.badge.variants.color');

        expect(cross, 'expected the cross-component colour-axis warning').toBeDefined();
        expect(cross?.scope).toBe('badge');
    });

    it('tags a rule-bearing finding too — no push may skip the tag', () => {
        // The css-property findings carry `rule` and `suggest` and were pushed
        // directly, bypassing the tagging helper. Every finding now goes
        // through one place, and this pins that: a scope-less diagnostic about
        // a pack's recipe is one nobody can attribute.
        const recipes: RecipeInput[] = [{
            component: 'button',
            parts: {
                root: {
                    base: { appearance: 'none', bakcgroundColor: 'red' },
                    states: { 'focus-visible': { outline: '2px solid black' } },
                },
            },
        }];
        const { errors, warnings } = validateDesignSystem(ds(bareTokens, recipes), baseManifest());
        const typo = [...errors, ...warnings].find((i) => i.rule === 'css-property');

        expect(typo, 'expected the misspelled-property finding').toBeDefined();
        expect(typo?.scope).toBe('button');
        // …and it kept everything it carried before.
        expect(typo?.suggest).toBeDefined();
    });

    it('does not attribute a scope to Object.prototype', () => {
        // The scope grammar is lowercase, so `toString` and friends cannot be
        // scope names — but `constructor` can, and on a plain object map the
        // lookup for it returns something inherited and truthy, attributing
        // the finding to a function.
        // At least one real owner, or `attributeFindings` returns before the
        // lookup and the test proves nothing.
        const owners = packagesByScope({
            components: [
                { scope: 'button', parts: [] },
                { scope: 'acme-stepper', parts: [], package: '@acme/stepper' },
            ] as unknown as ManifestComponent[],
        });
        const issues: ValidationIssue[] = [
            { level: 'warning', where: 'recipes.constructor', message: 'x', scope: 'constructor' },
        ];
        attributeFindings(issues, owners);

        expect(issues[0]!.package).toBeUndefined();
        expect(whereWithOwner(issues[0]!)).toBe('recipes.constructor');
    });

    it('never reports a zero-shipped scope as foreign, whatever it is called', () => {
        // The compiled map is read by the register and components emitters as
        // well; `constructor` there would emit an import from a function.
        const compiled = compileDesignSystem(
            ds(bareTokens, [{
                component: 'button',
                parts: { root: { base: { appearance: 'none' }, states: { 'focus-visible': { outline: '2px solid black' } } } },
            }]),
            baseManifest(),
        );
        expect(externalPackage(compiled, 'button')).toBeUndefined();
        expect(externalPackage(compiled, 'constructor')).toBeUndefined();

        // And with a populated map handed in as a PLAIN object, which the type
        // permits and a caller may well build: the compiled form uses a null
        // prototype, but the helper is the read path either way.
        const plain = { externalScopes: { 'acme-stepper': '@acme/stepper' } };
        expect(externalPackage(plain, 'acme-stepper')).toBe('@acme/stepper');
        expect(externalPackage(plain, 'constructor')).toBeUndefined();
    });

    it('records who owns what in the emitted manifest', async () => {
        const dir = outDir();
        await runStandardBuild({
            designSystem: ds(bareTokens, [{
                component: 'button',
                parts: { root: { base: { appearance: 'none' }, states: { 'focus-visible': { outline: '2px solid black' } } } },
            }]),
            manifest: baseManifest(),
            ecosystem: { packs: [packOf('@acme/stepper', [packRecipe])] },
            audit: false,
            outDir: dir,
            logger: logger(),
        });

        // A consumer reading dist/manifest.json can tell a foreign scope from
        // one of the design system's own, and name who ships it.
        const emitted = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as {
            externalScopes?: Record<string, string>;
        };
        expect(emitted.externalScopes).toEqual({ 'acme-stepper': '@acme/stepper' });
    });

    it('emits no provenance key at all when nothing was adopted', async () => {
        const dir = outDir();
        await runStandardBuild({
            designSystem: ds(bareTokens, [{
                component: 'button',
                parts: { root: { base: { appearance: 'none' }, states: { 'focus-visible': { outline: '2px solid black' } } } },
            }]),
            manifest: baseManifest(),
            audit: false,
            outDir: dir,
            logger: logger(),
        });
        expect(JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))).not.toHaveProperty('externalScopes');
    });
});
