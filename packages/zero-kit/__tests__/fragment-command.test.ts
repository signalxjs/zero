/**
 * `sigx zero:fragment` — the authoring-side gate.
 *
 * Every check here exists because the same mistake, uncaught, surfaces in a
 * stranger's build instead of the author's: a stale `version` literal, a
 * fragment path outside `"files"` (present locally, missing for every
 * consumer), a recipe for a part the anatomy never declared, a missing root
 * export the api-mode emitter imports by name.
 *
 * `runFragment` itself is not reachable from here — it dynamic-imports the
 * package's built entries, and vite's module runner cannot load a file
 * written outside the project. So the command is split the way
 * `commands/audit.ts` is, and `checkFragment` — everything after the imports
 * — is what this exercises.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { anatomies, defineAnatomy } from '@sigx/zero/anatomy';
import { FRAGMENT_VERSION } from '@sigx/zero-kit';
import type { ManifestComponent, ManifestFragment, RecipeInput, ZeroManifest } from '@sigx/zero-kit';
import { HOSTILE_TOKENS, checkFragment, rootEntry } from '../src/commands/fragment.js';
import { TOKEN_CATEGORIES, tokenProperty } from '../src/contract.js';
import { STRUCTURAL_FALLBACKS, resolveSystemTokens } from '../src/targets/shared.js';
import type { FragmentCheckInput } from '../src/commands/fragment.js';

const stepper = defineAnatomy('acme-stepper', {
    'root': { element: 'div' },
    'item': { element: 'button', parent: 'root', states: ['active', 'inactive'] },
});

const manifest = (): ZeroManifest =>
    ({ components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] }) as ZeroManifest;

const fragment = (over: Partial<ManifestFragment> = {}): ManifestFragment => ({
    version: FRAGMENT_VERSION,
    package: '@acme/zero-stepper',
    components: [stepper.toJSON()] as ManifestComponent[],
    ...over,
});

/** A pack in the recommended grammar, so the hostile probe has something to fit. */
const recipe: RecipeInput = {
    component: 'acme-stepper',
    parts: {
        root: { base: { display: 'flex' } },
        item: { base: { color: 'var(--color-base-content)' }, states: { active: { fontWeight: '700' }, inactive: {} } },
    },
    variants: { color: { primary: { item: { base: { color: 'var(--color-primary)' } } } } },
};

const input = (over: Partial<FragmentCheckInput> = {}): FragmentCheckInput => ({
    declaration: {
        package: '@acme/zero-stepper',
        dir: '/pkg',
        source: '/pkg/dist/fragment.js',
    },
    module: { fragment: fragment(), recipes: [recipe] },
    rootExports: ['AcmeStepper'],
    pkg: { name: '@acme/zero-stepper', files: ['dist'] },
    manifest: manifest(),
    ...over,
});

const errors = (result: { findings: { level: string; message: string }[] }): string[] =>
    result.findings.filter((f) => f.level === 'error').map((f) => f.message);
const warnings = (result: { findings: { level: string; message: string }[] }): string[] =>
    result.findings.filter((f) => f.level === 'warning').map((f) => f.message);

describe('checkFragment', () => {
    it('passes a well-formed package, and emits the JSON form', () => {
        const result = checkFragment(input());
        expect(result.findings).toEqual([]);
        expect(result.json).toMatchObject({
            $schema: expect.stringContaining('fragment.schema.json'),
            version: FRAGMENT_VERSION,
            package: '@acme/zero-stepper',
        });
    });

    it('catches a version literal that has fallen behind the kit', () => {
        // The literal is hand-written on purpose — importing FRAGMENT_VERSION
        // would drag the kit into the data entry's runtime graph. This check
        // is what makes that safe.
        const result = checkFragment(input({ module: { fragment: fragment({ version: 0 }), recipes: [] } }));
        expect(errors(result).join('\n')).toMatch(/declares version 0 but this kit speaks/);
    });

    it.each([
        ['a module exporting no fragment', { recipes: [] }, /exports no "fragment" object/],
        ['a fragment naming another package', { fragment: fragment({ package: '@other/pack' }) }, /declares package "@other\/pack"/],
        ['a recipes export that is not an array', { fragment: fragment(), recipes: {} }, /"recipes" that is not an array/],
    ])('reports %s as a finding, not a throw', (_what, module, expected) => {
        // packFromModule throws by design where DISCOVERY calls it — a broken
        // dependency is skipped and named. Here the broken package is the one
        // being checked, and its author needs a finding.
        const result = checkFragment(input({ module: module as Record<string, unknown> }));
        expect(errors(result).join('\n')).toMatch(expected);
        expect(result.pack).toBeUndefined();
    });

    it('reports a malformed fragment instead of dying on it', () => {
        // The command's whole job is to describe a broken fragment, so reading
        // one must not throw before the schema can speak.
        const noComponents = { version: FRAGMENT_VERSION, package: '@acme/zero-stepper' } as unknown as ManifestFragment;
        const result = checkFragment(input({ module: { fragment: noComponents, recipes: [] } }));
        expect(errors(result).join('\n')).toMatch(/declares no "components" array/);

        const noScope = fragment({ components: [{ parts: [] }] as unknown as ManifestComponent[] });
        const scopeless = checkFragment(input({ module: { fragment: noScope, recipes: [] } }));
        expect(errors(scopeless).join('\n')).toMatch(/needs a "scope"/);
    });

    it('catches a fragment entry that will be missing for consumers', () => {
        const result = checkFragment(input({ pkg: { name: '@acme/zero-stepper', files: ['src'] } }));
        expect(errors(result).join('\n')).toMatch(/not covered by "files"/);
    });

    it.each([
        ['a directory', ['dist'], true],
        ['a trailing slash', ['dist/'], true],
        ['a single-star glob', ['dist/*'], true],
        ['a double-star glob', ['dist/**'], true],
        ['a deep glob', ['dist/**/*'], true],
        // The one this was written for: any `*` used to count as a match, so
        // a package shipping only `src` passed while its fragment did not.
        ['another directory\'s glob', ['src/**'], false],
        ['an unrelated directory', ['src'], false],
        // A glob this does not model — assumed to ship rather than accused.
        ['an unmodelled glob', ['**/*.js'], true],
    ])('reads %s in "files"', (_what, files, shipped) => {
        const result = checkFragment(input({ pkg: { name: '@acme/zero-stepper', files } }));
        expect(errors(result).some((m) => m.includes('"files"'))).toBe(!shipped);
    });

    it('accepts a package that declares no files at all', () => {
        // No `files` means npm ships everything not otherwise ignored.
        expect(errors(checkFragment(input({ pkg: { name: '@acme/zero-stepper' } })))).toEqual([]);
    });

    it('catches a missing root export, naming the one the api emitter wants', () => {
        const result = checkFragment(input({ rootExports: ['Stepper'] }));
        expect(errors(result).join('\n')).toMatch(/exports no "AcmeStepper"/);
    });

    it('reports an unreadable root once, not once per scope', () => {
        // An unbuilt package would otherwise bury "the root does not exist"
        // under a missing-export error for every component it ships.
        const two = fragment({
            components: [
                stepper.toJSON(),
                defineAnatomy('acme-gauge', { root: { element: 'div' } }).toJSON(),
            ] as ManifestComponent[],
        });
        const result = checkFragment(input({
            module: { fragment: two, recipes: [] },
            rootExports: undefined,
            rootError: '/pkg/dist/index.js does not exist',
        }));

        const raised = errors(result).filter((m) => m.includes('root'));
        expect(raised).toHaveLength(1);
        expect(raised[0]).toMatch(/could not be read.*does not exist.*export-name check was skipped/s);
        expect(errors(result).join('\n')).not.toMatch(/exports no/);
    });

    it('catches a recipe for a part the anatomy does not declare', () => {
        const strayPart: RecipeInput = { component: 'acme-stepper', parts: { label: { base: { color: 'red' } } } };
        const result = checkFragment(input({ module: { fragment: fragment(), recipes: [strayPart] } }));
        expect(errors(result).join('\n')).toMatch(/styles "label", which its anatomy does not declare/);
    });

    it('catches a recipe for a scope the fragment does not declare', () => {
        const foreign: RecipeInput = { component: 'button', parts: { root: { base: { color: 'red' } } } };
        const result = checkFragment(input({ module: { fragment: fragment(), recipes: [foreign] } }));
        expect(errors(result).join('\n')).toMatch(/recipe for "button", which this fragment does not declare/);
    });

    it('catches a scope zero already ships', () => {
        const collides = defineAnatomy('button', { root: { element: 'div' } });
        const result = checkFragment(input({
            module: { fragment: fragment({ components: [collides.toJSON()] as ManifestComponent[] }), recipes: [] },
        }));
        expect(errors(result).join('\n')).toMatch(/scope|claim/i);
    });

    it('nudges an unprefixed scope without failing it', () => {
        // Not an error: "what is a vendor" is not checkable, and zero itself
        // promoted `steps` out of this very pattern. The collision it would
        // cause later IS an error, above.
        const bare = defineAnatomy('stepper', { root: { element: 'div' } });
        const result = checkFragment(input({
            module: { fragment: fragment({ components: [bare.toJSON()] as ManifestComponent[] }), recipes: [] },
            rootExports: ['Stepper'],
        }));
        expect(errors(result)).toEqual([]);
        expect(warnings(result).join('\n')).toMatch(/carries no vendor prefix/);
    });

    it('warns when a scope compiles to nothing under a minimal vocabulary', () => {
        // A pack that only draws through the colour axis renders as nothing on
        // a skin that declares no roles — which the author should learn now,
        // not from an adopter.
        const axisOnly: RecipeInput = {
            component: 'acme-stepper',
            parts: { root: {}, item: {} },
            variants: { color: { primary: { item: { base: { color: 'var(--color-primary)' } } } } },
        };
        const result = checkFragment(input({ module: { fragment: fragment(), recipes: [axisOnly] } }));
        expect(warnings(result).join('\n')).toMatch(/compiles to nothing under a vocabulary/);
    });

    it.each([
        ['a plain token', { accent: 'red' }],
        // A key ENDING in a digit. `--…-2xl` slipped past the first pattern
        // only because `xl` sits before the colon; `--…-text-2` has nothing
        // there but the digit, and was misread as painting nothing.
        ['a token ending in a digit', { 'text-2': '1rem' }],
    ])('counts %s as painting', (_what, tokens) => {
        // A recipe whose only output is a component token still emits a
        // declaration, so the "compiles to nothing" warning must not fire.
        const tokenOnly: RecipeInput = {
            component: 'acme-stepper',
            tokens: tokens as Record<string, string>,
            parts: { root: {}, item: {} },
        };
        const result = checkFragment(input({ module: { fragment: fragment(), recipes: [tokenOnly] } }));
        expect(warnings(result).join('\n')).not.toMatch(/compiles to nothing/);
    });

    it.each([
        ['a vendor prefix', { '-webkit-tap-highlight-color': 'transparent' }],
        // Through the raw escape hatch a property can be spelled anything at
        // all; three property-name patterns each missed a legal one, and each
        // miss was a false accusation the author could not override.
        ['an underscored custom property', { '--Tabs_Accent': 'red' }],
    ])('counts %s as painting', (_what, base) => {
        const prefixed: RecipeInput = {
            component: 'acme-stepper',
            parts: { root: {}, item: { base: base as Record<string, string> } },
        };
        const result = checkFragment(input({ module: { fragment: fragment(), recipes: [prefixed] } }));
        expect(warnings(result).join('\n')).not.toMatch(/compiles to nothing/);
    });

    it('says nothing about a declared scope the pack deliberately leaves unstyled', () => {
        // Unstyled but accessible is the contract's own fallback, so a scope
        // with no recipe is a choice, not a failure to compile.
        const two = fragment({
            components: [
                stepper.toJSON(),
                defineAnatomy('acme-gauge', { root: { element: 'div' } }).toJSON(),
            ] as ManifestComponent[],
        });
        const result = checkFragment(input({
            module: { fragment: two, recipes: [recipe] },
            rootExports: ['AcmeStepper', 'AcmeGauge'],
        }));
        expect(warnings(result).join('\n')).not.toMatch(/compiles to nothing/);
    });

    it('warns that a web-runtime property costs adopters the lynx target', () => {
        const pressy: RecipeInput = {
            component: 'acme-stepper',
            parts: {
                root: { base: { display: 'flex' } },
                item: { base: { backgroundPosition: 'var(--press-x) var(--press-y)' }, states: { active: {}, inactive: {} } },
            },
        };
        const result = checkFragment(input({ module: { fragment: fragment(), recipes: [pressy] } }));
        expect(errors(result)).toEqual([]);
        expect(warnings(result).join('\n')).toMatch(/not lynx-clean/);
    });

    it('lets a pack read the standard token vocabulary bare on the lynx probe (#158)', () => {
        // Every design system defines --space-*, --font-*, … — so a recipe in
        // the recommended grammar reads them without a fallback. The probe
        // must define them too, or the lynx dangling-var gate fails the pack
        // for vocabulary it never invented.
        const standard: RecipeInput = {
            component: 'acme-stepper',
            parts: {
                root: { base: { display: 'flex', gap: 'var(--space-2xs)', padding: 'var(--space-2xl)', maxWidth: 'var(--measure-prose)' } },
                item: {
                    base: {
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 'var(--weight-semibold)',
                        lineHeight: 'var(--leading-tight)',
                        letterSpacing: 'var(--tracking-wide)',
                        boxShadow: 'var(--shadow-lg)',
                        transitionDuration: 'var(--duration-fast)',
                        transitionTimingFunction: 'var(--ease-standard)',
                    },
                    states: { active: {}, inactive: {} },
                },
            },
        };
        const result = checkFragment(input({ module: { fragment: fragment(), recipes: [standard] } }));
        expect(errors(result)).toEqual([]);
        expect(warnings(result)).toEqual([]);
    });

    it('resolves a step the probe does not declare once the fitter snaps it (#158)', () => {
        // `--tracking-wider` is an extra step of the pack's own design
        // system: the fitter collapses it to the resting `--tracking-normal`,
        // which must then resolve on the probe rather than dangle.
        const extra: RecipeInput = {
            component: 'acme-stepper',
            parts: {
                root: { base: { letterSpacing: 'var(--tracking-wider)', gap: 'var(--space-3xl)' } },
                item: { base: { color: 'var(--color-base-content)' }, states: { active: {}, inactive: {} } },
            },
        };
        const result = checkFragment(input({ module: { fragment: fragment(), recipes: [extra] } }));
        expect(errors(result)).toEqual([]);
    });

    it('fits a breakpoint at key away rather than failing the probe on it (#225)', () => {
        // An adopter that declares `md` compiles this whole; one with no ramp
        // gets the condition dropped by the fit. The probe declares an empty
        // ramp, so it must take the second path, not throw "unknown condition".
        const responsive: RecipeInput = {
            component: 'acme-stepper',
            parts: {
                root: {
                    base: { display: 'flex' },
                    at: {
                        'below-md': { base: { display: 'none' } },
                        md: { base: { display: 'grid' } },
                    },
                },
                item: { base: { color: 'var(--color-base-content)' }, states: { active: {}, inactive: {} } },
            },
        };
        const result = checkFragment(input({ module: { fragment: fragment(), recipes: [responsive] } }));
        expect(errors(result)).toEqual([]);
        expect(warnings(result).join('\n')).not.toMatch(/compiles to nothing/);
    });

    it('fits a breakpoint at key inside composes away too (#225)', () => {
        const composing: RecipeInput = {
            component: 'acme-stepper',
            parts: {
                root: { base: { display: 'flex' } },
                item: { base: { color: 'var(--color-base-content)' }, states: { active: {}, inactive: {} } },
            },
            composes: {
                button: {
                    within: 'root',
                    parts: { root: { base: { flex: '1' }, at: { 'below-md': { base: { flex: 'none' } } } } },
                },
            },
        };
        const result = checkFragment(input({ module: { fragment: fragment(), recipes: [composing] } }));
        expect(errors(result)).toEqual([]);
    });

    it('keeps a raw @media prelude through the probe fit (#225)', () => {
        // The prelude hard-codes its width, so it needs no ramp and survives —
        // a recipe whose only styles sit under it still paints.
        const raw: RecipeInput = {
            component: 'acme-stepper',
            parts: {
                root: { at: { '@media (width < 48rem)': { base: { display: 'none' } } } },
                item: { states: { active: {}, inactive: {} } },
            },
        };
        const result = checkFragment(input({ module: { fragment: fragment(), recipes: [raw] } }));
        expect(errors(result)).toEqual([]);
        expect(warnings(result).join('\n')).not.toMatch(/compiles to nothing/);
    });

    it('warns, not errors, when a scope styles only under a breakpoint (#225)', () => {
        // Under no ramp the phone regime is all there is to drop, so the scope
        // renders as nothing — which is what an adopter with no ramp gets.
        const phoneOnly: RecipeInput = {
            component: 'acme-stepper',
            parts: {
                root: { at: { 'below-md': { base: { display: 'none' } } } },
                item: { states: { active: {}, inactive: {} } },
            },
        };
        const result = checkFragment(input({ module: { fragment: fragment(), recipes: [phoneOnly] } }));
        expect(errors(result)).toEqual([]);
        expect(warnings(result).join('\n')).toMatch(/compiles to nothing/);
    });
});

/**
 * The probe defines the standard non-colour vocabulary at base.css's own
 * fallback values (#158). Two copies of the same numbers drift, so — like the
 * lynx `STRUCTURAL_FALLBACKS` pin — this reads the base.css that ships.
 */
describe('the lynx probe vocabulary', () => {
    const baseCss = readFileSync(
        createRequire(join(process.cwd(), 'noop.js')).resolve('@sigx/zero/css'),
        'utf8',
    );
    const probe = resolveSystemTokens(HOSTILE_TOKENS.system);

    it.each(Object.entries(probe))('%s matches base.css', (prop, value) => {
        expect(baseCss).toContain(`${prop}: ${value};`);
    });

    it('covers every recommended key the lynx structural fallbacks leave out', () => {
        const missing = TOKEN_CATEGORIES
            .filter((c) => c.shape === 'scale')
            .flatMap((c) => c.recommended.map((key) => tokenProperty(c, key)))
            .filter((prop) => !(prop in STRUCTURAL_FALLBACKS) && !(prop in probe));
        expect(missing).toEqual([]);
    });
});

describe('rootEntry', () => {
    it('prefers the exports map, the way Node does', () => {
        // An ESM package commonly declares `exports` and omits `main`
        // entirely; reading `main` alone sent the export-name check at a file
        // that does not exist, and reported the root as missing its export.
        expect(rootEntry({ exports: { '.': { import: './dist/index.js' } }, main: './legacy.cjs' }))
            .toEqual({ path: './dist/index.js' });
        expect(rootEntry({ exports: { '.': { types: './d.ts', import: './esm.js' } } })).toEqual({ path: './esm.js' });
        expect(rootEntry({ exports: './single.js' })).toEqual({ path: './single.js' });
        // Sugar: a bare conditions object, no subpath keys, IS the root.
        expect(rootEntry({ exports: { import: './sugar.js' } })).toEqual({ path: './sugar.js' });
    });

    it('reports a subpath-only exports map as an unreachable root', () => {
        // Node ignores `main` once a map exists, so `import "<pkg>"` fails
        // here however inviting that `main` looks — and an api-mode adopter's
        // generated ./components module does exactly that import.
        const result = rootEntry({ exports: { './fragment': './dist/fragment.js' }, main: './dist/main.js' });
        expect(result).toEqual({ unexported: expect.stringContaining('no "." entry') });
    });

    it('falls back to main, then to the conventional path, when there is no map', () => {
        expect(rootEntry({ main: './out/index.js' })).toEqual({ path: './out/index.js' });
        expect(rootEntry({})).toEqual({ path: './dist/index.js' });
    });
});
