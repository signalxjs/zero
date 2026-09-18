/**
 * The type-test projects resolve `@sigx/zero/*` through the paths map in
 * `type-tests/tsconfig.base.json`. A subpath the map fails to match falls
 * through to Node resolution — which lands in the stale, gitignored `dist/`
 * (or, in CI where no build has run, resolves to nothing and is silently
 * swallowed by `skipLibCheck`). That is how the components project shipped
 * for months while actually checking 8 of 31 goldened scopes (#316).
 *
 * This test pins the map to `package.json` `exports`: every published
 * subpath must be reachable IN SOURCE through one of the map's candidates,
 * so adding a component (a new export) without a resolvable source path is
 * a test failure here, not a silent fallthrough there.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const pkgRoot = resolve(import.meta.dirname, '..');

/** tsconfig files carry `//` comments; strip them before JSON.parse. */
function readJsonc(path: string): unknown {
    const raw = readFileSync(path, 'utf8');
    return JSON.parse(raw.replace(/^\s*\/\/.*$/gm, ''));
}

const exportsMap = (
    JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8')) as {
        exports: Record<string, { types?: string } | string>;
    }
).exports;

const baseConfig = readJsonc(join(pkgRoot, 'type-tests/tsconfig.base.json')) as {
    compilerOptions: { paths: Record<string, string[]> };
};
const paths = baseConfig.compilerOptions.paths;
// Candidates are declared relative to the file that declares them
// (type-tests/tsconfig.base.json has no baseUrl).
const candidateRoot = join(pkgRoot, 'type-tests');

/** TS subpath exports: everything whose `types` target is a declaration file. */
const typedSubpaths = Object.entries(exportsMap)
    .filter((entry): entry is [string, { types: string }] =>
        typeof entry[1] === 'object' && typeof entry[1].types === 'string')
    .map(([key, value]) => ({ key, types: value.types }))
    .filter(({ key }) => key !== '.');

describe('type-tests paths map covers the export surface', () => {
    it('maps the package root to source', () => {
        const root = paths['@sigx/zero'];
        expect(root, 'the paths map must pin the bare specifier').toBeDefined();
        expect(root!.some((c) => existsSync(join(candidateRoot, c)))).toBe(true);
    });

    it.each(typedSubpaths)('resolves $key in source', ({ key, types }) => {
        const subpath = key.slice(2); // './tabs' → 'tabs'
        // The source twin of the published declaration target.
        const srcFile = types.replace('./dist/', 'src/').replace(/\.d\.ts$/, '.ts');
        expect(existsSync(join(pkgRoot, srcFile)), `${srcFile} should exist`).toBe(true);

        const wildcard = paths['@sigx/zero/*'] ?? [];
        const resolved = wildcard
            .map((candidate) => join(candidateRoot, candidate.replace('*', subpath)))
            // Mirror tsc: a bare candidate may resolve with an appended extension.
            .flatMap((p) => [p, `${p}.ts`])
            .find((p) => existsSync(p));
        expect(
            resolved,
            `no paths candidate reaches a source file for @sigx/zero/${subpath}`,
        ).toBeDefined();
        // The candidate that wins must be the export's own source, not a
        // stray same-named file somewhere else under src/.
        expect(resolve(resolved!)).toBe(resolve(join(pkgRoot, srcFile)));
    });
});
