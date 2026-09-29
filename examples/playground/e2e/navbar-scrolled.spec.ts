/**
 * Navbar's `scrolled` flag (#530) under real scrolling: the root carries
 * `data-scrolled` while the content it sits over is scrolled past the top —
 * the document scroller by default, or the container its `scrollContainer`
 * names. The unit suite dispatches synthetic scroll events at a happy-dom
 * `scrollTop`; this drives a real wheel through a real scroller, in every
 * engine, and checks that each bar listens to its own scroller and no other.
 *
 * Then material's use of it, measured in paint: a top app bar with content
 * scrolled under it fills with surface-container (chromium only — forced
 * colours revalue every author background, and the fill is one engine's
 * cascade claim).
 */
import { test, expect, type Page } from '@playwright/test';
import { bootPage } from './nav';
import { rootLabelled } from './demo';

/** The bar over the demo's own scroll box, named by its title. */
const boxBar = (page: Page) => rootLabelled(page, 'navbar', 'Inbox');
/** A bar watching the document — the first demo's, named by its button. */
const pageBar = (page: Page) => rootLabelled(page, 'navbar', 'Sign in');
const scrollBox = (page: Page) => page.locator('[data-demo="navbar-scroll-box"]');

/** A real wheel over the element — the scroll it causes is the engine's own. */
async function wheelOver(page: Page, selector: ReturnType<typeof scrollBox>, dy: number): Promise<void> {
    await selector.scrollIntoViewIfNeeded();
    const box = await selector.boundingBox();
    expect(box, 'the scroll box is not rendered').not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.wheel(0, dy);
}

test.describe('navbar scrolled (#530)', () => {
    test.beforeEach(async ({ page }) => {
        await bootPage(page, 'navbar', 'basic');
    });

    test('a bar over a named container follows that container, not the document', async ({ page }) => {
        const bar = boxBar(page);
        const box = scrollBox(page);
        await box.scrollIntoViewIfNeeded();
        await expect(bar).not.toHaveAttribute('data-scrolled');
        // Bringing the box into view may itself have scrolled the document:
        // the document bar reads the document, and must go on reading it
        // through the box's scroll.
        const documentBar = async () => {
            const scrolled = await page.evaluate(() => document.scrollingElement!.scrollTop > 0);
            if (scrolled) await expect(pageBar(page), 'the document bar reads the document').toHaveAttribute('data-scrolled', '');
            else await expect(pageBar(page), 'the document bar reads the document').not.toHaveAttribute('data-scrolled');
        };
        await documentBar();

        await wheelOver(page, box, 120);
        await expect.poll(() => box.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
        await expect(bar).toHaveAttribute('data-scrolled', '');
        await documentBar();

        await box.evaluate((el) => { el.scrollTop = 0; });
        await expect(bar).not.toHaveAttribute('data-scrolled');
    });

    test('a bar with no container follows the document scroller', async ({ page }) => {
        // Room to scroll whatever the page's own height: a spacer after the
        // demos, so the document can leave the top.
        await page.evaluate(() => {
            const spacer = document.createElement('div');
            spacer.style.blockSize = '200vh';
            document.querySelector('main')!.appendChild(spacer);
        });
        const bar = pageBar(page);
        await expect(bar).not.toHaveAttribute('data-scrolled');

        // Wheel over the page's heading, outside the scroll box.
        await page.mouse.move(640, 20);
        await page.mouse.wheel(0, 300);
        await expect.poll(() => page.evaluate(() => document.scrollingElement!.scrollTop)).toBeGreaterThan(0);
        await expect(bar).toHaveAttribute('data-scrolled', '');
        // The box bar watches its box, which is still at the top.
        await expect(boxBar(page)).not.toHaveAttribute('data-scrolled');

        await page.evaluate(() => window.scrollTo(0, 0));
        await expect(bar).not.toHaveAttribute('data-scrolled');
    });
});

test('material fills a scrolled-under top app bar with surface-container', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'a cascade claim, measured in one engine');
    await bootPage(page, 'navbar', 'material');
    const bar = boxBar(page);
    /** A colour token, resolved to the rgb() string the bar's computed style uses. */
    const resolve = (token: string) => page.evaluate((t) => {
        const probe = document.createElement('div');
        probe.style.background = `var(${t})`;
        document.body.appendChild(probe);
        const value = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return value;
    }, token);
    const surface = await resolve('--color-surface');
    const container = await resolve('--color-surface-container');
    expect(surface, 'surface and surface-container are different tones').not.toBe(container);
    const fill = () => bar.evaluate((el) => getComputedStyle(el).backgroundColor);

    await expect.poll(fill, { message: 'the resting bar is surface' }).toBe(surface);
    await wheelOver(page, scrollBox(page), 120);
    await expect(bar).toHaveAttribute('data-scrolled', '');
    await expect.poll(fill, { message: 'the scrolled-under bar is surface-container' }).toBe(container);
    await scrollBox(page).evaluate((el) => { el.scrollTop = 0; });
    await expect.poll(fill, { message: 'back at the top, the bar is surface again' }).toBe(surface);
});
