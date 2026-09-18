/**
 * Shared plumbing for the zero-kit commands.
 *
 * Both commands need the same two inputs — the compiled design-system module
 * and the anatomy manifest to check it against — and both report the resulting
 * diagnostics identically. That preamble was duplicated in the old hand-rolled
 * CLI; it lives once here.
 *
 * Paths resolve against `ctx.cwd` (what the sigx CLI hands the command), not
 * `process.cwd()`, so a hosted shell can run a command for another directory.
 */
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import type { Logger } from '@sigx/cli/plugin';
import type { ZeroManifest } from '../contract.js';
import type { DesignSystemInput } from '../design-system.js';
import type { ManifestFragment } from '../manifest.js';
import { attributeFindings, mergeManifests, packagesByScope, whereWithOwner } from '../manifest.js';
import type { EcosystemOptions, EcosystemPack } from '../discover.js';
import { resolveEcosystem } from '../discover.js';
import type { ValidationResult } from '../resolve/validate.js';
import { validateDesignSystem } from '../resolve/validate.js';

/** The slice of the plugin command context these helpers need. */
export interface CommandEnv {
    cwd: string;
    logger: Logger;
}

/** A bare or scoped package specifier, as opposed to a relative/absolute path. */
function isModuleSpecifier(value: string): boolean {
    return !value.startsWith('.') && !value.startsWith('/') && !value.startsWith('\\') && !/^[a-zA-Z]:/.test(value);
}

/**
 * The anatomy manifest to validate against. Defaults to the manifest generated
 * by whichever `@sigx/zero` the project has installed — resolved from `cwd`,
 * not from this package, so the contract checked is the one the project ships.
 *
 * `--manifest` takes a path, but also accepts a module specifier: the default
 * is documented as `@sigx/zero/manifest.json`, so passing that exact string
 * must work rather than being read as a directory named `@sigx`.
 *
 * `extras` are ecosystem manifest fragments (`--extra-manifest`, repeatable),
 * resolved the same way and MERGED rather than replacing — that is the whole
 * difference between covering an ecosystem component and forking the contract.
 */
export async function loadManifest(cwd: string, explicit?: string, extras: string[] = []): Promise<ZeroManifest> {
    const require = createRequire(resolve(cwd, 'package.json'));

    const readJson = async (spec: string, what: string): Promise<{ resolved: string; parsed: unknown }> => {
        let path: string;
        if (isModuleSpecifier(spec)) {
            try {
                path = require.resolve(spec);
            } catch {
                throw new Error(`cannot resolve the ${what} "${spec}" from ${cwd}`);
            }
        } else {
            path = spec;
        }
        const resolved = resolve(cwd, path);
        let source: string;
        try {
            source = await readFile(resolved, 'utf8');
        } catch {
            throw new Error(`cannot read the ${what} at ${resolved}`);
        }
        try {
            return { resolved, parsed: JSON.parse(source) };
        } catch (err) {
            throw new Error(`${resolved} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
        }
    };

    let baseSpec = explicit;
    if (!baseSpec) {
        // Bare MODULE_NOT_FOUND here reads as an internal failure — it means
        // the project has no @sigx/zero, or the command ran somewhere without
        // one. Name both the cause and the escape hatch.
        try {
            baseSpec = require.resolve('@sigx/zero/manifest.json');
        } catch {
            throw new Error(
                `cannot resolve @sigx/zero/manifest.json from ${cwd} — install @sigx/zero there, or pass --manifest <path>`,
            );
        }
    }

    const base = await readJson(baseSpec, 'anatomy manifest');
    // A design system emits its own dist/manifest.json, so pointing --manifest
    // at the wrong one of two identically named files is an easy mistake — and
    // without this it surfaces as "components.map is not a function".
    if (!Array.isArray((base.parsed as ZeroManifest | null)?.components)) {
        throw new Error(
            `${base.resolved} has no "components" array, so it is not the zero anatomy manifest — expected @sigx/zero/manifest.json, not a design system's own dist/manifest.json`,
        );
    }

    const fragments: ManifestFragment[] = [];
    for (const extra of extras) {
        const { resolved, parsed } = await readJson(extra, 'manifest fragment');
        // Shape errors past this point come from `mergeManifests`, which names
        // the fragment by its package — the one mistake it cannot name is a
        // full manifest passed where a fragment belongs, which would otherwise
        // read as "declares no package".
        const fragment = parsed as Record<string, unknown> | null;
        // `zeroVersion`/`tokens` mark an actual full manifest — a fragment
        // that merely forgot "package" must fall through to the merge's own
        // "declares no package" error rather than this misdiagnosis.
        if (fragment && typeof fragment === 'object' && !('package' in fragment)
            && Array.isArray(fragment['components'])
            && ('zeroVersion' in fragment || 'tokens' in fragment)) {
            throw new Error(
                `${resolved} looks like a full anatomy manifest, not a fragment — --extra-manifest takes { "package": "<specifier>", "components": [...] }; to replace the base manifest use --manifest`,
            );
        }
        fragments.push(fragment as unknown as ManifestFragment);
    }
    return fragments.length > 0
        ? mergeManifests(base.parsed as ZeroManifest, ...fragments)
        : base.parsed as ZeroManifest;
}

export async function loadDesignSystem(cwd: string, entry: string): Promise<DesignSystemInput> {
    const mod = await import(pathToFileURL(resolve(cwd, entry)).href);
    const ds = (mod.designSystem ?? mod.default) as DesignSystemInput | undefined;
    if (!ds || !ds.name || !ds.tokens) {
        throw new Error(`${entry} does not export a design system (named "designSystem" or default)`);
    }
    return ds;
}

/** The two ecosystem flags every command shares, as `resolveEcosystem` options. */
export interface EcosystemFlags {
    ecosystem?: boolean;
    ecosystemExclude?: string[];
}

/**
 * Turn the flags into options, refusing the combination that would do
 * nothing. `--ecosystem-exclude` without `--ecosystem` excludes packages from
 * a discovery that never runs — the same silent no-op the `include`/`exclude`
 * rules already refuse inside discovery, and worth refusing at the flag
 * boundary for the same reason.
 */
export function ecosystemOptionsFrom(env: CommandEnv, opts: EcosystemFlags): boolean | EcosystemOptions {
    const exclude = opts.ecosystemExclude ?? [];
    if (!opts.ecosystem) {
        if (exclude.length > 0) {
            throw new Error(
                '--ecosystem-exclude was given without --ecosystem, so it would exclude packages from a discovery that never runs',
            );
        }
        return false;
    }
    return { cwd: env.cwd, ...(exclude.length > 0 ? { exclude } : {}) };
}

export interface LoadedInputs {
    ds: DesignSystemInput;
    manifest: ZeroManifest;
    result: ValidationResult;
    /** Ecosystem packages adopted by discovery, in package-name order. */
    packs: EcosystemPack[];
}

/**
 * Load both inputs, validate, and report every issue through the CLI logger.
 * Returns the validation result rather than throwing on failure — `build` and
 * `validate` treat a failing result differently (`--strict` also fails on
 * warnings), so the decision stays with the caller.
 *
 * Ecosystem discovery happens here, and NOT only in `runStandardBuild`:
 * `zero:validate` and `zero:audit` reach a design system through this
 * function while `zero:build` reaches it through the harness. If only one
 * path adopted the packs, a build and a validate of the same directory would
 * disagree about which components exist.
 */
export async function loadInputs(
    env: CommandEnv,
    entry: string,
    manifest?: string,
    extraManifests: string[] = [],
    ecosystem?: boolean | EcosystemOptions,
): Promise<LoadedInputs> {
    const [loadedDs, loadedManifest] = await Promise.all([
        loadDesignSystem(env.cwd, entry),
        loadManifest(env.cwd, manifest, extraManifests),
    ]);
    const resolved = await resolveEcosystem({
        manifest: loadedManifest,
        designSystem: loadedDs,
        ecosystem,
        defaultCwd: env.cwd,
        logger: env.logger,
    });
    const { designSystem: ds, packs } = resolved;
    const mergedManifest = resolved.manifest;
    const result = validateDesignSystem(ds, mergedManifest);
    attributeFindings([...result.errors, ...result.warnings], packagesByScope(mergedManifest));
    for (const issue of [...result.errors, ...result.warnings]) {
        env.logger[issue.level === 'error' ? 'error' : 'warn'](`${whereWithOwner(issue)}: ${issue.message}`);
    }
    return { ds, manifest: mergedManifest, result, packs };
}
