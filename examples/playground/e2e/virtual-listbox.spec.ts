/**
 * Windowed Select and Combobox (`virtual`, #96) — ten thousand options under
 * a real layout engine.
 *
 * The unit suite models the geometry; this proves the half that needs a
 * real one: the popup really is a bounded scroll viewport, only a window of
 * options is in the document, the keyboard reaches options that were never
 * rendered and scrolls them into view, the highlighted option survives a
 * wheel scroll away from it (so `aria-activedescendant` never dangles), and
 * the window really fills the viewport wherever it is scrolled.
 *
 * The demos are named by the field they post (`station`, `station-search`,
 * and the grouped `station-by-line`); every option is located inside its
 * own popup.
 */
import { test, expect, type Locator, type Page } from '@playwright/test';
import { bootPage } from './nav';
import { demoPosting, settledBox } from './demo';

/**
 * Uncaught errors per page — above all WebKit's "ResizeObserver loop
 * completed with undelivered notifications", which a window rendering rows
 * inside the observer's own callback would cause, and no geometry assertion
 * would see.
 */
const errors = new WeakMap<Page, string[]>();

test.afterEach(({ page }) => {
    expect(errors.get(page), 'no uncaught errors or console errors').toEqual([]);
});

async function boot(page: Page, id: string): Promise<void> {
    const seen: string[] = [];
    errors.set(page, seen);
    page.on('pageerror', (e) => seen.push(e.message));
    page.on('console', (m) => {
        if (m.type() === 'error') seen.push(m.text());
    });
    await bootPage(page, id, 'basic');
}

/** The option `control`'s `aria-activedescendant` names — asserted to exist. */
async function active(page: Page, control: Locator): Promise<Locator> {
    const id = await control.getAttribute('aria-activedescendant');
    expect(id, 'aria-activedescendant is set').toBeTruthy();
    const option = page.locator(`[id="${id}"]`);
    await expect(option, `#${id} is in the document`).toHaveCount(1);
    return option;
}

/** Whether `row` shows inside the scroll container `viewport` (not the page's viewport). */
async function shownIn(row: Locator, viewport: Locator): Promise<boolean> {
    if ((await row.count()) === 0) return false;
    const [r, v] = await Promise.all([row.boundingBox(), viewport.boundingBox()]);
    return !!r && !!v && r.y >= v.y - 1 && r.y + r.height <= v.y + v.height + 1;
}

/** The highlighted option, rendered and scrolled into its popup. */
async function expectHighlightShown(page: Page, control: Locator, popup: Locator, text: string | RegExp, position: number): Promise<void> {
    const option = await active(page, control);
    // A string is the label, exactly: not "Station 1" for "Station 12", and
    // blind to the selected indicator after it.
    await expect(option).toHaveText(typeof text === 'string' ? new RegExp(`^${text}(?!\\d)`) : text);
    await expect(option).toHaveAttribute('aria-posinset', String(position));
    await expect(option).toHaveAttribute('data-highlighted', '');
    await expect.poll(() => shownIn(option, popup), { message: `option ${position} scrolled into view` }).toBe(true);
}

/** Rendered options: a window, never the list. */
async function expectWindowed(options: Locator, setSize: number): Promise<void> {
    const count = await options.count();
    expect(count).toBeGreaterThan(3);
    expect(count).toBeLessThan(60);
    await expect(options.first()).toHaveAttribute('aria-setsize', String(setSize));
}

/**
 * The rows the popup shows actually tile it: every option (and, grouped,
 * every heading) whose box overlaps the viewport is a rendered one,
 * consecutive rendered rows abut, and the viewport is never showing a
 * spacer's blank where a row belongs.
 */
async function expectViewportFilled(popup: Locator): Promise<void> {
    const gaps = await popup.evaluate((el) => {
        const view = el.getBoundingClientRect();
        const rows = [...el.querySelectorAll('[role="option"], [data-part="group-heading"]')]
            .map((o) => o.getBoundingClientRect())
            .filter((r) => r.bottom > view.top + 1 && r.top < view.bottom - 1)
            .sort((a, b) => a.top - b.top);
        const problems: string[] = [];
        if (rows.length === 0) problems.push('no option in view');
        for (let i = 1; i < rows.length; i++) {
            if (Math.abs(rows[i]!.top - rows[i - 1]!.bottom) > 1) problems.push(`gap of ${rows[i]!.top - rows[i - 1]!.bottom}px`);
        }
        const covered = rows.length === 0 ? 0 : Math.min(rows.at(-1)!.bottom, view.bottom) - Math.max(rows[0]!.top, view.top);
        // The popup's own padding may show at either end; nothing more.
        if (covered < el.clientHeight - 24) problems.push(`rows cover ${covered}px of ${el.clientHeight}px`);
        return problems;
    });
    expect(gaps).toEqual([]);
}

test.describe('Select virtual', () => {
    test.beforeEach(async ({ page }) => { await boot(page, 'select'); });
    const demo = (page: Page) => demoPosting(page, 'select', 'station');

    test('a bounded popup holds a window of the 10,000 options', async ({ page }) => {
        const parts = demo(page);
        await parts('trigger').click();
        await expect(parts('popup')).toHaveAttribute('data-state', 'open');
        await settledBox(parts('popup'), 'popup');
        const box = await parts('popup').boundingBox();
        expect(box!.height).toBeLessThan(page.viewportSize()!.height);
        await expectWindowed(parts('item'), 10_000);
        await expectViewportFilled(parts('popup'));
    });

    test('keyboard to the end and back: End, Home, PageDown, typeahead, Enter', async ({ page }) => {
        const parts = demo(page);
        const trigger = parts('trigger');
        await trigger.focus();
        await trigger.press('ArrowDown');
        await expect(parts('popup')).toHaveAttribute('data-state', 'open');
        await expectHighlightShown(page, trigger, parts('popup'), 'Station 1', 1);

        await trigger.press('End');
        await expectHighlightShown(page, trigger, parts('popup'), 'Zulu', 10_000);
        await expectWindowed(parts('item'), 10_000);
        await expectViewportFilled(parts('popup'));

        await trigger.press('Home');
        await expectHighlightShown(page, trigger, parts('popup'), 'Station 1', 1);

        await trigger.press('PageDown');
        const paged = Number(await (await active(page, trigger)).getAttribute('aria-posinset'));
        expect(paged).toBeGreaterThan(2);
        await expectHighlightShown(page, trigger, parts('popup'), `Station ${paged}`, paged);

        await trigger.press('z');
        await expectHighlightShown(page, trigger, parts('popup'), 'Zulu', 10_000);

        await trigger.press('ArrowUp');
        await expectHighlightShown(page, trigger, parts('popup'), 'Station 9999', 9_999);
        await trigger.press('Enter');
        await expect(parts('popup')).toHaveAttribute('data-state', 'closed');
        await expect(parts('value')).toHaveText('Station 9999');
        await expect(parts('hidden-input')).toHaveValue('s9999');

        // Reopened, it scrolls back to the selection.
        await trigger.press('ArrowDown');
        await expectHighlightShown(page, trigger, parts('popup'), 'Station 9999', 9_999);
    });

    test('scrolled away from, the highlighted option stays rendered', async ({ page }) => {
        const parts = demo(page);
        const trigger = parts('trigger');
        await trigger.focus();
        await trigger.press('ArrowDown');
        await expectHighlightShown(page, trigger, parts('popup'), 'Station 1', 1);

        // Scrolled by script, the pointer nowhere near: hovering an option
        // would (rightly) move the highlight to it.
        await page.mouse.move(0, 0);
        await parts('popup').evaluate((el) => { el.scrollTop = el.scrollHeight / 2; });
        await expect.poll(() => parts('item').filter({ hasText: /^Station 50\d\d$/ }).count()).toBeGreaterThan(3);
        await expectViewportFilled(parts('popup'));
        // Pinned apart from the window: aria-activedescendant still names it.
        const pinned = await active(page, trigger);
        await expect(pinned).toHaveText(/^Station 1(?!\d)/);
        expect(await shownIn(pinned, parts('popup'))).toBe(false);

        // The keyboard picks up where the highlight is, and scrolls back to it.
        await trigger.press('ArrowDown');
        await expectHighlightShown(page, trigger, parts('popup'), 'Station 2', 2);
    });

    test('a wheel scroll moves the window, and a click picks what is under the pointer', async ({ page }) => {
        const parts = demo(page);
        await parts('trigger').click();
        await expect(parts('popup')).toHaveAttribute('data-state', 'open');
        const box = await settledBox(parts('popup'), 'popup');
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        // Firefox scrolls a wheel notch by lines, whatever the delta: keep
        // turning until the list is well away from its top.
        await expect.poll(async () => {
            await page.mouse.wheel(0, 5_000);
            return parts('popup').evaluate((el) => el.scrollTop);
        }).toBeGreaterThan(3_000);
        await expect.poll(async () => {
            const top = await parts('popup').evaluate((el) => el.scrollTop);
            await page.waitForTimeout(100);
            return top === await parts('popup').evaluate((el) => el.scrollTop);
        }).toBe(true);
        await expectViewportFilled(parts('popup'));
        await expectWindowed(parts('item'), 10_000);

        const label = await page.evaluate(({ x, y }) =>
            document.elementFromPoint(x, y)?.closest('[role="option"]')?.textContent?.trim() ?? '', { x: box.x + box.width / 2, y: box.y + box.height / 2 });
        expect(label).toMatch(/^Station \d+$/);
        expect(Number(label.slice('Station '.length))).toBeGreaterThan(50);
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await expect(parts('value')).toHaveText(label);
    });
});

test.describe('Select virtual, grouped (#127)', () => {
    test.beforeEach(async ({ page }) => { await boot(page, 'select'); });
    const demo = (page: Page) => demoPosting(page, 'select', 'station-by-line');
    /** The heading the highlighted option names through aria-describedby. */
    const describedBy = async (page: Page, control: Locator): Promise<Locator> => {
        const id = await (await active(page, control)).getAttribute('aria-describedby');
        expect(id, 'the highlighted option names its group').toBeTruthy();
        return page.locator(`[id="${id}"]`);
    };

    test('headings window with the options, and each highlight names its line', async ({ page }) => {
        const parts = demo(page);
        const trigger = parts('trigger');
        await trigger.focus();
        await trigger.press('ArrowDown');
        await expect(parts('popup')).toHaveAttribute('data-state', 'open');
        await expectHighlightShown(page, trigger, parts('popup'), 'Station 1', 1);
        await expect(await describedBy(page, trigger)).toHaveText('Line 1');
        await expect.poll(() => shownIn(parts('group-heading').filter({ hasText: /^Line 1$/ }), parts('popup'))).toBe(true);
        // No group element can be split across a window: none renders.
        await expect(parts('group')).toHaveCount(0);
        await expectWindowed(parts('item'), 10_000);
        await expectViewportFilled(parts('popup'));

        await trigger.press('End');
        await expectHighlightShown(page, trigger, parts('popup'), 'Zulu', 10_000);
        await expect(await describedBy(page, trigger)).toHaveText('Line 40');
        await expectViewportFilled(parts('popup'));

        // Paged across a line boundary: 250 is the last of Line 1, 251 the
        // first of Line 2 — the headings between are rows the pages pass over.
        await trigger.press('Home');
        const position = async (): Promise<number> => Number(await (await active(page, trigger)).getAttribute('aria-posinset'));
        let paged = await position();
        for (let pages = 0; paged <= 250 && pages < 100; pages += 1) {
            await trigger.press('PageDown');
            paged = await position();
        }
        expect(paged).toBeGreaterThan(250);
        expect(paged).toBeLessThanOrEqual(500);
        await expectHighlightShown(page, trigger, parts('popup'), `Station ${paged}`, paged);
        await expect(await describedBy(page, trigger)).toHaveText('Line 2');
        await expectViewportFilled(parts('popup'));
    });
});

test.describe('Combobox virtual', () => {
    test.beforeEach(async ({ page }) => { await boot(page, 'combobox'); });
    const demo = (page: Page) => demoPosting(page, 'combobox', 'station-search');

    test('filters the window, and the keyboard reaches its far end', async ({ page }) => {
        const parts = demo(page);
        const input = parts('input');
        await input.click();
        await input.press('ArrowDown');
        await expect(parts('popup')).toHaveAttribute('data-state', 'open');
        await expectWindowed(parts('item'), 10_000);

        await input.pressSequentially('Station 99');
        // Station 99, 990–999 and 9900–9999.
        await expect(parts('item').first()).toHaveAttribute('aria-setsize', '111');
        await expectViewportFilled(parts('popup'));

        // Closed, ArrowUp opens on the last visible option.
        await input.press('Escape');
        await expect(parts('popup')).toHaveAttribute('data-state', 'closed');
        await input.press('ArrowUp');
        await expectHighlightShown(page, input, parts('popup'), 'Station 9999', 111);
        await input.press('PageUp');
        const paged = Number(await (await active(page, input)).getAttribute('aria-posinset'));
        expect(paged).toBeLessThan(110);
        await expectHighlightShown(page, input, parts('popup'), /^Station 99\d+$/, paged);
        await input.press('Enter');
        await expect(parts('popup')).toHaveAttribute('data-state', 'closed');
        const chosen = await input.inputValue();
        expect(chosen).toMatch(/^Station 99\d+$/);
        await expect(parts('hidden-input')).toHaveValue(`s${chosen.slice('Station '.length)}`);
    });

    test('ArrowUp from closed opens on the 10,000th option', async ({ page }) => {
        const parts = demo(page);
        const input = parts('input');
        await input.click();
        await input.press('ArrowUp');
        await expectHighlightShown(page, input, parts('popup'), 'Zulu', 10_000);
        await expectViewportFilled(parts('popup'));
        await input.press('Enter');
        await expect(input).toHaveValue('Zulu');
        await expect(parts('hidden-input')).toHaveValue('zulu');
    });
});
