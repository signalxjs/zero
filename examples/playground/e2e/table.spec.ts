/**
 * Table's column spec in a real engine, across all six design systems (#55).
 *
 * happy-dom can check that `--table-column-width` and `--table-cell-align`
 * are written; only a browser can show they reach the screen. The width goes
 * through the `zero.structure` rule on the `<col>` part, and the alignment
 * through every skin's cell recipes reading the custom property. A skin that
 * restated `text-align: start` would pass the unit tests and fail here.
 *
 * Chromium-only: layout and cascade facts, engine-independent.
 */
import { test, expect } from '@playwright/test';
import { demoLabelled, rootLabelled, settledBox, DESIGN_SYSTEMS } from './demo';
import { bootPage } from './nav';

for (const ds of DESIGN_SYSTEMS) {
    test(`${ds}: the column spec's widths and alignment reach the screen`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'chromium', 'layout and cascade facts — one engine is enough');
        await bootPage(page, 'table', ds);
        const part = demoLabelled(page, 'table', 'Activity (column spec)');

        // Positional within this one demo's own header row — identity, not
        // accident (see demo.ts). Locators, not `.all()`: those would snapshot
        // whatever had rendered at call time.
        const headers = part('header-cell');
        await expect(headers).toHaveCount(3);
        const [time, what, cost] = [headers.nth(0), headers.nth(1), headers.nth(2)];
        await expect(time).toHaveText('Time');
        await expect(cost).toHaveText('Cost');

        const rem = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
        const timeBox = await settledBox(time, 'the Time header cell');
        const costBox = await settledBox(cost, 'the Cost header cell');
        // Table layout may grow a column past its stated width, never shrink it.
        expect(timeBox.width).toBeGreaterThanOrEqual(8 * rem - 1);
        expect(costBox.width).toBeGreaterThanOrEqual(6 * rem - 1);

        await expect(cost).toHaveCSS('text-align', 'end');
        await expect(what).toHaveCSS('text-align', 'start');
        const cells = part('cell');
        await expect(cells.nth(2)).toHaveCSS('text-align', 'end');
        await expect(cells.nth(1)).toHaveCSS('text-align', 'start');
    });
}

/**
 * The stacked mode (#55): `Table.Root stack="md"`. Below the design system's
 * `md` every row is a card and each value is captioned by its column's label;
 * at or above it, the same markup is an ordinary table. Both directions,
 * because a one-way check passes for a rule that always — or never — applies.
 *
 * 390px is below every skin's `md` (the narrowest is 768px) and 1280px above
 * every one (carbon's, the widest, is 1056px). The label's contrast is
 * measured here, on the card, because the state-matrix audit renders at a
 * desktop width where the label is not painted at all.
 */
const NARROW = { width: 390, height: 900 };
const WIDE = { width: 1280, height: 900 };
const FLOOR = 3;

for (const ds of DESIGN_SYSTEMS) {
    test(`${ds}: rows stack into labelled cards below the breakpoint, and not above it`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'chromium', 'layout and cascade facts — one engine is enough');
        await page.setViewportSize(NARROW);
        await bootPage(page, 'table', ds);
        const root = rootLabelled(page, 'table', 'Deploys (stacked below md)');
        const part = demoLabelled(page, 'table', 'Deploys (stacked below md)');
        const rows = part('body').locator('[data-scope="table"][data-part="row"]');
        await expect(rows).toHaveCount(3);
        const firstCells = rows.nth(0).locator('[data-scope="table"][data-part="cell"]');
        const labels = rows.nth(0).locator('[data-scope="table"][data-part="cell-label"]');

        // ── below `md`: cards ──
        await expect(rows.nth(0)).toHaveCSS('display', 'block');
        await expect(labels).toHaveText(['Service', 'What happened', 'Cost']);
        for (let i = 0; i < 3; i++) await expect(labels.nth(i)).toBeVisible();
        // The cells of one card run top to bottom, and so do the cards.
        const [a, b] = [await settledBox(firstCells.nth(0), 'the first cell'), await settledBox(firstCells.nth(1), 'the second cell')];
        expect(b.y).toBeGreaterThanOrEqual(a.y + a.height - 1);
        const [card0, card1] = [await settledBox(rows.nth(0), 'the first card'), await settledBox(rows.nth(1), 'the second card')];
        expect(card1.y).toBeGreaterThanOrEqual(card0.y + card0.height - 1);
        // Each card spans the table; nothing scrolls sideways.
        const rootBox = await settledBox(root, 'the root');
        expect(card0.width).toBeGreaterThan(rootBox.width * 0.9);
        expect(await root.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
        // The label hangs at the reading start, the value sits beside it.
        const label = await settledBox(labels.nth(1), 'the "What happened" label');
        expect(Math.abs(label.x - a.x)).toBeLessThanOrEqual(1);
        const valueStart = await firstCells.nth(1).evaluate((cell) => {
            const range = document.createRange();
            range.selectNodeContents(cell);
            range.setStartAfter(cell.firstElementChild!);
            return range.getClientRects()[0]!.left;
        });
        expect(valueStart).toBeGreaterThanOrEqual(label.x + label.width - 1);
        // A stacked value reads from the start whatever its column's alignment.
        await expect(firstCells.nth(2)).toHaveCSS('text-align', 'start');
        // The head is read, not seen — in the tree, clipped to nothing.
        const head = part('head');
        await expect(head).toHaveCSS('clip-path', 'inset(50%)');
        expect((await head.boundingBox())!.height).toBeLessThanOrEqual(1);
        await expect(root.getByRole('columnheader', { name: 'What happened' })).toHaveCount(1);
        // The column spec's widths are gone with the columns.
        await expect(part('colgroup')).toHaveCSS('display', 'none');
        await expect(part('column').nth(0)).toHaveCSS('width', 'auto');

        // The label is legible on the card the skin drew.
        const ratio = await labels.nth(0).evaluate((el) => {
            const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
            const paint = (colors: string[]): number[] => {
                ctx.clearRect(0, 0, 1, 1);
                for (const c of colors) { ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1); }
                return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
            };
            let bg = 'white';
            for (let n: Element | null = el; n; n = n.parentElement) {
                const c = getComputedStyle(n).backgroundColor;
                if (c && !/^rgba\(.*,\s*0\)$|^transparent$/.test(c)) { bg = c; break; }
            }
            const lum = ([r, g, b]: number[]) => {
                const f = (v: number) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
                return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
            };
            const [ink, back] = [lum(paint(['white', bg, getComputedStyle(el).color])), lum(paint(['white', bg]))];
            return (Math.max(ink, back) + 0.05) / (Math.min(ink, back) + 0.05);
        });
        expect(ratio, 'the cell label against its card').toBeGreaterThanOrEqual(FLOOR);

        // Right-to-left, the label hangs at the other edge.
        await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
        const rtlLabel = await settledBox(labels.nth(1), 'the RTL label');
        const rtlCell = await settledBox(firstCells.nth(1), 'the RTL cell');
        expect(Math.abs(rtlLabel.x + rtlLabel.width - (rtlCell.x + rtlCell.width))).toBeLessThanOrEqual(1);
        await page.evaluate(() => document.documentElement.removeAttribute('dir'));

        // ── at or above `md`: a table ──
        await page.setViewportSize(WIDE);
        await expect(rows.nth(0)).toHaveCSS('display', 'table-row');
        for (let i = 0; i < 3; i++) await expect(labels.nth(i)).toBeHidden();
        const [c0, c1] = [await settledBox(firstCells.nth(0), 'the first cell'), await settledBox(firstCells.nth(1), 'the second cell')];
        expect(Math.abs(c1.y - c0.y)).toBeLessThanOrEqual(1);
        expect(c1.x).toBeGreaterThan(c0.x);
        const headers = part('header-cell');
        await expect(headers).toHaveText(['Service', 'What happened', 'Cost']);
        expect((await settledBox(headers.nth(1), 'a header cell')).height).toBeGreaterThan(1);
        await expect(firstCells.nth(2)).toHaveCSS('text-align', 'end');
        const rem = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
        expect((await settledBox(headers.nth(0), 'the Service header')).width).toBeGreaterThanOrEqual(10 * rem - 1);
    });
}

/**
 * The scroll root is keyboard-reachable (#270): a table wider than its
 * container is otherwise scrollable by pointer only (axe
 * scrollable-region-focusable). Tab lands on the root — a region named by
 * its caption — it shows the skin's ring INSIDE its own box (the root is as
 * wide as its column, so an outward ring would be clipped by whatever
 * scrolls around it), and the arrow keys scroll it.
 */
for (const ds of DESIGN_SYSTEMS) {
    test(`${ds}: the table's scroll box is a named keyboard stop with an inset ring`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'chromium', 'focus and cascade facts — one engine is enough');
        await bootPage(page, 'table', ds);
        const root = rootLabelled(page, 'table', 'Regions (hover, constrained width)');
        await expect(root).toHaveCount(1);
        await expect(root).toHaveAttribute('role', 'region');
        await expect(root).toHaveAccessibleName('Regions (hover, constrained width)');
        // The demo's column is a comfortable 24rem, which some skins' compact
        // cells fit — narrow it so every skin genuinely overflows.
        const fit = await root.evaluate((el) => {
            el.parentElement!.style.maxWidth = '12rem';
            return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
        });
        expect(fit.scrollWidth, `${ds}: the demo overflows (else scrolling proves nothing)`).toBeGreaterThan(fit.clientWidth);

        // Reached by keyboard: Tab from a probe button placed just before it.
        await root.evaluate((el) => {
            const before = document.createElement('button');
            before.textContent = 'before';
            before.setAttribute('data-e2e-probe', '');
            el.parentElement!.before(before);
        });
        await page.locator('[data-e2e-probe]').focus();
        await page.keyboard.press('Tab');
        await expect(root).toBeFocused();
        await expect(root).toHaveAttribute('data-focus-visible', '');

        const ring = await root.evaluate((el) => {
            const cs = getComputedStyle(el);
            return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth), offset: parseFloat(cs.outlineOffset) };
        });
        expect(ring.style, `${ds}: a ring is painted`).not.toBe('none');
        expect(ring.width, `${ds}: a ring is painted`).toBeGreaterThan(0);
        expect(ring.width + ring.offset, `${ds}: the ring stays inside the root's box`).toBeLessThanOrEqual(0);

        await page.keyboard.press('ArrowRight');
        await expect.poll(() => root.evaluate((el) => el.scrollLeft), { message: `${ds}: ArrowRight scrolls` })
            .toBeGreaterThan(0);
    });
}
