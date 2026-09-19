/**
 * The app shell composition (#133): Navbar + responsive Drawer + NavList +
 * Container, no scope of its own. `drawer-responsive.spec.ts` proves the
 * dock/sheet mechanism; this proves the COMPOSITION holds it — the same
 * NavList rendered once is the docked sidebar at `md` and a sheet below it,
 * the trigger lives in the bar and hides when docked, and the page keeps
 * exactly one banner and one navigation landmark either way.
 */
import { test, expect, type Page } from '@playwright/test';
import { bootPage } from './nav';
import { controlledPopup } from './demo';

const WIDE = { width: 1280, height: 720 };
const NARROW = { width: 600, height: 720 };

const shell = (page: Page) => page.locator('[data-demo="app-shell"]');
/** By its label — `getByRole` skips a hidden trigger, and it is hidden when docked. */
const trigger = (page: Page) => shell(page).locator('[data-scope="drawer"][data-part="trigger"]');
const navList = (page: Page) => shell(page).locator('[data-scope="nav-list"][data-part="root"]');

async function boot(page: Page, viewport: { width: number; height: number }) {
    await page.setViewportSize(viewport);
    await bootPage(page, 'app-shell', 'basic');
    await expect(trigger(page)).toHaveCount(1);
}

test('wide: the sidebar is docked in flow beside main, the bar has no menu button', async ({ page }) => {
    await boot(page, WIDE);
    const panel = await controlledPopup(page, trigger(page), 'the shell drawer trigger');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-l-dock', 'inline');
    await expect(navList(page)).toBeVisible();
    await expect(trigger(page)).toBeHidden();
    // Side by side: the panel's right edge is at or left of main's left edge.
    const panelBox = (await panel.boundingBox())!;
    const mainBox = (await shell(page).locator('main').boundingBox())!;
    expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(mainBox.x + 1);
    expect(await navList(page).evaluate((el) => el.closest('[data-part="panel"]') !== null)).toBe(true);
});

test('narrow: the menu button opens the same navigation as a sheet', async ({ page }) => {
    await boot(page, NARROW);
    const panel = await controlledPopup(page, trigger(page), 'the shell drawer trigger');
    await expect(trigger(page)).toBeVisible();
    await expect(panel).toBeHidden();
    await trigger(page).click();
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-l-dock', 'sheet');
    await expect(navList(page)).toBeVisible();
    await expect(navList(page).getByRole('link', { name: /Overview/ })).toHaveAttribute('aria-current', 'page');
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
});

test('one header, one navigation landmark, in both regimes', async ({ page }) => {
    for (const viewport of [WIDE, NARROW]) {
        await boot(page, viewport);
        // The Navbar's <header> is the banner landmark only at document
        // scope (ARIA's rule, and the anatomy's reasoning); nested in a demo
        // it is a plain header, so this counts the element, not the role.
        expect(await shell(page).locator('header').count()).toBe(1);
        // The <nav> is NavList's; Navbar's <header> deliberately carries none.
        expect(await shell(page).locator('nav').count()).toBe(1);
        await expect(shell(page).locator('nav')).toHaveAttribute('aria-label', 'Main');
    }
});
