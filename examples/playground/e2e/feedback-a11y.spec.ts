/**
 * The feedback tier announces what users see (#274) — the claims only a real
 * engine can check.
 *
 * - **Alert close keeps focus.** Hiding the root strands focus that sits in
 *   it; a browser's focus fixup then drops it on <body>. The runtime reads
 *   "focus is inside" as the model flips — before the fixup — and hands it
 *   to `finalFocus()`. happy-dom has no fixup, so only a real engine proves
 *   the ordering. The Close is focused by KEYBOARD path (`focus()` + Enter):
 *   WebKit does not focus a button on click, so a click would start from
 *   <body> and the assertion would prove nothing.
 * - **A loading skeleton is inert.** The placeholder's link refuses focus
 *   while loading and takes it once loaded — the engine's inert, not the
 *   attribute.
 * - **A spinner's words are clipped text.** The label part is visually
 *   hidden by the structure layer in every design system (chromium walks the
 *   six) and is what the live region holds.
 * - **Value text is what is shown.** A progressbar's aria-valuetext equals
 *   its painted ValueText.
 */
import { test, expect } from '@playwright/test';
import { DESIGN_SYSTEMS, demoLabelled, rootLabelled } from './demo';
import { bootPage } from './nav';

test('closing an alert that holds focus hands it to finalFocus', async ({ page }) => {
    await bootPage(page, 'alert', 'basic');
    const quota = demoLabelled(page, 'alert', 'Approaching your quota');
    const close = quota('close');
    await close.focus();
    await expect(close).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(rootLabelled(page, 'alert', 'Approaching your quota')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Bring it back', exact: true })).toBeFocused();
});

test('an alert is named by its title and a polite one is a status', async ({ page }) => {
    await bootPage(page, 'alert', 'basic');
    await expect(page.getByRole('alert', { name: 'Payment failed' })).toHaveCount(1);
    await expect(page.getByRole('status', { name: 'Deploy complete' })).toHaveCount(1);
});

test('a loading skeleton takes no focus; a loaded one does', async ({ page }) => {
    await bootPage(page, 'skeleton', 'basic');
    const link = page.getByRole('link', { name: 'Read the full report' });
    // Inert refuses focus outright — programmatic included, so the check
    // holds in WebKit, whose Tab skips links by default anyway.
    await link.focus();
    await expect(link).not.toBeFocused();
    await page.getByRole('button', { name: 'Finish loading' }).click();
    await expect(page.getByRole('button', { name: 'Start loading' })).toBeVisible();
    await link.focus();
    await expect(link).toBeFocused();
});

test('a progressbar announces the text it shows', async ({ page }) => {
    await bootPage(page, 'progress', 'basic');
    const files = demoLabelled(page, 'progress', 'Uploading files');
    await expect(files('value-text')).toHaveText('3 of 8 files');
    await expect(rootLabelled(page, 'progress', 'Uploading files')).toHaveAttribute('aria-valuetext', '3 of 8 files');
});

for (const ds of DESIGN_SYSTEMS) {
    test(`${ds}: a spinner's label is clipped text inside its status`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'chromium', 'the cascade claim is engine-independent; chromium walks the six skins');
        await bootPage(page, 'spinner', ds);
        const root = rootLabelled(page, 'spinner', 'Loading results');
        await expect(root).toHaveAttribute('role', 'status');
        await expect(root).not.toHaveAttribute('aria-label', /.*/);
        // Layout size, not the bounding rect: the spinner turns, and a 1px
        // box in a rotated parent has a bounding rect up to √2 wide.
        const box = await demoLabelled(page, 'spinner', 'Loading results')('label').evaluate((el) => {
            const cs = getComputedStyle(el);
            const h = el as HTMLElement;
            return { w: h.offsetWidth, h: h.offsetHeight, position: cs.position, clipPath: cs.clipPath };
        });
        expect(box.position).toBe('absolute');
        expect(box.clipPath).toBe('inset(50%)');
        expect(box.w).toBeLessThanOrEqual(1);
        expect(box.h).toBeLessThanOrEqual(1);
    });
}
