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
 * 1. the document does not scroll sideways;
 * 2. the root stays inside the column it sits in, and genuinely overflows —
 *    a row that fits proves nothing about scrolling;
 * 3. every value stays inside its own item, and items do not overlap — the
 *    overflow lands in the scroll box, not in the neighbouring stat;
 * 4. scrolled to its end, the last value is inside the scrollport.
 *
 * All four at the case that found it (brutalist at 1100px, a desktop width
 * the `narrow` project's sweep never visits). At phone width, in every
 * design system, only 3 and 4: that is the project's own viewport, where
 * `narrow-viewport.spec.ts` already walks this page and holds 1 and 2 for
 * every part — repeating them here would be a second spec asserting the
 * same boxes. Runs in the `narrow` project only (Chromium): a claim about
 * our own cascade, not about engine behaviour.
 */
import { test, expect } from '@playwright/test';
import { bootPage } from './nav';
import { partsOf, rootLabelled, scrollport, settledBox, DESIGN_SYSTEMS, type DesignSystemId } from './demo';

/** The reproducer's desktop width. */
const DESKTOP = { width: 1100, height: 800 };

/** Sub-pixel slack: `boundingBox()` is fractional; the defect was ~220px. */
const SLACK = 0.5;

/** `viewport: null` runs at the `narrow` project's own phone viewport. */
const CASES: readonly { ds: DesignSystemId; viewport: typeof DESKTOP | null }[] = [
    { ds: 'brutalist', viewport: DESKTOP },
    ...DESIGN_SYSTEMS.map((ds) => ({ ds, viewport: null })),
];

for (const { ds, viewport } of CASES) {
    const at = viewport ? `${viewport.width}px` : 'phone width';
    test(`${ds}: a stats row keeps its figures whole and reachable in its root at ${at}`, async ({ page }) => {
        if (viewport) await page.setViewportSize(viewport);
        await bootPage(page, 'stats', ds);
        // The horizontal demo — the only one with an Uptime stat.
        const root = rootLabelled(page, 'stats', 'Uptime');
        await expect(root).toHaveCount(1);
        await expect(root).toHaveAttribute('data-orientation', 'horizontal');
        const part = partsOf(root, 'stats');
        await settledBox(root, `${ds}: the stats root`);

        // 1–2 at the desktop reproducer only; at phone width the sweep holds them.
        if (viewport) {
            // 1. The page itself never scrolls sideways.
            const doc = await page.evaluate(() => ({
                scrollWidth: document.documentElement.scrollWidth,
                clientWidth: document.documentElement.clientWidth,
            }));
            expect(doc.scrollWidth, `${ds}: the document's scroll width`).toBeLessThanOrEqual(doc.clientWidth);

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
            expect(fit.scrollWidth, `${ds}: the row overflows at ${at} (else this proves nothing)`)
                .toBeGreaterThan(fit.clientWidth);
            expect(fit.left, `${ds}: the root's left edge against its column`)
                .toBeGreaterThanOrEqual(fit.columnLeft - SLACK);
            expect(fit.right, `${ds}: the root's right edge against its column`)
                .toBeLessThanOrEqual(fit.columnRight + SLACK);
        }

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
