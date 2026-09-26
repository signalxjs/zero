/**
 * CheckboxGroup and the derived tri-state parent box, in real engines (#282).
 *
 * What the unit suite cannot prove: that a real click on an indeterminate
 * native checkbox — which the platform answers by clearing the
 * `indeterminate` property before `change` fires — leaves the property
 * where `data-state` says it is, and that the parent box's derived state
 * reaches the native input assistive tech reads (`:indeterminate`).
 */
import { test, expect, type Locator } from '@playwright/test';
import { bootPage } from './nav';
import { rootLabelled } from './demo';

test.beforeEach(async ({ page }) => {
    await bootPage(page, 'checkbox', 'basic');
});

/** The one checkbox inside `group` whose label reads `text`. */
const box = (group: Locator, text: string) => {
    const root = group.locator('[data-scope="checkbox"][data-part="root"]').filter({ hasText: text });
    return { root, input: root.locator('[data-scope="checkbox"][data-part="hidden-input"]') };
};
const isIndeterminate = (input: Locator) => input.evaluate((el) => (el as HTMLInputElement).indeterminate);

test('the parent box derives its state from the children, and toggles all or none', async ({ page }) => {
    const group = rootLabelled(page, 'checkbox-group', 'Toppings');
    await expect(group).toHaveAttribute('role', 'group');
    const all = box(group, 'All toppings');
    const ham = box(group, 'Ham');
    const value = page.getByTestId('toppings-value');

    // Seeded with one of three: some.
    await expect(all.root).toHaveAttribute('data-state', 'indeterminate');
    expect(await isIndeterminate(all.input)).toBe(true);

    // From some, the parent selects all.
    await all.root.click();
    await expect(all.root).toHaveAttribute('data-state', 'checked');
    await expect(all.input).toBeChecked();
    expect(await isIndeterminate(all.input)).toBe(false);
    await expect(value).toHaveText('olives, ham, basil');
    await expect(ham.input).toBeChecked();

    // A child leaving makes it some again.
    await ham.root.click();
    await expect(all.root).toHaveAttribute('data-state', 'indeterminate');
    expect(await isIndeterminate(all.input)).toBe(true);

    // From some again — by keyboard this time — then from all to none.
    await all.input.focus();
    await page.keyboard.press('Space');
    await expect(all.root).toHaveAttribute('data-state', 'checked');
    await page.keyboard.press('Space');
    await expect(all.root).toHaveAttribute('data-state', 'unchecked');
    await expect(all.input).not.toBeChecked();
    expect(await isIndeterminate(all.input)).toBe(false);
    await expect(value).toHaveText('none');
});

test('aria-controls names the child inputs', async ({ page }) => {
    const group = rootLabelled(page, 'checkbox-group', 'Toppings');
    const controls = await box(group, 'All toppings').input.getAttribute('aria-controls');
    const ids = await Promise.all(['Ham', 'Olives', 'Basil'].map((t) => box(group, t).input.getAttribute('id')));
    expect(controls).toBe(ids.join(' '));
});

test('a click on an indeterminate box keeps the native input indeterminate while the prop says so', async ({ page }) => {
    const root = rootLabelled(page, 'checkbox', 'Some selected');
    const input = root.locator('[data-scope="checkbox"][data-part="hidden-input"]');
    expect(await isIndeterminate(input)).toBe(true);
    await root.click();
    await expect(root).toHaveAttribute('data-state', 'indeterminate');
    expect(await isIndeterminate(input)).toBe(true);
    await expect(input).toHaveJSProperty('indeterminate', true);
});
