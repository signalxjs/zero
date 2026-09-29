/**
 * Tabs' content geometry (#530) under real layout — material, the skin that
 * draws with it. Its own file because every other tabs spec boots basic.
 */
import { test, expect, type Locator, type Page } from '@playwright/test';
import { bootPage } from './nav';
import { demoLabelled, settledBox } from './demo';

/** The main Tabs demo, named by the text on it (`demo.ts`). */
const demo = (page: Page) => demoLabelled(page, 'tabs', 'Overview');
/** A tab within the demo, by its visible label — identity, not position. */
const tab = (page: Page, name: string) =>
    demo(page)('tab').filter({ hasText: name });

/**
 * The content geometry (#530): material's primary indicator is content-width
 * — it runs under the active tab's `Tabs.TabLabel`, not across the tab — and
 * its secondary one still spans the tab. Measured in boxes on both edges, in
 * both directions: the inline offset of the label is taken from the list's
 * inline-start edge, the same as the tab's, so RTL needs no correction.
 */
test.describe('the content-width indicator (material, #530)', () => {
    test.beforeEach(async ({ page }) => {
        await bootPage(page, 'tabs', 'material');
    });

    /** Polled, then asserted again once settled — `expectIndicatorOn`'s shape. */
    async function expectOn(indicator: Locator, target: Locator, tabBox: Locator, what: string): Promise<void> {
        const edges = async () => {
            const [t, i] = await Promise.all([target.boundingBox(), indicator.boundingBox()]);
            if (!t || !i) return Infinity;
            return Math.max(Math.abs(i.x - t.x), Math.abs(i.x + i.width - (t.x + t.width)));
        };
        await expect.poll(edges, { message: `the indicator never reached ${what}` }).toBeLessThanOrEqual(1);
        const t = await settledBox(target, what);
        const i = await settledBox(indicator, 'indicator');
        const tab = await settledBox(tabBox, `${what}'s tab`);
        expect(Math.abs(i.x - t.x), `indicator's left edge vs ${what}'s`).toBeLessThanOrEqual(1);
        expect(Math.abs(i.x + i.width - (t.x + t.width)), `indicator's right edge vs ${what}'s`).toBeLessThanOrEqual(1);
        // Still on the tab's block-end edge, where the tab's own bar was.
        expect(Math.abs(i.y + i.height - (tab.y + tab.height)), `indicator's bottom edge vs the tab's`).toBeLessThanOrEqual(1);
    }

    for (const dir of ['ltr', 'rtl'] as const) {
        test(`the primary indicator lands on the active tab's label (${dir})`, async ({ page }) => {
            if (dir === 'rtl') {
                // AFTER boot: an init script runs before documentElement exists (rtl.spec.ts).
                await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
                await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
            }
            const indicator = demo(page)('indicator');
            for (const name of ['Overview', 'History', 'Details']) {
                await tab(page, name).click();
                await expect(tab(page, name)).toHaveAttribute('data-state', 'active');
                const label = demo(page)('tab-label').filter({ hasText: name });
                const [l, t] = [await settledBox(label, `${name} label`), await settledBox(tab(page, name), `${name} tab`)];
                // Not vacuous: the label really is narrower than its tab.
                expect(t.width - l.width, `${name}'s label is inset in its tab`).toBeGreaterThan(8);
                await expectOn(indicator, label, tab(page, name), `the ${name} label`);
            }
        });
    }

    test('the secondary indicator still spans the tab', async ({ page }) => {
        const secondary = demoLabelled(page, 'tabs', 'secondary one');
        const target = secondary('tab').filter({ hasText: 'secondary two' });
        await target.click();
        await expect(target).toHaveAttribute('data-state', 'active');
        await expectOn(secondary('indicator'), target, target, 'the secondary tab');
    });
});
