/**
 * The overlay popups mirror their trigger's axes (#514), measured in a real
 * engine: the runtime copies the trigger's `data-variant` onto the top-layer
 * popup, and the design system's variant rule — anchored on the popup, since
 * no selector rooted on the trigger can reach a top-layer sibling — changes
 * the SURFACE.
 *
 * Every design system: each tooltip and dialog the page renders per wired
 * variant opens with the trigger's value on its popup (a skin wiring none
 * renders none, so the loop is empty there, not skipped). Material — the
 * skin that wires them — in boxes and paint: a `rich` tooltip is a
 * different surface from a `plain` one, and a `full-screen` dialog fills a
 * desktop viewport a `basic` one does not, at the SAME width, which is the
 * whole point of choosing it per use rather than per breakpoint.
 *
 * Chromium only: the cascade and the dialog's box are not where engines
 * differ, and the claim is about the stylesheet.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { bootPage } from './nav';
import { DESIGN_SYSTEMS, controlledPopup, settledBox } from './demo';

const tooltipTriggers = (page: Page): Locator =>
    page.locator('[data-demo="tooltip-variants"] [data-scope="tooltip"][data-part="trigger"]');

/** A tooltip's popup: the trigger names it through `aria-describedby` while open. */
async function openTooltip(page: Page, trigger: Locator): Promise<Locator> {
    await trigger.hover();
    const popup = page.locator('[data-scope="tooltip"][data-part="popup"][data-state="open"]');
    await expect(popup).toHaveCount(1);
    return popup;
}

test.describe('an overlay popup takes its trigger\'s variant (#514)', () => {
    test.beforeEach(({}, testInfo) => {
        test.skip(testInfo.project.name !== 'chromium', 'cascade resolution is not engine-specific — one engine is enough');
    });

    for (const ds of DESIGN_SYSTEMS) {
        test(`${ds}: every tooltip and dialog variant the page renders reaches the popup`, async ({ page }) => {
            await bootPage(page, 'tooltip', ds);
            const tips = tooltipTriggers(page);
            for (let i = 0; i < await tips.count(); i++) {
                const trigger = tips.nth(i);
                const variant = await trigger.getAttribute('data-variant');
                expect(variant, 'the demo passes a variant on every trigger').toBeTruthy();
                const popup = await openTooltip(page, trigger);
                await expect(popup).toHaveAttribute('data-variant', variant!);
                await page.mouse.move(0, 0);
                await expect(popup).toHaveCount(0);
            }

            await bootPage(page, 'dialog', ds);
            const dialogs = page.locator('[data-demo="dialog-variants"] [data-scope="dialog"][data-part="trigger"]');
            for (let i = 0; i < await dialogs.count(); i++) {
                const trigger = dialogs.nth(i);
                const variant = await trigger.getAttribute('data-variant');
                const popup = await controlledPopup(page, trigger, `dialog trigger ${variant}`);
                await expect(popup).toHaveAttribute('data-variant', variant!);
                await trigger.click();
                await expect(popup).toHaveAttribute('data-state', 'open');
                await page.keyboard.press('Escape');
                await expect(popup).toHaveAttribute('data-state', 'closed');
            }
        });
    }

    test('material: a rich tooltip is M3\'s rich surface, not the plain one', async ({ page }) => {
        await bootPage(page, 'tooltip', 'material');
        const surface = async (variant: string) => {
            const trigger = tooltipTriggers(page).and(page.locator(`[data-variant="${variant}"]`));
            const popup = await openTooltip(page, trigger);
            await settledBox(popup, `${variant} tooltip`);
            const paint = await popup.evaluate((el) => {
                const cs = getComputedStyle(el);
                return { background: cs.backgroundColor, radius: cs.borderTopLeftRadius, shadow: cs.boxShadow };
            });
            await page.mouse.move(0, 0);
            await expect(popup).toHaveCount(0);
            return paint;
        };
        const plain = await surface('plain');
        const rich = await surface('rich');
        expect(rich.background, 'rich is surface-container, plain inverse-surface').not.toBe(plain.background);
        expect(rich.radius, 'rich sits on the medium corner, plain on extra-small').not.toBe(plain.radius);
        expect(rich.shadow, 'rich is raised to level 2; plain has no elevation').not.toBe('none');
        expect(plain.shadow).toBe('none');
    });

    test('material: a full-screen dialog fills the viewport where a basic one does not, at the same width', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await bootPage(page, 'dialog', 'material');
        const box = async (variant: string) => {
            const trigger = page.locator(`[data-demo="dialog-variants"] [data-scope="dialog"][data-part="trigger"][data-variant="${variant}"]`);
            const popup = await controlledPopup(page, trigger, `${variant} dialog trigger`);
            await trigger.click();
            const b = await settledBox(popup, `${variant} dialog`);
            await page.keyboard.press('Escape');
            await expect(popup).toHaveAttribute('data-state', 'closed');
            return b;
        };
        const full = await box('full-screen');
        expect(full.x).toBeCloseTo(0, 0);
        expect(full.y).toBeCloseTo(0, 0);
        expect(full.width).toBeCloseTo(1280, 0);
        expect(full.height).toBeCloseTo(800, 0);
        const basic = await box('basic');
        // M3's basic dialog: at most 560dp wide, centred, with room around it.
        expect(basic.width).toBeLessThanOrEqual(560.5);
        expect(basic.height).toBeLessThan(800);
        expect(basic.x + basic.width / 2).toBeCloseTo(640, 0);
    });
});
