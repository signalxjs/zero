/**
 * Fieldset in real engines (#285).
 *
 * What the unit suite cannot prove: that the platform's `<fieldset
 * disabled>` really disables the native controls inside and exempts the
 * ones in its first `<legend>` — the "enable this section" checkbox is
 * operable while everything beside it is not — that the context reaches the
 * control the platform cannot (the composed slider's thumb refuses its
 * arrow keys), that nothing inside posts while the group is disabled and
 * everything does once it is not, and that the group takes its accessible
 * name from the legend with no ARIA of zero's own.
 */
import { test, expect, type Page } from '@playwright/test';
import { bootPage } from './nav';
import { demoPosting, partsOf, rootLabelled, rootPosting } from './demo';

test.beforeEach(async ({ page }) => {
    await bootPage(page, 'forms', 'basic');
});

/** The shipping fieldset, named by the text of its legend's checkbox. */
const shipping = (page: Page) => rootLabelled(page, 'fieldset', 'Ship to a different address');

const posted = async (page: Page): Promise<Record<string, string>> => {
    await page.locator('[data-demo="fieldset-form"] button[type="submit"]').click();
    const text = await page.getByTestId('fieldset-posted').textContent();
    return JSON.parse(text ?? '{}') as Record<string, string>;
};

test('a disabled fieldset: native controls disabled, the composed thumb refuses its keys, nothing posts', async ({ page }) => {
    const root = shipping(page);
    await expect(root).toHaveJSProperty('disabled', true);
    await expect(root).toHaveAttribute('data-disabled', '');

    // The platform's half: every native control inside is disabled.
    await expect(demoPosting(page, 'input', 'fs-street')('input')).toBeDisabled();
    await expect(demoPosting(page, 'select', 'fs-country')('trigger')).toBeDisabled();
    for (const radio of await demoPosting(page, 'radio-group', 'fs-delivery')('hidden-input').all()) {
        await expect(radio).toBeDisabled();
    }

    // Zero's half: the thumb is a span, which no fieldset can disable.
    const thumb = demoPosting(page, 'slider', 'fs-priority')('thumb');
    await expect(thumb).toHaveAttribute('aria-disabled', 'true');
    await expect(thumb).toHaveAttribute('data-disabled', '');
    await expect(thumb).toHaveAttribute('aria-valuenow', '2');
    await thumb.focus();
    await page.keyboard.press('ArrowRight');
    await expect(thumb).toHaveAttribute('aria-valuenow', '2');

    const data = await posted(page);
    expect(Object.keys(data).filter((k) => k.startsWith('fs-'))).toEqual([]);
});

test('the legend\'s checkbox stays live and enables the section; then every control takes input and posts', async ({ page }) => {
    const root = shipping(page);
    const legend = partsOf(root, 'fieldset')('legend');
    const toggle = partsOf(legend, 'checkbox');
    await expect(toggle('hidden-input')).toBeEnabled();
    await toggle('control').click();
    await expect(toggle('hidden-input')).toBeChecked();
    await expect(root).toHaveJSProperty('disabled', false);
    await expect(root).not.toHaveAttribute('data-disabled', '');

    await expect(demoPosting(page, 'input', 'fs-street')('input')).toBeEnabled();
    const thumb = demoPosting(page, 'slider', 'fs-priority')('thumb');
    await expect(thumb).not.toHaveAttribute('aria-disabled', 'true');
    await thumb.focus();
    await page.keyboard.press('ArrowRight');
    await expect(thumb).toHaveAttribute('aria-valuenow', '3');

    const data = await posted(page);
    expect(data).toMatchObject({
        'fs-street': 'Storgatan 1',
        'fs-country': 'sweden',
        'fs-delivery': 'standard',
        'fs-priority': '3',
    });
});

test('the group is named by its legend — the platform\'s naming, no aria-labelledby', async ({ page }) => {
    const billing = rootLabelled(page, 'fieldset', 'Billing (readonly)');
    await expect(billing).not.toHaveAttribute('aria-labelledby', /./);
    await expect(page.getByRole('group', { name: 'Billing (readonly)' })).toHaveCount(1);
    await expect(page.getByRole('group', { name: 'Contact me by (invalid)' })).toHaveCount(1);
});

test('a readonly fieldset: the text input keeps its value, the switch refuses a click', async ({ page }) => {
    const input = demoPosting(page, 'input', 'fs-company')('input');
    await expect(input).toHaveAttribute('readonly', '');
    await expect(input).toBeEnabled();
    await input.click();
    await page.keyboard.type('x');
    await expect(input).toHaveValue('Acme AB');

    const sw = rootPosting(page, 'switch', 'fs-invoice');
    await expect(sw).toHaveAttribute('data-readonly', '');
    await sw.click();
    await expect(sw).toHaveAttribute('data-state', 'checked');
});

test('an invalid fieldset marks every control inside it invalid', async ({ page }) => {
    const contact = rootLabelled(page, 'fieldset', 'Contact me by (invalid)');
    await expect(contact).toHaveAttribute('data-invalid', '');
    for (const name of ['fs-contact-email', 'fs-contact-phone']) {
        await expect(rootPosting(page, 'checkbox', name)).toHaveAttribute('data-invalid', '');
        await expect(demoPosting(page, 'checkbox', name)('hidden-input')).toHaveAttribute('aria-invalid', 'true');
    }
});
