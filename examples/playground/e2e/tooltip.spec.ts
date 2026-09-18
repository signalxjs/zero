/**
 * Tooltip — hover/focus intent and WCAG 1.4.13 dismissal in real engines.
 *
 * happy-dom can synthesize a focus event, but it cannot host the real thing
 * this spec exists for: a tooltip opened by HOVER while keyboard focus sits
 * elsewhere, dismissed by Escape through a document-level listener (SC
 * 1.4.13 "dismissable"). A trigger-local keydown can never see that Escape —
 * only a real engine with a real pointer and a real focus owner proves it.
 */
import { test, expect, type Page } from '@playwright/test';
import { bootPage } from './nav';

test.beforeEach(async ({ page }) => {
    await bootPage(page, 'tooltip', 'basic');
});

/**
 * `Tooltip.Root` renders no element and the trigger publishes no
 * `aria-controls` (its link is `aria-describedby`, only while open) — the
 * popup is named by the text it shows, the same way `demoLabelled` names a
 * root (`demo.ts`).
 */
const trigger = (page: Page) => page.getByRole('button', { name: 'Hover me', exact: true });
const popup = (page: Page) =>
    page.locator('[data-scope="tooltip"][data-part="popup"]', { hasText: 'top layer' });
const elsewhere = (page: Page) => page.getByRole('button', { name: 'Elsewhere', exact: true });

test('focus opens immediately, describes the trigger, and blur closes', async ({ page }) => {
    const t = trigger(page);
    await t.focus();
    await expect(popup(page)).toHaveAttribute('data-state', 'open');
    await expect(popup(page)).toBeVisible();
    // The description link exists exactly while open.
    const popupId = await popup(page).getAttribute('id');
    await expect(t).toHaveAttribute('aria-describedby', popupId!);

    await elsewhere(page).focus();
    await expect(popup(page)).toHaveAttribute('data-state', 'closed');
    await expect(t).not.toHaveAttribute('aria-describedby', /.*/);
});

test('hover opens after the intent delay and closes on pointer leave', async ({ page }) => {
    const t = trigger(page);
    const hoveredAt = Date.now();
    await t.hover();
    // Mid-delay probe: 250 ms into the 600 ms intent window the tooltip
    // must still be closed. This is what actually catches a SHORTENED
    // delay — the elapsed lower bound below cannot, because automation
    // overhead before pointerenter pads it. A single read, not a polling
    // expect: polling "closed" would succeed on the first sample and prove
    // nothing more. The 350 ms of headroom before the timer fires keeps a
    // contended runner from failing this wrongly.
    await page.waitForTimeout(250);
    expect(await popup(page).getAttribute('data-state')).toBe('closed');
    await expect(popup(page)).toHaveAttribute('data-state', 'open');
    // And the open cannot land before the full delay: the timer arms at
    // pointerenter, after hoveredAt was taken, so elapsed >= 600 strictly.
    // (Only a lower bound — an upper bound would race the runner.)
    expect(Date.now() - hoveredAt).toBeGreaterThanOrEqual(600);

    await page.mouse.move(0, 0);
    await expect(popup(page)).toHaveAttribute('data-state', 'closed');
});

test('Escape dismisses a hover-opened tooltip while focus is elsewhere (WCAG 1.4.13)', async ({ page }) => {
    // Park keyboard focus away from the trigger FIRST — this is the 1.4.13
    // shape: the tooltip is open purely by pointer, so the Escape below goes
    // to the Elsewhere button and only a document-level listener can see it.
    await elsewhere(page).focus();
    await trigger(page).hover();
    await expect(popup(page)).toHaveAttribute('data-state', 'open');
    await expect(elsewhere(page)).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(popup(page)).toHaveAttribute('data-state', 'closed');
    // Dismissal must not move focus…
    await expect(elsewhere(page)).toBeFocused();
    // …and must not pop back up from a stale hover timer: the pointer never
    // left the trigger, so give a re-open ample time to (wrongly) fire.
    await page.waitForTimeout(900);
    await expect(popup(page)).toHaveAttribute('data-state', 'closed');
});
