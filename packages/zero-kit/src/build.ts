/**
 * The standard design-system build — `@sigx/zero-kit/build`.
 *
 * Every shipped design system runs the same pipeline: merge any ecosystem
 * fragments, validate, refuse to emit from an invalid source, compile, build
 * the coverage report, write the artifacts. Six build.mjs files carried that
 * pipeline byte-identically (five of them literally so); it lives once here,
 * and the `sigx zero:build` command calls the same function — one derivation
 * of "what a build is", however it is invoked.
 *
 * Node-only (writes to disk). The authoring surface a browser-graph module
 * may import lives at `@sigx/zero-kit/define`.
 */
import type { ZeroManifest } from './contract.js';
import type { DesignSystemInput } from './design-system.js';
import { compileDesignSystem } from './design-system.js';
import type { CompiledDesignSystem } from './design-system.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ManifestFragment } from './manifest.js';
import { attributeFindings, mergeManifests, packagesByScope, whereWithOwner } from './manifest.js';
import type { EcosystemOptions } from './discover.js';
import { nearestPackageDir, resolveEcosystem } from './discover.js';
import type { ValidationResult } from './resolve/validate.js';
import { validateDesignSystem } from './resolve/validate.js';
import { buildReport } from './resolve/report.js';
import { buildDsManifest, writeArtifacts } from './artifacts.js';
import { auditDesignSystem } from './audit/index.js';
import type { AuditResult } from './audit/index.js';
export { AUDIT_SCHEMA_URL, auditDesignSystem, buildAuditArtifact, formatAudit } from './audit/index.js';
export { ECOSYSTEM_ENV, ECOSYSTEM_FIELD, declarationFor, discoverEcosystem, exportedSubpath, installedPackageDir, nearestPackageDir, packFromModule, resolveEcosystem, satisfiesKitRange, selectDependencies, selfDeclaration, zeroKitVersion } from './discover.js';
export type { EcosystemDeclaration, EcosystemLogger, EcosystemOptions, EcosystemPack, ResolvedEcosystem, ResolveEcosystemInput } from './discover.js';
export type { AuditArtifact, AuditFinding, AuditOptions, AuditResult, AuditRuleId } from './audit/index.js';
import type { CompiledLynxTarget } from './targets/lynx/compile.js';
import { compileDesignSystemLynx, writeLynxArtifacts } from './targets/lynx/compile.js';
import { LynxRuntimePropertyError } from './targets/lynx/capabilities.js';

/** The logging surface the build reports through — `console` by default. */
export interface StandardBuildLogger {
    log(message: string): void;
    warn(message: string): void;
    error(message: string): void;
}

/**
 * The emit targets a design-system build can produce. `web` is the CSS every
 * DS has always shipped; `lynx` is the class-grammar target for platforms
 * without attribute selectors (compiled into `dist/lynx/`, landing across the
 * #348 campaign).
 */
export const BUILD_TARGETS = ['web', 'lynx'] as const;
export type BuildTarget = typeof BUILD_TARGETS[number];

export interface StandardBuildOptions {
    designSystem: DesignSystemInput;
    /**
     * The anatomy manifest to build against. The caller supplies it (usually
     * `{ components: Object.values(anatomies).map((a) => a.toJSON()) }` from
     * `@sigx/zero/anatomy`) — the kit deliberately has no runtime dependency
     * on zero, so it cannot default this.
     */
    manifest: Pick<ZeroManifest, 'components'>;
    /**
     * Ecosystem manifest fragments to merge in (merged, never replacing).
     * zero-basic passes `@sigx/zero-ext-example/fragment` here; the recipe
     * pack that goes with a fragment is composed into
     * `designSystem.recipes` by the caller — spread order is precedence.
     */
    fragments?: readonly ManifestFragment[];
    /**
     * Adopt ecosystem component packages automatically — every dependency
     * declaring a `"sigx-zero"` field contributes its manifest fragment and
     * its recipe pack (see `discover.ts`). An object narrows the search or
     * makes a failing pack fatal; `false` turns it off, as does
     * `ZERO_ECOSYSTEM=0` for a single run.
     *
     * **Default `true`.** A dependency that declares the field is saying it
     * ships a zero component; a design system that installed it is the one
     * asking for that. Explicit `fragments` above are merged first and always
     * win a scope collision.
     */
    ecosystem?: boolean | EcosystemOptions;
    /** Absolute output directory (the package's `dist`). */
    outDir: string;
    /**
     * Which targets to emit. Defaults to `['web']` — every existing build.mjs
     * keeps producing exactly what it always has. A skin opts into the lynx
     * target with `targets: ['web', 'lynx']` once the lynx emitters land.
     */
    targets?: readonly BuildTarget[];
    /**
     * Run the audit (`auditDesignSystem`, #403) after the compile and before
     * the report, which folds its summary in and scores it: its
     * findings are written as `dist/audit.json`, its summary lands in
     * `report.json` under `audit` and feeds the score's sixth criterion,
     * and every error-severity finding is logged as a warning. The build
     * never fails on a finding — `sigx zero:audit` is where the exit code
     * lives. Default `true`; `false` skips all of it.
     */
    audit?: boolean;
    logger?: StandardBuildLogger;
}

export interface StandardBuildResult {
    result: ValidationResult;
    /** Every artifact path written. */
    written: string[];
}

/**
 * validate → compile → audit → buildReport → writeArtifacts, with uniform
 * issue printing. Throws — after printing every issue — when validation fails:
 * nothing is ever emitted from an invalid source, and a rejected promise is
 * what fails a build script and the CLI alike.
 */
export async function runStandardBuild(options: StandardBuildOptions): Promise<StandardBuildResult> {
    const { designSystem: authored, fragments = [], outDir, targets = ['web'] } = options;
    const logger = options.logger ?? console;

    // Unknown names are misconfiguration, not future-proofing — fail before
    // validating anything else so the message is unmissable.
    for (const target of targets) {
        if (!BUILD_TARGETS.includes(target)) {
            throw new Error(
                `[zero-kit] unknown build target "${target as string}" — known targets: ${BUILD_TARGETS.join(', ')}`,
            );
        }
    }
    if (!targets.includes('web')) {
        // Every non-web target is emitted BESIDE the web artifacts (register
        // d.ts, manifest and report all describe the one compiled DS), not
        // instead of them.
        throw new Error('[zero-kit] the "web" target is not optional — pass targets: [\'web\', …]');
    }
    const explicit = fragments.length > 0
        ? mergeManifests(options.manifest, ...fragments)
        : options.manifest;
    // Discovery runs after the explicit fragments so a hand-passed one wins a
    // scope collision, and through the same helper the CLI's validate/audit
    // path uses — one derivation of "which components exist here".
    // The resolved design system carries every adopted pack's recipes, fitted
    // to this vocabulary; `authored` is what the package itself wrote.
    const { manifest, designSystem: ds, contributed } = await resolveEcosystem({
        manifest: explicit,
        designSystem: authored,
        ecosystem: options.ecosystem ?? true,
        defaultCwd: outDir,
        logger,
    });

    // Whose scope is whose, for every diagnostic printed or written below.
    const owners = packagesByScope(manifest);

    const result = validateDesignSystem(ds, manifest);
    attributeFindings([...result.errors, ...result.warnings], owners);
    for (const issue of [...result.errors, ...result.warnings]) {
        logger[issue.level === 'error' ? 'error' : 'warn'](
            `[${issue.level}] ${whereWithOwner(issue)}: ${issue.message}`,
        );
    }
    if (!result.ok) {
        throw new Error(`[zero-kit] "${ds.name}" failed validation (${result.errors.length} errors) — nothing written`);
    }

    const compiled = compileDesignSystem(ds, manifest);
    // The audit reuses the compile and runs BEFORE the report, because the
    // report folds the audit's summary in and scores it. It is quality, not
    // correctness: findings are surfaced, written and scored, never fatal.
    let audit: AuditResult | undefined;
    if (options.audit !== false) {
        audit = auditDesignSystem(ds, manifest, { compiled });
        attributeFindings(audit.findings, owners);
        const { errors, warnings, info } = audit.summary;
        logger.log(
            `[${ds.name}] audit: ${errors} error(s), ${warnings} warning(s), ${info} info`
            + (errors + warnings > 0 ? ' — see audit.json, or run `sigx zero:audit`' : ''),
        );
        for (const finding of audit.findings) {
            if (finding.severity === 'error') {
                logger.warn(`[${ds.name}] audit ${finding.rule}: ${whereWithOwner(finding)} — ${finding.message}`);
            }
        }
    }
    // Under api mode the generated ./components module imports each external
    // scope from its owning package by name. A package the design system does
    // not itself depend on is one a CONSUMER cannot install: the import
    // resolves here, where both are in the same workspace, and nowhere else.
    if (compiled.componentApi) warnUninstallableApiImports(compiled, outDir, logger);

    // The coverage report is built here rather than inside writeArtifacts: it
    // needs the authoring input and the anatomy manifest, neither of which
    // survives into CompiledDesignSystem.
    const report = buildReport(compiled, ds, manifest, result, audit);

    // The lynx target compiles BEFORE the web artifacts are written: its
    // capability findings belong in the same report.json, and a lynx reject
    // (a recipe depending on a web-runtime mechanism) must fail the build
    // before anything lands on disk — same all-or-nothing rule validation has.
    let lynx: CompiledLynxTarget | undefined;
    if (targets.includes('lynx')) {
        // A DISCOVERED pack's recipe that the lynx emitter rejects — a
        // reference to `var(--press-x)` and friends, properties zero itself
        // publishes for web press feedback — would otherwise fail a build the
        // design system's author did not cause, over a recipe they did not
        // write. Drop that scope from the lynx target instead: a scope with no
        // lynx CSS is the documented unstyled-but-accessible fallback, while a
        // failed build is nothing. First-party recipes keep throwing.
        const webOnly = lynxIncapable(ds, manifest, contributed, logger);
        const excluded = new Set(webOnly.map((w) => w.scope));
        const lynxDs = excluded.size > 0
            ? { ...ds, recipes: ds.recipes.filter((r) => !excluded.has(r.component)) }
            : ds;
        lynx = compileDesignSystemLynx(lynxDs, manifest);
        attributeFindings(lynx.report.translated, owners);
        attributeFindings(lynx.report.dropped, owners);
        report.lynx = {
            translated: lynx.report.translated,
            dropped: lynx.report.dropped,
            ...(webOnly.length > 0 ? { webOnly } : {}),
        };
        if (lynx.report.dropped.length > 0) {
            logger.warn(
                `[${ds.name}] lynx target: ${lynx.report.dropped.length} declaration(s) dropped `
                + `(see report.json under "lynx" for the list and per-entry guidance)`,
            );
        }
    }

    const written = await writeArtifacts(compiled, outDir, report, audit);
    if (lynx) {
        written.push(...await writeLynxArtifacts(compiled, lynx, buildDsManifest(compiled), outDir));
    }
    logger.log(`[${ds.name}] built ${written.length} artifacts`);
    return { result, written };
}

/**
 * Which discovered pack scopes the lynx emitter refuses, compiled one recipe
 * at a time so the rejection can be attributed. Only pack recipes are probed:
 * a first-party recipe that cannot cross to lynx is the design system author's
 * own bug, and must keep failing the build.
 */
function lynxIncapable(
    ds: DesignSystemInput,
    manifest: Pick<ZeroManifest, 'components'>,
    contributed: Record<string, string>,
    logger: StandardBuildLogger,
): { scope: string; package: string; reason: string }[] {
    // `contributed` names the scopes a pack's recipe actually styles, not the
    // scopes its fragment declares. The two differ exactly where it matters:
    // when the design system writes its own recipe for a pack-declared scope,
    // the pack's is dropped and the authored one must keep failing the build
    // rather than being degraded on the pack's behalf.
    if (Object.keys(contributed).length === 0) return [];

    const webOnly: { scope: string; package: string; reason: string }[] = [];
    for (const recipe of ds.recipes) {
        if (!Object.hasOwn(contributed, recipe.component)) continue;
        const from = contributed[recipe.component]!;
        try {
            compileDesignSystemLynx({ ...ds, recipes: [recipe] }, manifest);
        } catch (err) {
            // The probe answers ONE question: does this recipe reference a
            // web-runtime property? Nothing else it reports is authoritative,
            // because it compiles a partial stylesheet — tokens plus this one
            // component — and the whole-index assertions (dangling vars, calc
            // var chains) can fail on a recipe that reads a custom property
            // another component's lynx CSS defines. So any other rejection is
            // left for the real compile below, which sees the whole thing and
            // fails the build with the accurate message.
            if (!(err instanceof LynxRuntimePropertyError)) continue;
            webOnly.push({ scope: recipe.component, package: from, reason: err.message });
            logger.error(
                `[${ds.name}] ecosystem: ${from}'s "${recipe.component}" is web-only — `
                + `excluded from the lynx target (${err.message})`,
            );
        }
    }
    return webOnly;
}

/**
 * Warn when api mode would emit an import a consumer cannot resolve.
 *
 * `components.js` re-exports an ecosystem scope's component from the package
 * that owns it, and `components.d.ts` imports its type. Both ship, so the
 * owning package has to be one consumers get — a `dependency` or a
 * `peerDependency` of the design system, not merely something present in the
 * author's workspace.
 *
 * A warning rather than an error: it is a packaging fact this build cannot
 * verify (a monorepo may well be building both), and the in-repo pairing of
 * two private packages is a legitimate use of exactly this shape.
 */
function warnUninstallableApiImports(
    compiled: CompiledDesignSystem,
    outDir: string,
    logger: StandardBuildLogger,
): void {
    const owners = new Set(Object.values(compiled.externalScopes ?? {}));
    if (owners.size === 0) return;

    let pkg: Record<string, unknown>;
    try {
        pkg = JSON.parse(readFileSync(join(nearestPackageDir(outDir), 'package.json'), 'utf8')) as Record<string, unknown>;
    } catch {
        return; // No package.json to check against — say nothing rather than guess.
    }
    const shipped = new Set([
        ...Object.keys((pkg['dependencies'] as Record<string, string> | undefined) ?? {}),
        ...Object.keys((pkg['peerDependencies'] as Record<string, string> | undefined) ?? {}),
    ]);

    for (const owner of [...owners].sort()) {
        if (shipped.has(owner)) continue;
        logger.warn(
            `[${compiled.name}] api mode emits "export { … } from '${owner}'" into components.js and a matching`
            + ` "import type" into components.d.ts, but ${owner} is not a dependency or peerDependency of this`
            + ' design system — a consumer installing it resolves neither',
        );
    }
}
