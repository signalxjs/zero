/**
 * A Stats row too wide for its column scrolls inside its own root (#43).
 *
 * A stat's value is a figure: it never wraps and never shrinks, so a row of
 * them has a floor, and brutalist's shout-scale `--text-3xl` put that floor
 * past the content column at an ordinary 1100px desktop — `99.98%` painted
 * outside its bordered item and the document scrolled sideways. The answer
 * is daisyUI's own `.stats` behaviour (and Table's and Pagination's): the
 * root is the row's scroll box. Claims, each geometric, because only a real
 * layout can make them:
 *
 * 1. the document does not scroll sideways (at desktop width — see below);
 * 2. the root stays inside the column it sits in — and, at the case that
 *    found it, genuinely overflows: a row that fits proves nothing about
 *    scrolling;
 * 3. every value stays inside its own item, and items do not overlap — the
 *    overflow lands in the scroll box, not in the neighbouring stat;
 * 4. scrolled to its end, the last value is inside the scrollport.
 *
 * Run at the case that found it (brutalist, 1100px) and at phone width in
 * every design system. Chromium only: a claim about our own cascade, not
 * about engine behaviour.
 */
import { test, expect, type Locator } from '@playwright/test';
import { bootPage } from './nav';
import { partsOf, rootLabelled, settledBox, DESIGN_SYSTEMS } from './demo';

/** The narrowest viewport a page is expected to work at (README: ~400px). */
const PHONE = { width: 400, height: 720 };

/** Sub-pixel slack: `boundingBox()` is fractional; the defect was ~220px. */
const SLACK = 0.5;

const CASES: readonly { ds: string; viewport: { width: number; height: number } }[] = [
    { ds: 'brutalist', viewport: { width: 1100, height: 800 } },
    ...DESIGN_SYSTEMS.map((ds) => ({ ds, viewport: PHONE })),
];

/** The root's scrollport (its padding box) in viewport coordinates. */
const scrollport = (root: Locator) => root.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left + el.clientLeft, right: r.left + el.clientLeft + el.clientWidth };
});

for (const { ds, viewport } of CASES) {
    test(`${ds}: a stats row stays inside its column and scrolls in its root at ${viewport.width}px`, async ({ page }, testInfo) => {
        test.skip(
            testInfo.project.name !== 'chromium',
            'claims about our own cascade, not about engine behaviour — one engine is the coverage',
        );
        await page.setViewportSize(viewport);
        await bootPage(page, 'stats', ds);
        // The horizontal demo — the only one with an Uptime stat.
        const root = rootLabelled(page, 'stats', 'Uptime');
        await expect(root).toHaveCount(1);
        await expect(root).toHaveAttribute('data-orientation', 'horizontal');
        const part = partsOf(root, 'stats');
        await settledBox(root, `${ds}: the stats root`);

        // 1. The page itself never scrolls sideways. Desktop only for now: at
        //    phone width the playground's own shell still overflows by 40px on
        //    every page (#219), which the narrow-viewport sweep (#45) fixes
        //    and then holds; claim 2 is what holds stats there meanwhile.
        if (viewport !== PHONE) {
            const doc = await page.evaluate(() => ({
                scrollWidth: document.documentElement.scrollWidth,
                clientWidth: document.documentElement.clientWidth,
            }));
            expect(doc.scrollWidth, `${ds}: the document's scroll width`).toBeLessThanOrEqual(doc.clientWidth);
        }

        // 2. Contained, and genuinely overflowing.
        const fit = await root.evaluate((el) => {
            const parent = el.parentElement!;
            const pr = parent.getBoundingClientRect();
            const ps = getComputedStyle(parent);
            const r = el.getBoundingClientRect();
            return {
                left: r.left,
                right: r.right,
                columnLeft: pr.left + parseFloat(ps.borderLeftWidth) + parseFloat(ps.paddingLeft),
                columnRight: pr.right - parseFloat(ps.borderRightWidth) - parseFloat(ps.paddingRight),
                scrollWidth: el.scrollWidth,
                clientWidth: el.clientWidth,
            };
        });
        // The reproducer must overflow, or it proves nothing about scrolling;
        // at phone width a skin whose row still fits (daisyUI's does) is held
        // to the containment and reachability claims all the same.
        if (viewport !== PHONE) {
            expect(fit.scrollWidth, `${ds}: the row overflows at ${viewport.width}px (else this proves nothing)`)
                .toBeGreaterThan(fit.clientWidth);
        }
        expect(fit.left, `${ds}: the root's left edge against its column`)
            .toBeGreaterThanOrEqual(fit.columnLeft - SLACK);
        expect(fit.right, `${ds}: the root's right edge against its column`)
            .toBeLessThanOrEqual(fit.columnRight + SLACK);

        // 3. Each value inside its own item; items side by side, never overlapping.
        const items = part('item');
        const count = await items.count();
        expect(count, `${ds}: the demo's three stats`).toBe(3);
        let previousRight = -Infinity;
        for (let i = 0; i < count; i++) {
            const item = items.nth(i);
            const itemBox = await settledBox(item, `${ds}: stat ${i}`);
            const valueBox = await settledBox(partsOf(item, 'stats')('value'), `${ds}: stat ${i}'s value`);
            expect(valueBox.x, `${ds}: stat ${i}'s value starts inside its item`)
                .toBeGreaterThanOrEqual(itemBox.x - SLACK);
            expect(valueBox.x + valueBox.width, `${ds}: stat ${i}'s value ends inside its item`)
                .toBeLessThanOrEqual(itemBox.x + itemBox.width + SLACK);
            expect(itemBox.x, `${ds}: stat ${i} starts after the previous one ends`)
                .toBeGreaterThanOrEqual(previousRight - SLACK);
            previousRight = itemBox.x + itemBox.width;
        }

        // 4. Every figure reachable: scrolled to the end, the last value is in view.
        await root.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
        const lastValue = partsOf(items.nth(count - 1), 'stats')('value');
        const lastBox = await settledBox(lastValue, `${ds}: the last value`);
        const port = await scrollport(root);
        expect(lastBox.x, `${ds}: the scrolled-to-end last value's start`)
            .toBeGreaterThanOrEqual(port.left - SLACK);
        expect(lastBox.x + lastBox.width, `${ds}: the scrolled-to-end last value's end`)
            .toBeLessThanOrEqual(port.right + SLACK);
    });
}
