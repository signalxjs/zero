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

/**
 * Boot the playground on one page with one design system pinned.
 *
 * Done means four things, each waited on rather than assumed (#134):
 *
 * - the pinned link is the COMMITTED one. `data-zero-ds` is stamped the
 *   moment the link is created, parked behind `media="not all"`; the
 *   attribute alone is true before the stylesheet has loaded or painted.
 * - the app has rendered. `main.tsx` awaits the design system (stylesheet
 *   AND vocabulary) before `render(<App/>)`, so a boot that stopped at the
 *   link could hand a spec an empty document.
 * - the router is on THIS page. A second `bootPage` in the same test is a
 *   same-document hash change: `goto` returns at the commit, before
 *   `hashchange` re-renders, and the previous page is still the one showing.
 *   The sidebar's `aria-current` link is written from the router's state, so
 *   it names the page actually rendered — `all` included.
 * - the fonts are in. The skins' named faces are bundled web fonts, so
 *   until `document.fonts.ready` settles a box can still be measured in the
 *   fallback face (#45).
 */
export async function bootPage(page: Page, pageId: string, ds: string): Promise<void> {
    await page.addInitScript((id) => {
        localStorage.setItem('zero-ds', id);
    }, ds);
    await gotoPage(page, pageId, ds);
}

/**
 * Navigate to `pageId` on a page whose design system `bootPage` already
 * pinned, with the same three waits. For a spec that navigates one page many
 * times: calling `bootPage` again would register another init script on
 * every load, and they accumulate. (The axe audit, which loads ~90 times,
 * opens a fresh page per scan instead: #350.)
 */
export async function gotoPage(page: Page, pageId: string, ds: string): Promise<void> {
    await page.goto(`/#/${pageId}`);
    await expect(page.locator('link[data-zero-ds]')).toHaveAttribute('data-zero-ds', ds);
    await expect(page.locator(`link[data-zero-ds="${ds}"]:not([media])`)).toHaveCount(1);
    await expect(
        page.locator(`nav[aria-label="Pages"] a[href="#/${pageId}"][aria-current="page"]`),
        `the router rendered "${pageId}"`,
    ).toHaveCount(1);
    // The page's web fonts (src/fonts.ts). A face loads lazily, on first use,
    // and until it lands the text is laid out in the fallback — so a spec
    // that measures a box (the narrow sweep, the contrast audit's glyph
    // runs) would read the fallback's metrics on a cold cache and the real
    // face's on a warm one.
    await page.evaluate(async () => { await document.fonts.ready; });
}
