/**
 * `createHotkeys` in real engines (#460), through the playground's Hotkeys
 * page: one `<Hotkeys bindings={{ ']': bump }} />` and the three places it
 * must stay quiet. The unit suite (happy-dom) holds the matcher and the
 * guards it can reach; these are the ones it cannot — a real `dialog:modal`
 * from `showModal()`, a real `:popover-open` menu, and real key events from
 * an input. Semantics, not paint: one design system, every engine.
 */
import { test, expect, type Page } from '@playwright/test';
import { controlledPopup, demoPosting } from './demo';
import { bootPage } from './nav';

const count = (page: Page) => page.locator('[data-demo="hotkeys-count"]');

async function boot(page: Page): Promise<void> {
    await bootPage(page, 'hotkeys', 'basic');
    await expect(count(page)).toHaveText('Fired 0 times');
}

test('a binding fires from the page', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press(']');
    await expect(count(page)).toHaveText('Fired 1 times');
    // An unbound modifier chord is not the binding.
    await page.keyboard.press('Alt+]');
    await page.keyboard.press(']');
    await expect(count(page)).toHaveText('Fired 2 times');
});

test('typing in an input fires nothing — the key reaches the input', async ({ page }) => {
    await boot(page);
    const input = demoPosting(page, 'input', 'hotkeys-typing')('input');
    await input.click();
    await page.keyboard.type('a]b');
    await expect(input).toHaveValue('a]b');
    await expect(count(page)).toHaveText('Fired 0 times');
});

test('a modal dialog owns the keyboard', async ({ page }) => {
    await boot(page);
    const trigger = page.getByRole('button', { name: 'Open hotkeys dialog', exact: true });
    await trigger.press('Enter');
    const popup = await controlledPopup(page, trigger, 'the hotkeys dialog trigger');
    await expect(popup).toHaveAttribute('data-state', 'open');
    await expect(popup).toBeVisible();
    await page.keyboard.press(']');
    await page.keyboard.press(']');
    await expect(count(page)).toHaveText('Fired 0 times');
    await page.keyboard.press('Escape');
    await expect(popup).toBeHidden();
    await page.keyboard.press(']');
    await expect(count(page)).toHaveText('Fired 1 times');
});

test('an open menu owns the keyboard', async ({ page }) => {
    await boot(page);
    const trigger = page.getByRole('button', { name: 'Hotkeys menu', exact: true });
    await trigger.press('Enter');
    const popup = await controlledPopup(page, trigger, 'the hotkeys menu trigger');
    await expect(popup).toHaveAttribute('data-state', 'open');
    await expect(popup).toBeVisible();
    await page.keyboard.press(']');
    await expect(count(page)).toHaveText('Fired 0 times');
    await expect(popup).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(popup).toBeHidden();
    await page.keyboard.press(']');
    await expect(count(page)).toHaveText('Fired 1 times');
});
