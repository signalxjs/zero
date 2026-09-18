/**
 * The audit as an ARTIFACT (#403, slice B): `runStandardBuild` runs it after
 * the compile and before the report, writes `dist/audit.json`, folds its
 * summary into `report.json` under `audit`, and hands its score to the
 * report's sixth criterion — and the build never fails on a finding. `zero:validate
 * --report` produces the same report through `reportFor`, so a
 * `--diff dist/report.json` compares like with like.
 *
 * Red-first (#403): `audit.json` was asserted present before `writeArtifacts`
 * knew how to write it, and the `criteria.audit` assertion before
 * `buildReport` took an audit.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { anatomies } from '@sigx/zero/anatomy';
import {
    AUDIT_SCHEMA_URL,
    auditDesignSystem,
    buildReport,
    compileDesignSystem,
    validateDesignSystem,
} from '@sigx/zero-kit';
import type { DesignSystemInput, DesignSystemReport, ManifestComponent, ZeroManifest } from '@sigx/zero-kit';
import { runStandardBuild } from '@sigx/zero-kit/build';
import { designSystem as basicDS } from '@sigx/zero-basic';
import { reportFor } from '../src/commands/validate.js';

const manifest = {
    components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[],
} as ZeroManifest;

const tempDirs: string[] = [];
const tempDir = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'zero-kit-audit-artifacts-'));
    tempDirs.push(dir);
    return dir;
};
afterAll(() => {
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

const collect = () => {
    const lines = { log: [] as string[], warn: [] as string[], error: [] as string[] };
    return {
        lines,
        logger: {
            log: (m: string) => { lines.log.push(m); },
            warn: (m: string) => { lines.warn.push(m); },
            error: (m: string) => { lines.error.push(m); },
        },
    };
};

type AuditArtifact = { $schema: string; auditVersion: number; name: string; findings: { rule: string }[]; summary: { errors: number; warnings: number; info: number; byRule: Record<string, number> } };

/** The #213 shape: a real `<button>` part with no `appearance` reset, and a state-blind tooltip trigger. */
const failingDS: DesignSystemInput = {
    name: 'unreset',
    tokens: {
        roles: { primary: {} },
        defaultLight: 'day',
        themes: {
            day: {
                colorScheme: 'light',
                colors: {
                    'base-100': '#ffffff', 'base-200': '#f2f2f2', 'base-300': '#e5e5e5',
                    'base-content': '#111111', primary: '#422ad5', 'primary-content': '#ffffff',
                },
            },
        },
    },
    recipes: [{
        component: 'tooltip',
        parts: { trigger: { base: { padding: '1rem' }, states: { open: {}, closed: {} } }, popup: { base: { padding: '1rem' } } },
    }],
};

describe('runStandardBuild writes the audit', () => {
    it('emits dist/audit.json beside report.json, folded into the report and its score', async () => {
        const outDir = tempDir();
        const { lines, logger } = collect();
        const { written } = await runStandardBuild({ designSystem: basicDS as DesignSystemInput, manifest, outDir, logger });
        expect(written.some((p) => p.endsWith('audit.json'))).toBe(true);

        const audit = JSON.parse(readFileSync(join(outDir, 'audit.json'), 'utf8')) as AuditArtifact;
        expect(audit.$schema).toBe(AUDIT_SCHEMA_URL);
        expect(audit.auditVersion).toBe(1);
        expect(audit.name).toBe('basic');
        expect(audit.summary.errors).toBe(0);

        const report = JSON.parse(readFileSync(join(outDir, 'report.json'), 'utf8')) as DesignSystemReport;
        expect(report.audit).toEqual({ auditVersion: 1, ...audit.summary });
        expect(report.score.criteria.audit).toBeDefined();
        expect(report.score.criteria.audit?.detail).toEqual({
            errors: audit.summary.errors, warnings: audit.summary.warnings, info: audit.summary.info,
        });
        // One summary line, no per-finding warnings for a clean skin.
        expect(lines.log.some((l) => /audit: 0 error/.test(l))).toBe(true);
        expect(lines.warn.filter((l) => l.includes('audit '))).toEqual([]);
    });

    it('does not fail the build on findings — it warns, writes them, and scores them', async () => {
        const outDir = tempDir();
        const { lines, logger } = collect();
        await expect(runStandardBuild({ designSystem: failingDS, manifest, outDir, logger })).resolves.toBeDefined();

        const audit = JSON.parse(readFileSync(join(outDir, 'audit.json'), 'utf8')) as AuditArtifact;
        expect(audit.summary.errors).toBeGreaterThan(0);
        expect(audit.findings.map((f) => f.rule)).toContain('button-affordance');
        // Every error-severity finding reaches the log as a warning naming its rule.
        expect(lines.warn.some((l) => l.includes('audit button-affordance'))).toBe(true);

        const report = JSON.parse(readFileSync(join(outDir, 'report.json'), 'utf8')) as DesignSystemReport;
        expect(report.audit?.errors).toBe(audit.summary.errors);
        expect(report.score.criteria.audit!.score).toBeLessThan(100);
        expect(report.score.criteria.audit!.score).toBe(Math.max(0, 100 - 10 * audit.summary.errors - 2 * audit.summary.warnings));
    });

    it('audit: false skips the artifact, the report section and the criterion', async () => {
        const outDir = tempDir();
        const { logger } = collect();
        const { written } = await runStandardBuild({ designSystem: basicDS as DesignSystemInput, manifest, outDir, logger, audit: false });
        expect(written.some((p) => p.endsWith('audit.json'))).toBe(false);
        expect(existsSync(join(outDir, 'audit.json'))).toBe(false);
        const report = JSON.parse(readFileSync(join(outDir, 'report.json'), 'utf8')) as DesignSystemReport;
        expect(report.audit).toBeUndefined();
        expect(report.score.criteria.audit).toBeUndefined();
    });
});

describe('the report takes the audit as an input', () => {
    const ds = basicDS as DesignSystemInput;
    const result = validateDesignSystem(ds, manifest);
    const compiled = compileDesignSystem(ds, manifest);
    const audit = auditDesignSystem(ds, manifest, { compiled });

    it('buildReport with an audit carries the section and the criterion; without, neither', () => {
        const withAudit = buildReport(compiled, ds, manifest, result, audit);
        expect(withAudit.audit).toEqual({ auditVersion: 1, ...audit.summary });
        expect(withAudit.score.criteria.audit?.weight).toBeGreaterThan(0);
        const without = buildReport(compiled, ds, manifest, result);
        expect(without.audit).toBeUndefined();
        expect(without.score.criteria.audit).toBeUndefined();
    });

    it('zero:validate --report builds the same report the build writes', async () => {
        const fromValidate = reportFor(ds, manifest, result);
        expect(fromValidate?.audit).toEqual({ auditVersion: 1, ...audit.summary });
        const outDir = tempDir();
        await runStandardBuild({ designSystem: ds, manifest, outDir, logger: collect().logger });
        const fromBuild = JSON.parse(readFileSync(join(outDir, 'report.json'), 'utf8')) as DesignSystemReport;
        expect(JSON.parse(JSON.stringify(fromValidate))).toEqual(fromBuild);
    });
});
