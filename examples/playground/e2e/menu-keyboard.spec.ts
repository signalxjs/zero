/**
 * Menu-button keyboard behaviour the platform owns (#175).
 *
 * The unit suite proves the popup asks for the right end and that Enter on a
 * link item is not prevented; only a real engine proves the consequence — the
 * unprevented Enter becomes the anchor's own click, which navigates. The
 * same holds for Tab (#263): the unit suite proves the close and that the
 * key is not prevented; only a real engine moves focus to the next stop.
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

// The next tab stop after the Actions menu in document order: the context
// menu's surface, named by its own text.
const contextSurface = (page: Page) =>
    page.locator('[data-scope="menu"][data-part="context-trigger"]', { hasText: 'Right-click' });

test('Tab closes the menu and focus moves on to the next tab stop (#263)', async ({ page }) => {
    await actions(page).focus();
    await page.keyboard.press('ArrowDown');
    const popup = await controlledPopup(page, actions(page), 'the Actions menu trigger');
    await expect(popup.locator('[data-part="item"]', { hasText: 'Rename' })).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(popup).toHaveAttribute('data-state', 'closed');
    await expect(popup).toBeHidden();
    // Not pulled back to the trigger and moved on from there — the stop
    // after the menu, reached from the item itself.
    await expect(contextSurface(page)).toBeFocused();
});

test('Shift+Tab closes the menu and focus moves to the previous tab stop (#263)', async ({ page }, testInfo) => {
    await actions(page).focus();
    await page.keyboard.press('ArrowUp');
    const popup = await controlledPopup(page, actions(page), 'the Actions menu trigger');
    await expect(popup.locator('[data-part="item"]', { hasText: 'Delete' })).toBeFocused();

    await page.keyboard.press('Shift+Tab');
    await expect(popup).toHaveAttribute('data-state', 'closed');
    await expect(popup).toBeHidden();
    await expect(actions(page)).toHaveAttribute('aria-expanded', 'false');
    if (testInfo.project.name !== 'webkit') {
        // The stop before the item in document order is the trigger.
        await expect(actions(page)).toBeFocused();
        return;
    }
    // WebKit leaves buttons out of the Tab order by default, so the stop
    // before the item is the one before the trigger: the same element a
    // Shift+Tab from the trigger itself reaches — and never the trigger,
    // which would mean the close had pulled focus back.
    await expect(actions(page)).not.toBeFocused();
    const landed = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return false;
        el.setAttribute('data-test-landed', '');
        return true;
    });
    expect(landed, 'Shift+Tab left focus on nothing').toBe(true);
    await actions(page).focus();
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('[data-test-landed]')).toBeFocused();
});

test('Tab from a nested submenu closes the whole chain (#263)', async ({ page }) => {
    await actions(page).focus();
    await page.keyboard.press('ArrowDown');
    const popup = await controlledPopup(page, actions(page), 'the Actions menu trigger');
    const share = popup.locator('[data-part="sub-trigger"]', { hasText: 'Share' });
    await share.focus();
    await page.keyboard.press('ArrowRight');
    const sharePopup = await controlledPopup(page, share, 'the Share sub-trigger');
    const social = sharePopup.locator('[data-part="sub-trigger"]', { hasText: 'Social' });
    await social.focus();
    await page.keyboard.press('ArrowRight');
    const socialPopup = await controlledPopup(page, social, 'the Social sub-trigger');
    await expect(socialPopup.getByRole('menuitem', { name: 'Mastodon' })).toBeFocused();

    await page.keyboard.press('Tab');
    for (const level of [socialPopup, sharePopup, popup]) {
        await expect(level).toHaveAttribute('data-state', 'closed');
        await expect(level).toBeHidden();
    }
    await expect(contextSurface(page)).toBeFocused();
});
