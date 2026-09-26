/**
 * Field validation in real engines (#284).
 *
 * What happy-dom cannot prove: that the platform's own interactive
 * validation — a real submit button, a real `patternMismatch` and
 * `typeMismatch` — reaches the Field through the
 * `invalid` event; that cancelling it leaves the platform's bubble out and
 * focus on the FIRST invalid control, as the platform would have put it;
 * that `validate`'s message blocks the native submit through
 * `setCustomValidity`; and that a blur-mode field validates on a real Tab.
 */
import { test, expect, type Page } from '@playwright/test';
import { bootPage } from './nav';
import { demoPosting } from './demo';

test.beforeEach(async ({ page }) => {
    await bootPage(page, 'forms', 'basic');
});

const form = (page: Page) => page.locator('[data-demo="validated-form"]');
/** The Field wrapping the control that posts `name`, inside the validated form. */
const fieldPosting = (page: Page, name: string) =>
    form(page).locator('[data-scope="field"][data-part="root"]', { has: page.locator(`[name="${name}"]`) });
const errorsOf = (page: Page, name: string) =>
    fieldPosting(page, name).locator('[data-scope="field"][data-part="error"]');
const submit = (page: Page) => form(page).locator('button[type="submit"]');
const posted = (page: Page) => page.getByTestId('validated-posted');
const user = (page: Page) => demoPosting(page, 'input', 'val-user')('input');
const email = (page: Page) => demoPosting(page, 'input', 'val-email')('input');

test('nothing shows before a submit', async ({ page }) => {
    await expect(form(page).locator('[data-scope="field"][data-part="error"]')).toHaveCount(0);
    await user(page).fill('AB');
    await expect(errorsOf(page, 'val-user')).toHaveCount(0);
    await expect(fieldPosting(page, 'val-user')).not.toHaveAttribute('data-invalid');
});

test('an empty submit shows each matched Error, cancels the bubble and focuses the first invalid control', async ({ page }) => {
    // Target-phase listeners run after the Field's capture listener.
    await page.evaluate(() => {
        const w = window as unknown as { prevented: boolean[] };
        w.prevented = [];
        for (const el of document.querySelectorAll('#validated-form [name]')) {
            el.addEventListener('invalid', (e) => w.prevented.push(e.defaultPrevented));
        }
    });
    await submit(page).click();

    await expect(errorsOf(page, 'val-user')).toHaveText(['Choose a username.']);
    await expect(errorsOf(page, 'val-email')).toHaveText(['Enter an email address.']);
    await expect(errorsOf(page, 'val-fruit')).toHaveText(['Pick a fruit.']);
    await expect(errorsOf(page, 'val-terms')).toHaveText(['Accept the terms to continue.']);
    await expect(posted(page)).toHaveText('—');
    await expect(user(page)).toBeFocused();
    await expect(user(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(fieldPosting(page, 'val-user')).toHaveAttribute('data-invalid', '');

    const prevented = await page.evaluate(() => (window as unknown as { prevented: boolean[] }).prevented);
    expect(prevented.length).toBeGreaterThanOrEqual(4);
    expect(prevented.every(Boolean)).toBe(true);

    // The control names exactly the Error that shows, and every id resolves.
    const ids = await user(page).evaluate((el) => (el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean));
    const errorId = await errorsOf(page, 'val-user').getAttribute('id');
    expect(ids).toContain(errorId);
    for (const id of ids) expect(await page.locator(`[id="${id}"]`).count(), id).toBe(1);
});

test('after a failed submit, each change revalidates against the matching key', async ({ page }) => {
    await submit(page).click();
    await expect(errorsOf(page, 'val-user')).toHaveText(['Choose a username.']);

    await user(page).fill('AB');
    await expect(errorsOf(page, 'val-user')).toHaveText(['Three or more lowercase letters.']);
    await user(page).fill('');
    await expect(errorsOf(page, 'val-user')).toHaveText(['Choose a username.']);
    await user(page).fill('admin');
    await expect(errorsOf(page, 'val-user')).toHaveText(['That username is reserved.']);
    expect(await user(page).evaluate((el: HTMLInputElement) => el.validity.customError)).toBe(true);
    await user(page).fill('ada');
    await expect(errorsOf(page, 'val-user')).toHaveCount(0);
    await expect(fieldPosting(page, 'val-user')).not.toHaveAttribute('data-invalid');
});

test("validate's message blocks the native submit", async ({ page }) => {
    await user(page).fill('admin');
    await email(page).fill('me@example.com');
    const fruit = demoPosting(page, 'select', 'val-fruit');
    await fruit('trigger').click();
    await fruit('item').nth(0).click();
    await demoPosting(page, 'checkbox', 'val-terms')('control').click();

    await submit(page).click();
    await expect(posted(page)).toHaveText('—');
    await expect(errorsOf(page, 'val-user')).toHaveText(['That username is reserved.']);
    await expect(user(page)).toBeFocused();

    await user(page).fill('ada');
    await submit(page).click();
    await expect(posted(page)).toContainText('"val-user":"ada"');
});

test('a blur-mode field validates on leaving it, not while typing', async ({ page }) => {
    await email(page).fill('nope');
    await expect(errorsOf(page, 'val-email')).toHaveCount(0);
    await email(page).press('Tab');
    await expect(errorsOf(page, 'val-email')).toHaveText(['That is not an email address.']);
    // Invalid now, so the fixing change clears it without another blur.
    await email(page).fill('nope@example.com');
    await expect(errorsOf(page, 'val-email')).toHaveCount(0);
});

test('reset forgets every shown error', async ({ page }) => {
    await submit(page).click();
    await expect(errorsOf(page, 'val-user')).toHaveCount(1);
    await form(page).locator('button[type="reset"]').click();
    await expect(form(page).locator('[data-scope="field"][data-part="error"]')).toHaveCount(0);
    await expect(fieldPosting(page, 'val-user')).not.toHaveAttribute('data-invalid');
});
