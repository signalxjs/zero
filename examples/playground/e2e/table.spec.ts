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
import { demoLabelled, settledBox } from './demo';
import { bootPage } from './nav';

const DESIGN_SYSTEMS = ['basic', 'daisyui', 'material', 'brutalist', 'heroui', 'carbon'] as const;

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
