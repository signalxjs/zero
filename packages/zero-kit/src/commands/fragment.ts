/**
 * `sigx zero:fragment` — the authoring-side gate for an ecosystem component
 * package.
 *
 * Everything else in this kit is the *adopting* side: a design system finds a
 * pack, fits it, composes it, attributes its diagnostics. The authoring side
 * had no gate at all, so every way a fragment can be wrong was discovered in
 * a stranger's build: a stale `version` literal, a fragment path outside
 * `"files"` (present locally, missing for every consumer), a recipe for a part
 * the anatomy never declared, a missing root export the api-mode emitter
 * imports by name — a convention `docs/architecture.md` records as having
 * "broken once, unnoticed".
 *
 * Split the way `zero:audit` is, and for the same reason: `runFragment` does
 * the two dynamic imports (vite's module runner cannot load a file written
 * outside the project, so a test cannot reach them), and `checkFragment` does
 * everything else in one pure pass.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { ValidateFunction } from 'ajv/dist/2020.js';
import { createRequire } from 'node:module';
import type { ZeroManifest } from '../contract.js';
import type { EcosystemDeclaration, EcosystemPack } from '../discover.js';
import { packFromModule, selfDeclaration } from '../discover.js';
import { FRAGMENT_VERSION, mergeManifests } from '../manifest.js';
import { fitRecipes } from '../fit.js';
import { compileDesignSystem } from '../design-system.js';
import { compileDesignSystemLynx } from '../targets/lynx/compile.js';
import { LynxRuntimePropertyError } from '../targets/lynx/capabilities.js';
import { componentExportName } from '../targets/web/components-dts.js';
import type { DesignSystemInput } from '../design-system.js';
import type { TokensInput } from '../tokens.js';
import type { CommandEnv } from './shared.js';
import { loadManifest } from './shared.js';

const require = createRequire(import.meta.url);

export interface FragmentCommandOptions {
    /** Anatomy manifest to check against (default `@sigx/zero/manifest.json`). */
    manifest?: string;
    /** Write the JSON form beside the module. On by default. */
    emit?: boolean;
    /** Treat warnings as failures. */
    strict?: boolean;
}

export interface FragmentFinding {
    level: 'error' | 'warning';
    message: string;
}

/** The schema URL the emitted JSON points at, as the ext-example does. */
export const FRAGMENT_SCHEMA_URL = 'https://signalxjs.github.io/zero/schemas/fragment.schema.json';

/**
 * `require.resolve` rather than `new URL(import.meta.url)`: under a test
 * transform `import.meta.url` is not a file: URL — the same reason
 * `artifacts.ts` resolves its schemas this way. `./schemas` in the published
 * package, `../schemas` when running from source.
 */
function schemaFile(name: string): Record<string, unknown> {
    // The build copies the schemas to `dist/schemas/`, and this module lives
    // one directory deeper than `artifacts.ts` — at `dist/commands/` when
    // published and `src/commands/` from source — so the two candidates are
    // `../schemas` and `../../schemas`, not that file's `./schemas` pair.
    //
    // Resolution and reading are separate loops on purpose: catching around
    // the read too would turn "this schema is corrupt" into "cannot find this
    // schema", which sends the reader looking for the wrong thing.
    let path: string | undefined;
    for (const base of ['../schemas', '../../schemas']) {
        try {
            path = require.resolve(`${base}/${name}.schema.json`);
            break;
        } catch {
            continue;
        }
    }
    if (path === undefined) {
        throw new Error(`[zero-kit] cannot find ${name}.schema.json beside this build`);
    }
    try {
        return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    } catch (err) {
        throw new Error(`[zero-kit] cannot read ${path}: ${err instanceof Error ? err.message : String(err)}`);
    }
}

let validateFragment: ValidateFunction | null = null;
function fragmentValidator(): ValidateFunction {
    if (validateFragment) return validateFragment;
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    // The fragment schema's `components` items `$ref` the anatomy manifest's
    // component shape — a fragment IS zero's own component shape plus
    // provenance — so that schema has to be registered alongside it.
    ajv.addSchema(schemaFile('manifest'));
    return (validateFragment = ajv.compile(schemaFile('fragment')));
}

/**
 * The vocabulary a pack must survive: base surfaces, no colour roles, no size
 * ramp. What an adopting skin like zero-heroui actually offers — and the
 * shape a pack written to the recommended grammar has to be *fitted* onto
 * rather than assume.
 */
const HOSTILE_TOKENS: TokensInput = {
    roles: {},
    sizes: [],
    themes: {
        probe: {
            colorScheme: 'light',
            colors: { 'base-100': 'white', 'base-200': 'white', 'base-300': 'white', 'base-content': 'black' },
        },
    },
    defaultLight: 'probe',
} as TokensInput;

/**
 * Whether compiled CSS carries a single declaration.
 *
 * Not `trim()`: a recipe whose every rule was fitted away still emits its
 * `@layer zero.recipes { }` wrapper, which is not empty and paints nothing.
 *
 * A terminating semicolon, rather than a property-name pattern. Three
 * successive attempts at the latter each missed a spelling that is perfectly
 * legal in emitted CSS — a key ending in a digit, a vendor prefix, an
 * underscore through the raw `css` escape hatch — and each miss is a false
 * "your component paints nothing" the author cannot override. Every
 * declaration ends in `;`; an empty layer, an empty rule and a bare `@media`
 * wrapper contain none. The one thing this over-counts is a raw `@import`,
 * which is output too.
 */
function paints(css: string | undefined): boolean {
    return css !== undefined && css.includes(';');
}

/**
 * Whether `"files"` (if declared) ships the path.
 *
 * Strict for the two spellings that carry a definite answer — an exact file,
 * and a directory prefix with or without a trailing glob (`dist`, `dist/`,
 * `dist/*`, `dist/**`). Anything else (`**`, `dist/*.mjs`) is assumed to ship:
 * this exists to catch the forgotten `dist`, not to reimplement npm's packer,
 * and a false accusation is worse than a missed one for a check the author
 * cannot override.
 */
function shippedIn(files: unknown, dir: string, source: string): boolean {
    // No `files` field means npm ships everything not otherwise ignored.
    if (!Array.isArray(files)) return true;
    const rel = relative(dir, source).split(sep).join('/');
    const under = (prefix: string) => rel === prefix || rel.startsWith(`${prefix}/`);

    return files.some((entry) => {
        if (typeof entry !== 'string') return false;
        const clean = entry.replace(/^\.\//, '').replace(/\/$/, '');
        if (!clean.includes('*')) return under(clean);

        // A directory prefix with a trailing glob: `dist/*`, `dist/**`,
        // `dist/**/*`. Strip the glob tail and the prefix answers.
        const prefix = clean.replace(/\/?\*{1,2}(?:\/\*{1,2})*$/, '');
        if (prefix.length > 0 && !prefix.includes('*')) return under(prefix);

        // A glob this does not model — `**`, or one carrying an extension.
        return true;
    });
}

/** Where the package's root entry is, or why a consumer cannot reach it. */
export type RootEntry = { path: string } | { unexported: string };

/**
 * The package's public root entry, the way a consumer reaches it.
 *
 * `exports` wins outright when present, because that is Node's own rule:
 * `main` is ignored for `import "<pkg>"` once a map exists. So a map that
 * declares only subpaths means the root is **not importable at all** — and
 * falling back to `main` there would let this gate pass a package whose
 * api-mode adopter cannot write `import { AcmeStepper } from '@acme/…'`,
 * which is the one thing the export-name check exists to prevent.
 */
export function rootEntry(pkg: Record<string, unknown>): RootEntry {
    const resolveCondition = (value: unknown): string | undefined => {
        if (typeof value === 'string') return value;
        if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
        const conditions = value as Record<string, unknown>;
        for (const key of ['import', 'node', 'default']) {
            const found = resolveCondition(conditions[key]);
            if (found) return found;
        }
        return undefined;
    };

    const exports = pkg['exports'];
    if (typeof exports === 'string') return { path: exports };
    if (typeof exports === 'object' && exports !== null && !Array.isArray(exports)) {
        const map = exports as Record<string, unknown>;
        // Sugar: a bare conditions object, with no subpath keys, IS the root.
        const isSubpathMap = Object.keys(map).some((key) => key.startsWith('.'));
        const resolved = resolveCondition(isSubpathMap ? map['.'] : map);
        if (resolved) return { path: resolved };
        return {
            unexported: isSubpathMap && !('.' in map)
                ? 'its "exports" map declares no "." entry, so `import "<package>"` fails for consumers'
                : 'its "exports" map does not resolve a "." entry for an import',
        };
    }
    return { path: typeof pkg['main'] === 'string' ? pkg['main'] : './dist/index.js' };
}

export interface FragmentCheckInput {
    declaration: EcosystemDeclaration;
    /** The fragment module's exports. */
    module: Record<string, unknown>;
    /**
     * The package root's export names, for the api-mode convention —
     * `undefined` when the root could not be read at all, which is a
     * different finding from a missing export.
     */
    rootExports: readonly string[] | undefined;
    /** Why the root could not be read, when it could not. */
    rootError?: string;
    /** The package.json of the package being checked. */
    pkg: Record<string, unknown>;
    manifest: ZeroManifest;
}

export interface FragmentCheckResult {
    /** Absent when the module's shape was too broken to read a pack out of. */
    pack?: EcosystemPack;
    findings: FragmentFinding[];
    /** The JSON form, ready to write. Absent when there is no pack. */
    json?: Record<string, unknown>;
}

/** Every check that does not need to import anything. */
export function checkFragment(input: FragmentCheckInput): FragmentCheckResult {
    const { declaration, module, rootExports, rootError, pkg, manifest } = input;
    const findings: FragmentFinding[] = [];
    const error = (message: string) => findings.push({ level: 'error', message });
    const warn = (message: string) => findings.push({ level: 'warning', message });

    // `packFromModule` THROWS on a bad shape, which is right where discovery
    // calls it — a broken dependency is skipped and named. Here the broken
    // package is the one being checked, and its author needs a finding rather
    // than a stack trace, so the throw is converted at the boundary.
    let pack: EcosystemPack;
    try {
        pack = packFromModule(declaration, module);
    } catch (err) {
        return { findings: [{ level: 'error', message: err instanceof Error ? err.message : String(err) }] };
    }

    // Read defensively. This command exists to REPORT a malformed fragment,
    // so it must not die reading one — a missing `components` should reach
    // the author as the schema's own message, not as a TypeError.
    const declared = Array.isArray(pack.fragment.components) ? pack.fragment.components : [];
    if (!Array.isArray(pack.fragment.components)) {
        error('fragment declares no "components" array');
    }
    const scopes = declared.map((c) => c?.scope).filter((s): s is string => typeof s === 'string' && s.length > 0);
    if (scopes.length !== declared.length) {
        error('every component in a fragment needs a "scope" — defineAnatomy().toJSON() emits one');
    }

    // The version literal is hand-written on purpose — importing
    // FRAGMENT_VERSION would drag the kit into the data entry's runtime graph
    // (see docs/building-your-own-component.md §4). This is what makes that
    // safe: the literal is checked here instead of in a consumer's build.
    if (pack.fragment.version !== FRAGMENT_VERSION) {
        error(
            `fragment declares version ${String(pack.fragment.version)} but this kit speaks ${FRAGMENT_VERSION}`
            + ' — rebuild the fragment against a matching @sigx/zero-kit',
        );
    }

    const json = {
        $schema: FRAGMENT_SCHEMA_URL,
        version: pack.fragment.version,
        package: pack.fragment.package,
        components: pack.fragment.components,
    } as Record<string, unknown>;
    const validate = fragmentValidator();
    if (!validate(JSON.parse(JSON.stringify(json)))) {
        for (const err of validate.errors ?? []) {
            error(`fragment.json ${err.instancePath || '(root)'} ${err.message ?? 'is invalid'}`);
        }
    }

    // The merge is the real contract: flags, governed states, placements,
    // hiddenIn, the part tree, and a scope nobody else claims.
    let merged: ZeroManifest | undefined;
    try {
        merged = mergeManifests(manifest, pack.fragment);
    } catch (err) {
        error(err instanceof Error ? err.message : String(err));
    }

    // Present locally and missing for every consumer is the failure mode a
    // package author cannot see from their own checkout.
    if (!shippedIn(pkg['files'], declaration.dir, declaration.source)) {
        error(
            `${relative(declaration.dir, declaration.source)} is not covered by "files", so consumers install a package`
            + ' whose declared fragment entry does not exist',
        );
    }

    // The api-mode convention: an api-declaring adopter's generated
    // ./components module imports exactly this name from exactly this package.
    //
    // A root that could not be read at all is ONE finding, not one per scope:
    // an unbuilt package would otherwise bury "the root does not exist" under
    // a missing-export error for every component it ships, each of which is a
    // symptom of the first.
    if (rootExports === undefined) {
        error(
            `the package root could not be read${rootError ? `: ${rootError}` : ''}`
            + ' — the export-name check was skipped',
        );
    } else {
        for (const scope of scopes) {
            const expected = componentExportName(scope);
            if (!rootExports.includes(expected)) {
                error(
                    `the package root exports no "${expected}" — an api-declaring design system's generated`
                    + ` ./components module imports that name for scope "${scope}"`,
                );
            }
        }
    }

    // Vendor prefixing is a SHOULD and not checkable ("what is a vendor"),
    // but a bare noun is worth a nudge: zero itself promoted `steps` out of
    // this very pattern, and the collision it would now cause is an error
    // above, not here.
    for (const scope of scopes) {
        if (!scope.includes('-')) {
            warn(`scope "${scope}" carries no vendor prefix — a bare noun is the one most likely to collide later`);
        }
    }

    if (merged) {
        const byScope = new Map(merged.components.map((c) => [c.scope, c]));
        // Against the pack's OWN scopes, not the merged manifest: a recipe for
        // `button` would resolve there and pass, and a pack that styles its
        // host's components is the thing adoption refuses outright.
        const owned = new Set(scopes);
        for (const recipe of pack.recipes) {
            const component = byScope.get(recipe.component);
            if (!component || !owned.has(recipe.component)) {
                error(`recipe for "${recipe.component}", which this fragment does not declare`);
                continue;
            }
            const parts = new Set(component.parts.map((p) => p.name));
            for (const part of Object.keys(recipe.parts ?? {})) {
                if (!parts.has(part)) {
                    error(`recipe for "${recipe.component}" styles "${part}", which its anatomy does not declare`);
                }
            }
        }

        // The probe: what an adopting skin with none of the recommended
        // vocabulary would actually get. A pack that only compiles against
        // its own assumptions is a pack that renders as nothing elsewhere.
        if (pack.recipes.length > 0) {
            const { recipes } = fitRecipes(pack.recipes, HOSTILE_TOKENS);
            const probe = { name: 'probe', tokens: HOSTILE_TOKENS, recipes } as DesignSystemInput;
            try {
                const compiled = compileDesignSystem(probe, merged);
                // Only the scopes the pack actually styles. A declared scope
                // with no recipe is the documented unstyled-but-accessible
                // fallback, not a fault — and it has no `componentCss` entry
                // to read either way.
                for (const scope of new Set(recipes.map((r) => r.component))) {
                    if (!paints(compiled.componentCss[scope])) {
                        warn(`"${scope}" compiles to nothing under a vocabulary with no colour roles or size ramp`);
                    }
                }
            } catch (err) {
                error(`fitted to a minimal vocabulary, the pack does not compile: ${err instanceof Error ? err.message : String(err)}`);
            }
            try {
                compileDesignSystemLynx(probe, merged);
            } catch (err) {
                // The same distinction adoption makes. A runtime-property
                // reference costs an adopter one target — their build drops
                // the scope from lynx and carries on — so it is a warning.
                // Every other lynx rejection propagates from their full
                // compile and FAILS their build, which is an error here.
                //
                // Only the warning branch has a test, for the reason
                // ecosystem-build.test.ts records: a lynx-only failure that
                // survives validation and the web compile is not currently
                // constructible.
                const message = err instanceof Error ? err.message : String(err);
                if (err instanceof LynxRuntimePropertyError) {
                    warn(`the pack is not lynx-clean, so adopters lose these scopes on that target: ${message}`);
                } else {
                    error(`the pack fails the lynx target, which fails the build of every adopter emitting it: ${message}`);
                }
            }
        }
    }

    return { pack, findings, json };
}

/** Load what the checks need, run them, report, and emit the JSON form. */
export async function runFragment(env: CommandEnv, opts: FragmentCommandOptions): Promise<void> {
    const dir = resolve(env.cwd);
    const declaration = selfDeclaration(dir, env.logger);
    if (!declaration) {
        throw new Error(
            `${join(dir, 'package.json')} declares no "sigx-zero" field —`
            + ' an ecosystem component package points at its data entry with'
            + ' { "fragment": "./dist/fragment.js" }. See docs/building-your-own-component.md',
        );
    }

    // Guarded like the root entry below, and for the same reason as every
    // other conversion in this command: an entry that throws on import is the
    // author's problem to fix, and a raw stack from inside their own module
    // does not say which file this gate was even looking at.
    let module: Record<string, unknown>;
    try {
        module = (await import(pathToFileURL(declaration.source).href)) as Record<string, unknown>;
    } catch (err) {
        throw new Error(
            `[zero-kit] ${declaration.package}'s fragment entry ${declaration.source} failed to load: `
            + `${err instanceof Error ? err.message : String(err)}`,
        );
    }
    // `selfDeclaration` above read this file too and would have reported a
    // parse failure first — but this command's contract is that nothing
    // reaches the author as a raw exception, and that contract should not
    // depend on the order two functions happen to run in.
    let pkg: Record<string, unknown>;
    try {
        pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Record<string, unknown>;
    } catch (err) {
        throw new Error(
            `[zero-kit] cannot read ${join(dir, 'package.json')}: ${err instanceof Error ? err.message : String(err)}`,
        );
    }
    const manifest = await loadManifest(env.cwd, opts.manifest);

    // The root entry, for the export-name convention. A root that cannot be
    // read is passed through as such rather than as an empty export list,
    // which would read as "every export is missing".
    const entry = rootEntry(pkg);
    let rootExports: string[] | undefined;
    let rootError: string | undefined;
    if ('unexported' in entry) {
        rootError = entry.unexported;
    } else {
        const rootPath = resolve(dir, entry.path);
        if (!existsSync(rootPath)) {
            rootError = `${rootPath} does not exist`;
        } else {
            try {
                rootExports = Object.keys((await import(pathToFileURL(rootPath).href)) as object);
            } catch (err) {
                rootError = `${rootPath} failed to load: ${err instanceof Error ? err.message : String(err)}`;
            }
        }
    }

    const { pack, findings, json } = checkFragment({
        declaration, module, rootExports, ...(rootError ? { rootError } : {}), pkg, manifest,
    });

    for (const finding of findings) {
        env.logger[finding.level === 'error' ? 'error' : 'warn'](`[${finding.level}] ${finding.message}`);
    }
    const errors = findings.filter((f) => f.level === 'error').length;
    const warnings = findings.length - errors;
    const name = pack?.package ?? declaration.package;

    if (opts.emit !== false && errors === 0 && json) {
        const out = join(dirname(declaration.source), 'fragment.json');
        await mkdir(dirname(out), { recursive: true });
        await writeFile(out, `${JSON.stringify(json, null, 4)}\n`, 'utf8');
        env.logger.log(`[${name}] wrote ${out}`);
    }

    env.logger.log(
        `[${name}] ${Array.isArray(pack?.fragment.components) ? pack.fragment.components.length : 0} scope(s),`
        + ` ${pack?.recipes.length ?? 0} recipe(s)`
        + ` — ${errors} error(s), ${warnings} warning(s)`,
    );
    if (errors > 0 || (opts.strict && warnings > 0)) {
        throw new Error(`"${name}" FAILED the fragment check (${errors} errors, ${warnings} warnings)`);
    }
}
