/**
 * Toast's runtime-managed presence, in real engines.
 *
 * This is the half the unit suite cannot prove: that the enter flip survives
 * real style/paint timing (the closed frame must be computed before `open`
 * lands or no transition plays), and that the exit hand-off — keep the node
 * until `transitionend`, with the computed-duration fallback — actually
 * unmounts in every engine, including under reduced motion where the
 * transition collapses to nothing.
 *
 * And the keyboard/focus half (#269): where focus goes when the focused
 * toast leaves (never `<body>`), the F8 hotkey and Escape, and the viewport
 * re-stacking over a modal dialog — real focus, a real top layer.
 */
import { test, expect } from '@playwright/test';
import { bootPage } from './nav';
import { controlledPopup, demoLabelled, rootLabelled, settledBox } from './demo';

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
    // Focus went back to where it came from (#269), which is also what
    // releases the focus hold.
    await expect(page.getByRole('button', { name: 'Success toast', exact: true })).toBeFocused();

    await page.getByRole('button', { name: 'Error alert' }).focus();
    await page.keyboard.press('Enter');
    const failed = rootLabelled(page, 'toast', 'Sync failed');
    await expect(failed).toHaveAttribute('data-state', 'open');
    // The default 5s duration runs: the next toast auto-dismisses.
    await expect(failed).toHaveCount(0, { timeout: 10_000 });
});

test('F8 reaches the first toast; closing it by keyboard returns focus to the opener, never body (#269)', async ({ page }) => {
    const opener = page.getByRole('button', { name: 'Success toast', exact: true });
    await opener.focus();
    await page.keyboard.press('Enter');
    const saved = rootLabelled(page, 'toast', 'Saved');
    await expect(saved).toHaveAttribute('data-state', 'open');
    await page.keyboard.press('F8');
    await expect(saved).toBeFocused();
    // Into the toast, onto its Close, and activate it.
    await demoLabelled(page, 'toast', 'Saved')('close').focus();
    await page.keyboard.press('Enter');
    await expect(saved).toHaveCount(0);
    await expect(opener).toBeFocused();
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);
});

test('Escape on a focused toast dismisses it (#269)', async ({ page }) => {
    const opener = page.getByRole('button', { name: 'Success toast', exact: true });
    await opener.focus();
    await page.keyboard.press('Enter');
    const saved = rootLabelled(page, 'toast', 'Saved');
    await expect(saved).toHaveAttribute('data-state', 'open');
    await page.keyboard.press('F8');
    await expect(saved).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(saved).toHaveCount(0);
    await expect(opener).toBeFocused();
});

test('closing the focused one of two toasts moves focus to the other (#269)', async ({ page }) => {
    await page.getByRole('button', { name: 'Success toast', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'With action', exact: true }).focus();
    await page.keyboard.press('Enter');
    const saved = rootLabelled(page, 'toast', 'Saved');
    const undoable = rootLabelled(page, 'toast', 'Undoable action');
    await expect(saved).toHaveAttribute('data-state', 'open');
    await expect(undoable).toHaveAttribute('data-state', 'open');
    await demoLabelled(page, 'toast', 'Saved')('close').focus();
    await page.keyboard.press('Enter');
    await expect(saved).toHaveCount(0);
    await expect(undoable).toBeFocused();
});

test('a toast arriving while the stack shows re-stacks it and keeps focus inside (#269)', async ({ page }) => {
    await page.getByRole('button', { name: 'With action', exact: true }).focus();
    await page.keyboard.press('Enter');
    const undoable = rootLabelled(page, 'toast', 'Undoable action');
    await expect(undoable).toHaveAttribute('data-state', 'open');
    const viewport = page.locator('[data-scope="toast"][data-part="viewport"]');
    await viewport.evaluate((el) => {
        (window as unknown as { __reopened: number }).__reopened = 0;
        el.addEventListener('toggle', (e) => {
            if ((e as ToggleEvent).newState === 'open') (window as unknown as { __reopened: number }).__reopened++;
        });
    });
    const undo = demoLabelled(page, 'toast', 'Undoable action')('action');
    await undo.focus();
    // Undo raises a second toast while focus sits in the first.
    await page.keyboard.press('Enter');
    await expect(rootLabelled(page, 'toast', 'Undone')).toHaveAttribute('data-state', 'open');
    await expect.poll(() => page.evaluate(() => (window as unknown as { __reopened: number }).__reopened)).toBeGreaterThan(0);
    await expect(undo).toBeFocused();
});

test('a toast raised under a modal dialog paints above its backdrop (#269)', async ({ page }) => {
    // The stack is already showing BEFORE the modal opens, so without the
    // re-stack it would sit below the dialog in the top layer.
    await page.getByRole('button', { name: 'With action', exact: true }).click();
    await expect(rootLabelled(page, 'toast', 'Undoable action')).toHaveAttribute('data-state', 'open');
    const trigger = page.getByRole('button', { name: 'Toast over a dialog', exact: true });
    await trigger.click();
    const popup = await controlledPopup(page, trigger, 'Toast over a dialog');
    await settledBox(popup, 'the dialog');
    await page.getByRole('button', { name: 'Raise a toast', exact: true }).click();
    const raised = rootLabelled(page, 'toast', 'Raised over the dialog');
    await expect(raised).toHaveAttribute('data-state', 'open');
    // Pixels, not a declaration: the backdrop's wash must not tint it. The
    // same toast with the dialog closed is the reference. Its interior only:
    // the rounded corners show whatever is behind the toast either way.
    const interior = async () => {
        const box = await settledBox(raised, 'the raised toast');
        const inset = 10;
        return page.screenshot({
            animations: 'disabled',
            clip: { x: box.x + inset, y: box.y + inset, width: box.width - 2 * inset, height: box.height - 2 * inset },
        });
    };
    const over = await interior();
    await page.keyboard.press('Escape');
    await expect(popup).toBeHidden();
    const alone = await interior();
    expect(over.equals(alone), 'the raised toast was painted under the modal backdrop').toBe(true);
});
