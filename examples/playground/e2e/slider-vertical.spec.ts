/**
 * Slider — vertical orientation (#170), under real layout and a real pointer.
 *
 * `orientation="vertical"` runs the rail bottom-to-top on both projections.
 * The drags prove the pointer maps through Y the right way up (the composed
 * thumb through zero's own `clientY` math, the native control through the
 * writing-mode spelling the runtime puts on it); the geometry test proves
 * every skin turns the channel upright, measured in boxes — a recipe that
 * ignored `data-orientation` leaves a flat, full-width track with the thumb
 * pinned off it, which no unit test (no layout) or CSS golden (the
 * declaration, not its effect) can see.
 */
import { test, expect, type Page } from '@playwright/test';
import { bootPage } from './nav';
import { demoLabelled, settledBox } from './demo';

const level = (page: Page) => demoLabelled(page, 'slider', 'Level');
const gain = (page: Page) => demoLabelled(page, 'slider', 'Gain');

test.describe('basic', () => {
    test.beforeEach(async ({ page }) => {
        await bootPage(page, 'slider', 'basic');
    });

    test('a vertical thumb drags bottom-to-top', async ({ page }) => {
        const thumb = level(page)('thumb');
        await thumb.scrollIntoViewIfNeeded();
        await expect(thumb).toHaveAttribute('aria-orientation', 'vertical');
        await expect(thumb).toHaveAttribute('aria-valuenow', '30');
        const track = await settledBox(level(page)('track'), 'the Level track');
        const t = await settledBox(thumb, 'the Level thumb');
        const cx = t.x + t.width / 2;
        await page.mouse.move(cx, t.y + t.height / 2);
        await page.mouse.down();
        // 80% of the way UP the rail.
        await page.mouse.move(cx, track.y + track.height * 0.2, { steps: 8 });
        const up = Number(await thumb.getAttribute('aria-valuenow'));
        expect(up).toBeGreaterThan(70);
        expect(up).toBeLessThan(90);
        // Past the foot, off the axis: the drag clamps at min.
        await page.mouse.move(cx + 80, track.y + track.height + 100, { steps: 6 });
        await expect(thumb).toHaveAttribute('aria-valuenow', '0');
        await page.mouse.up();
        await expect(level(page)('value-text')).toHaveText('0');
    });

    test('the vertical thumb steps with Up/Right and Down/Left', async ({ page }) => {
        const thumb = level(page)('thumb');
        await thumb.focus();
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('ArrowRight');
        await expect(thumb).toHaveAttribute('aria-valuenow', '32');
        await page.keyboard.press('ArrowDown');
        await expect(thumb).toHaveAttribute('aria-valuenow', '31');
    });

    test('a vertical native control drags bottom-to-top', async ({ page }) => {
        const control = gain(page)('control');
        await control.scrollIntoViewIfNeeded();
        await expect(control).toHaveAttribute('aria-orientation', 'vertical');
        const box = await settledBox(control, 'the Gain control');
        expect(box.height, 'the native range stands upright').toBeGreaterThan(box.width * 2);
        const cx = box.x + box.width / 2;
        // Start ON the thumb (value 60 → 60% up) so the drag is a drag.
        await page.mouse.move(cx, box.y + box.height * 0.4);
        await page.mouse.down();
        await page.mouse.move(cx, box.y + box.height * 0.1, { steps: 8 });
        const v = await gain(page)('control').evaluate((el) => (el as HTMLInputElement).valueAsNumber);
        expect(v).toBeGreaterThan(75);
        await page.mouse.up();
        await expect(gain(page)('value-text')).toHaveText(String(v));
    });
});

for (const ds of ['basic', 'daisyui', 'material', 'brutalist', 'heroui', 'carbon']) {
    test(`${ds}: the vertical rail stands upright with the thumb on it`, async ({ page }) => {
        await bootPage(page, 'slider', ds);
        const track = level(page)('track');
        await track.scrollIntoViewIfNeeded();
        const outer = await settledBox(track, `${ds} Level track`);
        // The parts are positioned against the track's PADDING box — a
        // bordered channel (brutalist) insets it by the border.
        const inner = await track.evaluate((el) => ({
            top: el.clientTop, left: el.clientLeft, width: el.clientWidth, height: el.clientHeight,
        }));
        const tr = { x: outer.x + inner.left, y: outer.y + inner.top, width: inner.width, height: inner.height };
        expect(tr.height, 'the rail is long on the block axis').toBeGreaterThan(tr.width * 3);
        const th = await settledBox(level(page)('thumb'), `${ds} Level thumb`);
        // Centred across the rail…
        expect(Math.abs((th.x + th.width / 2) - (tr.x + tr.width / 2))).toBeLessThan(2);
        // …and sitting 30% up it.
        const expected = tr.y + tr.height * 0.7;
        expect(Math.abs((th.y + th.height / 2) - expected)).toBeLessThan(3);
        const range = await settledBox(level(page)('range'), `${ds} Level range`);
        expect(Math.abs(range.y + range.height - (tr.y + tr.height)), 'the fill grows from the foot').toBeLessThan(3);
        expect(Math.abs(range.height - tr.height * 0.3)).toBeLessThan(3);
        const control = await settledBox(gain(page)('control'), `${ds} Gain control`);
        expect(control.height, 'the native range stands upright').toBeGreaterThan(control.width * 2);
    });
}
