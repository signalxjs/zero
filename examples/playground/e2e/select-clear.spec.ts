/**
 * Select's clear-trigger in real layout, in every design system (#280).
 *
 * The clear-trigger is a SIBLING of the trigger — a button cannot sit inside
 * a button — so each skin lays it over the trigger's inline end and makes
 * room for it before the chevron. Whether it lands there is a layout fact
 * the unit suite (no layout) and the CSS goldens (the declarations, not
 * their sufficiency) cannot see: inside the field, clear of the value text,
 * clear of the chevron, and a 24px target (the axe audit asks that of
 * zero-basic alone). Chromium only: one page load per design system.
 */
import { test, expect } from '@playwright/test';
import { bootPage } from './nav';
import { DESIGN_SYSTEMS, demoPosting, settledBox } from './demo';

for (const ds of DESIGN_SYSTEMS) {
    test(`${ds}: the clear-trigger sits inside the field, between the value and the chevron (#280)`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'chromium', 'layout is measured once, in chromium');
        await bootPage(page, 'select', ds);
        const clearable = demoPosting(page, 'select', 'clearable-fruit');
        const field = await settledBox(clearable('trigger'), 'trigger');
        const clear = await settledBox(clearable('clear-trigger'), 'clear-trigger');
        const value = await settledBox(clearable('value'), 'value');
        const chevron = await settledBox(clearable('indicator'), 'indicator');
        const eps = 0.5;
        expect(clear.x).toBeGreaterThanOrEqual(field.x - eps);
        expect(clear.x + clear.width).toBeLessThanOrEqual(field.x + field.width + eps);
        expect(clear.y).toBeGreaterThanOrEqual(field.y - eps);
        expect(clear.y + clear.height).toBeLessThanOrEqual(field.y + field.height + eps);
        // WCAG 2.5.8: a 24px target — it is a real tab stop, not furniture.
        expect(clear.width).toBeGreaterThanOrEqual(24 - eps);
        expect(clear.height).toBeGreaterThanOrEqual(24 - eps);
        // Left to right: value, clear, chevron — no overlap either side.
        expect(value.x + value.width).toBeLessThanOrEqual(clear.x + eps);
        expect(clear.x + clear.width).toBeLessThanOrEqual(chevron.x + eps);
    });
}
