/** `sigx zero:validate` — check a design system against the anatomy manifest. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { ZeroManifest } from '../contract.js';
import type { DesignSystemInput } from '../design-system.js';
import { compileDesignSystem } from '../design-system.js';
import type { DesignSystemReport } from '../resolve/report.js';
import { buildReport, formatReport } from '../resolve/report.js';
import { diffReports, formatReportDiff } from '../resolve/report-diff.js';
import { auditDesignSystem } from '../audit/index.js';
import { iterationEntryFrom } from '../resolve/iteration.js';
import type { ValidationResult } from '../resolve/validate.js';
import type { CommandEnv } from './shared.js';
import { ecosystemOptionsFrom, loadInputs } from './shared.js';
import { recordIteration, resolveIterationLogPath } from './iteration-log.js';

export interface ValidateOptions {
    entry: string;
    manifest?: string;
    /** Ecosystem manifest fragments to merge into the base manifest. */
    extraManifest?: string[];
    /** Adopt dependencies that declare a `"sigx-zero"` field. */
    ecosystem?: boolean;
    /** Package names to leave out of that adoption. */
    ecosystemExclude?: string[];
    /** Treat warnings as failures. */
    strict: boolean;
    /** Print the human-readable coverage report. */
    report?: boolean;
    /** Write the machine-readable report here; `-` means stdout. */
    reportJson?: string;
    /** An earlier `report.json` to print the changes against. */
    diff?: string;
    /** Append this run to an iteration log (JSONL); `ZERO_ITERATION_LOG` is the environment spelling. */
    log?: string;
}

/** The top-level sections `diffReports` reads — a file without them is not a report. */
const REPORT_SECTIONS = ['name', 'score', 'coverage', 'components', 'unwired', 'themes'] as const;

/**
 * The earlier report for `--diff`. Every way this can go wrong names the
 * path: a missing file, unreadable JSON, or something that is not a report —
 * a silent skip here would make "no change" indistinguishable from "did not
 * compare".
 */
async function readPreviousReport(env: CommandEnv, spec: string): Promise<DesignSystemReport> {
    const path = resolve(env.cwd, spec);
    let text: string;
    try {
        text = await readFile(path, 'utf8');
    } catch (err) {
        throw new Error(`--diff: cannot read "${path}": ${(err as Error).message}`);
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch (err) {
        throw new Error(`--diff: "${path}" is not JSON: ${(err as Error).message}`);
    }
    if (typeof parsed !== 'object' || parsed === null || typeof (parsed as { reportVersion?: unknown }).reportVersion !== 'number') {
        throw new Error(`--diff: "${path}" is not a coverage report (no numeric reportVersion)`);
    }
    // The sections the diff reads. Checked by name so a stray JSON file that
    // happens to carry a `reportVersion` fails here, naming the path, rather
    // than deep inside `diffReports` on an undefined field.
    const missing = REPORT_SECTIONS.filter((key) => !(key in (parsed as Record<string, unknown>)));
    if (missing.length > 0) {
        throw new Error(`--diff: "${path}" is not a coverage report (missing ${missing.join(', ')})`);
    }
    return parsed as DesignSystemReport;
}

/**
 * The report, or `undefined` when the design system does not compile.
 *
 * Only the COMPILE is guarded, and only when validation already failed. Those
 * are the two halves of the one case worth swallowing: `validateDesignSystem`
 * compiles inside its own try/catch and records the throw as an error on
 * `recipes`, so re-throwing it here would make `--report` fail differently
 * from plain `zero:validate` on the same input.
 *
 * Everything else propagates. A compile that throws while `result.ok` is true
 * contradicts the validator and is a bug in one of them; and `buildReport`
 * itself sits outside the `try` entirely, so a bug there always surfaces —
 * including for a design system that fails validation, which is exactly when
 * its report matters most.
 *
 * The audit runs here too, on the same compile, and only for the report's
 * sake: its summary is a section of the report and its score the sixth
 * criterion, and `runStandardBuild` does the same — so `--report` and
 * `dist/report.json` are the same document and `--diff dist/report.json`
 * compares like with like. The findings themselves are `zero:audit`'s to
 * print.
 */
export function reportFor(
    ds: DesignSystemInput,
    manifest: ZeroManifest,
    result: ValidationResult,
): DesignSystemReport | undefined {
    let compiled;
    try {
        compiled = compileDesignSystem(ds, manifest);
    } catch (err) {
        if (result.ok) throw err;
        return undefined;
    }
    return buildReport(compiled, ds, manifest, result, auditDesignSystem(ds, manifest, { compiled }));
}

export async function runValidate(env: CommandEnv, opts: ValidateOptions): Promise<void> {
    // The log times the whole answer — load, validate, report — because that
    // is what an author waits for between edits, so the clock starts before
    // anything runs. Only the path is decided here (flag beats environment,
    // resolved against cwd); whether it can be written is found out at the
    // append, after the work, and a failure there warns rather than fails —
    // a validate run does not answer for its own bookkeeping.
    const started = performance.now();
    const logPath = resolveIterationLogPath(env.cwd, opts.log, process.env);

    const { ds, manifest, result } = await loadInputs(
        env,
        opts.entry,
        opts.manifest,
        opts.extraManifest ?? [],
        ecosystemOptionsFrom(env, opts),
    );

    // `--report-json -` makes stdout the JSON and nothing else, so it can be
    // piped straight into a tool. The CLI logger's `log` goes to stdout (its
    // `warn`/`error` go to stderr, so diagnostics are unaffected), which means
    // every other `log` in this command has to fall silent — the exit code is
    // what carries pass/fail to a pipeline anyway.
    const stdoutIsJson = opts.reportJson === '-';

    // Emitted BEFORE the pass/fail decision, deliberately: a design system that
    // fails validation is exactly the one whose coverage is worth reading, and
    // that loop — generate, validate, see what is still uncovered, fix — is what
    // the report exists for (docs/architecture.md, "The authoring surface").
    // Read before anything is printed, so a bad --diff path fails the run
    // outright instead of after a report the caller may have already acted on.
    const previous = opts.diff ? await readPreviousReport(env, opts.diff) : undefined;

    // The log wants the score too, so it is one more reason to build the
    // report. Kept outside the block so the entry below can read it.
    let report: DesignSystemReport | undefined;
    if (opts.report || opts.reportJson || previous || logPath) {
        // `validateDesignSystem` compiles too, but discards the result behind
        // its own try/catch. Compiling again keeps that seam untouched and costs
        // nothing measurable. `undefined` here means only one thing — the design
        // system does not compile, which `result` already says.
        report = reportFor(ds, manifest, result);
        if (report) {
            if (opts.report && !stdoutIsJson) for (const line of formatReport(report)) env.logger.log(line);
            if (opts.reportJson) {
                // Never through the logger: it prefixes every line with
                // `[sigx] `, which would leave the JSON unparseable.
                const json = JSON.stringify(report, null, 2);
                if (stdoutIsJson) {
                    process.stdout.write(`${json}\n`);
                } else {
                    // Parents created, like `zero:build --out` does: a report
                    // path is usually somewhere that doesn't exist yet
                    // (`--report-json reports/basic.json`), and failing on that
                    // would be a worse answer than making the directory.
                    const path = resolve(env.cwd, opts.reportJson);
                    await mkdir(dirname(path), { recursive: true });
                    await writeFile(path, `${json}\n`);
                }
            }
            // After the report and before the verdict: "what moved" reads best
            // right under "where it stands". Silent under `--report-json -`
            // like everything else; the JSON pipeline has both files anyway.
            if (previous && !stdoutIsJson) {
                for (const line of formatReportDiff(diffReports(previous, report))) env.logger.log(line);
            }
        } else if (previous && !stdoutIsJson) {
            env.logger.warn('--diff skipped: the design system does not compile, so there is no current report to compare');
        }
    }

    // Appended BEFORE the verdict, like the report: a failing run is exactly
    // the one the log is for. One line for this run only — the earlier lines
    // are in the file, and the `(was …)` beside each count is the trend. A
    // log that cannot be written warns and steps aside: the verdict below is
    // the run's answer, and bookkeeping never gets to replace it.
    if (logPath) {
        const entry = iterationEntryFrom({ name: ds.name, result, report, ms: performance.now() - started });
        const line = await recordIteration(env.logger, logPath, entry);
        if (line && !stdoutIsJson) env.logger.log(line);
    }

    const counts = `${result.errors.length} errors, ${result.warnings.length} warnings`;
    if (!result.ok || (opts.strict && result.warnings.length > 0)) {
        throw new Error(`"${ds.name}" FAILED validation (${counts})`);
    }
    if (!stdoutIsJson) env.logger.log(`"${ds.name}" is valid (${result.warnings.length} warnings)`);
}
