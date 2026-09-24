/**
 * Pagination at phone width, in every design system (#44).
 *
 * The row is windowed at constant width by design, so its width follows
 * `count` and the windowing props, never the container — and at 420px the
 * "wider window" demo ran past the content column in all six skins, with
 * its trailing pages clipped rather than reachable. The answer is Table's:
 * the root is the row's scroll box. Three claims, each geometric, because
 * only a real layout can make them:
 *
 * 1. the root stays inside the column it sits in (and genuinely overflows —
 *    a row that fits proves nothing about scrolling);
 * 2. scrolled to its end, the last control is inside the scrollport, so
 *    every page is reachable;
 * 3. a keyboard-focused control at either end keeps its whole focus ring
 *    inside the scrollport — a scroll box clips at its padding box, so a
 *    recipe that scrolls without leaving room for the ring (padding, plus
 *    scroll padding for when focus scrolls it into view) cuts it in half.
 *
 * Chromium only, one page load per design system: a claim about our own
 * cascade, not about engine behaviour.
 */
import { test, expect, type Locator, type Page } from '@playwright/test';
import { bootPage } from './nav';
import { partsOf, settledBox, DESIGN_SYSTEMS } from './demo';

/** The narrowest viewport a page is expected to work at (README: ~400px). */
const PHONE = { width: 400, height: 720 };

/** Sub-pixel slack: `boundingBox()` is fractional; the defects are 12–96px. */
const SLACK = 0.5;

/** The "wider window" demo — the only one on the page that reaches page 20. */
const widerRow = (page: Page): Locator =>
    page.locator('[data-scope="pagination"][data-part="root"]').filter({
        has: page.getByRole('button', { name: 'Page 20', exact: true }),
    });

/** The root's scrollport (its padding box) in viewport coordinates. */
const scrollport = (root: Locator) => root.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
        left: r.left + el.clientLeft,
        right: r.left + el.clientLeft + el.clientWidth,
        top: r.top + el.clientTop,
        bottom: r.top + el.clientTop + el.clientHeight,
    };
});

/** How far the focused control's outline paints outside its border box. */
const ringExtent = (control: Locator) => control.evaluate((el) => {
    const cs = getComputedStyle(el);
    if (cs.outlineStyle === 'none') return 0;
    return Math.max(0, parseFloat(cs.outlineWidth) + parseFloat(cs.outlineOffset));
});

async function expectRingInside(root: Locator, control: Locator, what: string): Promise<void> {
    await expect(control, `${what}: focused`).toBeFocused();
    await expect(control, `${what}: keyboard focus is visible`).toHaveAttribute('data-focus-visible', '');
    const box = await settledBox(control, what);
    const ring = await ringExtent(control);
    const port = await scrollport(root);
    expect(box.x - ring, `${what}: ring's inline-start edge`).toBeGreaterThanOrEqual(port.left - SLACK);
    expect(box.x + box.width + ring, `${what}: ring's inline-end edge`).toBeLessThanOrEqual(port.right + SLACK);
    expect(box.y - ring, `${what}: ring's block-start edge`).toBeGreaterThanOrEqual(port.top - SLACK);
    expect(box.y + box.height + ring, `${what}: ring's block-end edge`).toBeLessThanOrEqual(port.bottom + SLACK);
}

for (const ds of DESIGN_SYSTEMS) {
    test(`${ds}: a wide pagination row scrolls inside its column at ${PHONE.width}px`, async ({ page }, testInfo) => {
        test.skip(
            testInfo.project.name !== 'chromium',
            'claims about our own cascade, not about engine behaviour — one engine is the coverage',
        );
        await page.setViewportSize(PHONE);
        await bootPage(page, 'pagination', ds);
        const root = widerRow(page);
        await expect(root).toHaveCount(1);
        const part = partsOf(root, 'pagination');

        // 1. Contained, and genuinely overflowing.
        const fit = await root.evaluate((el) => {
            const parent = el.parentElement!;
            const pr = parent.getBoundingClientRect();
            const ps = getComputedStyle(parent);
            return {
                right: el.getBoundingClientRect().right,
                columnRight: pr.right - parseFloat(ps.borderRightWidth) - parseFloat(ps.paddingRight),
                scrollWidth: el.scrollWidth,
                clientWidth: el.clientWidth,
            };
        });
        expect(fit.scrollWidth, `${ds}: the row overflows at ${PHONE.width}px (else this proves nothing)`)
            .toBeGreaterThan(fit.clientWidth);
        expect(fit.right, `${ds}: the root's right edge against its column`)
            .toBeLessThanOrEqual(fit.columnRight + SLACK);

        // 2. Every page reachable: scrolled to the end, the next trigger is in view.
        await root.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
        const next = part('next-trigger');
        const nextBox = await settledBox(next, `${ds}: the next trigger`);
        const port = await scrollport(root);
        expect(nextBox.x + nextBox.width, `${ds}: the scrolled-to-end next trigger`)
            .toBeLessThanOrEqual(port.right + SLACK);

        // 3. The focus ring survives the scroll box at both ends — reached by
        //    keyboard, so the browser's own scroll-into-view places them.
        await root.getByRole('button', { name: 'Page 20', exact: true }).focus();
        await page.keyboard.press('Tab');
        await expectRingInside(root, next, `${ds}: the focused next trigger`);

        await root.getByRole('button', { name: 'Page 1', exact: true }).focus();
        await page.keyboard.press('Shift+Tab');
        await expectRingInside(root, part('prev-trigger'), `${ds}: the focused prev trigger`);
    });
}
