/**
 * Combobox over popover="manual" + the dismiss layer, in real engines.
 *
 * The part the unit suite cannot prove: that opting out of native light
 * dismiss actually buys the behavior it exists for — clicking back into the
 * input (a caret click) keeps the list open, while a genuinely outside
 * click closes it.
 */
import { test, expect, type Page } from '@playwright/test';
import { bootPage } from './nav';
import { demoPosting } from './demo';

test.beforeEach(async ({ page }) => {
    await bootPage(page, 'combobox', 'basic');
});

/**
 * The country Combobox, named — the Combobox page renders three (this one, a
 * readonly sample and an invalid one) and will render more.
 *
 * Every locator below hangs off this root instead of resolving a bare
 * `[data-scope="combobox"][data-part=…]` across the page. `.first()` is not
 * the fix: it resolves by document order, so the spec would silently retarget
 * the moment the demo grows a sibling, and then pass — or fail — for a reason
 * that has nothing to do with the dismiss layer. The root is identified by the
 * field name it posts, which is this instance's identity rather than its
 * position.
 */
const demo = (page: Page) =>
    page.locator('[data-scope="combobox"][data-part="root"]')
        .filter({ has: page.locator('[data-scope="combobox"][data-part="hidden-input"][name="country"]') });

const part = (page: Page, name: string) =>
    demo(page).locator(`[data-scope="combobox"][data-part="${name}"]`);
const input = (page: Page) => part(page, 'input');
const popup = (page: Page) => part(page, 'popup');

test('typing filters, a caret click keeps the list open, outside click closes', async ({ page }) => {
    await input(page).click();
    await input(page).pressSequentially('den');
    await expect(popup(page)).toHaveAttribute('data-state', 'open');
    const items = part(page, 'item');
    await expect(items).toHaveCount(2); // Denmark, Sweden
    // A click back into the input must NOT light-dismiss the manual popover.
    await input(page).click();
    await expect(popup(page)).toHaveAttribute('data-state', 'open');
    // A genuinely outside click closes via the dismiss layer.
    await page.locator('h1').click();
    await expect(popup(page)).toHaveAttribute('data-state', 'closed');
});

test('keyboard selects and fills the input; the form value follows', async ({ page }) => {
    await input(page).click();
    await input(page).pressSequentially('ice');
    await input(page).press('ArrowDown');
    await input(page).press('Enter');
    await expect(input(page)).toHaveValue('Iceland');
    await expect(popup(page)).toHaveAttribute('data-state', 'closed');
    await expect(part(page, 'hidden-input')).toHaveValue('iceland');
});

/**
 * Tags and free text (#39), on the tools Combobox — named by the field it
 * posts, like the country one above.
 */
const tools = (page: Page) => demoPosting(page, 'combobox', 'tools');
const posted = (page: Page) =>
    tools(page)('hidden-input').evaluate((el) => Array.from((el as HTMLSelectElement).selectedOptions).map((o) => o.value));

test('tags: free text commits on Enter, Backspace on the empty input removes the last', async ({ page }) => {
    const t = tools(page);
    await expect(t('tag-label')).toHaveText(['search', 'shell']);
    await t('input').click();
    await t('input').pressSequentially('deploy');
    await t('input').press('Enter');
    await expect(t('tag-label')).toHaveText(['search', 'shell', 'deploy']);
    await expect(t('input')).toHaveValue('');
    expect(await posted(page)).toEqual(['search', 'shell', 'deploy']);

    await t('input').press('Backspace');
    await expect(t('tag-label')).toHaveText(['search', 'shell']);
    expect(await posted(page)).toEqual(['search', 'shell']);
});

test('tags: an option picked by keyboard becomes a tag and the list stays open', async ({ page }) => {
    const t = tools(page);
    await t('input').click();
    await t('input').pressSequentially('gi');
    await t('input').press('ArrowDown');
    await t('input').press('Enter');
    await expect(t('tag-label')).toHaveText(['search', 'shell', 'git']);
    await expect(t('popup')).toHaveAttribute('data-state', 'open');
    await expect(t('input')).toHaveValue('');
});

test('tags: a remove button deselects its value and hands focus back to the input', async ({ page }) => {
    const t = tools(page);
    const remove = t('tag-remove').nth(0);
    await expect(remove).toHaveAccessibleName('Remove search');
    await remove.click();
    await expect(t('tag-label')).toHaveText(['shell']);
    await expect(t('input')).toBeFocused();
    expect(await posted(page)).toEqual(['shell']);
});
