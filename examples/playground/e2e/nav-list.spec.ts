/**
 * NavList button mode (#451) under a real engine.
 *
 * The unit suite proves the markup: a Link without an `href` renders a
 * `<button type="button">` carrying `aria-current` and `data-state`, and its
 * `onClick` runs. What only a browser can prove is that the element really is
 * a keyboard control — a real Tab stops on every link, and a real Enter or
 * Space activates it — because the part re-implements none of that; it is
 * the native button's.
 */
import { test, expect, type Page } from '@playwright/test';
import { bootPage } from './nav';
import { rootLabelled } from './demo';

test.beforeEach(async ({ page }) => {
    await bootPage(page, 'nav-list', 'basic');
});

/** The state-driven demo's root, named by the text on it. */
const project = (page: Page) => rootLabelled(page, 'nav-list', 'Overview');

test('a link without an href is a button, and a click moves current', async ({ page }) => {
    const root = project(page);
    await expect(root).toHaveAttribute('aria-label', 'Project');
    const links = root.getByRole('button');
    await expect(links).toHaveText([/Overview/, /Activity/, /Members/]);
    await expect(root.getByRole('link')).toHaveCount(0);
    const current = root.locator('[aria-current="page"]');
    await expect(current).toContainText('Overview');
    await root.getByRole('button', { name: 'Members' }).click();
    await expect(current).toContainText('Members');
    await expect(root.getByRole('button', { name: 'Members' })).toHaveAttribute('data-state', 'active');
    await expect(root.getByRole('button', { name: 'Overview' })).toHaveAttribute('data-state', 'inactive');
    await expect(page.getByTestId('nav-list-view')).toHaveText('view: members');
});

for (const key of ['Enter', ' '] as const) {
    test(`Tab reaches each link and ${key === ' ' ? 'Space' : key} moves current`, async ({ page }, testInfo) => {
        const webkit = testInfo.project.name === 'webkit';
        // Linux WebKit headless does not reliably synthesize keyboard input.
        test.skip(webkit && process.platform === 'linux', 'headless WPE keyboard');
        // WebKit's default Tab skips links and buttons (Safari's "press Tab
        // to highlight each item" is off); Option+Tab is its full order.
        const tab = webkit ? 'Alt+Tab' : 'Tab';
        const root = project(page);
        const button = (name: string) => root.getByRole('button', { name, exact: false });
        await button('Overview').focus();
        await page.keyboard.press(tab);
        await expect(button('Activity')).toBeFocused();
        await page.keyboard.press(tab);
        await expect(button('Members')).toBeFocused();

        await page.keyboard.press(key);
        await expect(button('Members')).toHaveAttribute('aria-current', 'page');
        await expect(button('Overview')).not.toHaveAttribute('aria-current', /./);
        await expect(page.getByTestId('nav-list-view')).toHaveText('view: members');
        // Activation keeps focus where it was.
        await expect(button('Members')).toBeFocused();

        await page.keyboard.press(webkit ? 'Alt+Shift+Tab' : 'Shift+Tab');
        await expect(button('Activity')).toBeFocused();
        await page.keyboard.press(key);
        await expect(button('Activity')).toHaveAttribute('aria-current', 'page');
        await expect(button('Members')).not.toHaveAttribute('aria-current', /./);
    });
}
