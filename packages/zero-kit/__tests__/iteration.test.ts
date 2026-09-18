/**
 * The iteration log (issue #426; docs/architecture.md, "The authoring surface").
 *
 * The skill calls the validate → fix loop "the point", and until now nothing
 * observed it. These tests pin the pure half: what one run records, and how a
 * sequence of runs reads back as a trend. The Node half (append/read, and the
 * flag-vs-environment resolution) is in `iteration-log.test.ts`.
 *
 * Fixtures are REAL: the entry for zero-basic is built from its actual
 * validation result and coverage report, so the counts the summariser prints
 * are the ones a run would print — not a shape this file invented.
 */
import { describe, expect, it } from 'vitest';
import {
    buildReport,
    compileDesignSystem,
    formatIterationLine,
    formatIterationLog,
    iterationEntryFrom,
    validateDesignSystem,
    whereFamily,
} from '@sigx/zero-kit';
import type { DesignSystemInput, IterationEntry, ManifestComponent, ValidationIssue } from '@sigx/zero-kit';
import { anatomies } from '@sigx/zero/anatomy';
import { designSystem as basicDS } from '@sigx/zero-basic';

const manifest = { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] };
const basic = basicDS as DesignSystemInput;

const issue = (level: 'error' | 'warning', where: string, rule?: string): ValidationIssue => ({
    level, where, message: 'm', ...(rule ? { rule } : {}),
});

const entry = (over: Partial<IterationEntry>): IterationEntry => ({
    ts: '2026-09-08T00:00:00.000Z', name: 'x', errors: 0, warnings: 0, top: [], ms: 1, ...over,
});

describe('iterationEntryFrom', () => {
    it('records zero-basic as it validates today: counts, score, and a timestamp', () => {
        const result = validateDesignSystem(basic, manifest);
        const report = buildReport(compileDesignSystem(basic, manifest), basic, manifest, result);
        const e = iterationEntryFrom({ name: basic.name, result, report, ms: 42.7, now: new Date('2026-09-08T12:00:00Z') });
        expect(e.ts).toBe('2026-09-08T12:00:00.000Z');
        expect(e.name).toBe('basic');
        expect(e.errors).toBe(result.errors.length);
        expect(e.warnings).toBe(result.warnings.length);
        expect(e.score).toEqual({ total: report.score.total, grade: report.score.grade });
        expect(e.ms).toBe(43); // whole milliseconds — a log line is not a benchmark
        expect(JSON.parse(JSON.stringify(e))).toEqual(e); // survives the JSONL round trip as-is
    });

    it('omits the score when there is no report (the design system did not compile)', () => {
        const result = { ok: false, errors: [issue('error', 'recipes')], warnings: [] };
        const e = iterationEntryFrom({ name: 'x', result, ms: 1 });
        expect(e.score).toBeUndefined();
        expect('score' in e).toBe(false);
    });

    it('groups the top offenders by rule id, falling back to the first two segments of `where`', () => {
        const result = {
            ok: false,
            errors: [
                issue('error', 'themes.dark', 'contrast-floor'),
                issue('error', 'themes.light', 'contrast-floor'),
                issue('error', 'recipes.button.parts.root'),
            ],
            warnings: [
                issue('warning', 'recipes.button.variants.size'),
                issue('warning', 'recipes.badge'),
                issue('warning', 'tokens.variants'),
            ],
        };
        const e = iterationEntryFrom({ name: 'x', result, ms: 1 });
        // count desc, then id asc — deterministic for a log line that is diffed by eye.
        expect(e.top).toEqual([
            { id: 'contrast-floor', count: 2 },
            { id: 'recipes.button', count: 2 },
            { id: 'recipes.badge', count: 1 },
            { id: 'tokens.variants', count: 1 },
        ]);
    });

    it('keeps at most five families', () => {
        const errors = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((w) => issue('error', `${w}.x`));
        const e = iterationEntryFrom({ name: 'x', result: { ok: false, errors, warnings: [] }, ms: 1 });
        expect(e.top).toHaveLength(5);
        expect(e.top.map((t) => t.id)).toEqual(['a.x', 'b.x', 'c.x', 'd.x', 'e.x']);
    });
});

describe('whereFamily', () => {
    it('takes the first two dot-segments, or the whole thing when there are fewer', () => {
        expect(whereFamily('recipes.button.parts.root.states.open')).toBe('recipes.button');
        expect(whereFamily('themes.dark')).toBe('themes.dark');
        expect(whereFamily('recipes')).toBe('recipes');
    });
});

describe('formatIterationLog', () => {
    it('reads a single run with no comparison', () => {
        const lines = formatIterationLog([
            entry({ errors: 3, warnings: 14, score: { total: 71.2, grade: 'C' }, top: [{ id: 'contrast-floor', count: 2 }, { id: 'recipes.button', count: 1 }] }),
        ]);
        expect(lines).toEqual([
            'iteration 1 — errors 3, warnings 14, score 71.2 → C; top: contrast-floor ×2, recipes.button ×1',
        ]);
    });

    it('compares every run against the one before it', () => {
        const runs: IterationEntry[] = [
            entry({ errors: 3, warnings: 14, score: { total: 71, grade: 'C' } }),
            entry({ errors: 2, warnings: 14, score: { total: 74, grade: 'C' } }),
            entry({ errors: 2, warnings: 9, score: { total: 80, grade: 'B' } }),
            entry({ errors: 1, warnings: 6, score: { total: 85, grade: 'B' } }),
            entry({ errors: 1, warnings: 4, score: { total: 88, grade: 'B' } }),
            entry({ errors: 0, warnings: 4, score: { total: 90, grade: 'A' } }),
            entry({ errors: 0, warnings: 3, score: { total: 92, grade: 'A' }, top: [{ id: 'contrast-floor', count: 2 }, { id: 'recipes.button', count: 1 }] }),
        ];
        const lines = formatIterationLog(runs);
        expect(lines).toHaveLength(7);
        expect(lines[0]).toBe('iteration 1 — errors 3, warnings 14, score 71 → C');
        expect(lines[2]).toBe('iteration 3 — errors 2 (was 2), warnings 9 (was 14), score 80 → B (was 74 C)');
        expect(lines[6]).toBe(
            'iteration 7 — errors 0 (was 0), warnings 3 (was 4), score 92 → A (was 90 A); top: contrast-floor ×2, recipes.button ×1',
        );
    });

    it('says when a run had no score, and compares across that gap honestly', () => {
        const lines = formatIterationLog([
            entry({ errors: 1, warnings: 0 }),
            entry({ errors: 0, warnings: 0, score: { total: 96.5, grade: 'A' } }),
        ]);
        expect(lines[0]).toBe('iteration 1 — errors 1, warnings 0, score n/a');
        expect(lines[1]).toBe('iteration 2 — errors 0 (was 1), warnings 0 (was 0), score 96.5 → A (was n/a)');
    });

    it('returns nothing for an empty log', () => {
        expect(formatIterationLog([])).toEqual([]);
    });

    it('is one line per entry — what the CLI prints for the current run from the previous entry alone', () => {
        // `runValidate` prints only the latest line, built from this run's
        // entry, its position, and the entry before it — so the whole-log
        // formatter must agree with the single-line one at every position.
        const runs: IterationEntry[] = [
            entry({ errors: 3, warnings: 14, score: { total: 71, grade: 'C' } }),
            entry({ errors: 0, warnings: 3, score: { total: 92, grade: 'A' }, top: [{ id: 'contrast-floor', count: 2 }] }),
        ];
        expect(formatIterationLine(runs[0]!, 1)).toBe(formatIterationLog(runs)[0]);
        expect(formatIterationLine(runs[1]!, 2, runs[0])).toBe(formatIterationLog(runs)[1]);
        expect(formatIterationLine(runs[1]!, 2, runs[0])).toBe(
            'iteration 2 — errors 0 (was 3), warnings 3 (was 14), score 92 → A (was 71 C); top: contrast-floor ×2',
        );
    });
});
