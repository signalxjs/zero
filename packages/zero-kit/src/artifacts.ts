/**
 * Write a compiled design system to disk — the artifact layout every DS
 * package ships:
 *
 * ```
 * dist/css/tokens.css
 * dist/css/components/<scope>.css
 * dist/css/index.css
 * dist/manifest.json        (DS-level: versioned envelope, themes, declared tokens, per-component wired axes)
 * dist/register.d.ts        (GENERATED ZeroVocabulary augmentation —
 *                            docs/architecture.md, "The register artifact")
 * dist/register.js          (empty module so the /register subpath resolves)
 * dist/report.json          (coverage report — docs/architecture.md,
 *                            "The authoring surface"; only when given one)
 * dist/audit.json           (the audit — findings, waivers, summary; only when given one)
 * dist/components.d.ts      (vendor-named component types — issue #179; only when the design system declares an `api`)
 * dist/components.js        (data-only adapt() wiring for the same — issue #179; only with an `api`)
 * ```
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { ValidateFunction } from 'ajv/dist/2020.js';
import { TOKEN_KEY_PATTERN } from './contract.js';
import type { CompiledComponentApi } from './api.js';
import type {
    CompiledComponentAxes,
    CompiledDesignSystem,
    CompiledTheme,
} from './design-system.js';
import type { DesignSystemReport } from './resolve/report.js';
import type { AuditResult } from './audit/types.js';
import { buildAuditArtifact } from './audit/index.js';
import { compileRegisterDts, compileRegisterJs } from './targets/web/register-dts.js';
import { compileComponentsDts, compileComponentsJs } from './targets/web/components-dts.js';

const require = createRequire(import.meta.url);

/**
 * The version of the DS manifest's SHAPE — `manifestVersion` in every emitted
 * dist/manifest.json, and the constant a consumer checks against instead of
 * sniffing keys. Bumped only on an incompatible change to the manifest
 * contract; `schemas/ds-manifest.schema.json` pins the same number.
 */
export const DS_MANIFEST_VERSION = 1;

const DS_MANIFEST_SCHEMA_URL = 'https://signalxjs.github.io/zero/schemas/ds-manifest.schema.json';

/**
 * The manifest a compiled design system ships as `dist/manifest.json` — the
 * versioned envelope around the compiled form's themes/tokens/components.
 * Exported so consumers (the playground, e2e suites, docs tooling) type the
 * file from the kit instead of hand-declaring the shape, which is how every
 * one of them had drifted before the version existed (#317 item 5).
 *
 * NOT the zero anatomy manifest: `@sigx/zero/manifest.json` describes zero's
 * component anatomies and validates against `manifest.schema.json`. The two
 * artifacts share a basename and nothing else.
 */
export interface DesignSystemManifest {
    $schema: typeof DS_MANIFEST_SCHEMA_URL;
    manifestVersion: typeof DS_MANIFEST_VERSION;
    /** The @sigx/zero contract version compiled against (lockstep with the kit). */
    zeroVersion: string;
    /**
     * Scope → the ecosystem package that owns it, for every component this
     * design system adopted from outside `@sigx/zero`. Absent when it adopted
     * none. Additive and optional, so it is not a `manifestVersion` bump —
     * that version is for changes a reader cannot ignore.
     */
    externalScopes?: Record<string, string>;
    name: string;
    themes: CompiledTheme[];
    tokens: CompiledDesignSystem['tokens'];
    /** Scope → wired axes (scope names remain reachable as this record's keys). */
    components: Record<string, CompiledComponentAxes>;
    /** Scope → the vendor-named API surface — present iff the DS declares an `api` (#179). */
    api?: Record<string, CompiledComponentApi>;
}

/**
 * The schema, loaded from wherever this module runs: `dist/schemas/` in the
 * published package (the build copies them beside the compiled output),
 * `../schemas/` when running from source under the test aliases.
 */
let validateManifest: ValidateFunction | null = null;
function manifestValidator(): ValidateFunction {
    if (validateManifest) return validateManifest;
    // require.resolve rather than new URL(import.meta.url): under a test
    // transform import.meta.url is not a file: URL, while createRequire
    // normalizes it either way.
    let path: string;
    try {
        path = require.resolve('./schemas/ds-manifest.schema.json');
    } catch {
        path = require.resolve('../schemas/ds-manifest.schema.json');
    }
    const raw = readFileSync(path, 'utf8');
    const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
    return (validateManifest = ajv.compile(JSON.parse(raw) as Record<string, unknown>));
}

/**
 * The DS manifest for a compiled design system — extracted so the lynx
 * artifacts can carry the identical content under their own envelope (one
 * design system, one truth about its vocabulary; only delivery differs).
 */
export function buildDsManifest(compiled: CompiledDesignSystem): DesignSystemManifest {
    return {
        $schema: DS_MANIFEST_SCHEMA_URL,
        manifestVersion: DS_MANIFEST_VERSION,
        // Lockstep versioning: the kit's own version IS the zero contract
        // version it emits for.
        zeroVersion: (require('../package.json') as { version: string }).version,
        name: compiled.name,
        themes: compiled.themes,
        tokens: compiled.tokens,
        // Scope → wired axes (was a bare scope-name array; the scope names
        // remain reachable as this record's keys).
        components: compiled.components,
        // Scope → the vendor-named API surface, for tooling and the
        // conformance matrix's generated rows (issue #179).
        ...(compiled.componentApi ? { api: compiled.componentApi } : {}),
        // Scope → the ecosystem package that owns it. A TOP-LEVEL key rather
        // than a field on each component's axis entry: `componentAxes` holds
        // what a recipe WIRES, and an owning package is not an axis fact.
        // Without it a consumer reading this file — the app-side tooling
        // included — cannot tell which scopes are foreign or who ships them.
        ...(compiled.externalScopes && Object.keys(compiled.externalScopes).length > 0
            ? { externalScopes: compiled.externalScopes }
            : {}),
    };
}

/**
 * `report` is a parameter rather than something built here because
 * `buildReport` needs the authoring input and the anatomy manifest, neither of
 * which survives into `CompiledDesignSystem`. Optional, so a caller that wants
 * no coverage report keeps working unchanged; every other artifact is written
 * either way. `audit` likewise: the audit result becomes `audit.json` (its
 * summary already sits in the report, when both were built together).
 */
export async function writeArtifacts(
    compiled: CompiledDesignSystem,
    outDir: string,
    report?: DesignSystemReport,
    audit?: AuditResult,
): Promise<string[]> {
    const cssDir = join(outDir, 'css');
    const componentsDir = join(cssDir, 'components');
    await mkdir(componentsDir, { recursive: true });

    const written: string[] = [];
    const write = async (path: string, content: string) => {
        await writeFile(path, content.endsWith('\n') ? content : content + '\n');
        written.push(path);
    };

    const manifest = buildDsManifest(compiled);
    // Self-validation: a manifest the schema rejects fails the build that
    // PRODUCES it, not the app that reads it. JSON-roundtripped first so the
    // thing validated is byte-for-byte the thing written.
    const emitted: unknown = JSON.parse(JSON.stringify(manifest));
    const validate = manifestValidator();
    if (!validate(emitted)) {
        const details = validate.errors
            ?.map((e) => `  ${e.instancePath || '(root)'} ${e.message ?? ''}`)
            .join('\n');
        throw new Error(
            `[zero-kit] the compiled manifest for "${compiled.name}" does not validate against `
            + `ds-manifest.schema.json — refusing to write it:\n${details}`,
        );
    }

    await write(join(cssDir, 'tokens.css'), compiled.tokensCss);
    for (const [scope, css] of Object.entries(compiled.componentCss)) {
        // Backstop for direct callers: every pipeline entry (zero's registry,
        // `mergeManifests`) already enforces this grammar, but `writeArtifacts`
        // is public API and `join(dir, '../../escape.css')` walks wherever it
        // is pointed. The scope IS the filename, so the grammar is the guard.
        if (!TOKEN_KEY_PATTERN.test(scope)) {
            throw new Error(
                `[zero-kit] compiled scope "${scope}" is not a kebab-case identifier — it becomes the css/components/<scope>.css filename, so anything else could escape the output directory`,
            );
        }
        await write(join(componentsDir, `${scope}.css`), css);
    }
    await write(join(cssDir, 'index.css'), compiled.indexCss);
    await write(join(outDir, 'manifest.json'), JSON.stringify(emitted, null, 2));
    await write(join(outDir, 'register.d.ts'), compileRegisterDts(compiled));
    await write(join(outDir, 'register.js'), compileRegisterJs(compiled));
    if (compiled.componentApi) {
        await write(join(outDir, 'components.d.ts'), compileComponentsDts(compiled));
        await write(join(outDir, 'components.js'), compileComponentsJs(compiled));
    }
    if (report) await write(join(outDir, 'report.json'), JSON.stringify(report, null, 2));
    if (audit) await write(join(outDir, 'audit.json'), JSON.stringify(buildAuditArtifact(audit), null, 2));
    return written;
}
