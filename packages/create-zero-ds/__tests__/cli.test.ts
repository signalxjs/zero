/**
 * The command surface: exit codes, `--dry-run` writing nothing, the
 * non-empty-directory refusal, and the usage text naming the briefs. Runs
 * against templates collected from the workspace, like the scaffold suite.
 */
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { collectTemplates } from '../src/collect.js';
import { EXIT_FAILED, EXIT_OK, EXIT_USAGE, main } from '../src/cli.js';
import type { CliIo } from '../src/cli.js';
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
async function run(argv: string[], cwd: string, io: Partial<CliIo> = { templates }): Promise<Run> {
    const out: string[] = [];
    const err: string[] = [];
    const code = await main(argv, { stdout: (l) => out.push(l), stderr: (l) => err.push(l), cwd, ...io });
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

    it('an unknown brief is a failure, not a usage error', async () => {
        const cwd = tempDir();
        const r = await run(['zero-x', '--brief', 'bauhaus'], cwd);
        expect(r.code).toBe(EXIT_FAILED);
        expect(r.err[0]).toMatch(/unknown brief "bauhaus"/);
    });

    // #188: every one of these planned a package.json npm would reject, and
    // exited 0 (or 1 for a non-kebab design-system name).
    it('a name npm would reject, or one that yields no design-system name, is a usage error', async () => {
        const cwd = tempDir();
        for (const name of ['@Acme/zero-x', 'foo/zero-x', '../zero-x', '@acme/zero-x/extra', '.zero-x', '_zero-x', '@acme/', 'zero~x', 'Zero-X', '@acme/zero-X', 'zero-']) {
            const r = await run([name, '--brief', 'glass', '--dry-run'], cwd);
            expect(r.code, name).toBe(EXIT_USAGE);
            expect(r.err.join('\n'), name).toContain('Usage: create-zero-ds');
        }
        expect(readdirSync(cwd)).toEqual([]);
        for (const name of ['zero-x', '@acme/zero-x', '@acme.co/zero-x', '@my_org/monograph']) {
            expect((await run([name, '--brief', 'glass', '--dry-run'], cwd)).code, name).toBe(EXIT_OK);
        }
    });

    it('--dry-run refuses a non-empty directory like the real run, and --force marks what it overwrites', async () => {
        const cwd = tempDir();
        expect((await run(['zero-x', '--brief', 'glass'], cwd)).code).toBe(EXIT_OK);
        const readme = join(cwd, 'zero-x', 'README.md');
        writeFileSync(readme, 'MINE');
        const dry = await run(['zero-x', '--brief', 'glass', '--dry-run'], cwd);
        expect(dry.code).toBe(EXIT_FAILED);
        expect(dry.err[0]).toMatch(/not empty/);
        expect(readFileSync(readme, 'utf8')).toBe('MINE');

        const dryForce = await run(['zero-x', '--brief', 'glass', '--dry-run', '--force'], cwd);
        expect(dryForce.code).toBe(EXIT_OK);
        expect(dryForce.out.find((l) => l.includes('README.md'))).toMatch(/\(overwrites\)/);
        expect(readFileSync(readme, 'utf8')).toBe('MINE');

        const force = await run(['zero-x', '--brief', 'glass', '--force'], cwd);
        expect(force.code).toBe(EXIT_OK);
        expect(force.out.find((l) => l.includes('README.md'))).toMatch(/\(overwritten\)/);
        expect(readFileSync(readme, 'utf8')).not.toBe('MINE');

        // A file the plan does not name is left alone, and never marked.
        const fresh = tempDir();
        writeFileSync(join(fresh, 'notes.txt'), 'x');
        const into = await run(['zero-x', '--brief', 'glass', '--dir', '.', '--force'], fresh);
        expect(into.code).toBe(EXIT_OK);
        expect(into.out.some((l) => /overwr/.test(l))).toBe(false);
    });

    it('--help and --version work without templates', async () => {
        const cwd = tempDir();
        const missing = join(cwd, 'no-templates');
        const help = await run(['--help'], cwd, { templatesDir: missing });
        expect(help.code).toBe(EXIT_OK);
        expect(help.out.join('\n')).toContain('Usage: create-zero-ds');
        expect(help.out.join('\n')).not.toContain('Briefs:');
        const version = await run(['--version'], cwd, { templatesDir: missing });
        expect(version.code).toBe(EXIT_OK);
        const own = JSON.parse(readFileSync(resolve(import.meta.dirname, '../package.json'), 'utf8')) as { version: string };
        expect(version.out).toEqual([own.version]);
        // A real scaffold still needs them, and says so.
        const scaffold = await run(['zero-x', '--brief', 'glass'], cwd, { templatesDir: missing });
        expect(scaffold.code).toBe(EXIT_FAILED);
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
