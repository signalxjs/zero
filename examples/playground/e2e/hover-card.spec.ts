/**
 * HoverCard (#290) — hover intent, the trip into the card, keyboard focus and
 * Escape in real engines.
 *
 * happy-dom has no layout, so it cannot host what this spec is for: a real
 * pointer leaving the trigger and crossing the offset gap into a card that
 * holds links, the real `:focus-visible` heuristic deciding what a focus
 * means, and Escape reaching the document-level dismiss layer while focus is
 * elsewhere. And unlike a tooltip, the card's content is interactive, so
 * focus moving into it must keep it open and Escape from inside must hand
 * focus back to the trigger.
 */
import { test, expect, type Page } from '@playwright/test';
import { bootPage } from './nav';
import { arrowGeometry, settledBox } from './demo';

test.beforeEach(async ({ page }) => {
    await bootPage(page, 'hover-card', 'basic');
});

/**
 * `HoverCard.Root` renders no element and the trigger publishes no
 * `aria-controls` (it is a link, not a disclosure) — each card is named by
 * the text it shows, the same way `demoLabelled` names a root (`demo.ts`).
 */
const trigger = (page: Page) => page.getByRole('link', { name: '@ada', exact: true });
const card = (page: Page) =>
    page.locator('[data-scope="hover-card"][data-part="popup"]', { hasText: 'Ada Lovelace' });
const profileLink = (page: Page) => card(page).getByRole('link', { name: 'View profile', exact: true });
const elsewhere = (page: Page) => page.getByRole('button', { name: 'Elsewhere', exact: true });

test('hover opens after the 700 ms intent delay and closes once the pointer has left', async ({ page }) => {
    const hoveredAt = Date.now();
    await trigger(page).hover();
    // Mid-delay probe: 300 ms into the 700 ms window the card must still be
    // closed — what catches a SHORTENED delay (automation overhead pads the
    // lower bound below). A single read, not a polling expect.
    await page.waitForTimeout(300);
    expect(await card(page).getAttribute('data-state')).toBe('closed');
    await expect(card(page)).toHaveAttribute('data-state', 'open');
    await expect(card(page)).toBeVisible();
    // The timer arms at pointerenter, after hoveredAt: a lower bound only.
    expect(Date.now() - hoveredAt).toBeGreaterThanOrEqual(700);

    await page.mouse.move(0, 0);
    await expect(card(page)).toHaveAttribute('data-state', 'closed');
});

test('the pointer can travel from the trigger into the card and use it', async ({ page }) => {
    await trigger(page).hover();
    await expect(card(page)).toHaveAttribute('data-state', 'open');
    const from = await settledBox(trigger(page), 'hover-card trigger');
    const to = await settledBox(profileLink(page), 'the link inside the card');
    // Small real steps: the pointer leaves the trigger and spends time in the
    // gap that belongs to neither part, as a user's mouse does.
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 });
    // Well past the 300 ms close delay: had the leave closed it, it would be gone.
    await page.waitForTimeout(600);
    await expect(card(page)).toHaveAttribute('data-state', 'open');
    await expect(profileLink(page)).toBeVisible();

    // Leaving the card closes it.
    await page.mouse.move(0, 0);
    await expect(card(page)).toHaveAttribute('data-state', 'closed');
});

test('keyboard focus opens at once, focus inside the card keeps it open, and Escape hands focus back', async ({ page }) => {
    // A script focus with no pointer interaction before it matches
    // `:focus-visible` in every engine — the keyboard path. (Not a Tab:
    // WebKit's default Tab order skips links.)
    await trigger(page).focus();
    await expect(card(page)).toHaveAttribute('data-state', 'open');
    await expect(card(page)).toBeVisible();
    // Not a tooltip, not a disclosure.
    await expect(card(page)).not.toHaveAttribute('role', /.*/);
    await expect(trigger(page)).not.toHaveAttribute('aria-describedby', /.*/);
    await expect(trigger(page)).not.toHaveAttribute('aria-expanded', /.*/);

    await profileLink(page).focus();
    await page.waitForTimeout(500);
    await expect(card(page)).toHaveAttribute('data-state', 'open');
    await expect(profileLink(page)).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(card(page)).toHaveAttribute('data-state', 'closed');
    // Focus comes back to the trigger — and that focus does not reopen it.
    await expect(trigger(page)).toBeFocused();
    await page.waitForTimeout(900);
    await expect(card(page)).toHaveAttribute('data-state', 'closed');

    // Focus leaving both closes it.
    await trigger(page).blur();
    await trigger(page).focus();
    await expect(card(page)).toHaveAttribute('data-state', 'open');
    await elsewhere(page).focus();
    await expect(card(page)).toHaveAttribute('data-state', 'closed');
});

test('Escape closes a hover-opened card while focus is elsewhere, and it stays closed', async ({ page }) => {
    await elsewhere(page).focus();
    await trigger(page).hover();
    await expect(card(page)).toHaveAttribute('data-state', 'open');
    await expect(elsewhere(page)).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(card(page)).toHaveAttribute('data-state', 'closed');
    // Dismissal does not move focus…
    await expect(elsewhere(page)).toBeFocused();
    // …and the resting pointer does not bring it back.
    await page.waitForTimeout(1000);
    await expect(card(page)).toHaveAttribute('data-state', 'closed');
});

test('an arrow points at the trigger from the card placed above it', async ({ page }) => {
    const t = page.getByRole('link', { name: 'release notes', exact: true });
    const c = page.locator('[data-scope="hover-card"][data-part="popup"]', { hasText: 'Every change since' });
    await t.focus();
    await expect(c).toHaveAttribute('data-state', 'open');
    const { placement, popup, arrow, target } = await arrowGeometry(c, t, 'the hover card');
    expect(['top', 'bottom']).toContain(placement);
    expect(Math.abs(arrow.x + arrow.width / 2 - (target.x + target.width / 2))).toBeLessThanOrEqual(2);
    const edge = placement === 'top' ? popup.y + popup.height : popup.y;
    expect(arrow.y).toBeLessThan(edge);
    expect(arrow.y + arrow.height).toBeGreaterThan(edge);
});
