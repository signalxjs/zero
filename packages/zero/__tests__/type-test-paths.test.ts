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

/**
 * Every tsconfig whose `paths` map resolves `@sigx/zero/*`: the type-test
 * base, and the root one `pnpm typecheck` uses. The root one matters as much
 * — vitest aliases every export to source (scripts/lib/source-aliases.mjs),
 * so a subpath the root map misses typechecks against `dist/` (or fails with
 * TS2307 in CI, where typecheck runs before the build) while its test passes.
 * Candidates are declared relative to the file that declares them (neither
 * sets a baseUrl).
 */
const pathMaps = [
    { name: 'type-tests/tsconfig.base.json', dir: join(pkgRoot, 'type-tests') },
    { name: 'tsconfig.json (root)', dir: resolve(pkgRoot, '../..'), file: 'tsconfig.json' },
].map(({ name, dir, file }) => {
    const config = readJsonc(join(dir, file ?? 'tsconfig.base.json')) as {
        compilerOptions: { paths: Record<string, string[]> };
    };
    return { name, paths: config.compilerOptions.paths, candidateRoot: dir };
});

/**
 * TS subpath exports: everything whose `types` target is an emitted
 * declaration file. `./css` is excluded by that test: its `types` is the
 * static empty module beside the stylesheet (`css/base.d.ts`), which has no
 * source twin to map.
 */
const typedSubpaths = Object.entries(exportsMap)
    .filter((entry): entry is [string, { types: string }] =>
        typeof entry[1] === 'object' && typeof entry[1].types === 'string')
    .map(([key, value]) => ({ key, types: value.types }))
    .filter(({ key, types }) => key !== '.' && types.startsWith('./dist/'));

describe.each(pathMaps)('$name paths map covers the export surface', ({ paths, candidateRoot }) => {
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
