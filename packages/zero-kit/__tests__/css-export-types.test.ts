/**
 * Every extensionless stylesheet export carries a `types` condition (#66).
 *
 * `import '@sigx/zero/css'` has no `.css` extension, so a bundler's `*.css`
 * ambient module never matches it, and TypeScript 6 checks side-effect
 * imports by default — every app needed a hand-written shim. The fix is a
 * `{ types, default }` export pointing `types` at an empty module: a static
 * file in zero, the one `writeArtifacts` emits in a design system. This
 * sweeps the shipped packages' exports so a new one cannot regress, and
 * proves the declared file is one that actually exists after a build.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { compileDesignSystem, writeArtifacts } from '@sigx/zero-kit';
import type { ManifestComponent } from '@sigx/zero-kit';
import { anatomies } from '@sigx/zero/anatomy';
import { designSystem as basicDS } from '@sigx/zero-basic';

const PACKAGES = ['zero', 'zero-basic', 'zero-daisyui', 'zero-material', 'zero-brutalist', 'zero-heroui', 'zero-carbon'];
const DS_TYPES = './dist/css/index.d.ts';

const tempDirs: string[] = [];
afterAll(() => {
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

function stylesheetExports(pkg: string): Array<[string, unknown]> {
    const json = JSON.parse(readFileSync(resolve(process.cwd(), 'packages', pkg, 'package.json'), 'utf8')) as {
        exports: Record<string, unknown>;
    };
    const target = (value: unknown): string | undefined =>
        typeof value === 'string' ? value : (value as { default?: string } | null)?.default;
    // An export whose SPECIFIER already ends in `.css` is matched by the
    // ambient module; only the extensionless ones need a declaration.
    return Object.entries(json.exports)
        .filter(([key, value]) => target(value)?.endsWith('.css') && !key.endsWith('.css'));
}

describe('extensionless stylesheet exports declare types', () => {
    it.each(PACKAGES)('%s', (pkg) => {
        const entries = stylesheetExports(pkg);
        expect(entries.length).toBeGreaterThan(0);
        for (const [key, value] of entries) {
            expect(value, `${pkg} exports ${key}`).toBeTypeOf('object');
            const conditions = Object.keys(value as object);
            // `types` first: conditions match in order.
            expect(conditions, `${pkg} exports ${key}`).toEqual(['types', 'default']);
            const types = (value as { types: string }).types;
            if (pkg === 'zero') {
                expect(existsSync(resolve(process.cwd(), 'packages/zero', types))).toBe(true);
            } else {
                expect(types, `${pkg} exports ${key}`).toBe(DS_TYPES);
            }
        }
    });

    it('writeArtifacts emits the declaration the design systems point at', async () => {
        const manifest = { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] };
        const dir = mkdtempSync(join(tmpdir(), 'zero-css-types-'));
        tempDirs.push(dir);
        const written = await writeArtifacts(compileDesignSystem(basicDS, manifest), join(dir, 'dist'));
        const dts = join(dir, DS_TYPES);
        expect(written).toContain(dts);
        expect(readFileSync(dts, 'utf8')).toMatch(/^export \{\};$/m);
    });
});
