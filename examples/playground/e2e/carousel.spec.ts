/**
 * Carousel — the scroll-snap contract under a real scroll engine.
 *
 * The unit suite proves the button/dot/model wiring against a DOM that
 * cannot scroll; this spec proves the half that needs a layout engine: the
 * viewport really snaps, a nav press really moves the scroll position, and
 * a REAL scroll drives the model back through the IntersectionObserver —
 * the direction no simulated DOM can exercise.
 */
import { test, expect, type Page } from '@playwright/test';
import { bootPage } from './nav';
import { demoLabelled } from './demo';

test.beforeEach(async ({ page }) => {
    await bootPage(page, 'carousel', 'basic');
});

/** The "Featured places" carousel — the page renders a second, smaller one. */
const demo = (page: Page) => demoLabelled(page, 'carousel', 'First slide');

const scrollLeft = (page: Page) =>
    demo(page)('viewport').evaluate((el) => Math.round(el.scrollLeft));

test('the viewport is a scroll-snap container and the items are snap stops', async ({ page }) => {
    const viewport = demo(page)('viewport');
    const snapType = await viewport.evaluate((el) => getComputedStyle(el).scrollSnapType);
    expect(snapType).toContain('x');
    const align = await demo(page)('item').first().evaluate((el) => getComputedStyle(el).scrollSnapAlign);
    expect(align).toContain('center');
});

test('next scrolls to the next slide and the model follows; prev clamps at 0', async ({ page }) => {
    const items = demo(page)('item');
    const prev = demo(page)('prev-trigger');
    const next = demo(page)('next-trigger');

    // At rest: slide 1 active, nowhere for prev to go.
    await expect(items.nth(0)).toHaveAttribute('data-state', 'active');
    await expect(prev).toHaveAttribute('aria-disabled', 'true');
    expect(await scrollLeft(page)).toBe(0);

    await next.click();
    await expect(items.nth(1)).toHaveAttribute('data-state', 'active');
    // The press moved real scroll, not just the attribute — poll it past the
    // smooth animation.
    await expect.poll(() => scrollLeft(page)).toBeGreaterThan(0);
    await expect(prev).not.toHaveAttribute('aria-disabled');

    await next.click();
    await expect(items.nth(2)).toHaveAttribute('data-state', 'active');
    await expect(next).toHaveAttribute('aria-disabled', 'true');
});

test('the press that reaches the last slide keeps keyboard focus on next (#270)', async ({ page }) => {
    const items = demo(page)('item');
    const next = demo(page)('next-trigger');
    await next.focus();
    await page.keyboard.press('Enter');
    await expect(items.nth(1)).toHaveAttribute('data-state', 'active');
    await page.keyboard.press('Enter');
    await expect(items.nth(2)).toHaveAttribute('data-state', 'active');
    // aria-disabled at the bound, never natively disabled — a native
    // `disabled` would have dropped focus to <body> right here.
    await expect(next).toHaveAttribute('aria-disabled', 'true');
    await expect(next).toBeFocused();
    // A further press is a no-op.
    await page.keyboard.press('Enter');
    await expect(items.nth(2)).toHaveAttribute('data-state', 'active');
    await expect(next).toBeFocused();
});

test('a dot jumps straight to its slide and takes aria-current with it', async ({ page }) => {
    const dots = demo(page)('indicator');
    await expect(dots).toHaveCount(3);
    await expect(dots.nth(0)).toHaveAttribute('aria-current', 'true');

    await dots.nth(2).click();
    await expect(demo(page)('item').nth(2)).toHaveAttribute('data-state', 'active');
    await expect(dots.nth(2)).toHaveAttribute('data-state', 'active');
    await expect(dots.nth(2)).toHaveAttribute('aria-current', 'true');
    await expect(dots.nth(0)).toHaveAttribute('data-state', 'inactive');
    await expect.poll(() => scrollLeft(page)).toBeGreaterThan(0);
});

test('a REAL scroll drives the model: the observer updates the dots', async ({ page }) => {
    const viewport = demo(page)('viewport');
    const dots = demo(page)('indicator');
    await expect(dots.nth(0)).toHaveAttribute('data-state', 'active');

    // Scroll the viewport itself — no button involved. 'instant' so the
    // settle is immediate and the only asynchrony left is the observer's.
    await viewport.evaluate((el) => {
        el.scrollTo({ left: el.clientWidth, behavior: 'instant' as ScrollBehavior });
    });
    await expect(dots.nth(1)).toHaveAttribute('data-state', 'active');
    await expect(demo(page)('item').nth(1)).toHaveAttribute('data-state', 'active');
});

/**
 * #171 — a model write scrolls the VIEWPORT, never the page. The old
 * `scrollIntoView` scrolled every scrollable ancestor, so a carousel below
 * the fold that started mid-way pulled the document down to it on load, and
 * an external model write scrolled the page to it again.
 */
test.describe('the page never scrolls for a carousel (#171)', () => {
    // Short enough that the "Tour" demo — the page's third carousel — sits
    // below the fold; the guard in each test proves it does.
    test.use({ viewport: { width: 1024, height: 320 } });

    /** The bound-model "Tour" carousel, which starts on stop 2. */
    const tour = (page: Page) => demoLabelled(page, 'carousel', 'Tour stop 1');

    /**
     * Every scroll offset on the page outside the carousels' own viewports:
     * the document's and any scrolling ancestor's (the playground's layout
     * may scroll a region rather than the document).
     */
    const pageScroll = (page: Page) => page.evaluate(() => {
        const moved = [document.scrollingElement, ...document.querySelectorAll('body *')]
            .filter((el): el is Element => el !== null)
            .filter((el) => !el.matches('[data-scope="carousel"][data-part="viewport"]'))
            .filter((el) => el.scrollTop !== 0 || el.scrollLeft !== 0)
            .map((el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}: ${el.scrollTop},${el.scrollLeft}`);
        return moved;
    });

    /** Distance between an item's centre and its viewport's centre, in px. */
    const offCentre = (page: Page, i: number) =>
        tour(page)('viewport').evaluate((vp, idx) => {
            const item = vp.querySelectorAll('[data-scope="carousel"][data-part="item"]')[idx]!;
            const a = vp.getBoundingClientRect();
            const b = item.getBoundingClientRect();
            return Math.round(Math.abs((b.left + b.width / 2) - (a.left + a.width / 2)));
        }, i);

    /** Press an outside button WITHOUT Playwright scrolling it into view first. */
    const pressOutside = (page: Page, name: string) =>
        page.getByRole('button', { name, exact: true }).evaluate((b) => (b as HTMLButtonElement).click());

    test.beforeEach(async ({ page }) => {
        // First: a page scrolled on mount (the #171 regression itself) pulls
        // the carousel above the fold, which the layout guard below would
        // otherwise misreport as a fixture problem.
        expect(await pageScroll(page), 'the page scrolled on mount (#171)').toEqual([]);
        const top = await tour(page)('viewport').evaluate((el) => el.getBoundingClientRect().top);
        expect(top, 'the Tour carousel must start below the fold').toBeGreaterThan(320);
    });

    test('on mount: it opens on its slide, and the page stays at the top', async ({ page }) => {
        await expect(tour(page)('item').nth(1)).toHaveAttribute('data-state', 'active');
        await expect.poll(() => offCentre(page, 1)).toBeLessThanOrEqual(1);
        expect(await pageScroll(page)).toEqual([]);
    });

    test('on an external model write: only the viewport scrolls', async ({ page }) => {
        await pressOutside(page, 'Tour: last stop');
        await expect(tour(page)('item').nth(2)).toHaveAttribute('data-state', 'active');
        await expect.poll(() => offCentre(page, 2)).toBeLessThanOrEqual(1);
        expect(await pageScroll(page)).toEqual([]);
    });

    test('RTL: the viewport lands on the slide, scrolling negative', async ({ page }) => {
        // After boot — an init script runs before documentElement exists.
        await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
        await pressOutside(page, 'Tour: first stop');
        await expect.poll(() => offCentre(page, 0)).toBeLessThanOrEqual(1);
        await pressOutside(page, 'Tour: last stop');
        await expect.poll(() => offCentre(page, 2)).toBeLessThanOrEqual(1);
        expect(await tour(page)('viewport').evaluate((el) => el.scrollLeft)).toBeLessThan(0);
        await expect(tour(page)('item').nth(2)).toHaveAttribute('data-state', 'active');
        expect(await pageScroll(page)).toEqual([]);
    });
});
