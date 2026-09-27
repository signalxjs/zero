/**
 * ChatLog — following the tail under a real layout engine (#299).
 *
 * The unit suite drives the log against a modelled geometry. This spec
 * proves the half that needs one: an appended or growing row really keeps
 * the end in view, a real wheel scroll really lets go (and the jump trigger
 * really shows, floated inside the box), the trigger really returns to the
 * end, a prepend really leaves the row being read where it was — and none
 * of it trips "ResizeObserver loop completed with undelivered
 * notifications", which the pinning runs inside the observer's callback to
 * avoid.
 *
 * The demo is a named root — the `log` called "Conversation" — and rows are
 * named by their own header text.
 */
import { test, expect, type Locator, type Page } from '@playwright/test';
import { bootPage } from './nav';
import { settledBox } from './demo';

const errors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
    const seen: string[] = [];
    errors.set(page, seen);
    page.on('pageerror', (e) => seen.push(e.message));
    page.on('console', (m) => {
        if (m.type() === 'error') seen.push(m.text());
    });
    await bootPage(page, 'chat', 'basic');
});

test.afterEach(({ page }) => {
    expect(errors.get(page), 'no uncaught errors or console errors').toEqual([]);
});

const log = (page: Page): Locator => page.getByRole('log', { name: 'Conversation' });
const jump = (page: Page): Locator => log(page).getByRole('button', { name: 'Jump to latest' });
const button = (page: Page, name: string): Locator => page.getByRole('button', { name, exact: true });
const status = (page: Page): Locator => page.getByText(/ messages · /);

/** Message `#n`'s row, by the header it carries. */
const message = (page: Page, n: number): Locator =>
    log(page).locator('[data-scope="chat"][data-part="root"]').filter({ has: page.getByText(`#${n}`, { exact: true }) });

/** How far the log is from its end, in px. */
const gapToEnd = (viewport: Locator): Promise<number> =>
    viewport.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop);

/** Whether `row` shows inside the log's box — not the page's viewport. */
async function shownIn(row: Locator, viewport: Locator): Promise<boolean> {
    if ((await row.count()) === 0) return false;
    const [r, v] = await Promise.all([row.boundingBox(), viewport.boundingBox()]);
    return !!r && !!v && r.y < v.y + v.height && r.y + r.height > v.y;
}

/** Resolves once the log's scroll position has held still for 150ms (see virtual-list.spec's settleScroll, #134). */
const settleScroll = (viewport: Locator): Promise<void> =>
    viewport.evaluate((el) => new Promise<void>((resolve) => {
        let last = el.scrollTop;
        let since = performance.now();
        const tick = (now: number): void => {
            if (el.scrollTop !== last) {
                last = el.scrollTop;
                since = now;
            } else if (now - since >= 150) {
                return resolve();
            }
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }));

/** Scroll up the way a reader does — wheel input over the log — and wait for it to land. */
async function readerScrollsUp(page: Page, viewport: Locator, px: number): Promise<void> {
    await viewport.scrollIntoViewIfNeeded();
    const box = await settledBox(viewport, 'log');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -px);
    await expect(status(page)).toContainText('paused');
    await settleScroll(viewport);
}

/** The header text of the first row whose top is inside the log. */
async function firstFullyVisible(viewport: Locator): Promise<string> {
    return viewport.evaluate((el) => {
        const top = el.getBoundingClientRect().top;
        for (const row of el.querySelectorAll('[data-scope="chat"][data-part="root"]')) {
            if (row.getBoundingClientRect().top >= top) return row.querySelector('[data-part="header"]')!.textContent!;
        }
        throw new Error('no row starts inside the log');
    });
}

test('boots on its tail, following, with the jump trigger hidden', async ({ page }) => {
    await expect(status(page)).toContainText('following the tail');
    await expect.poll(() => gapToEnd(log(page))).toBeLessThanOrEqual(1);
    await expect.poll(() => shownIn(message(page, 129), log(page))).toBe(true);
    await expect(jump(page)).toBeHidden();
});

test('appended rows and a growing last row keep the tail visible', async ({ page }) => {
    const l = log(page);
    await expect.poll(() => gapToEnd(l)).toBeLessThanOrEqual(1);
    for (let i = 0; i < 3; i++) await button(page, 'Append a message').click();
    await expect(status(page)).toContainText('33 messages');
    await expect.poll(() => shownIn(message(page, 132), log(page))).toBe(true);
    await expect.poll(() => gapToEnd(l)).toBeLessThanOrEqual(1);

    await button(page, 'Stream into the last message').click();
    await button(page, 'Stream into the last message').click();
    await expect.poll(() => gapToEnd(l)).toBeLessThanOrEqual(1);
    await expect(status(page)).toContainText('following the tail');
});

test('a wheel scroll up lets go and shows the jump trigger; appends then leave the reader alone', async ({ page }) => {
    const l = log(page);
    await expect.poll(() => gapToEnd(l)).toBeLessThanOrEqual(1);
    await readerScrollsUp(page, l, 400);
    await expect(jump(page)).toBeVisible();

    // The trigger floats inside the log's box, not after it.
    const [trigger, box] = await Promise.all([settledBox(jump(page), 'jump trigger'), settledBox(l, 'log')]);
    expect(trigger.y).toBeGreaterThanOrEqual(box.y);
    expect(trigger.y + trigger.height).toBeLessThanOrEqual(box.y + box.height + 0.5);

    const reading = await firstFullyVisible(l);
    const readingRow = l.locator('[data-scope="chat"][data-part="root"]').filter({ has: page.getByText(reading, { exact: true }) });
    const before = await settledBox(readingRow, `row ${reading}`);
    await button(page, 'Append a message').click();
    await expect(status(page)).toContainText('31 messages');
    await expect(status(page)).toContainText('paused');
    const after = await settledBox(readingRow, `row ${reading}`);
    expect(Math.abs(after.y - before.y), 'the row being read did not move').toBeLessThan(1);
});

test('the jump trigger resumes following at the end and hands focus to the log', async ({ page }) => {
    const l = log(page);
    await expect.poll(() => gapToEnd(l)).toBeLessThanOrEqual(1);
    await readerScrollsUp(page, l, 400);
    await button(page, 'Append a message').click();
    expect(await shownIn(message(page, 130), log(page))).toBe(false);

    await jump(page).focus();
    await page.keyboard.press('Enter');
    await expect(status(page)).toContainText('following the tail');
    await expect.poll(() => gapToEnd(l)).toBeLessThanOrEqual(1);
    await expect.poll(() => shownIn(message(page, 130), log(page))).toBe(true);
    await expect(jump(page)).toBeHidden();
    await expect(l).toBeFocused();
});

test('loading earlier messages leaves the row being read where it was', async ({ page }) => {
    const l = log(page);
    await expect.poll(() => gapToEnd(l)).toBeLessThanOrEqual(1);
    await readerScrollsUp(page, l, 300);

    const reading = await firstFullyVisible(l);
    const readingRow = l.locator('[data-scope="chat"][data-part="root"]').filter({ has: page.getByText(reading, { exact: true }) });
    const before = await settledBox(readingRow, `row ${reading}`);
    await button(page, 'Load 10 earlier').click();
    await expect(status(page)).toContainText('40 messages');
    await expect.poll(async () => Math.abs((await settledBox(readingRow, `row ${reading}`)).y - before.y)).toBeLessThan(1);
});
