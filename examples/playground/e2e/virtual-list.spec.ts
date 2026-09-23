/**
 * Virtual list — windowing under a real layout engine.
 *
 * The unit suite drives `createVirtualList` against a DOM that has no layout,
 * with the geometry stubbed. This spec proves the half that needs one: rows
 * really measure, the padding really stands in for the rows that are not
 * rendered (so they tile with no gap or overlap), stick-to-bottom really
 * follows the tail and really lets go when the reader scrolls up, and a
 * prepend really leaves the row being read where it was.
 *
 * Both demos are named roots by their accessible names — the transcript is a
 * `log`, the long list a `region` — and rows are named by their own text.
 */
import { test, expect, type Locator, type Page } from '@playwright/test';
import { bootPage } from './nav';
import { settledBox } from './demo';

/**
 * Uncaught errors per page. The one this is here for is WebKit's
 * "ResizeObserver loop completed with undelivered notifications": rows render
 * inside the observer's own callback, and observing them there is exactly how
 * to cause it — a regression the geometry assertions would never see.
 */
const errors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
    const seen: string[] = [];
    errors.set(page, seen);
    page.on('pageerror', (e) => seen.push(e.message));
    page.on('console', (m) => {
        if (m.type() === 'error') seen.push(m.text());
    });
    await bootPage(page, 'virtual-list', 'basic');
});

test.afterEach(({ page }) => {
    expect(errors.get(page), 'no uncaught errors or console errors').toEqual([]);
});

const transcript = (page: Page): Locator => page.getByRole('log', { name: 'Virtualised transcript' });
const longList = (page: Page): Locator => page.getByRole('region', { name: 'Ten thousand rows' });

/** Message `#n`'s row, by the header it carries. */
const message = (page: Page, n: number): Locator =>
    transcript(page).locator('li').filter({ has: page.getByText(`#${n}`, { exact: true }) });

/** Row `label` of the long list ("Row 5,000"), not "Row 5,0001". */
const row = (page: Page, label: string): Locator =>
    longList(page).locator('li').filter({ hasText: new RegExp(`^${label}(?![\\d,])`) });

const button = (page: Page, name: string): Locator => page.getByRole('button', { name, exact: true });

/** How far the viewport is from its end, in px. */
const gapToEnd = (viewport: Locator): Promise<number> =>
    viewport.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop);

const status = (page: Page): Locator => page.getByText(/ in the document · /);

/**
 * Whether `row` shows inside the scroll container `viewport`. Not
 * `toBeInViewport()`: that asks about the PAGE's viewport, and a row can be
 * on screen while scrolled out of its list, or the other way round.
 */
async function shownIn(row: Locator, viewport: Locator): Promise<boolean> {
    if ((await row.count()) === 0) return false;
    const [r, v] = await Promise.all([row.boundingBox(), viewport.boundingBox()]);
    return !!r && !!v && r.y < v.y + v.height && r.y + r.height > v.y;
}

/** Bring the demo on screen and put the pointer over it — wheel input goes where the pointer is. */
async function pointAt(page: Page, viewport: Locator): Promise<void> {
    await viewport.scrollIntoViewIfNeeded();
    const box = await settledBox(viewport, 'viewport');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
}

/**
 * Resolves once the viewport's scroll position has held still for 150ms — a
 * smooth wheel scroll has landed. Wall-clock rather than a frame count on
 * purpose (#134): WebKit applies a wheel scroll off the main thread, so under
 * load `scrollTop` can read unchanged for several frames while the main
 * thread is busy re-rendering and the scroll is still in flight. WebKit fires
 * no `scrollend` to wait on instead.
 */
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

/** Scroll up the way a reader does — wheel input over the viewport — and wait for it to land. */
async function readerScrollsUp(page: Page, viewport: Locator, px: number): Promise<void> {
    await pointAt(page, viewport);
    await page.mouse.wheel(0, -px);
    await expect(status(page)).toContainText('paused');
    await settleScroll(viewport);
}

/** The first row whose top is inside the viewport — the one a reader's eye is on. */
async function firstFullyVisible(viewport: Locator): Promise<string> {
    return viewport.evaluate((el) => {
        const top = el.getBoundingClientRect().top;
        for (const li of el.querySelectorAll('li')) {
            if (li.getBoundingClientRect().top >= top) return li.querySelector('[data-part="header"]')!.textContent!;
        }
        throw new Error('no row starts inside the viewport');
    });
}

/** Consecutive rendered rows: each starts where the previous ended, plus the list's gap. */
async function expectTiled(viewport: Locator, gap: number): Promise<void> {
    const boxes = await viewport.evaluate((el) =>
        [...el.querySelectorAll('li')].map((li) => {
            const r = li.getBoundingClientRect();
            return { top: r.top, bottom: r.bottom };
        }));
    expect(boxes.length).toBeGreaterThan(2);
    for (let i = 1; i < boxes.length; i++) {
        expect(Math.abs(boxes[i]!.top - (boxes[i - 1]!.bottom + gap)), `row ${i} tiles after row ${i - 1}`).toBeLessThan(1);
    }
    // And the rendered rows cover the viewport: no blank band at either edge.
    const vp = await viewport.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom };
    });
    expect(boxes[0]!.top).toBeLessThanOrEqual(vp.top + 1);
    expect(boxes.at(-1)!.bottom).toBeGreaterThanOrEqual(vp.bottom - 1);
}

test('the transcript boots on its tail with only a window of rows in the document', async ({ page }) => {
    const log = transcript(page);
    await expect(status(page)).toContainText('2000 messages');
    await expect(status(page)).toContainText('following the tail');
    await expect.poll(() => gapToEnd(log)).toBeLessThanOrEqual(1);
    await expect.poll(() => shownIn(message(page, 2999), transcript(page))).toBe(true);
    expect(await log.locator('li').count()).toBeLessThan(40);
});

test('appends and streamed text keep the end in view while following', async ({ page }) => {
    const log = transcript(page);
    await expect.poll(() => gapToEnd(log)).toBeLessThanOrEqual(1);

    await button(page, 'Append a message').click();
    await expect.poll(() => shownIn(message(page, 3000), transcript(page))).toBe(true);
    await expect.poll(() => gapToEnd(log)).toBeLessThanOrEqual(1);

    // The last row grows under a following reader: still pinned to the end.
    await button(page, 'Stream into the last message').click();
    await button(page, 'Stream into the last message').click();
    await expect.poll(() => gapToEnd(log)).toBeLessThanOrEqual(1);
    await expect(status(page)).toContainText('following the tail');
});

test('scrolling up lets go of the tail; appends then leave the reader alone; Jump to latest resumes', async ({ page }) => {
    const log = transcript(page);
    await expect.poll(() => gapToEnd(log)).toBeLessThanOrEqual(1);
    await readerScrollsUp(page, log, 600);

    const reading = await firstFullyVisible(log);
    const readingRow = log.locator('li').filter({ has: page.getByText(reading, { exact: true }) });
    const before = await settledBox(readingRow, `row ${reading}`);

    await button(page, 'Append a message').click();
    await button(page, 'Append a message').click();
    await expect(status(page)).toContainText('2002 messages');
    await expect(status(page)).toContainText('paused');
    const after = await settledBox(readingRow, `row ${reading}`);
    expect(Math.abs(after.y - before.y), 'the row being read did not move').toBeLessThan(1);
    expect(await shownIn(message(page, 3001), transcript(page))).toBe(false);

    await button(page, 'Jump to latest').click();
    await expect(status(page)).toContainText('following the tail');
    await expect.poll(() => gapToEnd(log)).toBeLessThanOrEqual(1);
    await expect.poll(() => shownIn(message(page, 3001), transcript(page))).toBe(true);
});

test('scrolling back down to the end resumes following', async ({ page }) => {
    const log = transcript(page);
    await expect.poll(() => gapToEnd(log)).toBeLessThanOrEqual(1);
    await readerScrollsUp(page, log, 400);
    await pointAt(page, log);
    // Reaching the end is its own claim, asserted before the one under test:
    // engines scale a wheel delta differently, and a scroll that came to rest
    // short of the end would otherwise read as "never resumed following".
    await expect(async () => {
        await page.mouse.wheel(0, 5000);
        await settleScroll(log);
        expect(await gapToEnd(log)).toBeLessThanOrEqual(24);
    }).toPass();
    await expect(status(page)).toContainText('following the tail');
});

test('loading earlier messages leaves the row being read where it was', async ({ page }) => {
    const log = transcript(page);
    await expect.poll(() => gapToEnd(log)).toBeLessThanOrEqual(1);
    await readerScrollsUp(page, log, 500);

    const reading = await firstFullyVisible(log);
    const readingRow = log.locator('li').filter({ has: page.getByText(reading, { exact: true }) });
    const before = await settledBox(readingRow, `row ${reading}`);

    await button(page, 'Load 50 earlier').click();
    await expect(status(page)).toContainText('2050 messages');
    // Measurements of the prepended rows land over a frame or two; the anchor
    // holds through every one of them.
    await expect.poll(async () => Math.abs((await settledBox(readingRow, `row ${reading}`)).y - before.y)).toBeLessThan(1);
    await expectTiled(log, 8);
});

test('measured rows tile with no gap or overlap, at the tail and after a jump to the top', async ({ page }) => {
    const log = transcript(page);
    await expect.poll(() => gapToEnd(log)).toBeLessThanOrEqual(1);
    await expectTiled(log, 8);

    const list = longList(page);
    await button(page, 'Scroll to row 5,000').click();
    await expect.poll(() => shownIn(row(page, 'Row 5,000'), longList(page))).toBe(true);
    await expectTiled(list, 0);
});

test('scrollToIndex lands an unmeasured row at the top of the viewport, and back to row 1', async ({ page }) => {
    const list = longList(page);
    await button(page, 'Scroll to row 5,000').click();
    const target = row(page, 'Row 5,000');
    await expect.poll(() => shownIn(target, list)).toBe(true);
    // Rows above it were estimates when the jump was made; their measurements
    // must not push the target off its mark.
    await expect.poll(async () => {
        const [t, v] = await Promise.all([settledBox(target, 'Row 5,000'), settledBox(list, 'long list')]);
        // The viewport's 1px border sits above its content box; a scroll
        // offset lands on whole pixels, the row edges need not.
        return Math.abs(t.y - (v.y + 1));
    }).toBeLessThan(1);
    expect(await list.locator('li').count()).toBeLessThan(40);

    await button(page, 'Back to the top').click();
    await expect.poll(() => shownIn(row(page, 'Row 1'), longList(page))).toBe(true);
    await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBe(0);
});

test('a real scroll through the long list never shows a blank band', async ({ page }) => {
    const list = longList(page);
    await pointAt(page, list);
    for (let i = 0; i < 6; i++) {
        // Engines scale a wheel delta differently; the claim is only that it moved.
        const before = await list.evaluate((el) => el.scrollTop);
        await page.mouse.wheel(0, 900);
        await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBeGreaterThan(before);
        await settleScroll(list);
        await expectTiled(list, 0);
    }
});
