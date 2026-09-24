/**
 * The release and CI guards from #196.
 *
 * - `release.yml` publishes whatever `package.json` says and skips what is
 *   already on npm, so a tag that disagrees with the packages (v0.6.0 pushed
 *   on the 0.5.0 commit) used to skip all five, exit 0 and still cut a
 *   GitHub release. `releaseTagProblems` is the check the workflow now runs
 *   first; its pure half is pinned here, and the workflow is held to calling
 *   it before anything publishes.
 * - `core-sync.yml` opened its PR with the default GITHUB_TOKEN, which
 *   starts no `pull_request` workflows, and pointed at a RELEASING.md that
 *   does not exist.
 * - A failed e2e run left nothing to debug with: no trace, no report, no
 *   artifact, and a cold browser download on every run.
 *
 * Workflows cannot run locally, so the YAML is held by its text — the
 * cheapest check that fails when a guard is dropped.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// @ts-expect-error — a plain ESM module, no declarations by design.
import { releaseTagProblems, readPublishList } from '../lib/release-tag.mjs';

const read = (p: string) => readFileSync(resolve(import.meta.dirname, '../..', p), 'utf-8');

const pkgs = (v: string, other = v) => [
    { name: '@sigx/zero', version: v },
    { name: '@sigx/zero-kit', version: other },
];

describe('releaseTagProblems', () => {
    it('passes a tag that matches every publishable package', () => {
        expect(releaseTagProblems('v0.6.0', pkgs('0.6.0'))).toEqual([]);
        expect(releaseTagProblems('v0.6.0-rc.1', pkgs('0.6.0-rc.1'))).toEqual([]);
    });

    it('fails a tag pushed on a commit whose packages carry another version', () => {
        const problems = releaseTagProblems('v0.6.0', pkgs('0.5.0'));
        expect(problems).toHaveLength(2);
        expect(problems[0]).toMatch(/@sigx\/zero is 0\.5\.0.*v0\.6\.0/);
    });

    it('fails a prerelease tag on a stable version — it would publish to npm latest', () => {
        expect(releaseTagProblems('v0.6.0-rc.1', pkgs('0.6.0'))).toHaveLength(2);
    });

    it('names only the package that drifted out of lockstep', () => {
        const problems = releaseTagProblems('v0.6.0', pkgs('0.6.0', '0.5.0'));
        expect(problems).toHaveLength(1);
        expect(problems[0]).toMatch(/@sigx\/zero-kit/);
    });

    it('refuses a tag that is not v<semver>', () => {
        expect(releaseTagProblems('0.6.0', pkgs('0.6.0'))[0]).toMatch(/not a release tag/);
        expect(releaseTagProblems('v0.6', pkgs('0.6.0'))[0]).toMatch(/not a release tag/);
        expect(releaseTagProblems('', pkgs('0.6.0'))[0]).toMatch(/not a release tag/);
    });

    it('refuses an empty package list rather than passing vacuously', () => {
        expect(releaseTagProblems('v0.6.0', [])[0]).toMatch(/no publishable packages/);
    });
});

describe('readPublishList', () => {
    it('reads the PACKAGES array publish.js publishes', () => {
        const list = readPublishList(read('scripts/publish.js'));
        expect(list).toContain('packages/zero');
        expect(list).toContain('packages/zero-kit');
    });

    it('ignores quoted paths inside comments in the array', () => {
        const source = [
            'const PACKAGES = [',
            "    'packages/zero', // 'packages/zero-material' is private",
            "    /* 'packages/zero-heroui' */",
            "    'packages/zero-kit',",
            '];',
        ].join('\n');
        expect(readPublishList(source)).toEqual(['packages/zero', 'packages/zero-kit']);
    });
});

describe('release.yml', () => {
    const yml = read('.github/workflows/release.yml');

    it('checks the tag against the package versions before building or publishing', () => {
        const guard = yml.indexOf('node scripts/check-release-tag.mjs');
        expect(guard).toBeGreaterThan(-1);
        expect(guard).toBeLessThan(yml.indexOf('pnpm install'));
        expect(guard).toBeLessThan(yml.indexOf('node scripts/publish.js'));
    });

    it('drops the repo-template TODO header', () => {
        expect(yml).not.toMatch(/TODO\(sigx-standard\)/);
    });
});

describe('core-sync.yml', () => {
    const yml = read('.github/workflows/core-sync.yml');

    it('points the PR body at AGENTS.md, not a RELEASING.md that does not exist', () => {
        expect(yml).not.toMatch(/RELEASING\.md/);
        expect(yml).toMatch(/AGENTS\.md.*Cutting a release/);
    });

    it('opens the PR with a token that starts pull_request workflows', () => {
        expect(yml).toMatch(/token:\s*\$\{\{\s*secrets\.CORE_SYNC_TOKEN/);
    });
});

describe('e2e debuggability', () => {
    it('records a trace on the first retry and writes an HTML report on CI', () => {
        const config = read('examples/playground/playwright.config.ts');
        expect(config).toMatch(/trace:\s*'on-first-retry'/);
        expect(config).toMatch(/\['html',\s*\{\s*open:\s*'never'\s*\}\]/);
    });

    it('uploads the report and results on failure and caches the browsers', () => {
        const ci = read('.github/workflows/ci.yml');
        const e2e = ci.slice(ci.indexOf('\n  e2e:'), ci.indexOf('\n  verify-pack:'));
        expect(e2e).toMatch(/actions\/upload-artifact@/);
        expect(e2e).toMatch(/if:\s*failure\(\)/);
        expect(e2e).toMatch(/playwright-report/);
        expect(e2e).toMatch(/test-results/);
        expect(e2e).toMatch(/actions\/cache@[\s\S]*ms-playwright/);
    });
});
