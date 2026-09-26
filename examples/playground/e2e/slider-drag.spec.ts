/**
 * Slider — value movement under a real pointer drag and real keyboard.
 *
 * The press-feedback spec already proves `data-pressed` survives a captured
 * drag; this one proves the VALUE side: a drag on the native range control
 * tracks the pointer (including outside the control's box — implicit pointer
 * capture), the model round-trips into `value-text` and `--slider-percent`,
 * and the platform's keyboard steps flow through the model too.
 */
import { test, expect, type Page } from '@playwright/test';
import { bootPage } from './nav';
import { demoLabelled, rootLabelled, settledBox } from './demo';

test.beforeEach(async ({ page }) => {
    await bootPage(page, 'slider', 'basic');
});

/**
 * The Volume slider — the page also renders an invalid sample and a
 * Progress mirror, so the instance is named by its label (`demo.ts`).
 */
const demo = (page: Page) => demoLabelled(page, 'slider', 'Volume');

const controlValue = (page: Page) =>
    demo(page)('control').evaluate((el) => (el as HTMLInputElement).valueAsNumber);

test('a pointer drag on the control moves the value with the pointer', async ({ page }) => {
    const control = demo(page)('control');
    await control.scrollIntoViewIfNeeded();
    const box = await settledBox(control, 'the Volume slider control');
    const cy = box.y + box.height / 2;
    // Start ON the thumb (value 40 → 40% along the track) so the drag is a
    // drag, not an initial jump-to-position.
    await page.mouse.move(box.x + box.width * 0.4, cy);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.8, cy, { steps: 8 });
    const midDrag = await controlValue(page);
    // The thumb has width and engines differ on the exact mapping — the
    // claim is "the value followed the pointer", not a pixel-perfect 80.
    expect(midDrag).toBeGreaterThan(65);
    expect(midDrag).toBeLessThan(95);
    await page.mouse.up();

    // The model round-trips: output text and the track-fill custom property.
    await expect(demo(page)('value-text')).toHaveText(String(midDrag));
    expect(await rootLabelled(page, 'slider', 'Volume').evaluate(
        (el) => el.style.getPropertyValue('--slider-percent'),
    )).toBe(`${midDrag}%`);
});

test('the drag survives leaving the control: implicit capture clamps at max', async ({ page }) => {
    const control = demo(page)('control');
    await control.scrollIntoViewIfNeeded();
    const box = await settledBox(control, 'the Volume slider control');
    const cy = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * 0.4, cy);
    await page.mouse.down();
    // Way past the right edge and off the vertical axis — without capture
    // the drag would die at the border; with it the value clamps to max.
    await page.mouse.move(box.x + box.width + 150, cy + 60, { steps: 6 });
    expect(await controlValue(page)).toBe(100);
    await page.mouse.up();
    await expect(demo(page)('value-text')).toHaveText('100');
});

test('keyboard steps the value through the same model', async ({ page }) => {
    const control = demo(page)('control');
    await control.focus();
    expect(await controlValue(page)).toBe(40);

    await page.keyboard.press('ArrowRight');
    expect(await controlValue(page)).toBe(41);
    await expect(demo(page)('value-text')).toHaveText('41');

    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    expect(await controlValue(page)).toBe(39);
    await expect(demo(page)('value-text')).toHaveText('39');

    await page.keyboard.press('End');
    expect(await controlValue(page)).toBe(100);
    await page.keyboard.press('Home');
    expect(await controlValue(page)).toBe(0);
    await expect(demo(page)('value-text')).toHaveText('0');
});

test('PageUp/PageDown on the native control move by largeStep in every engine (#272)', async ({ page }) => {
    const control = demo(page)('control');
    await control.focus();
    expect(await controlValue(page)).toBe(40);
    // The native range's own PageUp is engine-defined; largeStep (default
    // ten steps) is not.
    await page.keyboard.press('PageUp');
    expect(await controlValue(page)).toBe(50);
    await page.keyboard.press('Shift+ArrowDown');
    expect(await controlValue(page)).toBe(40);
    await expect(demo(page)('value-text')).toHaveText('40');
});

/** The gap-keeping range demo: [20, 60], step 5, largeStep 25, two steps apart. */
const windowDemo = (page: Page) => demoLabelled(page, 'slider', 'Time window');
const committed = (page: Page) => page.locator('[data-demo="slider-committed"]');

test('valueCommit fires on release, not during the drag (#272)', async ({ page }) => {
    const end = windowDemo(page)('thumb').nth(1);
    await end.scrollIntoViewIfNeeded();
    const track = await settledBox(windowDemo(page)('track'), 'the Time window track');
    const thumb = await settledBox(end, 'the Window end thumb');
    const cy = thumb.y + thumb.height / 2;
    await page.mouse.move(thumb.x + thumb.width / 2, cy);
    await page.mouse.down();
    await page.mouse.move(track.x + track.width * 0.9, cy, { steps: 6 });
    await expect(end).not.toHaveAttribute('aria-valuenow', '60');
    await expect(committed(page)).toHaveText('—');
    await page.mouse.up();
    const now = await end.getAttribute('aria-valuenow');
    await expect(committed(page)).toHaveText(`20 – ${now}`);
});

test('minStepsBetweenThumbs holds the gap under Shift+Arrow large steps (#272)', async ({ page }) => {
    const start = windowDemo(page)('thumb').nth(0);
    await start.focus();
    await expect(start).toHaveAttribute('aria-valuemax', '50');
    await page.keyboard.press('Shift+ArrowRight');
    await expect(start).toHaveAttribute('aria-valuenow', '45');
    await page.keyboard.press('Shift+ArrowRight');
    // Clamped two steps (10) short of the end thumb at 60.
    await expect(start).toHaveAttribute('aria-valuenow', '50');
    await expect(committed(page)).toHaveText('50 – 60');
});
