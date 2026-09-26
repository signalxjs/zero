/**
 * Pagination link mode (#294) under a real engine.
 *
 * The unit suite proves the markup — `<a href>` per control, the inert
 * bound as an `<a>` with no `href`, `role="link"` and `aria-disabled`.
 * What only a browser can prove is the tab order: an `<a>` leaves it the
 * moment it loses its `href`, so a bound would vanish from Tab — unlike
 * button mode's bound, which is aria-disabled and stays a stop (#270) —
 * unless it keeps a tab stop of its own. The demo stands in for an SPA
 * router — it prevents the navigation on a wrapper — so the claims are
 * also that a real click and a real Enter move the model without zero
 * ever preventing the default itself.
 */
import { test, expect, type Page } from '@playwright/test';
import { bootPage } from './nav';
import { partsOf } from './demo';

test.beforeEach(async ({ page }) => {
    await bootPage(page, 'pagination', 'basic');
});

/** The link-mode demo, named by its landmark. */
const linked = (page: Page) => page.getByRole('navigation', { name: 'Linked pages', exact: true });

test('every control is a link, and a bound is a disabled link with no destination', async ({ page }) => {
    const root = linked(page);
    const part = partsOf(root, 'pagination');
    await expect(root.locator('button')).toHaveCount(0);
    await expect(root.getByRole('link', { name: 'Page 1', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(root.getByRole('link', { name: 'Page 3', exact: true })).toHaveAttribute('href', '?page=3');
    await expect(part('next-trigger')).toHaveAttribute('href', '?page=2');
    await expect(part('last-trigger')).toHaveAttribute('href', '?page=6');
    for (const name of ['First page', 'Previous page']) {
        const bound = root.getByRole('link', { name, exact: true });
        await expect(bound).toHaveAttribute('aria-disabled', 'true');
        await expect(bound).not.toHaveAttribute('href');
    }
});

test('a click moves the model; the router, not zero, prevents the navigation', async ({ page }) => {
    const root = linked(page);
    const before = page.url();
    await root.getByRole('link', { name: 'Page 4', exact: true }).click();
    await expect(root.getByRole('link', { name: 'Page 4', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByText('Router would go to ?page=4')).toBeVisible();
    expect(page.url()).toBe(before);
});

test('Enter on the last-page link reaches the bound, which stays a tab stop', async ({ page }) => {
    const root = linked(page);
    const last = partsOf(root, 'pagination')('last-trigger');
    await last.focus();
    await page.keyboard.press('Enter');
    await expect(root.getByRole('link', { name: 'Page 6', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(last).not.toHaveAttribute('href');
    await expect(last).toHaveAttribute('aria-disabled', 'true');
    await expect(last).toBeFocused();
    // A press at the bound goes nowhere.
    await page.keyboard.press('Enter');
    await expect(root.getByRole('link', { name: 'Page 6', exact: true })).toHaveAttribute('aria-current', 'page');

    // Both bounds lost the href that made them tab stops; Tab still walks
    // through them, as it walks through button mode's aria-disabled bounds.
    const part = partsOf(root, 'pagination');
    await root.getByRole('link', { name: 'Page 6', exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(part('next-trigger')).not.toHaveAttribute('href');
    await expect(part('next-trigger')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(last).toBeFocused();
});
