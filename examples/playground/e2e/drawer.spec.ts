/**
 * Drawer — Dialog's top-layer machinery on an edge panel, in real engines.
 *
 * The unit suite (happy-dom) proves the state wiring; only a real engine has
 * `showModal()`, `:modal`, a ::backdrop that hit-tests as the dialog element
 * itself, a native `cancel` for Escape, and native focus restore. On top of
 * Dialog's contract this spec covers what is Drawer's OWN:
 *
 * - the EDGE: `data-placement="start|end"` is the logical pair, so the spec
 *   measures boxes rather than attributes — the start panel's inline-start
 *   edge sits on the viewport's reading edge, the end panel's on the far
 *   one (LTR here; the RTL sweep is rtl.spec.ts's jurisdiction);
 * - the scrim geometry (#324, inherited): a click on the panel's own
 *   padding must NOT close while a genuine scrim click must;
 * - the INLINE mode: `show()` renders in flow — no `:modal`, no dismiss
 *   trap, Escape through zero's dismiss layer, focus restore through
 *   zero's `createFocusRestore`.
 */
import { test, expect, type Page } from '@playwright/test';
import { bootPage } from './nav';
import { controlledPopup, settledBox } from './demo';

test.beforeEach(async ({ page }) => {
    await bootPage(page, 'drawer', 'basic');
});

/**
 * `Drawer.Root` renders no element, so there is no demo root to hang parts
 * off — each demo is pinned by the text on its own trigger, and the panel
 * resolves through the `aria-controls` id that trigger publishes (`demo.ts`).
 * The page holds three drawers: start, end, and the inline filters panel.
 */
const startTrigger = (page: Page) => page.getByRole('button', { name: 'Open drawer', exact: true });
const endTrigger = (page: Page) => page.getByRole('button', { name: 'Open end drawer', exact: true });
const inlineTrigger = (page: Page) => page.getByRole('button', { name: 'Open filters', exact: true });

test('opens modal in the top layer and hugs the reading edge', async ({ page }) => {
    const trigger = startTrigger(page);
    await trigger.click();
    const panel = await controlledPopup(page, trigger, 'the start drawer trigger');
    await expect(panel).toHaveAttribute('data-state', 'open');
    await expect(panel).toHaveAttribute('data-placement', 'start');
    expect(await panel.evaluate((el) => el.matches(':modal'))).toBe(true);
    // The edge is a measured fact, not an attribute echo: the panel's
    // inline-start edge sits on the viewport's left (LTR) and it spans the
    // full height.
    const box = await settledBox(panel, 'the start drawer panel');
    expect(box.x).toBeLessThanOrEqual(1);
    const viewport = page.viewportSize()!;
    expect(box.height).toBeGreaterThanOrEqual(viewport.height - 2);
});

test('placement="end" pins the panel to the far edge', async ({ page }) => {
    const trigger = endTrigger(page);
    await trigger.click();
    const panel = await controlledPopup(page, trigger, 'the end drawer trigger');
    await expect(panel).toHaveAttribute('data-state', 'open');
    await expect(panel).toHaveAttribute('data-placement', 'end');
    const box = await settledBox(panel, 'the end drawer panel');
    const viewport = page.viewportSize()!;
    expect(box.x + box.width).toBeGreaterThanOrEqual(viewport.width - 1);
});

test('Escape closes (native cancel routed through the model) and restores focus', async ({ page }) => {
    const trigger = startTrigger(page);
    // Keyboard open, so the trigger genuinely HOLDS focus first — WebKit
    // does not focus buttons on click, so a click-open would leave the
    // restore target as body and assert nothing.
    await trigger.focus();
    await page.keyboard.press('Enter');
    const panel = await controlledPopup(page, trigger, 'the start drawer trigger');
    await expect(panel).toHaveAttribute('data-state', 'open');
    await page.keyboard.press('Escape');
    await expect(panel).toHaveAttribute('data-state', 'closed');
    await expect(panel).not.toBeVisible();
    await expect(trigger).toBeFocused();
});

test('a scrim click closes; a click on the panel\'s own padding does not', async ({ page }) => {
    const trigger = startTrigger(page);
    await trigger.click();
    const panel = await controlledPopup(page, trigger, 'the start drawer trigger');
    await expect(panel).toHaveAttribute('data-state', 'open');

    // Padding first: a click inside the panel's box that still targets the
    // <dialog> element itself (no child under the pointer — the bottom
    // inside corner is bare padding). Both clicks have e.target === dialog;
    // only the geometry differs.
    const box = await settledBox(panel, 'the start drawer panel');
    await page.mouse.click(box.x + 4, box.y + box.height - 4);
    await page.waitForTimeout(300);
    await expect(panel).toHaveAttribute('data-state', 'open');

    // Scrim: an edge panel leaves the rest of the viewport to its backdrop,
    // so a point well past the panel's inline edge is reliably outside.
    const viewport = page.viewportSize()!;
    expect(box.x + box.width).toBeLessThan(viewport.width - 20); // precondition
    await page.mouse.click(viewport.width - 8, Math.floor(viewport.height / 2));
    await expect(panel).toHaveAttribute('data-state', 'closed');
});

test('the Close button closes and native focus restore lands on the trigger', async ({ page }) => {
    const trigger = startTrigger(page);
    // Keyboard open — see the Escape test for why (WebKit click focus).
    await trigger.focus();
    await page.keyboard.press('Enter');
    const panel = await controlledPopup(page, trigger, 'the start drawer trigger');
    await expect(panel).toHaveAttribute('data-state', 'open');
    await panel.locator('[data-part="close"]', { hasText: 'Close drawer' }).click();
    await expect(panel).toHaveAttribute('data-state', 'closed');
    await expect(trigger).toBeFocused();
});

test('inline mode: no :modal, in flow, outside clicks do not dismiss', async ({ page }) => {
    const trigger = inlineTrigger(page);
    await trigger.click();
    const panel = await controlledPopup(page, trigger, 'the inline drawer trigger');
    await expect(panel).toHaveAttribute('data-state', 'open');
    await expect(panel).toBeVisible();
    expect(await panel.evaluate((el) => el.matches(':modal'))).toBe(false);
    // In flow, not fixed to the viewport: the inline panel is furniture.
    expect(await panel.evaluate((el) => getComputedStyle(el).position)).not.toBe('fixed');

    // Furniture survives the user working elsewhere — clicking the page is
    // not a dismissal (and the click actually reaches the page: no
    // backdrop, no inertness).
    await page.locator('h1').click();
    await page.waitForTimeout(300);
    await expect(panel).toHaveAttribute('data-state', 'open');
});

test('inline mode: Escape closes via the dismiss-layer fallback and restores focus', async ({ page }) => {
    const trigger = inlineTrigger(page);
    // Keyboard open — see the modal Escape test for why (WebKit click focus).
    await trigger.focus();
    await page.keyboard.press('Enter');
    const panel = await controlledPopup(page, trigger, 'the inline drawer trigger');
    await expect(panel).toHaveAttribute('data-state', 'open');
    // Park focus OUTSIDE the panel: a non-modal <dialog> fires no cancel
    // event, so this Escape can only be seen by zero's document-level
    // dismiss layer — the platform contributes nothing here.
    await page.locator('h1').click();
    await page.keyboard.press('Escape');
    await expect(panel).toHaveAttribute('data-state', 'closed');
    // show() does not restore focus natively — this is createFocusRestore.
    await expect(trigger).toBeFocused();
});

test('the panel is labelled by its Title, or by the label prop when no Title renders', async ({ page }) => {
    const start = await controlledPopup(page, startTrigger(page), 'the start drawer trigger');
    const titleId = await start.locator('[data-part="title"]').getAttribute('id');
    expect(titleId).toBeTruthy();
    await expect(start).toHaveAttribute('aria-labelledby', titleId!);
    // Title wins over the label prop; both never render together.
    await expect(start).not.toHaveAttribute('aria-label', /.*/);
});
