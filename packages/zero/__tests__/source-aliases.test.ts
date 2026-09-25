/**
 * The vitest source aliases (#195). `@sigx/zero/<sub>` must resolve to the
 * source file behind that published subpath — a bare `'@sigx/zero'` string
 * alias is a prefix match, so an unaliased subpath used to become
 * `packages/zero/src/index.ts/theme` — and every alias must be a real
 * filesystem path even when the checkout sits under a directory with a
 * space in its name (`URL.pathname` keeps the `%20`).
 */
import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
// @ts-expect-error — a plain ESM module, no declarations by design.
import { sourceAliases } from '../../../scripts/lib/source-aliases.mjs';
import zeroPkg from '../package.json';

type Alias = { find: string | RegExp; replacement: string };

function resolveWith(aliases: Alias[], id: string): string | undefined {
    for (const { find, replacement } of aliases) {
        if (typeof find === 'string') {
            if (id === find) return replacement;
            if (id.startsWith(find + '/')) return replacement + id.slice(find.length);
        } else if (find.test(id)) {
            return id.replace(find, replacement);
        }
    }
    return undefined;
}

// A real platform path as the root, so the expectations carry a drive letter
// on Windows — a drive-less `file:///repo/` makes fileURLToPath throw there.
const spaced = join(tmpdir(), 'my dir');
const repo = join(tmpdir(), 'repo');
const rootUrl = (dir: string) => pathToFileURL(dir + sep);

describe('sourceAliases', () => {
    it('maps every alias to a decoded filesystem path under a root with a space', () => {
        const aliases: Alias[] = sourceAliases(rootUrl(spaced), zeroPkg.exports);
        expect(rootUrl(spaced).href).toContain('%20');
        for (const { replacement } of aliases) {
            expect(replacement).not.toContain('%20');
            expect(replacement.startsWith(join(spaced, 'packages'))).toBe(true);
        }
    });

    it('routes a published subpath to its own source file and the bare name to the barrel', () => {
        const aliases: Alias[] = sourceAliases(rootUrl(repo), zeroPkg.exports);
        // The regex fallback splices `/$1` onto a platform path; normalise
        // separators on both sides so the comparison is about the target.
        const norm = (p: string | undefined) => p?.replace(/\\/g, '/');
        const at = (id: string) => norm(resolveWith(aliases, id));
        const src = (...rel: string[]) => norm(join(repo, 'packages', ...rel));
        expect(at('@sigx/zero')).toBe(src('zero/src/index.ts'));
        expect(at('@sigx/zero/theme')).toBe(src('zero/src/theme/index.ts'));
        expect(at('@sigx/zero/theme/registry')).toBe(src('zero/src/theme/registry.ts'));
        expect(at('@sigx/zero/tabs')).toBe(src('zero/src/components/tabs/index.ts'));
        expect(at('@sigx/zero/anatomy')).toBe(src('zero/src/anatomy.ts'));
        expect(at('@sigx/zero/behaviors/typeahead')).toBe(src('zero/src/behaviors/typeahead'));
        expect(at('@sigx/zero-kit')).toBe(src('zero-kit/src/index.ts'));
        expect(at('@sigx/zero-kit/define')).toBe(src('zero-kit/src/define.ts'));
        expect(at('@sigx/zero-ext-example/fragment')).toBe(src('zero-ext-example/src/fragment.ts'));
    });
});
