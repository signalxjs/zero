/**
 * A design system that both extends a skin and owns a fragment (#62).
 *
 * The shape is andtii/agentic's `@agentic/ui`: a system derived from
 * zero-daisyui (so it carries daisy's `api`) that also publishes an
 * ecosystem fragment. Its `./components` module re-exports the fragment's
 * scopes from the package that owns them — its OWN package — and by name
 * that is `@agentic/ui` importing `@agentic/ui`. So the specifier is made
 * relative, from the emitted file to the files the package.json names.
 *
 * The fixture is a throwaway package on disk, because what is under test is
 * exactly the reading of a real package.json from a real `outDir`.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    compileComponentsJs,
    compileDesignSystem,
    extendDesignSystem,
    mergeManifests,
    runStandardBuild,
    selfComponentsImport,
} from '@sigx/zero-kit';
import type { ManifestComponent } from '@sigx/zero-kit';
import { anatomies } from '@sigx/zero/anatomy';
import { designSystem as daisy } from '@sigx/zero-daisyui';
import { fragment as extFragment, recipes as extRecipes } from '@sigx/zero-ext-example/fragment';

const PKG = '@acme/control-room';
const manifest = { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] };
/** The ext-example fragment, re-owned: here it is the design system's own package that ships it. */
const fragment = { ...extFragment, package: PKG };
const designSystem = extendDesignSystem(daisy, { name: 'control-room', addRecipes: extRecipes });

const dirs: string[] = [];
afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
/** A package directory holding `package.json` — the fixture's root. */
const fixturePackage = (pkg: Record<string, unknown>): string => {
    const dir = mkdtempSync(join(tmpdir(), 'zero-self-owned-'));
    dirs.push(dir);
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: PKG, type: 'module', ...pkg }));
    return dir;
};
const logger = () => ({ log: vi.fn<(m: string) => void>(), warn: vi.fn<(m: string) => void>(), error: vi.fn<(m: string) => void>() });

describe('a derived design system that owns a fragment', () => {
    it('imports its own scopes relatively in both halves, and never by its own name', async () => {
        const dir = fixturePackage({ exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js' } } });
        const outDir = join(dir, 'dist', 'ds');
        const log = logger();
        await runStandardBuild({ designSystem, manifest, fragments: [fragment], outDir, ecosystem: false, audit: false, logger: log });

        const js = readFileSync(join(outDir, 'components.js'), 'utf8');
        const dts = readFileSync(join(outDir, 'components.d.ts'), 'utf8');
        expect(js).toContain("export { ExtStepper } from '../index.js';");
        expect(dts).toContain("import type { ExtStepper as ZExtStepper } from '../index.js';");
        expect(js + dts).not.toContain(`'${PKG}'`);
        // daisy's own scopes still come from zero.
        expect(js).toContain("from '@sigx/zero/button'");
        // The specifier lands on the file the root export names.
        expect(resolve(outDir, '../index.js')).toBe(resolve(dir, 'dist/index.js'));
        // Not a dependency of itself — and no longer asked to be.
        expect(log.warn.mock.calls.flat().join('\n')).not.toMatch(/is not a dependency or peerDependency/);
    });

    it('reads the types condition where it points elsewhere, nested conditions included', () => {
        const dir = fixturePackage({
            exports: { '.': { import: { types: './types/index.d.mts', default: './dist/index.mjs' } } },
        });
        const compiled = compileDesignSystem(designSystem, mergeManifests(manifest, fragment));
        expect(selfComponentsImport(compiled, join(dir, 'dist', 'ds'))).toEqual({
            package: PKG,
            js: '../index.mjs',
            types: '../../types/index.mjs',
        });
    });

    it('falls back to main and types when there is no exports map', () => {
        const dir = fixturePackage({ main: 'lib/main.js', types: 'lib/main.d.ts' });
        const compiled = compileDesignSystem(designSystem, mergeManifests(manifest, fragment));
        expect(selfComponentsImport(compiled, dir)).toEqual({ package: PKG, js: './lib/main.js', types: './lib/main.js' });
    });

    it('refuses a package with no root export to import from', () => {
        const dir = fixturePackage({ exports: { './css': './dist/index.css' } });
        const compiled = compileDesignSystem(designSystem, mergeManifests(manifest, fragment));
        expect(() => selfComponentsImport(compiled, dir))
            .toThrow(/re-exports ext-stepper from its own package @acme\/control-room .* exports no root entry/);
    });

    it('leaves a scope owned by another package imported by name', () => {
        const dir = fixturePackage({ name: '@acme/someone-else', exports: './dist/index.js' });
        const compiled = compileDesignSystem(designSystem, mergeManifests(manifest, fragment));
        expect(selfComponentsImport(compiled, dir)).toBeUndefined();
        expect(compileComponentsJs(compiled)).toContain(`export { ExtStepper } from '${PKG}';`);
    });

    it('rewrites only the owner it names', () => {
        const compiled = compileDesignSystem(designSystem, mergeManifests(manifest, fragment));
        const js = compileComponentsJs(compiled, { self: { package: '@acme/other', js: './x.js', types: './x.js' } });
        expect(js).toContain(`export { ExtStepper } from '${PKG}';`);
    });
});
