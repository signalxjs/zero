/**
 * The dialog popup at phone width, in every design system (#101).
 *
 * A `<dialog>` keeps the UA's `content-box`, and zero ships no reset. A
 * recipe that writes `width: calc(100% - 2rem)` (or `100%`, or a
 * `max-width` meant to leave a gutter) plus padding on such a box therefore
 * renders WIDER than it says — by the padding and border — and at 400px the
 * popup ran past both viewport edges in five of the six skins. Only the box
 * a real engine lays out can show that: the unit suite has no layout, and
 * the CSS goldens only prove the declaration is there, not that it suffices.
 *
 * Chromium only, one page load per design system: this is a claim about
 * our own cascade, not about engine behaviour. The check is geometric on
 * purpose — the popup's border box must sit inside the viewport on both
 * axes — rather than an assertion on `box-sizing`, because that is the fix,
 * not the requirement; a skin is free to reach the same box another way.
 */
import { test, expect, type Page } from '@playwright/test';
import { bootPage } from './nav';
import { controlledPopup, settledBox } from './demo';

const DESIGN_SYSTEMS = ['basic', 'daisyui', 'material', 'brutalist', 'heroui', 'carbon'] as const;

/** The narrowest viewport a page is expected to work at (README: ~400px). */
const PHONE = { width: 400, height: 720 };

const modalTrigger = (page: Page) => page.getByRole('button', { name: 'Open dialog', exact: true });

for (const ds of DESIGN_SYSTEMS) {
    test(`${ds}: the modal dialog's box stays inside a ${PHONE.width}px viewport`, async ({ page }, testInfo) => {
        test.skip(
            testInfo.project.name !== 'chromium',
            'claims about our own cascade, not about engine behaviour — one engine is the coverage',
        );
        await page.setViewportSize(PHONE);
        await bootPage(page, 'dialog', ds);
        const trigger = modalTrigger(page);
        await trigger.click();
        const popup = await controlledPopup(page, trigger, 'the modal dialog trigger');
        await expect(popup).toHaveAttribute('data-state', 'open');
        const box = await settledBox(popup, `${ds}: the open dialog popup`);
        // The border box, as the engine paints it — padding and border
        // included, whatever `box-sizing` the recipe chose.
        expect(box.x, `${ds}: the popup's left edge`).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, `${ds}: the popup's right edge`).toBeLessThanOrEqual(PHONE.width);
        expect(box.y, `${ds}: the popup's top edge`).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height, `${ds}: the popup's bottom edge`).toBeLessThanOrEqual(PHONE.height);
    });
}
