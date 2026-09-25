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
import { test, expect, type Locator, type Page } from '@playwright/test';
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

/**
 * Where the textarea lays out the character after `prefix` on its first
 * line, in client px: the content box's inline start plus the prefix's
 * advance, measured by a canvas in the textarea's own font — an
 * independent measurement, not the mirror the component uses.
 */
const inlineStartAfter = (textarea: Locator, prefix: string) => textarea.evaluate((el, text) => {
    const cs = getComputedStyle(el);
    const ctx = document.createElement('canvas').getContext('2d')!;
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const box = el.getBoundingClientRect();
    const advance = ctx.measureText(text).width;
    return cs.direction === 'rtl'
        ? box.left + el.clientLeft + el.clientWidth - parseFloat(cs.paddingRight) - advance
        : box.left + el.clientLeft + parseFloat(cs.paddingLeft) + advance;
}, prefix);

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

    // Anchored at the token (#105): the list starts where the `@` does.
    const list = await settledBox(popup, 'the mention list');
    expect(Math.abs(list.x - await inlineStartAfter(textarea, 'cc '))).toBeLessThan(3);

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

test('the list opens at the typed @, on its own line (#105)', async ({ page }) => {
    const { popup, textarea } = demo(page);
    await textarea.click();
    await page.keyboard.type('Hello there, @a');
    await expect(popup).toHaveAttribute('data-state', 'open');
    const box = await settledBox(textarea, 'the composer');
    let list = await settledBox(popup, 'the mention list');
    // At the `@`, well inside the composer rather than at its edge.
    const at = await inlineStartAfter(textarea, 'Hello there, ');
    expect(at - box.x).toBeGreaterThan(40);
    expect(Math.abs(list.x - at)).toBeLessThan(3);

    // A token on the first of several lines opens under that line — inside
    // the composer's box, not below all of it.
    await page.keyboard.press('Escape');
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Backspace');
    for (const line of ['one', 'two', 'three']) {
        await page.keyboard.press('Shift+Enter');
        await page.keyboard.type(line);
    }
    await page.keyboard.press('ControlOrMeta+Home');
    // WebKit on macOS: Cmd+Home may not move a textarea's caret; set it.
    await textarea.evaluate((el) => (el as HTMLTextAreaElement).setSelectionRange(0, 0));
    await page.keyboard.type('@a');
    await expect(popup).toHaveAttribute('data-state', 'open');
    const tall = await settledBox(textarea, 'the grown composer');
    list = await settledBox(popup, 'the mention list');
    expect(list.y).toBeLessThan(tall.y + tall.height / 2);
    expect(list.y).toBeGreaterThan(tall.y);
});

test('under rtl the list opens from the @ towards the reading direction (#105)', async ({ page }) => {
    const { popup, textarea } = demo(page);
    await textarea.evaluate((el) => { (el as HTMLTextAreaElement).dir = 'rtl'; });
    await textarea.click();
    await page.keyboard.type('@a');
    await expect(popup).toHaveAttribute('data-state', 'open');
    await expect(popup).toHaveAttribute('data-placement', 'bottom-start');
    const list = await settledBox(popup, 'the mention list');
    // The list's right edge — its inline start — sits at the `@`'s.
    expect(Math.abs(list.x + list.width - await inlineStartAfter(textarea, ''))).toBeLessThan(3);
});

test.describe('Input.Input as the control (#106)', () => {
    const COMMAND = 'Command (/ to complete)';
    function line(page: Page) {
        const root = rootLabelled(page, 'combobox', COMMAND);
        const part = partsOf(root, 'combobox');
        return { popup: part('popup'), items: part('item'), input: root.locator('[data-scope="input"][data-part="input"]') };
    }

    test('a / token opens the list; Enter commits into the line, then runs it', async ({ page }) => {
        const { popup, items, input } = line(page);
        await expect(input).toHaveAttribute('aria-autocomplete', 'list');
        await input.click();
        await page.keyboard.type('/de');
        await expect(popup).toHaveAttribute('data-state', 'open');
        await expect(input).toHaveAttribute('role', 'combobox');
        await expect(items).toHaveText(['deploy', 'describe']);
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await expect(input).toHaveValue('/describe ');
        await expect(popup).toHaveAttribute('data-state', 'closed');
        await expect(input).not.toHaveAttribute('role', /./);
        await expect(page.getByText('Ran: —')).toBeVisible();
        await page.keyboard.type('now');
        await page.keyboard.press('Enter');
        await expect(page.getByText('Ran: /describe now')).toBeVisible();
        await expect(input).toHaveValue('');
    });

    test('the list opens under the line, at the /', async ({ page }) => {
        const { popup, input } = line(page);
        await input.click();
        await page.keyboard.type('run /h');
        await expect(popup).toHaveAttribute('data-state', 'open');
        const box = await settledBox(input, 'the command line');
        const list = await settledBox(popup, 'the command list');
        expect(Math.abs(list.x - await inlineStartAfter(input, 'run '))).toBeLessThan(3);
        expect(list.y).toBeGreaterThanOrEqual(box.y + box.height - 1);
    });
});
