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
import { demoPosting, rootPosting } from './demo';

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

test('typed text is resynced on Tab away: the input shows what the form posts (#265)', async ({ page }) => {
    await input(page).click();
    await input(page).pressSequentially('ice');
    await input(page).press('ArrowDown');
    await input(page).press('Enter');
    await expect(input(page)).toHaveValue('Iceland');
    // A query that never became a selection, then focus leaves.
    await input(page).pressSequentially('Ger');
    await expect(popup(page)).toHaveAttribute('data-state', 'open');
    await input(page).press('Tab');
    await expect(input(page)).not.toBeFocused();
    await expect(popup(page)).toHaveAttribute('data-state', 'closed');
    await expect(input(page)).toHaveValue('Iceland');
    await expect(part(page, 'hidden-input')).toHaveValue('iceland');
});

test('a pointer pick after typing selects the option, not the resynced text (#265)', async ({ page }) => {
    await input(page).click();
    await input(page).pressSequentially('den');
    // The press blurs the input towards an option that takes no focus: the
    // blur must leave the text to the click, or the list would refilter
    // under the pointer.
    await part(page, 'item').filter({ hasText: 'Denmark' }).click();
    await expect(input(page)).toHaveValue('Denmark');
    await expect(part(page, 'hidden-input')).toHaveValue('denmark');
    await expect(input(page)).toBeFocused();
});

test('Escape on a closed combobox clears the text and the value (#265)', async ({ page }) => {
    await input(page).click();
    await input(page).pressSequentially('ice');
    await input(page).press('ArrowDown');
    await input(page).press('Enter');
    await expect(popup(page)).toHaveAttribute('data-state', 'closed');
    await input(page).press('Escape');
    await expect(input(page)).toHaveValue('');
    await expect(part(page, 'hidden-input')).toHaveValue('');
});

test('openOnClick: a click in the input opens the list (#265)', async ({ page }) => {
    const grouped = demoPosting(page, 'combobox', 'grouped-country');
    await expect(grouped('popup')).toHaveAttribute('data-state', 'closed');
    await grouped('input').click();
    await expect(grouped('popup')).toHaveAttribute('data-state', 'open');
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

    // Two presses (#411): the first focuses the last tag, the second removes it.
    await t('input').press('Backspace');
    await expect(t('tag').nth(2)).toBeFocused();
    await expect(t('tag-label')).toHaveText(['search', 'shell', 'deploy']);
    await page.keyboard.press('Backspace');
    await expect(t('tag-label')).toHaveText(['search', 'shell']);
    await expect(t('tag').nth(1)).toBeFocused();
    expect(await posted(page)).toEqual(['search', 'shell']);
});

/**
 * Tag keyboard (#411), in real engines: real focus lands on the tags, a
 * printable key typed on one reaches the input's text (focus moves during the
 * keydown — only a real engine inserts the character where focus went), and
 * a real Tab never stops on a tag or its remove button.
 */
test('tags: arrows walk the tags, Delete removes, and typing on a tag lands in the input (#411)', async ({ page }) => {
    const t = tools(page);
    await t('input').click();
    await page.keyboard.press('ArrowLeft');
    await expect(t('tag').nth(1)).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(t('tag').nth(0)).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(t('tag').nth(1)).toBeFocused();
    await expect(t('tag').nth(1)).toHaveAttribute('data-focus-visible', '');
    await page.keyboard.press('ArrowRight');
    await expect(t('input')).toBeFocused();

    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Home');
    await page.keyboard.press('Delete');
    await expect(t('tag-label')).toHaveText(['shell']);
    await expect(t('tag').nth(0)).toBeFocused();
    expect(await posted(page)).toEqual(['shell']);

    await page.keyboard.type('gi');
    await expect(t('input')).toBeFocused();
    await expect(t('input')).toHaveValue('gi');
});

test('tags: Tab and Shift+Tab never stop on a tag or its remove button (#411)', async ({ page }) => {
    const t = tools(page);
    await t('input').click();
    await page.keyboard.press('Shift+Tab');
    const inside = () => rootPosting(page, 'combobox', 'tools').evaluate((root) => root.contains(document.activeElement));
    expect(await inside()).toBe(false);
    await t('input').click();
    await page.keyboard.press('Tab');
    expect(await inside()).toBe(false);
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

test('the clear-trigger empties the input and the value, and typing resumes in the input (#280)', async ({ page }) => {
    const clearable = demoPosting(page, 'combobox', 'clearable-country');
    await expect(clearable('input')).toHaveValue('Sweden');
    await expect(clearable('hidden-input')).toHaveValue('sweden');
    await clearable('clear-trigger').click();
    await expect(clearable('input')).toHaveValue('');
    await expect(clearable('hidden-input')).toHaveValue('');
    await expect(clearable('input')).toBeFocused();
    // Nothing left to clear: the button leaves with the value.
    await expect(clearable('clear-trigger')).toHaveCount(0);
    // Typed text alone brings it back — and it clears that too.
    await page.keyboard.type('Nor');
    await expect(clearable('clear-trigger')).toBeVisible();
    await clearable('clear-trigger').click();
    await expect(clearable('input')).toHaveValue('');
    await expect(clearable('input')).toBeFocused();
});

test('a separator is skipped by the arrows (#280)', async ({ page }) => {
    const clearable = demoPosting(page, 'combobox', 'clearable-country');
    await clearable('clear-trigger').click();
    const items = clearable('item');
    const at = async (i: number) => (await items.nth(i).getAttribute('id'))!;
    await clearable('input').press('ArrowDown'); // opens on the first option
    await expect(clearable('popup')).toHaveAttribute('data-state', 'open');
    await expect(clearable('input')).toHaveAttribute('aria-activedescendant', await at(0));
    await clearable('input').press('ArrowDown');
    await expect(clearable('input')).toHaveAttribute('aria-activedescendant', await at(1));
    await clearable('input').press('ArrowDown'); // Sweden → Australia, never the rule
    await expect(clearable('input')).toHaveAttribute('aria-activedescendant', await at(2));
});

test('loading: the listbox is busy and says so until the list arrives (#280)', async ({ page }) => {
    const city = demoPosting(page, 'combobox', 'city');
    await city('trigger').click();
    await expect(city('popup')).toHaveAttribute('aria-busy', 'true');
    await expect(city('loading')).toHaveText('Loading cities…');
    await expect(city('empty')).toHaveCount(0);
    await page.getByLabel('Cities still loading').uncheck();
    await expect(city('popup')).not.toHaveAttribute('aria-busy', 'true');
    await expect(city('loading')).toHaveCount(0);
    await city('trigger').click();
    await expect(city('popup')).toHaveAttribute('data-state', 'open');
    await expect(city('item')).toHaveCount(8);
});

/**
 * Inline autocomplete (#301), on the inline Combobox — named by the field it
 * posts. What a real engine adds over the unit suite: the `inputType` a real
 * keystroke carries, the selection the completion leaves, and that typing
 * over it replaces it.
 */
const inlineDemo = (page: Page) => demoPosting(page, 'combobox', 'inline-country');
const selection = (loc: ReturnType<ReturnType<typeof inlineDemo>>) =>
    loc.evaluate((el) => {
        const i = el as HTMLInputElement;
        return i.value.slice(i.selectionStart ?? 0, i.selectionEnd ?? 0);
    });

test('inline: typing completes with the rest selected; typing on refines, Backspace drops it, Enter picks (#301)', async ({ page }) => {
    const c = inlineDemo(page);
    await expect(c('input')).toHaveAttribute('aria-autocomplete', 'both');
    await c('input').click();
    await page.keyboard.type('S');
    await expect(c('input')).toHaveValue('Sweden');
    expect(await selection(c('input'))).toBe('weden');
    const sweden = c('item').filter({ hasText: 'Sweden' });
    await expect(c('input')).toHaveAttribute('aria-activedescendant', (await sweden.getAttribute('id'))!);
    // Backspace removes only the selected completion.
    await page.keyboard.press('Backspace');
    await expect(c('input')).toHaveValue('S');
    await expect(c('input')).not.toHaveAttribute('aria-activedescendant', /.+/);
    // Typing over a completion replaces it and completes again.
    await page.keyboard.type('w');
    await expect(c('input')).toHaveValue('Sweden');
    await page.keyboard.press('Enter');
    await expect(c('popup')).toHaveAttribute('data-state', 'closed');
    await expect(c('input')).toHaveValue('Sweden');
    await expect(c('hidden-input')).toHaveValue('Sweden');
});

test('inline: Escape takes the completion back first; a caret move accepts it as text (#301)', async ({ page }) => {
    const c = inlineDemo(page);
    await c('input').click();
    await page.keyboard.type('Ic');
    await expect(c('input')).toHaveValue('Iceland');
    await page.keyboard.press('Escape');
    await expect(c('input')).toHaveValue('Ic');
    await expect(c('popup')).toHaveAttribute('data-state', 'open');
    await page.keyboard.type('e');
    await expect(c('input')).toHaveValue('Iceland');
    // A caret move along the text (End, Home and ArrowLeft do the same;
    // End is no caret key in a macOS text field).
    await page.keyboard.press('ArrowRight');
    await expect(c('input')).toHaveValue('Iceland');
    expect(await selection(c('input'))).toBe('');
    // Accepted text, not a value: nothing posts until it is picked.
    await expect(c('hidden-input')).toHaveValue('');
    await page.keyboard.press('Tab');
    await expect(c('hidden-input')).toHaveValue('Iceland');
});

test('inline: an IME composition is never completed (#301)', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'IME composition is driven over CDP');
    const c = inlineDemo(page);
    await c('input').click();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.imeSetComposition', { text: 'Ja', selectionStart: 2, selectionEnd: 2 });
    await expect(c('input')).toHaveValue('Ja');
    await cdp.send('Input.insertText', { text: 'Ja' });
    await expect(c('input')).toHaveValue('Ja');
    expect(await selection(c('input'))).toBe('');
    // The next plain keystroke completes again.
    await page.keyboard.type('p');
    await expect(c('input')).toHaveValue('Japan');
});
