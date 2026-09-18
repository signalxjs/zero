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
