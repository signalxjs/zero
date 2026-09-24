/**
 * Visually hidden labels in real engines (#54).
 *
 * The unit suite pins the attribute; only a real cascade can show that
 * `@layer zero.structure` actually wins — that no design system's label
 * recipe (a `display`, a `margin`, a padded chip) puts the box back — and
 * only a real accessibility tree can show the name survives the clip.
 * Chromium walks all six design systems for the box; the accessible names
 * are skin-independent and are asserted once per engine.
 */
import { test, expect, type Page } from '@playwright/test';
import { DESIGN_SYSTEMS } from './demo';
import { bootPage } from './nav';

const hiddenFieldLabel = (page: Page) =>
    page.locator('[data-scope="field"][data-part="label"][data-visually-hidden]', { hasText: 'Search the docs' });
const hiddenSwitchLabel = (page: Page) =>
    page.locator('[data-demo="row-named"] [data-scope="switch"][data-part="label"]');

test('the hidden labels still name their controls — once', async ({ page }) => {
    await bootPage(page, 'field', 'basic');
    // Field + Switch with the Field as the one name: exactly "Dark mode",
    // not a concatenation with the switch's own (absent) text.
    await expect(page.getByRole('switch', { name: 'Dark mode', exact: true })).toHaveCount(1);
    await expect(page.getByRole('switch', { name: 'Airplane mode', exact: true })).toHaveCount(1);
    await expect(page.getByRole('textbox', { name: 'Search the docs', exact: true })).toHaveCount(1);
});

for (const ds of DESIGN_SYSTEMS) {
    test(`${ds}: the structure layer clips the label whatever the recipe says`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'chromium', 'the cascade claim is engine-independent; chromium walks the six skins');
        await bootPage(page, 'field', ds);
        for (const label of [hiddenFieldLabel(page), hiddenSwitchLabel(page)]) {
            await expect(label).toHaveCount(1);
            const box = await label.evaluate((el) => {
                const r = el.getBoundingClientRect();
                const cs = getComputedStyle(el);
                return { w: r.width, h: r.height, position: cs.position, clipPath: cs.clipPath };
            });
            expect(box.position).toBe('absolute');
            expect(box.clipPath).toBe('inset(50%)');
            expect(box.w).toBeLessThanOrEqual(1);
            expect(box.h).toBeLessThanOrEqual(1);
        }
    });
}
