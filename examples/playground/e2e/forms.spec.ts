/**
 * The form-participation contract in real engines (#441).
 *
 * What the unit table cannot prove: that a real submit is blocked by the
 * platform's constraint validation on a visually-hidden `<select>` and that
 * the invalid focus lands on the styled trigger; that a real `FormData`
 * carries every control's value, omits the disabled one and includes the one
 * associated from outside through `form="id"`; and that the platform's
 * `reset` restores every default in the DOM the user sees.
 */
import { test, expect, type Page } from '@playwright/test';
import { bootPage } from './nav';
import { demoPosting, rootPosting } from './demo';

test.beforeEach(async ({ page }) => {
    await bootPage(page, 'forms', 'basic');
});

const form = (page: Page) => page.locator('form#demo-form');
const posted = (page: Page) => page.getByTestId('posted');
const submit = (page: Page) => form(page).locator('button[type="submit"]');
const reset = (page: Page) => form(page).locator('button[type="reset"]');

/** Pick the second fruit through the styled listbox. */
async function pickBanana(page: Page): Promise<void> {
    const select = demoPosting(page, 'select', 'form-fruit');
    await select('trigger').click();
    await expect(select('popup')).toHaveAttribute('data-state', 'open');
    await select('item').nth(1).click();
    await expect(select('value')).toHaveText('Banana');
}

test('a required, empty Select blocks submit and the invalid focus lands on its trigger', async ({ page }) => {
    await submit(page).click();
    await expect(posted(page)).toHaveText('—');
    await expect(demoPosting(page, 'select', 'form-fruit')('trigger')).toBeFocused();
});

test('a real FormData carries every control, omits the disabled one, includes form= from outside', async ({ page }) => {
    await pickBanana(page);
    await submit(page).click();
    await expect(posted(page)).not.toHaveText('—');
    const data = JSON.parse((await posted(page).textContent())!) as Record<string, string>;
    expect(data).toMatchObject({
        'form-fruit': 'banana',
        'form-email': 'me@example.com',
        'form-plan': 'starter',
        'form-notify': 'on',
        'form-qty': '1',
        'form-stars': '3',
        'form-volume': '40',
        'form-outside': 'associated',
    });
    // Unchecked and disabled controls never post.
    expect(data).not.toHaveProperty('form-terms');
    expect(data).not.toHaveProperty('form-skipped');
    // An unnamed RadioGroup keeps a generated grouping name for arrow-key
    // roving but is owned by no form (form=""), so nothing posts under it.
    expect(Object.keys(data).filter((k) => k.startsWith('zx-'))).toEqual([]);
});

test('reset restores every default the user can see, styled parts included', async ({ page }) => {
    const select = demoPosting(page, 'select', 'form-fruit');
    const email = demoPosting(page, 'input', 'form-email')('input');
    await pickBanana(page);
    await email.fill('changed@example.com');
    const terms = rootPosting(page, 'checkbox', 'form-terms');
    await terms.click();
    await expect(terms).toHaveAttribute('data-state', 'checked');

    await reset(page).click();

    await expect(select('value')).toHaveText('Pick a fruit…');
    await expect(select('hidden-input')).toHaveValue('');
    await expect(email).toHaveValue('me@example.com');
    await expect(terms).toHaveAttribute('data-state', 'unchecked');
    await expect(rootPosting(page, 'switch', 'form-notify')).toHaveAttribute('data-state', 'checked');
});
