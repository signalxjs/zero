/**
 * A rebuild into an existing outDir leaves nothing behind from the previous
 * run (#186). A design system's package exports `./css/*` straight from
 * `dist/css/components/`, so a stale `<scope>.css` from a removed recipe
 * stays importable — and packable, from a dirty local dist. The same goes for
 * `components.{js,d.ts}` after the api is dropped, `audit.json` after
 * `audit: false`, and `lynx/` after the lynx target is dropped.
 *
 * What must survive is everything the kit did NOT write: tsgo emits the
 * design system's own `dist/*.js` into the same directory.
 */
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { anatomies } from '@sigx/zero/anatomy';
import { compileDesignSystem, writeArtifacts } from '@sigx/zero-kit';
import type { ManifestComponent } from '@sigx/zero-kit';
import { runStandardBuild } from '@sigx/zero-kit/build';
import { designSystem as basicDS } from '@sigx/zero-basic';
import { designSystem as daisy } from '@sigx/zero-daisyui';

const manifest = { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] };
const silent = { log() {}, warn() {}, error() {} };

const tempDirs: string[] = [];
const tempDir = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'zero-kit-stale-'));
    tempDirs.push(dir);
    return dir;
};
afterAll(() => {
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

// Each case runs two full builds of a real skin; under a loaded full-suite run
// that outgrows vitest's 5s default.
describe('stale dist artifacts (#186)', { timeout: 30_000 }, () => {
    it('a rebuild removes a dropped recipe\'s CSS, audit.json and lynx/, and keeps tsgo output', async () => {
        const outDir = tempDir();
        await runStandardBuild({
            designSystem: basicDS, manifest, outDir, targets: ['web', 'lynx'], ecosystem: false, logger: silent,
        });
        expect(existsSync(join(outDir, 'css', 'components', 'stack.css'))).toBe(true);
        expect(existsSync(join(outDir, 'lynx', 'components', 'stack.css'))).toBe(true);
        expect(existsSync(join(outDir, 'audit.json'))).toBe(true);
        // What tsgo would have emitted beside the kit's artifacts.
        writeFileSync(join(outDir, 'index.js'), 'export {};\n');

        const smaller = { ...basicDS, recipes: basicDS.recipes.filter((r) => r.component !== 'stack') };
        await runStandardBuild({
            designSystem: smaller, manifest, outDir, targets: ['web'], audit: false, ecosystem: false, logger: silent,
        });

        expect(existsSync(join(outDir, 'css', 'components', 'stack.css'))).toBe(false);
        expect(existsSync(join(outDir, 'css', 'components', 'button.css'))).toBe(true);
        expect(existsSync(join(outDir, 'audit.json'))).toBe(false);
        expect(existsSync(join(outDir, 'lynx'))).toBe(false);
        expect(existsSync(join(outDir, 'index.js'))).toBe(true);
    });

    it('a lynx rebuild removes a dropped recipe\'s lynx CSS', async () => {
        const outDir = tempDir();
        await runStandardBuild({
            designSystem: basicDS, manifest, outDir, targets: ['web', 'lynx'], ecosystem: false, logger: silent,
        });
        const smaller = { ...basicDS, recipes: basicDS.recipes.filter((r) => r.component !== 'stack') };
        await runStandardBuild({
            designSystem: smaller, manifest, outDir, targets: ['web', 'lynx'], ecosystem: false, logger: silent,
        });
        expect(existsSync(join(outDir, 'lynx', 'components', 'stack.css'))).toBe(false);
        expect(existsSync(join(outDir, 'lynx', 'components', 'button.css'))).toBe(true);
    });

    it('writeArtifacts removes components.{js,d.ts} and report.json it no longer writes', async () => {
        const outDir = tempDir();
        const compiled = compileDesignSystem(daisy, manifest);
        expect(compiled.componentApi).toBeDefined();
        await writeArtifacts(compiled, outDir, { placeholder: true } as never);
        expect(existsSync(join(outDir, 'components.js'))).toBe(true);
        expect(existsSync(join(outDir, 'components.d.ts'))).toBe(true);
        expect(existsSync(join(outDir, 'report.json'))).toBe(true);

        await writeArtifacts({ ...compiled, componentApi: undefined }, outDir);
        expect(existsSync(join(outDir, 'components.js'))).toBe(false);
        expect(existsSync(join(outDir, 'components.d.ts'))).toBe(false);
        expect(existsSync(join(outDir, 'report.json'))).toBe(false);
        expect(existsSync(join(outDir, 'manifest.json'))).toBe(true);
    });

    it('an invalid scope throws before the previous build is cleared', async () => {
        const outDir = tempDir();
        const compiled = compileDesignSystem(basicDS, manifest);
        await writeArtifacts(compiled, outDir);
        const bad = { ...compiled, componentCss: { ...compiled.componentCss, '../escape': '' } };
        await expect(writeArtifacts(bad, outDir)).rejects.toThrow(/kebab-case/);
        expect(existsSync(join(outDir, 'css', 'components', 'button.css'))).toBe(true);
    });
});
