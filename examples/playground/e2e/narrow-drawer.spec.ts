/**
 * The block-edge drawer sheets at phone width, in every design system (#291).
 *
 * `narrow-dialog`'s shape for the other top-layer surface whose box a recipe
 * sizes from scratch: a bottom (and top) sheet fills the inline size, so the
 * failure this catches is the one #101 found on the dialog — a `<dialog>`
 * left `content-box`, whose `inline-size: 100%` plus padding and border
 * renders wider than the viewport — and, on the block axis, a recipe-owned
 * height that outgrows the glass. The unit suite has no layout and the CSS
 * goldens only prove a declaration is there.
 *
 * Runs in the `narrow` project only (Chromium), one page load per design
 * system. Geometric on purpose: the sheet's border box must sit inside the
 * viewport on both axes, and rest on the block edge it names.
 */
import { test, expect } from '@playwright/test';
import { bootPage } from './nav';
import { controlledPopup, settledBox, DESIGN_SYSTEMS } from './demo';

/** The narrowest viewport a page is expected to work at (README: ~400px). */
const PHONE = { width: 400, height: 720 };

for (const ds of DESIGN_SYSTEMS) {
    test(`${ds}: the top and bottom drawer sheets stay inside a ${PHONE.width}px viewport`, async ({ page }) => {
        await page.setViewportSize(PHONE);
        await bootPage(page, 'drawer', ds);
        for (const [placement, label, close] of [
            ['bottom', 'Open bottom sheet', 'Close bottom sheet'],
            ['top', 'Open top sheet', 'Close top sheet'],
        ] as const) {
            const trigger = page.getByRole('button', { name: label, exact: true });
            await trigger.click();
            const panel = await controlledPopup(page, trigger, `the ${placement} sheet trigger`);
            await expect(panel).toHaveAttribute('data-state', 'open');
            const box = await settledBox(panel, `${ds}: the open ${placement} sheet`);
            const vw = await page.evaluate(() => document.documentElement.clientWidth);
            // Half a pixel of slack, as narrow-dialog: `boundingBox()` is
            // fractional; the defects this catches are whole paddings.
            const slack = 0.5;
            expect(box.x, `${ds}: the ${placement} sheet's left edge`).toBeGreaterThanOrEqual(-slack);
            expect(box.x + box.width, `${ds}: the ${placement} sheet's right edge`).toBeLessThanOrEqual(vw + slack);
            expect(box.y, `${ds}: the ${placement} sheet's top edge`).toBeGreaterThanOrEqual(-slack);
            expect(box.y + box.height, `${ds}: the ${placement} sheet's bottom edge`).toBeLessThanOrEqual(PHONE.height + slack);
            // Full width by default, and resting on its own block edge.
            expect(box.width, `${ds}: the ${placement} sheet spans the viewport`).toBeGreaterThanOrEqual(vw - 1);
            if (placement === 'bottom') {
                expect(box.y + box.height, `${ds}: the bottom sheet rests on the block end`).toBeGreaterThanOrEqual(PHONE.height - 1);
            } else {
                expect(box.y, `${ds}: the top sheet rests on the block start`).toBeLessThanOrEqual(1);
            }
            await panel.getByRole('button', { name: close, exact: true }).click();
            await expect(panel).toHaveAttribute('data-state', 'closed');
            await expect(panel).not.toBeVisible();
        }
    });
}
