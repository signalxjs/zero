/**
 * Input's optional outline part (#468), measured in boxes and pixels.
 *
 * `Input.Outline` renders a `<fieldset>` over the control whose `<legend>`
 * (the `notch`) a skin sizes from the runtime-published
 * `--input-label-inline-size`, so a floated label sits in a real cut in the
 * border rather than over paint standing in for the surface behind it.
 * happy-dom holds the wiring; only a browser lays out the label, scales it
 * and cuts the border, so the claims live here:
 *
 * - in a skin that notches (Material's outlined field), the notch spans the
 *   floated label's painted box — same inline start, same width — in both
 *   reading directions, for an `Input.Label` and for a `Field.Label` the
 *   input adopted, and it opens when a resting label floats on focus;
 * - the cut is real: with a background no stand-in could guess behind the
 *   field, the border's row inside the notch shows that background, and
 *   the label behind it paints none of its own;
 * - every other skin leaves the part undisplayed.
 *
 * Chromium only, per design system: the geometry is the recipe's, the
 * fieldset/legend cut the engine's.
 */
import { test, expect, type Locator, type Page } from '@playwright/test';
import { DESIGN_SYSTEMS, partsOf, settledBox } from './demo';
import { bootPage } from './nav';

/** The skins whose label floats onto the outline, and so notch it. */
const NOTCHING: ReadonlySet<string> = new Set(['material']);

const demo = (page: Page, name: string): Locator => page.locator(`[data-demo="${name}"]`);

/** The outlined demos: the input root, and the label that names it. */
function outlined(page: Page, name: 'outline-empty' | 'outline-filled' | 'outline-field') {
    const host = demo(page, name);
    // The field demo's host is the Field.Root: its input root sits inside.
    const inputRoot = name === 'outline-field'
        ? host.locator('[data-scope="input"][data-part="root"]')
        : host;
    const parts = partsOf(inputRoot, 'input');
    const label = name === 'outline-field'
        ? host.locator('[data-scope="field"][data-part="label"]')
        : parts('label');
    return { parts, label, host };
}

/** The label's painted box and the notch's, once both have settled. */
async function boxes(label: Locator, notch: Locator) {
    const l = await settledBox(label, 'floated label');
    await notch.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished.catch(() => {}))));
    const n = await notch.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, width: r.width };
    });
    return { l, n };
}

test.describe('input outline (#468)', () => {
    test.beforeEach(({}, testInfo) => {
        test.skip(testInfo.project.name !== 'chromium', 'box geometry, chromium only');
    });

    for (const ds of DESIGN_SYSTEMS) {
        if (!NOTCHING.has(ds)) {
            test(`${ds}: the outline stays undisplayed — the control keeps its own border`, async ({ page }) => {
                await bootPage(page, 'input', ds);
                for (const name of ['outline-empty', 'outline-filled', 'outline-field'] as const) {
                    const { parts } = outlined(page, name);
                    await expect(parts('outline'), `${name}: the part is rendered`).toHaveCount(1);
                    expect(await parts('outline').evaluate((el) => getComputedStyle(el).display), name).toBe('none');
                }
            });
            continue;
        }

        test(`${ds}: the notch spans the floated label`, async ({ page }) => {
            await bootPage(page, 'input', ds);
            for (const name of ['outline-filled', 'outline-field'] as const) {
                const { parts, label } = outlined(page, name);
                await expect(parts('outline')).toBeVisible();
                const published = await parts('outline').evaluate((el) =>
                    parseFloat(getComputedStyle(el).getPropertyValue('--input-label-inline-size')));
                expect(published, `${name}: a visible label publishes its width`).toBeGreaterThan(0);
                const { l, n } = await boxes(label, parts('notch'));
                expect(Math.abs(n.x - l.x), `${name}: the notch starts where the label does`).toBeLessThanOrEqual(1);
                expect(Math.abs(n.width - l.width), `${name}: the notch is as wide as the label`).toBeLessThanOrEqual(1.5);
                // No stand-in paint: the label sits in the cut.
                expect(await label.evaluate((el) => getComputedStyle(el).backgroundColor), name).toBe('rgba(0, 0, 0, 0)');
            }
        });

        test(`${ds}: a resting label opens no notch, and focus opens it`, async ({ page }) => {
            await bootPage(page, 'input', ds);
            const { parts, label } = outlined(page, 'outline-empty');
            await expect(parts('outline')).toBeVisible();
            await parts('notch').evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished.catch(() => {}))));
            expect(await parts('notch').evaluate((el) => el.getBoundingClientRect().width), 'resting: closed').toBe(0);
            await parts('input').focus();
            const { l, n } = await boxes(label, parts('notch'));
            expect(n.width, 'focused: open').toBeGreaterThan(0);
            expect(Math.abs(n.x - l.x)).toBeLessThanOrEqual(1);
            expect(Math.abs(n.width - l.width)).toBeLessThanOrEqual(1.5);
        });

        test(`${ds}: under RTL the notch spans the label from the reading start`, async ({ page }) => {
            await bootPage(page, 'input', ds);
            // After boot: an init script runs before documentElement exists.
            await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
            for (const name of ['outline-filled', 'outline-field'] as const) {
                const { parts, label } = outlined(page, name);
                const { l, n } = await boxes(label, parts('notch'));
                const control = await settledBox(parts('control'), 'control');
                // The reading start is the right edge.
                expect(l.x + l.width, `${name}: the label floats at the right`).toBeGreaterThan(control.x + control.width / 2);
                expect(Math.abs((n.x + n.width) - (l.x + l.width)), `${name}: right edges meet`).toBeLessThanOrEqual(1);
                expect(Math.abs(n.width - l.width), name).toBeLessThanOrEqual(1.5);
            }
        });

        test(`${ds}: the border is cut, over a background no stand-in could paint`, async ({ page }) => {
            await bootPage(page, 'input', ds);
            const { parts, host } = outlined(page, 'outline-filled');
            // A saturated backdrop behind the field, set on the row it sits in.
            await host.evaluate((el) => { (el.parentElement as HTMLElement).style.background = 'rgb(255, 0, 255)'; });
            const outline = parts('outline');
            await expect(outline).toBeVisible();
            await outline.scrollIntoViewIfNeeded();
            await parts('notch').evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished.catch(() => {}))));
            const geo = await outline.evaluate((el) => {
                const r = el.getBoundingClientRect();
                const legend = el.querySelector('legend')!.getBoundingClientRect();
                const bw = parseFloat(getComputedStyle(el).borderTopWidth);
                return { top: r.top, left: r.left, right: r.right, bw, notchStart: legend.left, notchEnd: legend.right };
            });
            expect(geo.notchEnd - geo.notchStart).toBeGreaterThan(8);
            // One row through the middle of the top border, from the outline's
            // left edge to past the notch.
            const y = Math.floor(geo.top + geo.bw / 2);
            const clip = { x: Math.floor(geo.left), y, width: Math.ceil(geo.notchEnd - geo.left) + 4, height: 1 };
            const png = await page.screenshot({ clip, animations: 'disabled' });
            const row = await page.evaluate(async (b64) => {
                const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
                const bmp = await createImageBitmap(blob);
                const canvas = new OffscreenCanvas(bmp.width, bmp.height);
                const ctx = canvas.getContext('2d')!;
                ctx.drawImage(bmp, 0, 0);
                return Array.from(ctx.getImageData(0, 0, bmp.width, 1).data);
            }, png.toString('base64'));
            const px = (x: number) => {
                const dpr = row.length / 4 / clip.width;
                const i = Math.round((x - clip.x) * dpr) * 4;
                return [row[i]!, row[i + 1]!, row[i + 2]!];
            };
            const magenta = ([r, g, b]: number[]) => r! > 200 && g! < 60 && b! > 200;
            // Just inside the notch's leading edge — the label's padding, no
            // glyph — the backdrop shows through the border's row…
            expect(magenta(px(geo.notchStart + 1.5)), 'inside the notch: the backdrop').toBe(true);
            // …and before the notch the outline is drawn over it.
            expect(magenta(px(geo.left + (geo.notchStart - geo.left) / 2)), 'before the notch: the outline').toBe(false);
        });
    }
});
