/**
 * Every scope a design system declares is rendered somewhere (#194).
 *
 * The sweeping specs — ds-smoke, the contrast audit, the axe audit,
 * press-feedback — only ever see what the playground renders. A scope the
 * manifest declares but no page renders is therefore invisible to all of
 * them at once, and nothing said so: `ext-stepper` (the ecosystem scope
 * zero-basic adopts from `@sigx/zero-ext-example`) compiled into zero-basic's
 * CSS and manifest for months without a single page rendering it.
 *
 * So: boot the kitchen-sink route once and require one element per declared
 * scope. The scope list is zero-basic's compiled manifest, read node-side like
 * ds-smoke reads it — the one design system that also merges an ecosystem
 * fragment, so its scope set is the widest. It is presence in the DOM, not
 * visibility: an overlay idles closed and still carries its scope.
 *
 * `VisuallyHidden` is deliberately not a scope (no anatomy, no recipe), so the
 * manifest cannot name it; it is held here by its own attribute on an element
 * that is NOT a part — which is exactly the standalone component, since a
 * part's `visuallyHidden` option stamps the same attribute on a scoped
 * element.
 *
 * Chromium only, one page load: which scopes render is engine-independent.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import type { DesignSystemManifest } from '@sigx/zero-kit';
import { ALL, bootPage } from './nav';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const manifest = JSON.parse(
    readFileSync(join(repoRoot, 'packages', 'zero-basic', 'dist', 'manifest.json'), 'utf8'),
) as DesignSystemManifest;
const declaredScopes = Object.keys(manifest.components);

test('every scope zero-basic declares renders on #/all, and so does VisuallyHidden', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'which scopes render is engine-independent');
    expect(declaredScopes.length).toBeGreaterThan(50);

    await bootPage(page, ALL, 'basic');
    const rendered = new Set(
        await page.locator('[data-scope]').evaluateAll(
            (els) => els.map((el) => el.getAttribute('data-scope') ?? ''),
        ),
    );
    const missing = declaredScopes.filter((scope) => !rendered.has(scope));
    expect(missing, `declared scopes no playground page renders: ${missing.join(', ')}`).toEqual([]);

    await expect(
        page.locator('[data-visually-hidden]:not([data-scope])'),
        'the standalone VisuallyHidden component renders somewhere',
    ).not.toHaveCount(0);
});
