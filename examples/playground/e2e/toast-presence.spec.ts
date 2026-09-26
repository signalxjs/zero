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

test('a promise toast: loading, then updated in place with its outcome and indicator (#292)', async ({ page }) => {
    await page.getByRole('button', { name: 'Promise → resolves', exact: true }).click();
    const loading = rootLabelled(page, 'toast', 'Uploading report…');
    await expect(loading).toHaveAttribute('data-state', 'open');
    const parts = demoLabelled(page, 'toast', 'Uploading report…');
    await expect(parts('indicator')).toHaveAttribute('data-state', 'loading');
    await expect(parts('indicator')).toHaveAttribute('aria-hidden', 'true');
    // The same toast, by its title's id — its text is about to change.
    const titleId = await parts('title').getAttribute('id');
    expect(titleId).toBeTruthy();
    const same = page.locator('[data-scope="toast"][data-part="root"]').filter({ has: page.locator(`[id="${titleId}"]`) });
    await expect(same.locator('[data-part="title"]')).toHaveText('Report uploaded');
    await expect(same.locator('[data-part="indicator"]')).toHaveAttribute('data-state', 'complete');
    await expect(same).toHaveCount(1);

    await page.getByRole('button', { name: 'Promise → rejects', exact: true }).click();
    const syncing = demoLabelled(page, 'toast', 'Syncing…');
    await expect(syncing('indicator')).toHaveAttribute('data-state', 'loading');
    await expect(demoLabelled(page, 'toast', 'Sync stopped')('indicator')).toHaveAttribute('data-state', 'error');
});

test('the stack rests closed and fans out while hovered, its offsets monotonic (#292)', async ({ page }) => {
    await page.getByRole('button', { name: 'Stack three', exact: true }).click();
    const viewport = page.locator('[data-scope="toast"][data-part="viewport"]');
    const cards = ['First of three', 'Second of three', 'Third of three'].map((t) => rootLabelled(page, 'toast', t));
    for (const card of cards) await expect(card).toHaveAttribute('data-state', 'open');
    await expect(viewport).toHaveAttribute('data-state', 'closed');

    // The runtime's numbers: each card's offset is the height of the newer
    // cards in front of it, so it falls from the oldest to the newest.
    const measured = async () => Promise.all(cards.map((card) => card.evaluate((el) => ({
        height: parseFloat(el.style.getPropertyValue('--toast-height')),
        offset: parseFloat(el.style.getPropertyValue('--toast-offset')),
    }))));
    const vars = await measured();
    for (const v of vars) expect(v.height).toBeGreaterThan(0);
    expect(vars[2]!.offset).toBe(0);
    expect(vars[1]!.offset).toBeCloseTo(vars[2]!.height, 0);
    expect(vars[0]!.offset).toBeCloseTo(vars[1]!.height + vars[2]!.height, 0);

    // Resting, basic deals them as a deck: the older cards sit behind the
    // front one rather than in a column.
    const front = await settledBox(cards[2]!, 'the front card');
    const oldest = await settledBox(cards[0]!, 'the oldest card');
    expect(oldest.y + oldest.height).toBeGreaterThan(front.y);

    await cards[2]!.hover();
    await expect(viewport).toHaveAttribute('data-state', 'open');
    // Fanned: a column, newest nearest the bottom edge, no card over another.
    const boxes = [];
    for (const [i, card] of cards.entries()) boxes.push(await settledBox(card, `card ${i}`));
    expect(boxes[0]!.y + boxes[0]!.height).toBeLessThanOrEqual(boxes[1]!.y + 1);
    expect(boxes[1]!.y + boxes[1]!.height).toBeLessThanOrEqual(boxes[2]!.y + 1);

    // Crossing the gap between two fanned cards keeps the stack open.
    const gapY = (boxes[1]!.y + boxes[1]!.height + boxes[2]!.y) / 2;
    await page.mouse.move(boxes[2]!.x + boxes[2]!.width / 2, gapY);
    await expect(viewport).toHaveAttribute('data-state', 'open');

    // And leaving folds it back.
    await page.mouse.move(5, 5);
    await expect(viewport).toHaveAttribute('data-state', 'closed');
});
