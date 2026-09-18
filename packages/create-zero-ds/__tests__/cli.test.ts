/**
 * The command surface: exit codes, `--dry-run` writing nothing, the
 * non-empty-directory refusal, and the usage text naming the briefs. Runs
 * against templates collected from the workspace, like the scaffold suite.
 */
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { collectTemplates } from '../src/collect.js';
import { EXIT_FAILED, EXIT_OK, EXIT_USAGE, main } from '../src/cli.js';
import { loadTemplates } from '../src/templates.js';
import type { Templates } from '../src/templates.js';

const workspaceRoot = resolve(import.meta.dirname, '../../..');
const tempDirs: string[] = [];
const tempDir = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'create-zero-ds-cli-'));
    tempDirs.push(dir);
    return dir;
};
afterAll(() => {
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

let templates: Templates;
beforeAll(async () => {
    const dir = tempDir();
    await collectTemplates(workspaceRoot, dir);
    templates = loadTemplates(dir);
});

interface Run { code: number; out: string[]; err: string[] }
async function run(argv: string[], cwd: string): Promise<Run> {
    const out: string[] = [];
    const err: string[] = [];
    const code = await main(argv, { stdout: (l) => out.push(l), stderr: (l) => err.push(l), cwd, templates });
    return { code, out, err };
}

describe('create-zero-ds', () => {
    it('scaffolds into ./<last segment> by default and prints the next steps', async () => {
        const cwd = tempDir();
        const r = await run(['@acme/zero-acme', '--brief', 'corporate'], cwd);
        expect(r.err).toEqual([]);
        expect(r.code).toBe(EXIT_OK);
        expect(existsSync(join(cwd, 'zero-acme', 'src', 'tokens.ts'))).toBe(true);
        expect(r.out.join('\n')).toContain('npx sigx zero:validate --report');
    });

    it('--dir places it, --dry-run writes nothing', async () => {
        const cwd = tempDir();
        const r = await run(['zero-x', '--brief', 'glass', '--dir', 'elsewhere', '--dry-run'], cwd);
        expect(r.code).toBe(EXIT_OK);
        expect(r.out[0]).toMatch(/Would write \d+ files into .*elsewhere/);
        expect(readdirSync(cwd)).toEqual([]);
    });

    it('refuses a non-empty directory, and --force overrides', async () => {
        const cwd = tempDir();
        expect((await run(['zero-x', '--brief', 'glass'], cwd)).code).toBe(EXIT_OK);
        const again = await run(['zero-x', '--brief', 'glass'], cwd);
        expect(again.code).toBe(EXIT_FAILED);
        expect(again.err[0]).toMatch(/not empty/);
        expect((await run(['zero-x', '--brief', 'glass', '--force'], cwd)).code).toBe(EXIT_OK);
    });

    it('usage errors exit 2 and name the briefs', async () => {
        const cwd = tempDir();
        const noBrief = await run(['zero-x'], cwd);
        expect(noBrief.code).toBe(EXIT_USAGE);
        expect(noBrief.err[0]).toMatch(/--brief is required — one of: .*riso/);
        expect((await run(['--brief', 'glass'], cwd)).code).toBe(EXIT_USAGE);
        expect((await run(['zero-x', '--brief', 'glass', '--baseline', 'heroui'], cwd)).code).toBe(EXIT_USAGE);
        expect((await run(['zero-x', '--brief', 'glass', '--targets', 'lynx'], cwd)).code).toBe(EXIT_USAGE);
        expect((await run(['zero-x', '--brief', 'glass', '--bogus'], cwd)).code).toBe(EXIT_USAGE);
        expect(readdirSync(cwd)).toEqual([]);
    });

    it('an unknown brief or a bad name is a failure, not a usage error', async () => {
        const cwd = tempDir();
        const r = await run(['zero-x', '--brief', 'bauhaus'], cwd);
        expect(r.code).toBe(EXIT_FAILED);
        expect(r.err[0]).toMatch(/unknown brief "bauhaus"/);
        expect((await run(['Zero-X', '--brief', 'glass'], cwd)).code).toBe(EXIT_FAILED);
    });

    it('--help lists the briefs, --version prints the lockstep version', async () => {
        const cwd = tempDir();
        const help = await run(['--help'], cwd);
        expect(help.code).toBe(EXIT_OK);
        expect(help.out.join('\n')).toContain('Briefs: basic, brutalist, corporate, glass, riso, seeded, terminal');
        const version = await run(['-v'], cwd);
        expect(version.out).toEqual([templates.versions.version]);
    });
});
