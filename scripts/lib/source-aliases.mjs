/**
 * The source aliases vitest resolves the workspace packages through (#195):
 * each `@sigx/*` specifier maps to the package's TypeScript source, so tests
 * run against `src/` without a build.
 *
 * Two things the hand-written map got wrong, and this module exists to keep
 * right:
 *
 * - Paths come from `fileURLToPath`, never `URL.pathname` — the latter keeps
 *   percent-escapes, so a checkout under a directory with a space in its
 *   name (`my%20dir`) broke every alias.
 * - `@sigx/zero/<sub>` is derived from zero's own `exports` map: every
 *   published subpath with an `import` condition (`./dist/X.js`) aliases to
 *   its source (`src/X.ts`). Vite's string aliases are prefix matches, so the
 *   bare `'@sigx/zero'` entry used to swallow any subpath without its own
 *   entry and resolve `@sigx/zero/theme` to `src/index.ts/theme`. Every entry
 *   here is an anchored regex, so order no longer decides the match; a last
 *   `@sigx/zero/*` → `src/*` fallback mirrors the tsconfig `paths`.
 */
import { readFileSync } from 'node:fs';
// node:url's URL, not the global one — under a DOM test environment the
// global is the DOM's, which fileURLToPath refuses.
import { URL, fileURLToPath } from 'node:url';

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const exact = (specifier, replacement) => ({ find: new RegExp(`^${escape(specifier)}$`), replacement });

/** The non-zero entries — each package's barrel and its hand-picked subpaths. */
const OTHER_ENTRIES = {
    '@sigx/zero-kit/build': 'zero-kit/src/build.ts',
    '@sigx/zero-kit/define': 'zero-kit/src/define.ts',
    '@sigx/zero-kit': 'zero-kit/src/index.ts',
    '@sigx/zero-basic': 'zero-basic/src/index.ts',
    '@sigx/zero-daisyui': 'zero-daisyui/src/index.ts',
    '@sigx/zero-material': 'zero-material/src/index.ts',
    '@sigx/zero-brutalist': 'zero-brutalist/src/index.ts',
    '@sigx/zero-heroui': 'zero-heroui/src/index.ts',
    '@sigx/zero-carbon': 'zero-carbon/src/index.ts',
    '@sigx/zero-ext-example/fragment': 'zero-ext-example/src/fragment.ts',
    '@sigx/zero-ext-example': 'zero-ext-example/src/index.ts',
};

/**
 * @param {URL | string} rootUrl the repo root, as a directory URL (trailing slash).
 * @param {Record<string, unknown>} [zeroExports] `@sigx/zero`'s `exports` map;
 *   read from `<root>/packages/zero/package.json` when omitted.
 * @returns {{ find: RegExp, replacement: string }[]} vite `resolve.alias` entries.
 */
export function sourceAliases(rootUrl, zeroExports) {
    const root = new URL(String(rootUrl));
    const at = (rel) => fileURLToPath(new URL(`packages/${rel}`, root));
    const exportsMap = zeroExports ?? JSON.parse(readFileSync(at('zero/package.json'), 'utf-8')).exports;

    const aliases = [];
    for (const [key, target] of Object.entries(exportsMap)) {
        const js = typeof target === 'object' && target !== null ? target.import : undefined;
        if (typeof js !== 'string') continue; // css, manifest.json — not modules
        const m = /^\.\/dist\/(.+)\.js$/.exec(js);
        if (!m) throw new Error(`@sigx/zero export "${key}" → "${js}" is not under ./dist/ — cannot map it to src/`);
        const specifier = key === '.' ? '@sigx/zero' : `@sigx/zero/${key.slice(2)}`;
        aliases.push(exact(specifier, at(`zero/src/${m[1]}.ts`)));
    }
    for (const [specifier, rel] of Object.entries(OTHER_ENTRIES)) aliases.push(exact(specifier, at(rel)));
    // An unexported zero module (tsconfig's `@sigx/zero/*`): vite resolves
    // the extension and a directory index itself.
    aliases.push({ find: /^@sigx\/zero\/(.+)$/, replacement: `${at('zero/src')}/$1` });
    return aliases;
}
