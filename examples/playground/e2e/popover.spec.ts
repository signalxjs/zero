/**
 * Popover — `popover="auto"` in real engines.
 *
 * The unit suite proves the state machine; this proves the parts the
 * platform and the focus behaviors own: the top layer actually showing, the
 * dialog-role focus move on open (#324's `focusFirst` — an unshown popover
 * cannot take focus, so the move is deferred past `showPopover()`), native
 * light dismiss and Escape, and focus restore to the trigger on close.
 */
import { test, expect, type Page } from '@playwright/test';
import { bootPage } from './nav';
import { controlledPopup } from './demo';

test.beforeEach(async ({ page }) => {
    await bootPage(page, 'popover', 'basic');
});

/**
 * `Popover.Root` renders no element, so the Filters demo is pinned by its
 * trigger's text and the popup resolves through `aria-controls` (`demo.ts`).
 */
const trigger = (page: Page) => page.getByRole('button', { name: 'Filters', exact: true });

test('open moves focus to the first tabbable inside the popup (#324)', async ({ page }) => {
    const t = trigger(page);
    await t.click();
    const popup = await controlledPopup(page, t, 'the Filters trigger');
    await expect(popup).toHaveAttribute('data-state', 'open');
    await expect(popup).toBeVisible();

    // APG dialog-role popup: focus moves in on open. The demo's first
    // tabbable is the Switch's native input — landing there (not on the
    // popup itself) proves focusFirst ran AND found the tabbable; the
    // popup's own tabIndex=-1 is only the fallback for tabbable-less
    // content.
    await expect(popup.locator('[data-scope="switch"][data-part="hidden-input"]')).toBeFocused();
});

test('Escape closes and focus returns to the trigger', async ({ page }) => {
    const t = trigger(page);
    // Keyboard open, so the trigger genuinely HOLDS focus before the popup
    // takes it — WebKit does not focus buttons on click, so a click-open
    // would leave the restore target as body and assert nothing.
    await t.focus();
    await page.keyboard.press('Enter');
    const popup = await controlledPopup(page, t, 'the Filters trigger');
    await expect(popup).toHaveAttribute('data-state', 'open');
    await page.keyboard.press('Escape');
    await expect(popup).toHaveAttribute('data-state', 'closed');
    await expect(popup).not.toBeVisible();
    await expect(t).toBeFocused();
});

test('a genuinely outside click light-dismisses', async ({ page }) => {
    const t = trigger(page);
    await t.click();
    const popup = await controlledPopup(page, t, 'the Filters trigger');
    await expect(popup).toHaveAttribute('data-state', 'open');
    // popover="auto": light dismiss is the platform's, not a zero handler.
    await page.locator('h1').click();
    await expect(popup).toHaveAttribute('data-state', 'closed');
});

test('the Close button closes and restores focus to the trigger', async ({ page }) => {
    const t = trigger(page);
    // Keyboard open — see the Escape test for why (WebKit click focus).
    await t.focus();
    await page.keyboard.press('Enter');
    const popup = await controlledPopup(page, t, 'the Filters trigger');
    await expect(popup).toHaveAttribute('data-state', 'open');
    await popup.locator('[data-part="close"]', { hasText: 'Done' }).click();
    await expect(popup).toHaveAttribute('data-state', 'closed');
    await expect(t).toBeFocused();
});

test('the popup is a labelled dialog anchored under its trigger', async ({ page }) => {
    const t = trigger(page);
    await t.click();
    const popup = await controlledPopup(page, t, 'the Filters trigger');
    await expect(popup).toHaveAttribute('role', 'dialog');
    const titleId = await popup.locator('[data-part="title"]').getAttribute('id');
    expect(titleId).toBeTruthy();
    await expect(popup).toHaveAttribute('aria-labelledby', titleId!);
});
