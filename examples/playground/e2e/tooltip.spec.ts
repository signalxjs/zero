/**
 * Tooltip — hover/focus intent and WCAG 1.4.13 dismissal in real engines.
 *
 * happy-dom can synthesize a focus event, but it cannot host the real thing
 * this spec exists for: a tooltip opened by HOVER while keyboard focus sits
 * elsewhere, dismissed by Escape through a document-level listener (SC
 * 1.4.13 "dismissable"). A trigger-local keydown can never see that Escape —
 * only a real engine with a real pointer and a real focus owner proves it.
 * It also proves SC 1.4.13 "hoverable" (#167): a real pointer crosses the
 * real offset gap between trigger and popup, which happy-dom has no layout
 * for.
 *
 * Opening is keyboard-focus only (#268): a CLICK focuses the trigger too, so
 * the "click does not open" check needs a real engine's `:focus-visible`
 * heuristic, which happy-dom does not model. And the delay group's instant
 * sibling open is timed against a real pointer crossing real boxes.
 */
import { test, expect, type Page } from '@playwright/test';
import { bootPage } from './nav';
import { arrowGeometry, settledBox } from './demo';

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

test('keyboard focus opens immediately, describes the trigger, and blur closes', async ({ page }) => {
    const t = trigger(page);
    // A script focus with no pointer interaction before it matches
    // `:focus-visible` in every engine — the keyboard path. (Not a Tab:
    // WebKit's default Tab order skips buttons.)
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

test('the pointer can cross the offset gap onto the popup without it closing (WCAG 1.4.13 hoverable, #167)', async ({ page }) => {
    const t = trigger(page);
    await t.hover();
    await expect(popup(page)).toHaveAttribute('data-state', 'open');
    const from = await settledBox(t, 'tooltip trigger');
    const to = await settledBox(popup(page), 'tooltip popup');
    // Walk from the trigger's centre to the popup's centre in small real
    // steps, so the pointer leaves the trigger and spends time in the gap
    // that belongs to neither part — exactly what a user's mouse does.
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
    // Well past the grace period: had the leave closed it, it would be gone.
    await page.waitForTimeout(500);
    await expect(popup(page)).toHaveAttribute('data-state', 'open');
    await expect(popup(page)).toBeVisible();

    // Leaving the popup still closes it.
    await page.mouse.move(0, 0);
    await expect(popup(page)).toHaveAttribute('data-state', 'closed');
});

test('a click does not open it, and closes a hover-opened one until the pointer leaves', async ({ page }) => {
    const t = trigger(page);
    await t.hover();
    await expect(popup(page)).toHaveAttribute('data-state', 'open');
    // WebKit does not focus a button on click, so focus is not asserted —
    // what matters is that the press closes it and nothing re-opens it: not
    // the focus a click gives (Chromium/Firefox, not :focus-visible), not
    // the pointer still resting on the trigger.
    await t.click();
    await expect(popup(page)).toHaveAttribute('data-state', 'closed');
    await page.waitForTimeout(900);
    await expect(popup(page)).toHaveAttribute('data-state', 'closed');

    // Leave and come back: hover works again.
    await page.mouse.move(0, 0);
    await t.hover();
    await expect(popup(page)).toHaveAttribute('data-state', 'open');
});

test('in a Tooltip.Group, moving to a sibling opens it well inside the intent delay and closes the first', async ({ page }) => {
    const group = page.locator('[data-demo="tooltip-group"]');
    const bold = group.getByRole('button', { name: 'Bold', exact: true });
    const italic = group.getByRole('button', { name: 'Italic', exact: true });
    const boldPopup = page.locator('[data-scope="tooltip"][data-part="popup"]', { hasText: 'Bold (Ctrl+B)' });
    const italicPopup = page.locator('[data-scope="tooltip"][data-part="popup"]', { hasText: 'Italic (Ctrl+I)' });

    await bold.hover();
    await expect(boldPopup).toHaveAttribute('data-state', 'open');
    await italic.hover();
    // Lower-bound style: the group default openDelay is 600 ms; a 200 ms
    // budget can only pass if the delay was skipped.
    await expect(italicPopup).toHaveAttribute('data-state', 'open', { timeout: 200 });
    await expect(italicPopup).toBeVisible();
    await expect(boldPopup).toHaveAttribute('data-state', 'closed');
});

test('the arrow points at the trigger from the edge facing it (#279)', async ({ page }) => {
    const t = page.getByRole('button', { name: 'With arrow', exact: true });
    await t.hover();
    const tip = page.locator('[data-scope="tooltip"][data-part="popup"]', { hasText: 'Points at what it describes' });
    await expect(tip).toHaveAttribute('data-state', 'open');
    const { placement, popup, arrow, target: trigger } = await arrowGeometry(tip, t, 'the tooltip');
    expect(['top', 'bottom']).toContain(placement);
    expect(Math.abs(arrow.x + arrow.width / 2 - (trigger.x + trigger.width / 2))).toBeLessThanOrEqual(2);
    const edge = placement === 'top' ? popup.y + popup.height : popup.y;
    expect(arrow.y).toBeLessThan(edge);
    expect(arrow.y + arrow.height).toBeGreaterThan(edge);
    // Decoration only: the trigger's description is the text alone.
    await expect(t).toHaveAccessibleDescription('Points at what it describes');
});
