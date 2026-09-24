/**
 * The vitest source aliases (#195). `@sigx/zero/<sub>` must resolve to the
 * source file behind that published subpath — a bare `'@sigx/zero'` string
 * alias is a prefix match, so an unaliased subpath used to become
 * `packages/zero/src/index.ts/theme` — and every alias must be a real
 * filesystem path even when the checkout sits under a directory with a
 * space in its name (`URL.pathname` keeps the `%20`).
 */
import { describe, it, expect } from 'vitest';
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

describe('sourceAliases', () => {
    it('maps every alias to a decoded filesystem path under a root with a space', () => {
        const aliases: Alias[] = sourceAliases('file:///tmp/my%20dir/', zeroPkg.exports);
        for (const { replacement } of aliases) {
            expect(replacement).not.toContain('%20');
            expect(replacement.replace(/\\/g, '/')).toContain('/tmp/my dir/packages/');
        }
    });

    it('routes a published subpath to its own source file and the bare name to the barrel', () => {
        const aliases: Alias[] = sourceAliases('file:///repo/', zeroPkg.exports);
        const at = (id: string) => resolveWith(aliases, id)?.replace(/\\/g, '/');
        expect(at('@sigx/zero')).toBe('/repo/packages/zero/src/index.ts');
        expect(at('@sigx/zero/theme')).toBe('/repo/packages/zero/src/theme/index.ts');
        expect(at('@sigx/zero/theme/registry')).toBe('/repo/packages/zero/src/theme/registry.ts');
        expect(at('@sigx/zero/tabs')).toBe('/repo/packages/zero/src/components/tabs/index.ts');
        expect(at('@sigx/zero/anatomy')).toBe('/repo/packages/zero/src/anatomy.ts');
        expect(at('@sigx/zero-kit')).toBe('/repo/packages/zero-kit/src/index.ts');
        expect(at('@sigx/zero-kit/define')).toBe('/repo/packages/zero-kit/src/define.ts');
        expect(at('@sigx/zero-ext-example/fragment')).toBe('/repo/packages/zero-ext-example/src/fragment.ts');
    });
});
