/**
 * A design system package may never import zero-kit's Node-only surface at
 * RUNTIME — only its types, or the `/define` subpath (AGENTS.md:
 * "devDependency of DS packages; never a runtime dependency" — `/define` is
 * the one carve-out, #318). The kit's barrel is Node-only: `artifacts.ts`
 * imports `node:fs/promises`, so one value import of it in a DS package's
 * runtime graph drags the Node built-ins into the browser and takes the
 * playground down with a module-externalized error — which is exactly how
 * this rule was learned (a `defineApi` value import in heroui's
 * `design-system.ts` hung the whole e2e suite).
 *
 * `/define` is allowed because its module graph is `node:`-free BY CONTRACT
 * — the second suite here walks the graph and fails on the first non-relative
 * import, so the carve-out cannot silently widen.
 *
 * Static by design: the check reads the source, so it fails on the import
 * statement itself rather than on whichever downstream consumer loads the
 * graph in a browser first.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const packagesDir = resolve(import.meta.dirname, '../..');
const dsPackages = readdirSync(packagesDir).filter((name) => name.startsWith('zero-') && name !== 'zero-kit');

/**
 * Value imports from zero-kit — `import { x }` / `import x`, but not
 * `import type` — from the barrel or ANY subpath except `/define`.
 */
const VALUE_IMPORT = /^import\s+(?!type\b)[^;]*from\s+['"]@sigx\/zero-kit(?!\/define['"])[^'"]*['"]/m;

describe.each(dsPackages)('%s stays free of runtime zero-kit imports', (pkg) => {
    const srcDir = resolve(packagesDir, pkg, 'src');
    let files: string[];
    try {
        files = readdirSync(srcDir).filter((f) => f.endsWith('.ts'));
    } catch {
        files = [];
    }

    it.each(files)('src/%s imports zero-kit as types or /define only', (file) => {
        const source = readFileSync(resolve(srcDir, file), 'utf8');
        const match = VALUE_IMPORT.exec(source);
        expect(
            match?.[0],
            `${pkg}/src/${file} imports @sigx/zero-kit's Node-only surface at runtime — use \`import type\`, or the /define subpath for the define* helpers (everything else breaks every browser consumer of this package)`,
        ).toBeUndefined();
    });
});

describe('the /define subpath is node:-free', () => {
    /**
     * Every value import/re-export specifier in one module. `import type` /
     * `export type` are erased at runtime and deliberately skipped — that is
     * how `api.ts` may reference the validator's types without dragging the
     * validator (and `culori`) into a browser graph.
     */
    const valueSpecifiers = (source: string): string[] => {
        const out: string[] = [];
        for (const re of [
            /^import\s+(?!type\b)[^;]*?from\s+['"]([^'"]+)['"]/gm,
            /^import\s+['"]([^'"]+)['"]/gm,
            /^export\s+(?!type\b)[^;]*?from\s+['"]([^'"]+)['"]/gm,
        ]) {
            for (const match of source.matchAll(re)) out.push(match[1]!);
        }
        return out;
    };

    it('reaches only relative modules — no node: built-ins, no dependencies', () => {
        const entry = resolve(packagesDir, 'zero-kit', 'src', 'define.ts');
        const queue = [entry];
        const seen = new Set<string>();
        while (queue.length > 0) {
            const file = queue.pop()!;
            if (seen.has(file)) continue;
            seen.add(file);
            for (const spec of valueSpecifiers(readFileSync(file, 'utf8'))) {
                expect(
                    spec.startsWith('./') || spec.startsWith('../'),
                    `${file} imports "${spec}" — the /define graph is the one zero-kit surface a browser bundle may contain, so it may only reach relative modules`,
                ).toBe(true);
                queue.push(resolve(dirname(file), spec.replace(/\.js$/, '.ts')));
            }
        }
        // The graph is real, not an empty walk: define plus its authoring core.
        expect(seen.size).toBeGreaterThanOrEqual(5);
    });
});
