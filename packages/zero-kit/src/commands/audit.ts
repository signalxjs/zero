/**
 * `sigx zero:audit` — does what the design system built say what it claims?
 *
 * `auditDesignSystem` never throws on a finding, and `runStandardBuild`
 * never fails on one: a design system mid-iteration must be able to read its
 * own audit and still get artifacts to look at in a browser. This command is
 * where the exit code lives — error findings fail the run, warnings fail it
 * under `--strict`, `info` (the contrast matrix's `unmeasured` cells, once
 * that slice lands) never does.
 *
 * Split in two so the part after loading is testable in-process: `runAudit`
 * loads the entry and the manifest the way `zero:validate` does (printing
 * validation issues on the way — a finding is more useful with its
 * validation context than without), and `auditInputs` does the rest.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { auditDesignSystem, buildAuditArtifact, formatAudit } from '../audit/index.js';
import { attributeFindings, packagesByScope } from '../manifest.js';
import type { AuditRuleId } from '../audit/index.js';
import { compileDesignSystem } from '../design-system.js';
import type { CommandEnv, LoadedInputs } from './shared.js';
import { ecosystemOptionsFrom, loadInputs } from './shared.js';

export interface AuditCommandOptions {
    entry: string;
    manifest?: string;
    /** Ecosystem manifest fragments to merge into the base manifest. */
    extraManifest?: string[];
    /** Adopt dependencies that declare a `"sigx-zero"` field. */
    ecosystem?: boolean;
    /** Package names to leave out of that adoption. */
    ecosystemExclude?: string[];
    /** Treat warning findings as failures too. */
    strict: boolean;
    /** Run only these rules (repeatable); default every rule. */
    rule?: string[];
    /** Write the audit artifact here; `-` means stdout. */
    json?: string;
}

export async function runAudit(env: CommandEnv, opts: AuditCommandOptions): Promise<void> {
    const inputs = await loadInputs(
        env,
        opts.entry,
        opts.manifest,
        opts.extraManifest ?? [],
        ecosystemOptionsFrom(env, opts),
    );
    await auditInputs(env, inputs, opts);
}

/** Everything after loading: compile, audit, print, write, decide. */
export async function auditInputs(
    env: CommandEnv,
    { ds, manifest, result }: LoadedInputs,
    opts: Pick<AuditCommandOptions, 'strict' | 'rule' | 'json'>,
): Promise<void> {
    // The audit reads compiled CSS, so a design system that does not compile
    // has nothing to audit. `validateDesignSystem` already turned that throw
    // into an error on `recipes` and `loadInputs` printed it; say so in the
    // validator's words rather than as a raw compiler stack.
    let compiled;
    try {
        compiled = compileDesignSystem(ds, manifest);
    } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        throw new Error(
            `"${ds.name}" does not compile, so it cannot be audited — fix validation first `
            + `(${result.errors.length} errors): ${detail}`,
        );
    }

    // An unknown rule name is refused by `auditDesignSystem` with the list of
    // known ones; the string[] from the CLI is narrowed there, not here.
    const rules = opts.rule && opts.rule.length > 0 ? (opts.rule as AuditRuleId[]) : undefined;
    const audit = auditDesignSystem(ds, manifest, { compiled, ...(rules ? { rules } : {}) });
    attributeFindings(audit.findings, packagesByScope(manifest));

    // `--json -` makes stdout the artifact and nothing else — the same rule
    // `zero:validate --report-json -` follows, for the same pipe.
    const stdoutIsJson = opts.json === '-';
    if (!stdoutIsJson) for (const line of formatAudit(audit)) env.logger.log(line);
    if (opts.json) {
        const json = JSON.stringify(buildAuditArtifact(audit), null, 2);
        if (stdoutIsJson) {
            process.stdout.write(`${json}\n`);
        } else {
            const path = resolve(env.cwd, opts.json);
            await mkdir(dirname(path), { recursive: true });
            await writeFile(path, `${json}\n`);
        }
    }

    const { errors, warnings } = audit.summary;
    if (errors > 0 || (opts.strict && warnings > 0)) {
        throw new Error(`"${ds.name}" FAILED audit (${errors} errors, ${warnings} warnings)`);
    }
    // A design system that compiles but fails validation gets its audit
    // printed (that is the mid-iteration value) and still exits non-zero:
    // "passed audit" on an invalid source would be a misleading exit code
    // for a script, and `zero:build` refuses such a source outright.
    if (!result.ok) {
        throw new Error(
            `"${ds.name}" passed audit (${warnings} warnings) but FAILED validation `
            + `(${result.errors.length} errors) — the audit is advisory until it validates`,
        );
    }
    if (!stdoutIsJson) env.logger.log(`"${ds.name}" passed audit (${warnings} warnings)`);
}
