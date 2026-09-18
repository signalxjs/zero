/**
 * Navigation for the paged playground.
 *
 * Every page of demos is hash-addressable (`/#/<id>` — see `src/router.ts`
 * and `src/pages/registry.ts`), so a spec boots straight onto the page it
 * drives instead of walking tabs. The design system is pinned through the
 * same `localStorage` key the toolbar persists to, BEFORE the document loads,
 * and the boot is only considered done once the pinned stylesheet is the live
 * one — asserting on `link[data-zero-ds]` is what makes a failed pin a
 * failure here rather than a mystery three assertions later.
 *
 * `ALL` is the kitchen-sink route: every page's demos on one document,
 * derived from the registry (`src/pages/all.tsx`). Sweeping specs
 * (press-feedback, ds-smoke) boot it to keep their documented
 * one-page-load cost model.
 */
import { expect, type Page } from '@playwright/test';

export const ALL = 'all';

/** Boot the playground on one page with one design system pinned. */
export async function bootPage(page: Page, pageId: string, ds: string): Promise<void> {
    await page.addInitScript((id) => {
        localStorage.setItem('zero-ds', id);
    }, ds);
    await page.goto(`/#/${pageId}`);
    await expect(page.locator('link[data-zero-ds]')).toHaveAttribute('data-zero-ds', ds);
}
