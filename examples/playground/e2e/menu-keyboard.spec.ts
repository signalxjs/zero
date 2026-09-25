/**
 * Menu-button keyboard behaviour the platform owns (#175).
 *
 * The unit suite proves the popup asks for the right end and that Enter on a
 * link item is not prevented; only a real engine proves the consequence — the
 * unprevented Enter becomes the anchor's own click, which navigates.
 */
import { test, expect, type Page } from '@playwright/test';
import { controlledPopup } from './demo';
import { bootPage } from './nav';

test.beforeEach(async ({ page }, testInfo) => {
    // Linux WebKit headless does not reliably synthesize keyboard input.
    test.skip(testInfo.project.name === 'webkit' && process.platform === 'linux', 'headless WPE keyboard');
    await bootPage(page, 'menu', 'basic');
});

const actions = (page: Page) => page.getByRole('button', { name: 'Actions', exact: true });
const goTo = (page: Page) => page.getByRole('button', { name: 'Go to', exact: true });

test('ArrowUp on the closed trigger opens on the last item, ArrowDown on the first', async ({ page }) => {
    await actions(page).focus();
    await page.keyboard.press('ArrowUp');
    const popup = await controlledPopup(page, actions(page), 'the Actions menu trigger');
    await expect(popup).toHaveAttribute('data-state', 'open');
    await expect(popup.locator('[data-part="item"]', { hasText: 'Delete' })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(popup).toHaveAttribute('data-state', 'closed');
    await expect(actions(page)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(popup).toHaveAttribute('data-state', 'open');
    await expect(popup.locator('[data-part="item"]', { hasText: 'Rename' })).toBeFocused();
});

test('Enter on an asChild link item navigates and still selects', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', (msg) => logs.push(msg.text()));
    await goTo(page).focus();
    await page.keyboard.press('ArrowUp');
    const popup = await controlledPopup(page, goTo(page), 'the Go to menu trigger');
    const dialogLink = popup.getByRole('menuitem', { name: 'Dialog page' });
    await expect(dialogLink).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/dialog$/);
    expect(logs.filter((l) => l.includes('go to select: dialog'))).toHaveLength(1);
});
