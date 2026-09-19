/**
 * Dialog — the native `<dialog>` top layer in real engines.
 *
 * The unit suite (happy-dom) proves the state wiring; only a real engine has
 * `showModal()`, `:modal`, a ::backdrop that hit-tests as the dialog element
 * itself, a native `cancel` event for Escape, and native focus restore. This
 * spec covers those, plus the two behaviors zero adds on top:
 *
 * - the geometric backdrop test (#324): a ::backdrop click targets the
 *   `<dialog>` element, but so does a click on the dialog's own padding —
 *   only the pointer's position can tell them apart, so a padding click must
 *   NOT close while a genuine backdrop click must;
 * - the non-modal fallback: `show()` fires no `cancel`, so Escape dismissal
 *   is zero's own document-level dismiss layer, and focus restore is zero's
 *   `createFocusRestore` rather than the platform's.
 */
import { test, expect, type Page } from '@playwright/test';
import { bootPage } from './nav';
import { controlledPopup, settledBox } from './demo';

test.beforeEach(async ({ page }) => {
    await bootPage(page, 'dialog', 'basic');
});

/**
 * `Dialog.Root` renders no element, so there is no demo root to hang parts
 * off — each demo is pinned by the text on its own trigger, and the popup
 * resolves through the `aria-controls` id that trigger publishes (`demo.ts`).
 * The page holds two dialogs: the modal one and the non-modal find bar.
 */
const modalTrigger = (page: Page) => page.getByRole('button', { name: 'Open dialog', exact: true });
const findTrigger = (page: Page) => page.getByRole('button', { name: 'Open find bar', exact: true });

test('opens modal in the top layer: showModal, :modal matches, backdrop exists', async ({ page }) => {
    const trigger = modalTrigger(page);
    await trigger.click();
    const popup = await controlledPopup(page, trigger, 'the modal dialog trigger');
    await expect(popup).toHaveAttribute('data-state', 'open');
    await expect(popup).toBeVisible();
    // `:modal` only matches a dialog opened via showModal() — this is the
    // top-layer assertion, not an attribute echo.
    expect(await popup.evaluate((el) => el.matches(':modal'))).toBe(true);
});

test('Escape closes (native cancel routed through the model) and restores focus', async ({ page }) => {
    const trigger = modalTrigger(page);
    // Keyboard open, so the trigger genuinely HOLDS focus first — WebKit
    // does not focus buttons on click, so a click-open would leave the
    // restore target as body and assert nothing.
    await trigger.focus();
    await page.keyboard.press('Enter');
    const popup = await controlledPopup(page, trigger, 'the modal dialog trigger');
    await expect(popup).toHaveAttribute('data-state', 'open');
    await page.keyboard.press('Escape');
    await expect(popup).toHaveAttribute('data-state', 'closed');
    await expect(popup).not.toBeVisible();
    await expect(trigger).toBeFocused();
});

test('a ::backdrop click closes; a click on the dialog\'s own padding does not (#324)', async ({ page }) => {
    const trigger = modalTrigger(page);
    await trigger.click();
    const popup = await controlledPopup(page, trigger, 'the modal dialog trigger');
    await expect(popup).toHaveAttribute('data-state', 'open');

    // Padding first: a click inside the dialog's box that still targets the
    // <dialog> element itself (no child under the pointer). Both clicks have
    // e.target === dialog — only the geometry differs.
    const box = await settledBox(popup, 'the modal dialog popup');
    await page.mouse.click(box.x + 4, box.y + 4);
    // The close would be prompt if it were (wrongly) triggered — give it a
    // beat, then assert nothing happened.
    await page.waitForTimeout(300);
    await expect(popup).toHaveAttribute('data-state', 'open');

    // Backdrop: any pointer position outside the dialog's box. The backdrop
    // covers the viewport, so a corner well away from the centered dialog is
    // reliably outside.
    expect(box.x).toBeGreaterThan(20); // precondition: the corner IS outside
    await page.mouse.click(8, 8);
    await expect(popup).toHaveAttribute('data-state', 'closed');
});

test('the Close button closes and native focus restore lands on the trigger', async ({ page }) => {
    const trigger = modalTrigger(page);
    // Keyboard open — see the Escape test for why (WebKit click focus).
    await trigger.focus();
    await page.keyboard.press('Enter');
    const popup = await controlledPopup(page, trigger, 'the modal dialog trigger');
    await expect(popup).toHaveAttribute('data-state', 'open');
    await popup.locator('[data-part="close"]', { hasText: 'Got it' }).click();
    await expect(popup).toHaveAttribute('data-state', 'closed');
    await expect(trigger).toBeFocused();
});

test('non-modal: no :modal, the page stays live, outside clicks do not dismiss', async ({ page }) => {
    const trigger = findTrigger(page);
    await trigger.click();
    const popup = await controlledPopup(page, trigger, 'the find bar trigger');
    await expect(popup).toHaveAttribute('data-state', 'open');
    await expect(popup).toBeVisible();
    expect(await popup.evaluate((el) => el.matches(':modal'))).toBe(false);

    // A find bar survives the user working elsewhere — clicking the page is
    // not a dismissal (and the click actually reaches the page: no backdrop,
    // no inertness).
    await page.locator('h1').click();
    await page.waitForTimeout(300);
    await expect(popup).toHaveAttribute('data-state', 'open');
});

test('non-modal: Escape closes via the dismiss-layer fallback and restores focus', async ({ page }) => {
    const trigger = findTrigger(page);
    // Keyboard open — see the modal Escape test for why (WebKit click focus).
    await trigger.focus();
    await page.keyboard.press('Enter');
    const popup = await controlledPopup(page, trigger, 'the find bar trigger');
    await expect(popup).toHaveAttribute('data-state', 'open');
    // Park focus OUTSIDE the dialog: a non-modal <dialog> fires no cancel
    // event, so this Escape can only be seen by zero's document-level
    // dismiss layer — the platform contributes nothing here.
    await page.locator('h1').click();
    await page.keyboard.press('Escape');
    await expect(popup).toHaveAttribute('data-state', 'closed');
    // show() does not restore focus natively — this is createFocusRestore.
    await expect(trigger).toBeFocused();
});

test('the popup is labelled by its Title — and only when a Title is rendered', async ({ page }) => {
    const modal = await controlledPopup(page, modalTrigger(page), 'the modal dialog trigger');
    const titleId = await modal.locator('[data-part="title"]').getAttribute('id');
    expect(titleId).toBeTruthy();
    await expect(modal).toHaveAttribute('aria-labelledby', titleId!);
    await expect(modal).toHaveAttribute('aria-describedby', /.+/);

    // The find bar renders no Title: the ref must be ABSENT, not dangling.
    const find = await controlledPopup(page, findTrigger(page), 'the find bar trigger');
    await expect(find).not.toHaveAttribute('aria-labelledby', /.*/);
});

test('the close event reports why: native Escape, a valued Close, Cancel (#52)', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Delete file…', exact: true });
    const readout = page.locator('[data-demo="close-reason"]');
    await expect(readout).toHaveText('Last close: none yet');

    // Escape in a real engine is the native `cancel` event, routed through
    // the model — the reason must survive that detour.
    await trigger.focus();
    await page.keyboard.press('Enter');
    const popup = await controlledPopup(page, trigger, 'the alert dialog trigger');
    await expect(popup).toHaveAttribute('data-state', 'open');
    await page.keyboard.press('Escape');
    await expect(popup).toHaveAttribute('data-state', 'closed');
    await expect(readout).toHaveText('Last close: escape');

    // The destructive action carries its value back with the close; the
    // native close event that follows the requested close adds no second
    // report.
    await trigger.click();
    await expect(popup).toHaveAttribute('data-state', 'open');
    await popup.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(popup).toHaveAttribute('data-state', 'closed');
    await expect(readout).toHaveText('Last close: close · delete');

    await trigger.click();
    await popup.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(readout).toHaveText('Last close: cancel');
});

/**
 * The alert dialog (#128), in a real engine. The unit suite proves the
 * `autofocus` attribute lands on Cancel; only `showModal()`'s own focusing
 * steps prove it is what receives focus. And a backdrop click's geometry is
 * the engine's.
 */
test('alertdialog: initial focus is the least-destructive action, and the backdrop does not dismiss', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Delete workspace…', exact: true });
    await trigger.click();
    const popup = await controlledPopup(page, trigger, 'the confirm dialog trigger');
    await expect(popup).toHaveAttribute('data-state', 'open');
    await expect(popup).toHaveAttribute('role', 'alertdialog');
    await expect(popup.getByRole('button', { name: 'Keep workspace', exact: true })).toBeFocused();

    // A click on the ::backdrop — outside the dialog's box — keeps an
    // alertdialog open; the same click closes a plain dialog (#324). The
    // same geometry precondition as that test: the corner IS outside.
    const box = await settledBox(popup, 'the confirm dialog');
    expect(box.x).toBeGreaterThan(20);
    expect(box.y).toBeGreaterThan(20);
    await page.mouse.click(8, 8);
    await page.waitForTimeout(300);
    await expect(popup).toHaveAttribute('data-state', 'open');
    await page.keyboard.press('Escape');
    await expect(popup).toHaveAttribute('data-state', 'closed');
});

test('alertdialog: the destructive action is a <form method="dialog"> submit, reported with its value', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Delete workspace…', exact: true });
    const readout = page.locator('[data-demo="confirm-reason"]');
    await trigger.click();
    const popup = await controlledPopup(page, trigger, 'the confirm dialog trigger');
    // The app's own Button, in its danger colour — not a dialog part.
    const destroy = popup.getByRole('button', { name: 'Delete workspace', exact: true });
    await expect(destroy).toHaveAttribute('data-scope', 'button');
    await expect(destroy).toHaveAttribute('data-color', 'error');
    await destroy.click();
    await expect(popup).toHaveAttribute('data-state', 'closed');
    // The platform closed it (method="dialog"), so the reason is
    // `programmatic`, and the submitter's value is the close's value.
    await expect(readout).toHaveText('Last confirm: programmatic · delete');

    await trigger.click();
    await popup.getByRole('button', { name: 'Keep workspace', exact: true }).click();
    await expect(readout).toHaveText('Last confirm: cancel');
});

test('a dialog whose model is already open at mount opens, and throws nothing (#102)', async ({ page }) => {
    // The popup mounts before its parent inserts the subtree, so a
    // synchronous `showModal()` hits a detached element — which every real
    // engine refuses with InvalidStateError. The demo mounts the dialog on
    // demand with its model already `true`, the issue's exact shape.
    const errors: string[] = [];
    page.on('pageerror', (error) => { errors.push(error.message); });
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.locator('[data-demo="mount-open"]').click();
    const popup = page.locator('[data-demo="restored"] [data-scope="dialog"][data-part="popup"]');
    await expect(popup).toHaveAttribute('data-state', 'open');
    await expect(popup).toBeVisible();
    expect(await popup.evaluate((el) => el.matches(':modal'))).toBe(true);
    expect(errors).toEqual([]);
    // And it is a working dialog: Close takes it down and unmounts the demo.
    await popup.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.locator('[data-demo="restored"]')).toHaveCount(0);
});
