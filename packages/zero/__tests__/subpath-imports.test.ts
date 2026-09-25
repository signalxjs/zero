/**
 * `@sigx/zero/<sub>` imports resolve under vitest (#195). The bare
 * `'@sigx/zero'` string alias is a prefix match, so any subpath without an
 * alias of its own used to become `packages/zero/src/index.ts/theme` and
 * fail to load. The aliases are now derived from zero's `exports` map
 * (scripts/lib/source-aliases.mjs).
 */
import { describe, it, expect } from 'vitest';

describe('@sigx/zero subpaths under vitest', () => {
    it('resolve to their source modules, not into the barrel file', async () => {
        const theme = await import('@sigx/zero/theme');
        expect(typeof theme.themeController).toBe('function');
        const registry = await import('@sigx/zero/theme/registry');
        expect(typeof registry.registerThemes).toBe('function');
        const tabs = await import('@sigx/zero/tabs');
        expect(tabs.Tabs).toBeDefined();
        const listCore = await import('@sigx/zero/behaviors/core');
        expect(typeof listCore.createListController).toBe('function');
    });

    it('an unexported module resolves like tsconfig\'s `@sigx/zero/*` path', async () => {
        const typeahead = await import('@sigx/zero/behaviors/typeahead');
        expect(typeof typeahead.createTypeahead).toBe('function');
    });
});
