/**
 * Submenus over nested `popover="auto"`, in real engines.
 *
 * The unit suite proves the state machine; this proves the parts the
 * platform owns: nested auto popovers keeping ancestors open, Escape
 * closing exactly one level, and focus really moving on keyboard open.
 */
import { test, expect, type Page } from '@playwright/test';
import { controlledPopup } from './demo';
import { bootPage } from './nav';

test.beforeEach(async ({ page }) => {
    await bootPage(page, 'menu', 'basic');
});

/**
 * The Actions menu and its levels, each pinned by the `aria-controls` id its
 * own trigger publishes.
 *
 * `Menu.Root` renders no element, so there is no demo root to hang these off —
 * and the playground holds a second menu (the right-click surface, with its own
 * `Send to` submenu). `menu/popup`.first() and `sub-popup`.nth(n) resolved
 * across BOTH of them and were right only because the Actions demo precedes the
 * context menu in document order. The published id is the link between one
 * trigger and one surface. See `demo.ts`.
 */
const trigger = (page: Page) => page.getByRole('button', { name: 'Actions', exact: true });
const subTrigger = (page: Page, text: string) =>
    page.locator('[data-scope="menu"][data-part="sub-trigger"]', { hasText: text });
const popup = (page: Page) => controlledPopup(page, trigger(page), 'the Actions menu trigger');
const subPopup = (page: Page, text: string) =>
    controlledPopup(page, subTrigger(page, text), `the ${text} sub-trigger`);

test('keyboard opens a nested submenu; Escape closes one level at a time', async ({ page }, testInfo) => {
    // Linux WebKit headless does not reliably synthesize keyboard input.
    test.skip(testInfo.project.name === 'webkit' && process.platform === 'linux', 'headless WPE keyboard');
    await trigger(page).click();
    const share = subTrigger(page, 'Share');
    await share.focus();
    await page.keyboard.press('ArrowRight');
    const sharePopup = await subPopup(page, 'Share');
    await expect(sharePopup).toHaveAttribute('data-state', 'open');
    // Focus moved to the first sub item on keyboard open.
    await expect(sharePopup.locator('[data-part="item"]', { hasText: 'Email' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(sharePopup).toHaveAttribute('data-state', 'closed');
    // The parent level survives the first Escape.
    await expect(await popup(page)).toHaveAttribute('data-state', 'open');
    await page.keyboard.press('Escape');
    await expect(await popup(page)).toHaveAttribute('data-state', 'closed');
});

test('hover opens with intent delay and selection bubbles to the root', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', (msg) => logs.push(msg.text()));
    await trigger(page).click();
    await subTrigger(page, 'Share').hover();
    const sharePopup = await subPopup(page, 'Share');
    await expect(sharePopup).toHaveAttribute('data-state', 'open');
    await sharePopup.locator('[data-part="item"]', { hasText: 'Copy link' }).click();
    await expect(await popup(page)).toHaveAttribute('data-state', 'closed');
    expect(logs.some((l) => l.includes('menu select: link'))).toBe(true);
});

test('a third level opens while both ancestors stay open', async ({ page }) => {
    await trigger(page).click();
    await subTrigger(page, 'Share').hover();
    // Leaving the trigger before the submenu opens cancels the pending open
    // (a swipe across an item must not open it) — wait like a human would.
    const sharePopup = await subPopup(page, 'Share');
    await expect(sharePopup).toHaveAttribute('data-state', 'open');
    await subTrigger(page, 'Social').hover();
    const socialPopup = await subPopup(page, 'Social');
    await expect(socialPopup).toHaveAttribute('data-state', 'open');
    await expect(sharePopup).toHaveAttribute('data-state', 'open');
    await expect(await popup(page)).toHaveAttribute('data-state', 'open');
    await expect(socialPopup.locator('[data-part="item"]', { hasText: 'Mastodon' })).toBeVisible();
});
