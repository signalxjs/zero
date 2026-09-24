/**
 * The lockstep bump must refuse a drifted tree BEFORE it writes anything
 * (#195). It used to bump each package from its own version inside the
 * loop, write it, cut its CHANGELOG, and only then notice the packages
 * ended on different versions — exiting 1 with the tree half-bumped.
 *
 * Runs the real CLI against a scratch copy of `scripts/` beside a scratch
 * `packages/`, since the script resolves `packages/` from its own location.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = join(dirname(fileURLToPath(import.meta.url)), '..');

function writePackage(root: string, dir: string, pkg: Record<string, unknown>, changelog?: string) {
    const at = join(root, 'packages', dir);
    mkdirSync(at, { recursive: true });
    writeFileSync(join(at, 'package.json'), JSON.stringify(pkg, null, 4) + '\n');
    if (changelog !== undefined) writeFileSync(join(at, 'CHANGELOG.md'), changelog);
}

function snapshot(root: string): Record<string, string> {
    const files = ['a/package.json', 'a/CHANGELOG.md', 'b/package.json', 'c/package.json'];
    return Object.fromEntries(files.map((f) => [f, readFileSync(join(root, 'packages', f), 'utf-8')]));
}

function bump(root: string, ...args: string[]) {
    return spawnSync(process.execPath, [join(root, 'scripts', 'bump-version.js'), ...args], { encoding: 'utf-8' });
}

describe('bump-version lockstep', () => {
    let root: string;
    const changelog = '# Changelog\n\n## [Unreleased]\n\n- a change.\n\n## [0.5.0] - 2026-09-20\n';

    beforeEach(() => {
        // realpath: macOS's tmpdir is a symlink, and the script only runs as a CLI
        // when its own URL matches argv[1].
        root = realpathSync(mkdtempSync(join(tmpdir(), 'bump-version-')));
        // cpSync would create the parent itself; explicit, not load-bearing.
        mkdirSync(join(root, 'scripts'), { recursive: true });
        cpSync(join(scriptsDir, 'bump-version.js'), join(root, 'scripts', 'bump-version.js'));
        cpSync(join(scriptsDir, 'lib'), join(root, 'scripts', 'lib'), { recursive: true });
    });
    afterEach(() => rmSync(root, { recursive: true, force: true }));

    it('refuses a drifted tree before writing any package.json or CHANGELOG', () => {
        writePackage(root, 'a', { name: '@x/a', version: '0.5.0' }, changelog);
        writePackage(root, 'b', { name: '@x/b', version: '0.4.9' });
        writePackage(root, 'c', { name: '@x/c', version: '0.0.1', private: true });
        const before = snapshot(root);

        const result = bump(root, 'patch');

        expect(snapshot(root)).toEqual(before);
        expect(result.status).toBe(1);
        expect(result.stderr).toMatch(/Lockstep broken/);
        expect(result.stderr).toMatch(/@x\/a.*0\.5\.0/);
        expect(result.stderr).toMatch(/@x\/b.*0\.4\.9/);
    });

    it('refuses a malformed version before writing anything', () => {
        writePackage(root, 'a', { name: '@x/a', version: '0.5.0' }, changelog);
        writePackage(root, 'b', { name: '@x/b', version: '0.5' });
        writePackage(root, 'c', { name: '@x/c', version: '0.0.1', private: true });
        const before = snapshot(root);

        const result = bump(root, 'patch');

        expect(snapshot(root)).toEqual(before);
        expect(result.status).toBe(1);
    });

    it('bumps an in-step tree, cuts the CHANGELOG, and skips private packages', () => {
        writePackage(root, 'a', { name: '@x/a', version: '0.5.0' }, changelog);
        writePackage(root, 'b', { name: '@x/b', version: '0.5.0' });
        writePackage(root, 'c', { name: '@x/c', version: '0.0.1', private: true });

        const result = bump(root, 'minor');

        expect(result.status).toBe(0);
        const after = snapshot(root);
        expect(JSON.parse(after['a/package.json']).version).toBe('0.6.0');
        expect(JSON.parse(after['b/package.json']).version).toBe('0.6.0');
        expect(JSON.parse(after['c/package.json']).version).toBe('0.0.1');
        expect(after['a/CHANGELOG.md']).toMatch(/## \[Unreleased\]\n\n## \[0\.6\.0\] - \d{4}-\d{2}-\d{2}\n\n- a change\./);
    });

    it('an exact version still moves a drifted tree back into step', () => {
        writePackage(root, 'a', { name: '@x/a', version: '0.5.0' }, changelog);
        writePackage(root, 'b', { name: '@x/b', version: '0.4.9' });
        writePackage(root, 'c', { name: '@x/c', version: '0.0.1', private: true });

        const result = bump(root, '0.6.0');

        expect(result.status).toBe(0);
        const after = snapshot(root);
        expect(JSON.parse(after['a/package.json']).version).toBe('0.6.0');
        expect(JSON.parse(after['b/package.json']).version).toBe('0.6.0');
    });
});
