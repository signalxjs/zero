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
    await expect(prev).toBeDisabled();
    expect(await scrollLeft(page)).toBe(0);

    await next.click();
    await expect(items.nth(1)).toHaveAttribute('data-state', 'active');
    // The press moved real scroll, not just the attribute — poll it past the
    // smooth animation.
    await expect.poll(() => scrollLeft(page)).toBeGreaterThan(0);
    await expect(prev).toBeEnabled();

    await next.click();
    await expect(items.nth(2)).toHaveAttribute('data-state', 'active');
    await expect(next).toBeDisabled();
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
