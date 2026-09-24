/**
 * Toast's runtime-managed presence, in real engines.
 *
 * This is the half the unit suite cannot prove: that the enter flip survives
 * real style/paint timing (the closed frame must be computed before `open`
 * lands or no transition plays), and that the exit hand-off — keep the node
 * until `transitionend`, with the computed-duration fallback — actually
 * unmounts in every engine, including under reduced motion where the
 * transition collapses to nothing.
 */
import { test, expect } from '@playwright/test';
import { bootPage } from './nav';
import { demoLabelled, rootLabelled } from './demo';

test.beforeEach(async ({ page }) => {
    await bootPage(page, 'toast', 'basic');
});

test('a toast enters, reaches open, and unmounts after close', async ({ page }) => {
    await page.getByRole('button', { name: 'Success toast' }).click();
    const root = page.locator('[data-scope="toast"][data-part="root"]');
    await expect(root).toHaveAttribute('data-state', 'open');
    const viewport = page.locator('[data-scope="toast"][data-part="viewport"]');
    await expect(viewport).toBeVisible();
    await root.locator('[data-part="close"]').click();
    // Removed only after the exit transition (or instantly without one) —
    // and never wedged.
    await expect(root).toHaveCount(0);
});

test('an updated toast keeps its identity and its new content', async ({ page }) => {
    await page.getByRole('button', { name: 'Progress → done' }).click();
    const root = page.locator('[data-scope="toast"][data-part="root"]');
    await expect(root.locator('[data-part="title"]')).toHaveText('Uploading…');
    await expect(root.locator('[data-part="title"]')).toHaveText('Upload complete');
    await expect(root).toHaveCount(1);
    // The re-armed duration (4s) eventually dismisses it.
    await expect(root).toHaveCount(0, { timeout: 10_000 });
});

test('stacked toasts publish their index and count', async ({ page }) => {
    await page.getByRole('button', { name: 'Success toast' }).click();
    await page.getByRole('button', { name: 'With action' }).click();
    const roots = page.locator('[data-scope="toast"][data-part="root"]');
    await expect(roots).toHaveCount(2);
    await expect(roots.nth(1)).toHaveAttribute('data-state', 'open');
    const vars = await roots.nth(1).evaluate((el) => [
        el.style.getPropertyValue('--toast-index'),
        el.style.getPropertyValue('--toast-count'),
    ]);
    expect(vars).toEqual(['1', '2']);
});

test('a keyboard close of the focused toast does not leave the queue paused (#168)', async ({ page }) => {
    // Keyboard only, so the pointer never enters the viewport: the only
    // pause is the focus one. Removing the focused Close fires no focusout
    // in Firefox/WebKit, which used to leave that pause stuck.
    await page.getByRole('button', { name: 'Success toast' }).focus();
    await page.keyboard.press('Enter');
    const saved = rootLabelled(page, 'toast', 'Saved');
    const savedPart = demoLabelled(page, 'toast', 'Saved');
    await expect(saved).toHaveAttribute('data-state', 'open');
    await savedPart('close').focus();
    await page.keyboard.press('Enter');
    await expect(saved).toHaveCount(0);

    await page.getByRole('button', { name: 'Error alert' }).focus();
    await page.keyboard.press('Enter');
    const failed = rootLabelled(page, 'toast', 'Sync failed');
    await expect(failed).toHaveAttribute('data-state', 'open');
    // The default 5s duration runs: the next toast auto-dismisses.
    await expect(failed).toHaveCount(0, { timeout: 10_000 });
});
