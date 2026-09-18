/**
 * Context menu in real engines — the parts happy-dom cannot prove: the
 * popup actually lands at the pointer coordinates (top layer + fixed
 * positioning), a second right-click re-anchors it to the new point, and
 * Escape restores focus to the surface.
 */
import { test, expect } from '@playwright/test';
import { controlledPopup, settledBox } from './demo';
import { bootPage } from './nav';

test.beforeEach(async ({ page }) => {
    await bootPage(page, 'menu', 'basic');
});

const surface = (page: import('@playwright/test').Page) =>
    page.locator('[data-scope="menu"][data-part="context-trigger"]');
// The demo page holds several menus; aria-controls pins THE popup this
// surface opens. (`Menu.Root` renders no element, so there is no demo root to
// hang the popup off — the published id is the link. See `demo.ts`.)
const popup = (page: import('@playwright/test').Page) =>
    controlledPopup(page, surface(page), 'context surface');

async function rightClickAt(page: import('@playwright/test').Page, dx: number, dy: number) {
    await surface(page).scrollIntoViewIfNeeded();
    const box = await settledBox(surface(page), 'context surface');
    const x = box.x + dx;
    const y = box.y + dy;
    await page.mouse.click(x, y, { button: 'right' });
    return { x, y };
}

test('right-click opens the popup at the pointer', async ({ page }) => {
    const { x, y } = await rightClickAt(page, 60, 40);
    await expect(await popup(page)).toHaveAttribute('data-state', 'open');
    const pb = await settledBox(await popup(page), 'context popup');
    // bottom-start off a zero-size anchor: the popup's top-left hugs the
    // point (offset 4, flip/shift may nudge, so a loose tolerance).
    expect(Math.abs(pb.x - x)).toBeLessThan(24);
    expect(pb.y).toBeGreaterThan(y);
    expect(pb.y - y).toBeLessThan(24);
});

/**
 * A second right-click re-anchors the popup to the new point.
 *
 * It does NOT keep it continuously open, and no implementation over a native
 * `popover="auto"` can. Measured in Chromium (`beforetoggle`/`toggle` listeners
 * on the popup, timestamps relative to the second right-click's `pointerdown`):
 *
 *   t=0.7  pointerdown button=2        popup open
 *   t=1.0  contextmenu buttons=2
 *   t=1.0  beforetoggle open→closed    cancelable: FALSE
 *   t=1.0  pointerup                   popup already closed
 *   t=10.9 beforetoggle closed→open
 *   t=11.2 toggle       closed→open
 *
 * The gesture's own `pointerdown` light-dismisses the popover, and the hide
 * `beforetoggle` is **not cancelable** — there is no hook to refuse it.
 * `Menu.ContextTrigger` then reopens a task later (its `setTimeout(…, 0)`,
 * which exists precisely so the reopen cannot be eaten by the same gesture),
 * so the popup is genuinely `display: none` for at least one task turn.
 *
 * Which is why this test polls the box instead of sampling it once. Sampling
 * raced that gap: `expect(…).toHaveAttribute('data-state', 'open')` is happy
 * to match the *pre-dismiss* open state, and the measurement that followed
 * then landed in the closed window and got `null` from `boundingBox()` —
 * `TypeError: Cannot read properties of null (reading 'x')`, the failure
 * reported in #196.
 *
 * The `reduced-motion` project is where it actually bit, and that is not a
 * coincidence: `settledBox` awaits `getAnimations()`, and with animations
 * suppressed that resolves immediately, so the measurement arrives inside the
 * ~10 ms window instead of after it. Under machine load the window widens and
 * the other projects can reach it too.
 */
test('a second right-click re-anchors the popup to the new point', async ({ page }) => {
    await rightClickAt(page, 40, 30);
    const p = await popup(page);
    const first = await settledBox(p, 'context popup');
    // Well clear of the open popup — a right-click INSIDE it belongs to the
    // popup, not the surface.
    const { x } = await rightClickAt(page, 420, 20);
    // Polls the very fact under test (the popup is showing, at the new point),
    // so it cannot be satisfied by the stale pre-dismiss popup and cannot read
    // a box that does not exist yet.
    await expect
        .poll(async () => {
            const b = await p.boundingBox();
            return b ? Math.abs(b.x - x) : Number.POSITIVE_INFINITY;
        }, { message: 'popup re-anchored to the second right-click' })
        .toBeLessThan(24);
    await expect(p).toHaveAttribute('data-state', 'open');
    const second = await settledBox(p, 'context popup (re-anchored)');
    // The poll samples a RAW box, so it can be satisfied mid-transition. Assert
    // the same tolerance on the SETTLED box too, or an enter transition that
    // animates position could pass through the target and come to rest
    // somewhere else entirely — the one failure this test exists to catch.
    // (Under `reduced-motion` the two coincide; on the other four projects they
    // do not, which is exactly why both assertions are needed.)
    expect(Math.abs(second.x - x)).toBeLessThan(24);
    expect(second.x).not.toBe(first.x);
});

test('a submenu opens inside the context menu', async ({ page }) => {
    await rightClickAt(page, 60, 40);
    const sub = (await popup(page)).locator('[data-part="sub-trigger"]');
    await sub.click();
    await expect((await popup(page)).locator('[data-part="sub-popup"]')).toHaveAttribute('data-state', 'open');
});

test('Shift+F10 opens anchored to the surface element', async ({ page }) => {
    await surface(page).scrollIntoViewIfNeeded();
    // The demo surface content carries tabIndex=0 — focus it and invoke.
    await surface(page).focus();
    await page.keyboard.press('Shift+F10');
    await expect(await popup(page)).toHaveAttribute('data-state', 'open');
    const sb = await settledBox(surface(page), 'context surface');
    const pb = await settledBox(await popup(page), 'context popup');
    // Anchored to the element rect (bottom-start), not to a stale pointer.
    expect(Math.abs(pb.x - sb.x)).toBeLessThan(24);
});

test('Escape closes and restores focus to the surface content', async ({ page }) => {
    await surface(page).scrollIntoViewIfNeeded();
    const inner = surface(page);
    await inner.focus();
    await page.keyboard.press('Shift+F10');
    await expect(await popup(page)).toHaveAttribute('data-state', 'open');
    await page.keyboard.press('Escape');
    await expect(await popup(page)).toHaveAttribute('data-state', 'closed');
    await expect(inner).toBeFocused();
});

test('outside click closes via light dismiss', async ({ page }) => {
    await rightClickAt(page, 60, 40);
    await expect(await popup(page)).toHaveAttribute('data-state', 'open');
    await page.locator('h1').click();
    await expect(await popup(page)).toHaveAttribute('data-state', 'closed');
});
