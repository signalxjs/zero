/**
 * The Node half of the iteration log (issue #426): where the file goes, and
 * the append/read round trip.
 *
 * `runValidate` itself is not reachable from this suite — `loadDesignSystem`
 * dynamic-imports the entry through vite's module runner, which cannot load a
 * file written outside the project (the same limit `report.test.ts` records).
 * So the command's two decisions are tested at the seam it makes them through:
 * `resolveIterationLogPath` (flag beats environment beats nothing) and
 * `appendIteration`/`readIterationLog`.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { IterationEntry } from '@sigx/zero-kit';
import { formatIterationLog } from '@sigx/zero-kit';
import { appendIteration, readIterationLog, recordIteration, resolveIterationLogPath } from '../src/commands/iteration-log.js';

const dirs: string[] = [];
const tempDir = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'zero-kit-iteration-'));
    dirs.push(dir);
    return dir;
};
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

const entry = (n: number): IterationEntry => ({
    ts: `2026-09-08T00:00:0${n}.000Z`, name: 'x', errors: n, warnings: 0, top: [], ms: 1,
});

describe('resolveIterationLogPath', () => {
    it('is off unless asked: no flag and no environment means no log', () => {
        expect(resolveIterationLogPath('/cwd', undefined, {})).toBeUndefined();
        expect(resolveIterationLogPath('/cwd', undefined, { ZERO_ITERATION_LOG: '' })).toBeUndefined();
    });

    it('honours ZERO_ITERATION_LOG, resolved against the command cwd', () => {
        expect(resolveIterationLogPath('/cwd', undefined, { ZERO_ITERATION_LOG: '.zero-iterations.jsonl' }))
            .toBe(resolve('/cwd', '.zero-iterations.jsonl'));
    });

    it('lets --log win over the environment', () => {
        expect(resolveIterationLogPath('/cwd', 'flag.jsonl', { ZERO_ITERATION_LOG: 'env.jsonl' }))
            .toBe(resolve('/cwd', 'flag.jsonl'));
    });

    it('lets an empty --log= switch the log OFF for this run, even with the environment set', () => {
        // "The flag wins" has to hold for the empty value too: `--log=` is the
        // one-run opt-out of ZERO_ITERATION_LOG, not a fall-through to it.
        expect(resolveIterationLogPath('/cwd', '', { ZERO_ITERATION_LOG: 'env.jsonl' })).toBeUndefined();
        expect(resolveIterationLogPath('/cwd', '   ', { ZERO_ITERATION_LOG: 'env.jsonl' })).toBeUndefined();
        expect(resolveIterationLogPath('/cwd', undefined, { ZERO_ITERATION_LOG: '  ' })).toBeUndefined();
    });
});

describe('appendIteration / readIterationLog', () => {
    it('creates the file and its parents, one JSON line per run', async () => {
        const path = join(tempDir(), 'nested', 'deeper', 'it.jsonl');
        await appendIteration(path, entry(1));
        await appendIteration(path, entry(2));
        const raw = readFileSync(path, 'utf8');
        const lines = raw.split('\n');
        expect(lines.at(-1)).toBe(''); // newline-terminated, so the next append starts a fresh line
        expect(lines.slice(0, -1)).toHaveLength(2);
        for (const line of lines.slice(0, -1)) expect(() => JSON.parse(line)).not.toThrow();
        expect(await readIterationLog(path)).toEqual([entry(1), entry(2)]);
    });

    it('reads an absent log as empty rather than throwing', async () => {
        const path = join(tempDir(), 'never-written.jsonl');
        expect(existsSync(path)).toBe(false);
        expect(await readIterationLog(path)).toEqual([]);
    });

    it('skips a trailing partial line — a run killed mid-write must not poison the next one', async () => {
        const path = join(tempDir(), 'it.jsonl');
        await appendIteration(path, entry(1));
        writeFileSync(path, `${readFileSync(path, 'utf8')}{"ts":"2026-09-08T00:00:02.000Z","name":"x","err`);
        expect(await readIterationLog(path)).toEqual([entry(1)]);
        // …and the next append lands on its own line, after the debris.
        await appendIteration(path, entry(3));
        expect(await readIterationLog(path)).toEqual([entry(1), entry(3)]);
    });

    it('skips a line that parses but is not an entry', async () => {
        const path = join(tempDir(), 'it.jsonl');
        writeFileSync(path, '{"not":"an entry"}\n[1,2]\n');
        await appendIteration(path, entry(1));
        expect(await readIterationLog(path)).toEqual([entry(1)]);
    });

    it('skips a line with the right keys but a malformed `top` or `score` — the formatter must never throw on what the reader let through', async () => {
        const path = join(tempDir(), 'it.jsonl');
        const base = { ts: '2026-09-08T00:00:00.000Z', name: 'x', errors: 0, warnings: 0, ms: 1 };
        writeFileSync(path, [
            JSON.stringify({ ...base, top: ['not-an-object'] }),
            JSON.stringify({ ...base, top: [{ id: 'x' }] }),                 // count missing
            JSON.stringify({ ...base, top: [{ id: 1, count: 1 }] }),         // id not a string
            JSON.stringify({ ...base, top: [], score: 'A' }),                // score not an object
            JSON.stringify({ ...base, top: [], score: { total: 90 } }),      // grade missing
            JSON.stringify({ ...base, top: [], score: { total: 90, grade: 'Z' } }),
            JSON.stringify({ ...base, top: [], score: null }),
        ].join('\n') + '\n');
        await appendIteration(path, entry(1));
        const entries = await readIterationLog(path);
        expect(entries).toEqual([entry(1)]);
        expect(() => formatIterationLog(entries)).not.toThrow();
    });
});

describe('recordIteration', () => {
    const stub = () => {
        const warnings: string[] = [];
        return { logger: { log() {}, warn(m: string) { warnings.push(m); }, error() {} }, warnings };
    };

    it('appends and returns the trend line for this run', async () => {
        const path = join(tempDir(), 'it.jsonl');
        const { logger, warnings } = stub();
        expect(await recordIteration(logger, path, entry(1))).toBe('iteration 1 — errors 1, warnings 0, score n/a');
        expect(await recordIteration(logger, path, entry(0))).toBe('iteration 2 — errors 0 (was 1), warnings 0 (was 0), score n/a (was n/a)');
        expect(warnings).toEqual([]);
        expect(await readIterationLog(path)).toEqual([entry(1), entry(0)]);
    });

    it('warns and returns nothing when the log cannot be written — bookkeeping never fails the run', async () => {
        // A parent that is a FILE: mkdir -p and the append both fail with a
        // filesystem error. The verdict must still be reachable.
        const blocker = join(tempDir(), 'not-a-dir');
        writeFileSync(blocker, 'x');
        const { logger, warnings } = stub();
        expect(await recordIteration(logger, join(blocker, 'it.jsonl'), entry(1))).toBeUndefined();
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toMatch(/iteration log: cannot write .*not-a-dir/);
    });
});
