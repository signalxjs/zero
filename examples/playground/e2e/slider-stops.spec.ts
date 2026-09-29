/**
 * Slider — stop state and the per-thumb value bubble (#490), under real
 * layout, a real pointer and a real keyboard.
 *
 * The unit suite proves the attributes: a mark's `data-state` follows the
 * range span, and `Slider.ThumbValue` mirrors its thumb's `pressed` and
 * `focus-visible`. What only an engine can tell is whether the skins turn
 * that into something a reader sees, so every claim here is measured in
 * boxes and paint order, per design system:
 *
 * - an ACTIVE stop is painted above the filled span, in an ink that is not
 *   the span's own — before #490 the range covered the stops it filled;
 * - the bubble is invisible at rest, shows while its thumb is dragged or
 *   keyboard-focused, and sits centred over its thumb (horizontal) or beside
 *   it on the inline-start side, centred on it (vertical) — in RTL too,
 *   since the centring is spelled physically and the side logically.
 */
import { test, expect, type Locator, type Page } from '@playwright/test';
import { bootPage } from './nav';
import { DESIGN_SYSTEMS, demoLabelled, settledBox } from './demo';

const band = (page: Page) => demoLabelled(page, 'slider', 'Band');
const level = (page: Page) => demoLabelled(page, 'slider', 'Level');

const shown = (loc: Locator): Promise<boolean> =>
    loc.evaluate((el) => el.checkVisibility({ opacityProperty: true, visibilityProperty: true }));

const markStates = (page: Page): Promise<(string | null)[]> =>
    band(page)('mark').evaluateAll((els) => els.map((el) => el.getAttribute('data-state')));

test.describe('stop state', () => {
    test.beforeEach(async ({ page }) => {
        await bootPage(page, 'slider', 'basic');
    });

    test('the stops on the filled span are active, and follow the keyboard', async ({ page }) => {
        // Band is [30, 70] over stops every ten.
        expect(await markStates(page)).toEqual([
            'inactive', 'inactive', 'inactive', 'active', 'active', 'active', 'active', 'active', 'inactive', 'inactive', 'inactive',
        ]);
        await band(page)('thumb').nth(1).focus();
        await page.keyboard.press('End');
        expect(await markStates(page)).toEqual([
            'inactive', 'inactive', 'inactive', 'active', 'active', 'active', 'active', 'active', 'active', 'active', 'active',
        ]);
    });
});

for (const ds of DESIGN_SYSTEMS) {
    test.describe(ds, () => {
        // Geometry and paint order are engine-independent, and forced colours
        // revalue every author background — so the chromium project only.
        test.beforeEach(({}, testInfo) => {
            test.skip(testInfo.project.name !== 'chromium', 'one engine, default colours');
        });

        test.beforeEach(async ({ page }) => {
            await bootPage(page, 'slider', ds);
        });

        test('an active stop paints above the filled span, in its own ink', async ({ page }) => {
            const track = band(page)('track');
            await track.scrollIntoViewIfNeeded();
            const t = await settledBox(track, 'the Band track');
            // The 50 stop: inside the [30, 70] span and clear of both thumbs.
            const mark = band(page)('mark').nth(5);
            await expect(mark).toHaveAttribute('data-state', 'active');
            // A bare stop has no label, so its box is zero-wide at the stop's
            // position: read the rect, since a visibility check refuses it.
            const m = await mark.evaluate((el) => el.getBoundingClientRect().toJSON() as { x: number });
            const probe = await page.evaluate(({ x, y }) => {
                const stack = document.elementsFromPoint(x, y);
                const index = (part: string) => stack.findIndex((el) => el.getAttribute('data-scope') === 'slider' && el.getAttribute('data-part') === part);
                return { mark: index('mark'), range: index('range') };
            }, { x: m.x, y: t.y + t.height / 2 });
            expect(probe.range, 'the filled span is under the stop').toBeGreaterThanOrEqual(0);
            expect(probe.mark, 'the stop is hit where its tick is drawn').toBeGreaterThanOrEqual(0);
            expect(probe.mark, 'the stop is painted above the span, not under it').toBeLessThan(probe.range);

            const inks = await page.evaluate(([markEl, rangeEl]) => ({
                tick: getComputedStyle(markEl!, '::before').backgroundColor,
                span: getComputedStyle(rangeEl!).backgroundColor,
            }), [await mark.elementHandle(), await band(page)('range').elementHandle()] as const);
            expect(inks.tick, 'an active stop is not inked like the span it sits on').not.toBe(inks.span);

            const inactive = band(page)('mark').nth(9);
            const inactiveTick = await inactive.evaluate((el) => getComputedStyle(el, '::before').backgroundColor);
            expect(inactiveTick, 'active and inactive stops are inked apart').not.toBe(inks.tick);
        });

        test('the bubble shows over its thumb while dragged and while focused, and hides at rest', async ({ page }) => {
            const thumb = band(page)('thumb').nth(0);
            const bubble = band(page)('thumb-value').nth(0);
            await thumb.scrollIntoViewIfNeeded();
            expect(await shown(bubble), 'at rest').toBe(false);
            await expect(bubble).toHaveText('30%');

            const th = await settledBox(thumb, 'the Band start thumb');
            await page.mouse.move(th.x + th.width / 2, th.y + th.height / 2);
            await page.mouse.down();
            await expect(bubble).toHaveAttribute('data-pressed', '');
            await expect.poll(() => shown(bubble), { message: 'while dragged' }).toBe(true);
            const b = await settledBox(bubble, 'the dragged bubble');
            const held = await settledBox(thumb, 'the held thumb');
            expect(Math.abs((b.x + b.width / 2) - (held.x + held.width / 2)), 'centred on the thumb').toBeLessThanOrEqual(1);
            expect(b.y + b.height, 'over the thumb, not on it').toBeLessThanOrEqual(held.y + 0.5);
            await page.mouse.up();
            await expect(bubble).not.toHaveAttribute('data-pressed', '');
            // The drag focused the thumb by pointer: not focus-visible — the
            // press cancels its default, and Chromium would otherwise call
            // the scripted focus keyboard-visible — so the bubble goes once
            // the press ends.
            await expect(thumb).not.toHaveAttribute('data-focus-visible', '');
            await expect.poll(() => shown(bubble), { message: 'after the drag' }).toBe(false);

            // Keyboard focus: Shift+Tab back onto the start thumb from the end one.
            await band(page)('thumb').nth(1).focus();
            await page.keyboard.press('Shift+Tab');
            await expect(thumb).toBeFocused();
            await expect(bubble).toHaveAttribute('data-focus-visible', '');
            await expect.poll(() => shown(bubble), { message: 'while keyboard-focused' }).toBe(true);
            await page.keyboard.press('ArrowRight');
            await expect(bubble).toHaveText('40%');
        });

        for (const dir of ['ltr', 'rtl'] as const) {
            test(`upright, the bubble sits beside its thumb on the inline-start side (${dir})`, async ({ page }) => {
                if (dir === 'rtl') await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
                const thumb = level(page)('thumb');
                const bubble = level(page)('thumb-value');
                await thumb.scrollIntoViewIfNeeded();
                await thumb.focus();
                // Focused programmatically after a keyboard press, so the
                // engine calls it focus-visible.
                await page.keyboard.press('ArrowUp');
                await expect(bubble).toHaveAttribute('data-focus-visible', '');
                await expect.poll(() => shown(bubble)).toBe(true);
                const b = await settledBox(bubble, 'the Level bubble');
                const t = await settledBox(thumb, 'the Level thumb');
                expect(Math.abs((b.y + b.height / 2) - (t.y + t.height / 2)), 'centred on the thumb').toBeLessThanOrEqual(1);
                if (dir === 'ltr') expect(b.x + b.width, 'left of the thumb').toBeLessThanOrEqual(t.x + 0.5);
                else expect(b.x, 'right of the thumb').toBeGreaterThanOrEqual(t.x + t.width - 0.5);
            });
        }
    });
}
