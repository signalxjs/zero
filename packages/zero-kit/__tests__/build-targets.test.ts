/**
 * The `targets` option on `runStandardBuild` (#348): default `['web']`
 * changes nothing, unknown names and web-less lists fail fast, and the lynx
 * target emits `dist/lynx/**` beside the web artifacts with its capability
 * findings folded into the shared report.json.
 *
 * The lynx integration case runs a SYNTHETIC design system so its
 * assertions stay independent of the skins' recipes. The real skins compile
 * the lynx target too: zero-basic and zero-daisyui pass
 * `targets: ['web', 'lynx']` in their `build.mjs`, their web-runtime
 * references (`var(--slider-percent)`, `--diff-percent`) live in
 * `targets.web` sections (#355), and the end-to-end case below builds
 * zero-basic for lynx and pins that none of those references reach the
 * lynx artifacts.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { anatomies } from '@sigx/zero/anatomy';
import type { ManifestComponent } from '@sigx/zero-kit';
import { BUILD_TARGETS, runStandardBuild } from '@sigx/zero-kit/build';
import type { BuildTarget } from '@sigx/zero-kit/build';
import { designSystem as basicDS } from '@sigx/zero-basic';

const manifest = { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] };
const silent = { log() {}, warn() {}, error() {} };

const tempDirs: string[] = [];
const tempDir = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'zero-kit-targets-'));
    tempDirs.push(dir);
    return dir;
};
afterAll(() => {
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

describe('runStandardBuild targets', () => {
    it('defaults to web and writes the classic layout', async () => {
        const outDir = tempDir();
        const { written } = await runStandardBuild({
            designSystem: basicDS, manifest, outDir, logger: silent,
        });
        expect(written.length).toBeGreaterThan(0);
        expect(existsSync(join(outDir, 'css', 'index.css'))).toBe(true);
        expect(existsSync(join(outDir, 'lynx'))).toBe(false);
    });

    it('explicit ["web"] is byte-equivalent to the default', async () => {
        const a = tempDir();
        const b = tempDir();
        const first = await runStandardBuild({ designSystem: basicDS, manifest, outDir: a, logger: silent });
        const second = await runStandardBuild({
            designSystem: basicDS, manifest, outDir: b, targets: ['web'], logger: silent,
        });
        expect(second.written.map((p) => p.slice(b.length))).toEqual(first.written.map((p) => p.slice(a.length)));
    });

    it('rejects unknown targets by name', async () => {
        await expect(runStandardBuild({
            designSystem: basicDS, manifest, outDir: tempDir(),
            targets: ['web', 'terminal' as BuildTarget], logger: silent,
        })).rejects.toThrow(/unknown build target "terminal".*known targets: web, lynx/);
    });

    it('rejects a target list without web', async () => {
        await expect(runStandardBuild({
            designSystem: basicDS, manifest, outDir: tempDir(),
            targets: ['lynx'], logger: silent,
        })).rejects.toThrow(/"web" target is not optional/);
    });

    const syntheticDS = {
        name: 'lynx-probe',
        tokens: {
            roles: { primary: {} },
            defaultLight: 'light',
            themes: {
                light: {
                    colorScheme: 'light' as const,
                    colors: {
                        'base-100': '#ffffff', 'base-200': '#f2f2f2', 'base-300': '#e5e5e5',
                        'base-content': '#111111', primary: '#422ad5', 'primary-content': '#ffffff',
                    },
                },
            },
        },
        recipes: [{
            component: 'button',
            parts: {
                root: {
                    base: { display: 'flex', color: 'var(--color-primary)' },
                    states: { 'focus-visible': { outline: '2px solid var(--color-primary)' } },
                },
            },
            variants: { color: { primary: { root: { base: { background: 'var(--color-primary)' } } } } },
        }],
    };

    it('emits the lynx artifacts beside the web ones when opted in', async () => {
        const outDir = tempDir();
        const { written } = await runStandardBuild({
            designSystem: syntheticDS, manifest, outDir,
            targets: ['web', 'lynx'], logger: silent,
        });
        for (const artifact of ['lynx/tokens.css', 'lynx/index.css', 'lynx/manifest.json', 'lynx/components/button.css']) {
            expect(existsSync(join(outDir, artifact)), artifact).toBe(true);
        }
        // The web layout is unchanged and the lynx files are in `written`.
        expect(existsSync(join(outDir, 'css', 'index.css'))).toBe(true);
        expect(written.some((p) => p.endsWith(join('lynx', 'index.css')))).toBe(true);
        // The capability findings land in the shared report under `lynx`,
        // and the lynx manifest carries the DS manifest content + envelope.
        const report = JSON.parse(readFileSync(join(outDir, 'report.json'), 'utf8')) as {
            lynx?: { translated: unknown[]; dropped: unknown[] };
        };
        expect(report.lynx).toBeDefined();
        const lynxManifest = JSON.parse(readFileSync(join(outDir, 'lynx', 'manifest.json'), 'utf8')) as {
            target: string; classGrammarVersion: number; name: string; themes: unknown[];
        };
        expect(lynxManifest.target).toBe('lynx');
        expect(lynxManifest.classGrammarVersion).toBe(2);
        expect(lynxManifest.name).toBe('lynx-probe');
        expect(lynxManifest.themes.length).toBeGreaterThan(0);
    });

    it('compiles zero-basic for lynx end-to-end (runtime refs migrated to targets.web)', async () => {
        // The #351 pin in reverse: zero-basic's web-runtime references
        // (--slider-percent, --diff-percent) now live in targets.web, so the
        // full skin compiles — and the report says what the lynx copy lost.
        const outDir = tempDir();
        await runStandardBuild({
            designSystem: basicDS, manifest, outDir,
            targets: ['web', 'lynx'], logger: silent,
        });
        const report = JSON.parse(readFileSync(join(outDir, 'report.json'), 'utf8')) as {
            lynx: { dropped: { where: string; what: string }[] };
        };
        expect(report.lynx.dropped.length).toBeGreaterThan(0);
        // The migrated declarations are gone from the lynx view entirely —
        // neither emitted nor reported as dropped.
        const sliderCss = readFileSync(join(outDir, 'lynx', 'components', 'slider.css'), 'utf8');
        expect(sliderCss).not.toContain('--slider-percent');
        expect(sliderCss).toContain('.zx-slider__control {');
    });

    it('pins the known-target list', () => {
        expect([...BUILD_TARGETS]).toEqual(['web', 'lynx']);
    });
});
