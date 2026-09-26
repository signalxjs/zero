/**
 * Breadcrumbs collapse (#295) under a real engine.
 *
 * The unit suite proves the markup — the middle items `hidden` with
 * `data-state="closed"`, the ellipsis open in their place, the trigger's
 * name and `aria-expanded`. What only a browser can prove is the keyboard
 * path: Tab steps from the leading link straight to the trigger (a hidden
 * item's link is no tab stop), a real Enter or Space expands the trail, and
 * focus lands on the first revealed link instead of falling to `<body>`
 * when the trigger hides under it.
 */
import { test, expect, type Page } from '@playwright/test';
import { bootPage } from './nav';
import { partsOf } from './demo';

test.beforeEach(async ({ page }) => {
    await bootPage(page, 'breadcrumbs', 'basic');
});

/** The collapsing demo, named by its landmark. */
const collapsed = (page: Page) => page.getByRole('navigation', { name: 'Collapsed breadcrumb', exact: true });

test('the middle crumbs hide behind an open ellipsis', async ({ page }) => {
    const root = collapsed(page);
    const part = partsOf(root, 'breadcrumbs');
    await expect(root.getByRole('link')).toHaveText(['Home', 'Mechanical']);
    for (const name of ['Catalog', 'Accessories', 'Keyboards']) {
        await expect(root.getByText(name, { exact: true })).toBeHidden();
    }
    await expect(part('ellipsis')).toHaveAttribute('data-state', 'open');
    const trigger = root.getByRole('button', { name: 'Show 3 more breadcrumbs', exact: true });
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

for (const key of ['Enter', ' '] as const) {
    test(`Tab reaches the trigger and ${key === ' ' ? 'Space' : key} expands onto the first revealed link`, async ({ page }, testInfo) => {
        const webkit = testInfo.project.name === 'webkit';
        // Linux WebKit headless does not reliably synthesize keyboard input.
        test.skip(webkit && process.platform === 'linux', 'headless WPE keyboard');
        // WebKit's default Tab skips links and buttons (Safari's "press Tab
        // to highlight each item" is off); Option+Tab is its full order.
        const tab = webkit ? 'Alt+Tab' : 'Tab';
        const root = collapsed(page);
        const part = partsOf(root, 'breadcrumbs');
        await root.getByRole('link', { name: 'Home', exact: true }).focus();
        await page.keyboard.press(tab);
        const trigger = part('ellipsis-trigger');
        await expect(trigger).toBeFocused();
        await expect(trigger).toHaveAttribute('data-focus-visible', '');

        await page.keyboard.press(key);
        await expect(root.getByRole('link')).toHaveText(['Home', 'Catalog', 'Accessories', 'Keyboards', 'Mechanical']);
        await expect(part('ellipsis')).toBeHidden();
        await expect(root.getByRole('link', { name: 'Catalog', exact: true })).toBeFocused();
        // …and the walk carries on through the revealed trail.
        await page.keyboard.press(tab);
        await expect(root.getByRole('link', { name: 'Accessories', exact: true })).toBeFocused();
    });
}
