/**
 * Combobox trigger mode — `@mention` over a Textarea — in real engines (#58).
 *
 * happy-dom proves the token rules and the wiring; only a browser shows the
 * parts that depend on a real editing stack and a real top layer: the caret
 * after a commit (typing continues after the inserted label), the commit
 * landing through `insertText` so it undoes, a pointer pick that never takes
 * focus out of the textarea, the popup anchored to it, and Enter going to the
 * composer only while the list is closed.
 */
import { test, expect, type Page } from '@playwright/test';
import { partsOf, rootLabelled, settledBox } from './demo';
import { bootPage } from './nav';

const DEMO = 'Message (@ to mention)';

/** The mention demo, named by its label — the Combobox page renders several. */
function demo(page: Page) {
    const root = rootLabelled(page, 'combobox', DEMO);
    const part = partsOf(root, 'combobox');
    return {
        root,
        popup: part('popup'),
        items: part('item'),
        textarea: root.locator('[data-scope="textarea"][data-part="textarea"]'),
    };
}

const caret = (page: Page) => demo(page).textarea.evaluate((el) => (el as HTMLTextAreaElement).selectionStart);

test.beforeEach(async ({ page }) => {
    await bootPage(page, 'combobox', 'basic');
});

test('the token at the caret opens the list; arrows move, Enter commits and the caret follows', async ({ page }) => {
    const { popup, items, textarea } = demo(page);
    await expect(textarea).toHaveAttribute('aria-autocomplete', 'list');
    await expect(textarea).not.toHaveAttribute('role', /./);

    await textarea.click();
    await page.keyboard.type('Hi @a');
    await expect(popup).toHaveAttribute('data-state', 'open');
    await expect(textarea).toHaveAttribute('role', 'combobox');
    await expect(textarea).toHaveAttribute('aria-expanded', 'true');
    await expect(items).toHaveText(['Atlas', 'Ada', 'Grace']);
    // Positional within this one demo's own list — identity, not accident.
    await expect(textarea).toHaveAttribute('aria-activedescendant', (await items.nth(0).getAttribute('id'))!);

    await page.keyboard.press('ArrowDown');
    await expect(textarea).toHaveAttribute('aria-activedescendant', (await items.nth(1).getAttribute('id'))!);
    await page.keyboard.press('Enter');

    await expect(textarea).toHaveValue('Hi @Ada ');
    await expect(popup).toHaveAttribute('data-state', 'closed');
    await expect(textarea).not.toHaveAttribute('role', /./);
    expect(await caret(page)).toBe(8);
    await expect(page.getByText('Mentioned: ada')).toBeVisible();
    // That Enter was the list's — nothing was sent.
    await expect(page.getByText('Sent: —')).toBeVisible();

    // Typing continues after the label.
    await page.keyboard.type('hello');
    await expect(textarea).toHaveValue('Hi @Ada hello');
});

test('Escape dismisses until the next edit; a closed list leaves Enter to the composer', async ({ page }) => {
    const { popup, textarea } = demo(page);
    await textarea.click();
    await page.keyboard.type('ping @gr');
    await expect(popup).toHaveAttribute('data-state', 'open');
    await page.keyboard.press('Escape');
    await expect(popup).toHaveAttribute('data-state', 'closed');
    await page.keyboard.type('a');
    await expect(popup).toHaveAttribute('data-state', 'open');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Sent: ping @gra')).toBeVisible();
    await expect(textarea).toHaveValue('');
});

test('a pointer pick commits without taking focus or the caret out of the textarea', async ({ page }) => {
    const { popup, items, textarea } = demo(page);
    await textarea.click();
    await page.keyboard.type('cc @li');
    await expect(popup).toHaveAttribute('data-state', 'open');

    // Anchored to the textarea: the list starts at its inline edge.
    const box = await settledBox(textarea, 'the composer');
    const list = await settledBox(popup, 'the mention list');
    expect(Math.abs(list.x - box.x)).toBeLessThan(2);

    await items.filter({ hasText: 'Linus' }).click();
    await expect(textarea).toHaveValue('cc @Linus ');
    await expect(textarea).toBeFocused();
    await page.keyboard.type('!');
    await expect(textarea).toHaveValue('cc @Linus !');
});

test('a commit is one edit on the undo stack', async ({ page }, testInfo) => {
    // WebKit coalesces the typing before the commit and the commit itself
    // into one undo group, so an undo there empties the box — the platform's
    // grouping, not a lost edit. Blink and Gecko undo the commit alone.
    test.skip(testInfo.project.name === 'webkit', 'WebKit groups the typed token and the commit into one undo step');
    const { textarea } = demo(page);
    await textarea.click();
    await page.keyboard.type('@at');
    await page.keyboard.press('Tab');
    await expect(textarea).toHaveValue('@Atlas ');
    await expect(textarea).toBeFocused();
    await page.keyboard.press('ControlOrMeta+z');
    await expect(textarea).toHaveValue('@at');
});
