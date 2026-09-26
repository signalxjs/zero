/**
 * The APG menubar over Menu (#289), in real engines.
 *
 * The unit suite proves the coordination — the roving stop, the bar value
 * each key writes, the hover switch — against a stubbed popover. What only
 * a real engine can show is the top layer doing its part: showing one
 * `popover="auto"` menu hides the sibling it replaces without stealing the
 * focus the new menu takes, a native Escape hands focus back to the right
 * trigger, a pointer that clicks the open trigger survives light dismiss
 * racing the click, and `:dir(rtl)` set after boot flips the arrows.
 *
 * Every locator goes through the bar's accessible name (`Editor`) — the page
 * renders two bars, and the Menu page renders its own `View` menu button.
 */
import { test, expect, type Page } from '@playwright/test';
import { controlledPopup } from './demo';
import { bootPage } from './nav';

test.beforeEach(async ({ page }, testInfo) => {
    // Linux WebKit headless does not reliably synthesize keyboard input.
    test.skip(testInfo.project.name === 'webkit' && process.platform === 'linux', 'headless WPE keyboard');
    await bootPage(page, 'menubar', 'basic');
});

const editor = (page: Page) => page.getByRole('menubar', { name: 'Editor' });
const trigger = (page: Page, name: string) => editor(page).getByRole('menuitem', { name, exact: true });
const popupOf = (page: Page, name: string) => controlledPopup(page, trigger(page, name), `the ${name} trigger`);
const openValue = (page: Page) => page.getByTestId('menubar-open');

test('the bar is one tab stop; arrows rove the triggers, skip the disabled one, and wrap', async ({ page }) => {
    await page.locator('main').getByText('The APG menubar').click();
    await page.keyboard.press('Tab');
    await expect(trigger(page, 'File')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(trigger(page, 'Edit')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(trigger(page, 'View')).toBeFocused();
    // Help is disabled: the wrap lands on File.
    await page.keyboard.press('ArrowRight');
    await expect(trigger(page, 'File')).toBeFocused();
    await page.keyboard.press('End');
    await expect(trigger(page, 'View')).toBeFocused();
    await expect(openValue(page)).toHaveText('(none)');

    // The stop follows focus: Shift+Tab out and Tab back lands on View.
    await page.keyboard.press('Shift+Tab');
    await expect(trigger(page, 'View')).not.toBeFocused();
    await page.keyboard.press('Tab');
    await expect(trigger(page, 'View')).toBeFocused();
});

test('ArrowRight/ArrowLeft inside an open menu move to the adjacent menu, on its first item', async ({ page }) => {
    await trigger(page, 'File').focus();
    await page.keyboard.press('ArrowDown');
    const file = await popupOf(page, 'File');
    const edit = await popupOf(page, 'Edit');
    await expect(file).toBeVisible();
    await expect(file.getByRole('menuitem', { name: 'New file' })).toBeFocused();

    await page.keyboard.press('ArrowRight');
    await expect(edit).toBeVisible();
    await expect(file).toBeHidden();
    await expect(edit.getByRole('menuitem', { name: 'Undo' })).toBeFocused();
    await expect(openValue(page)).toHaveText('edit');

    await page.keyboard.press('ArrowLeft');
    await expect(file).toBeVisible();
    await expect(edit).toBeHidden();
    await expect(file.getByRole('menuitem', { name: 'New file' })).toBeFocused();

    // On a sub-trigger ArrowRight opens its submenu; inside it (an item that
    // opens nothing) ArrowRight closes the chain and moves on.
    const recent = file.locator('[data-part="sub-trigger"]', { hasText: 'Open recent' });
    await recent.focus();
    await page.keyboard.press('ArrowRight');
    const sub = await controlledPopup(page, recent, 'the Open recent sub-trigger');
    await expect(sub).toBeVisible();
    await expect(sub.getByRole('menuitem', { name: 'notes.md' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(edit).toBeVisible();
    await expect(sub).toBeHidden();
    await expect(file).toBeHidden();
    await expect(edit.getByRole('menuitem', { name: 'Undo' })).toBeFocused();
});

test('Escape closes back to the open menu\'s own trigger — after a switch too', async ({ page }) => {
    await trigger(page, 'File').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    const edit = await popupOf(page, 'Edit');
    await expect(edit).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(edit).toBeHidden();
    await expect(openValue(page)).toHaveText('(none)');
    await expect(trigger(page, 'Edit')).toBeFocused();
});

test('ArrowUp opens on the last item; Tab closes and moves past the bar', async ({ page }) => {
    await trigger(page, 'File').focus();
    await page.keyboard.press('ArrowUp');
    const file = await popupOf(page, 'File');
    await expect(file.getByRole('menuitem', { name: 'Save' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(file).toBeHidden();
    await expect(openValue(page)).toHaveText('(none)');
    await expect(editor(page).locator(':focus')).toHaveCount(0);
});

test('with a menu open, hovering another trigger switches; clicking the open trigger closes it', async ({ page }) => {
    const file = await popupOf(page, 'File');
    const edit = await popupOf(page, 'Edit');
    // No menu open: hover alone opens nothing.
    await trigger(page, 'Edit').hover();
    await expect(openValue(page)).toHaveText('(none)');

    await trigger(page, 'File').click();
    await expect(file).toBeVisible();
    await trigger(page, 'Edit').hover();
    await expect(edit).toBeVisible();
    await expect(file).toBeHidden();
    await expect(openValue(page)).toHaveText('edit');

    // A click on the trigger the hover just opened keeps it open…
    await trigger(page, 'Edit').click();
    await expect(edit).toBeVisible();
    await expect(openValue(page)).toHaveText('edit');
    // …and a second click on it closes.
    await trigger(page, 'Edit').click();
    await expect(edit).toBeHidden();
    await expect(openValue(page)).toHaveText('(none)');
});

test('selecting an item closes the bar and returns focus to its trigger', async ({ page }) => {
    await trigger(page, 'File').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(await popupOf(page, 'Edit')).toBeHidden();
    await expect(trigger(page, 'Edit')).toBeFocused();
});

test('under RTL the horizontal arrows flip, between triggers and between menus', async ({ page }) => {
    // After boot: an init script runs before documentElement exists (see rtl.spec).
    await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
    await trigger(page, 'File').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(trigger(page, 'Edit')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(trigger(page, 'File')).toBeFocused();

    await page.keyboard.press('ArrowDown');
    const edit = await popupOf(page, 'Edit');
    await page.keyboard.press('ArrowLeft');
    await expect(edit).toBeVisible();
    await expect(edit.getByRole('menuitem', { name: 'Undo' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(edit).toBeHidden();
    await expect(openValue(page)).toHaveText('file');
});

test('a vertical bar roves with Up/Down and opens with the inline-end arrow', async ({ page }) => {
    const tools = page.getByRole('menubar', { name: 'Tools' });
    await expect(tools).toHaveAttribute('aria-orientation', 'vertical');
    const format = tools.getByRole('menuitem', { name: 'Format', exact: true });
    const insert = tools.getByRole('menuitem', { name: 'Insert', exact: true });
    await format.focus();
    await page.keyboard.press('ArrowDown');
    await expect(insert).toBeFocused();
    await page.keyboard.press('ArrowRight');
    const popup = await controlledPopup(page, insert, 'the Insert trigger');
    await expect(popup).toBeVisible();
    await expect(popup.getByRole('menuitem', { name: 'Image' })).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(popup).toBeHidden();
    await expect(insert).toBeFocused();
});
