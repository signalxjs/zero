/**
 * The switch survives forced colours (#189).
 *
 * Under `forced-colors: active` the browser revalues every author background
 * to `Canvas` and drops every `box-shadow`. A switch painted only with
 * backgrounds (carbon's track and thumb) or whose knob is a background plus
 * shadows (daisyUI's `currentColor` knob) then renders Canvas on Canvas: the
 * track has no edge, and checked cannot be told from unchecked. Nothing in the
 * unit suite can see that — it is the browser's revaluation, not a
 * declaration — so this measures PIXELS, in the one project that emulates the
 * mode.
 *
 * Two claims per design system, both on the control's own box:
 *
 * 1. **The track is there.** A screenshot of the control differs from the
 *    same rectangle with the control made `visibility: hidden`. A switch that
 *    paints nothing a forced palette keeps reads identical to the page behind
 *    it.
 * 2. **On and off differ.** The checked and unchecked screenshots differ. A
 *    visible thumb in a different place is enough; an invisible thumb on an
 *    outline-only track is exactly the identical pair the issue found.
 *
 * "Differ" means STRONGLY, counted in decoded pixels: a pixel counts only when
 * its luminance moves by more than half the range. A forced palette is
 * high-contrast by construction, so anything a reader can actually see moves
 * that far, while byte-level equality is far too weak — daisyUI's noise
 * texture (a `background-image`, which forced colours keep) made its two
 * visually identical states differ in bytes and pass. The PNGs are decoded in
 * the page itself, since the playground carries no PNG decoder.
 *
 * Focus and hover are cleared before each shot so the ring a click leaves
 * behind cannot be what makes the pair differ.
 */
import { test, expect, type Locator, type Page } from '@playwright/test';
import { demoLabelled, settledBox, DESIGN_SYSTEMS } from './demo';
import { bootPage } from './nav';

type Box = Awaited<ReturnType<typeof settledBox>>;

async function shoot(page: Page, control: Locator): Promise<{ png: Buffer; box: Box }> {
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.mouse.move(0, 0);
    const box = await settledBox(control, 'switch control');
    return { png: await page.screenshot({ clip: box, animations: 'disabled' }), box };
}

/** Pixels that are visibly different — luminance apart by more than half the range. */
const STRONG = 128;
/** Enough of them to be a mark rather than a stray anti-aliased edge. */
const MIN_PIXELS = 12;

async function strongDiff(page: Page, a: Buffer, b: Buffer): Promise<number> {
    return page.evaluate(async ([pa, pb, strong]) => {
        const decode = async (b64: string) => {
            const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
            const bmp = await createImageBitmap(blob);
            const canvas = new OffscreenCanvas(bmp.width, bmp.height);
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(bmp, 0, 0);
            return ctx.getImageData(0, 0, bmp.width, bmp.height);
        };
        const [x, y] = await Promise.all([decode(pa), decode(pb)]);
        if (x.width !== y.width || x.height !== y.height) return Number.POSITIVE_INFINITY;
        const lum = (d: Uint8ClampedArray, i: number) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        let n = 0;
        for (let i = 0; i < x.data.length; i += 4) {
            if (Math.abs(lum(x.data, i) - lum(y.data, i)) > strong) n++;
        }
        return n;
    }, [a.toString('base64'), b.toString('base64'), STRONG] as const);
}

for (const ds of DESIGN_SYSTEMS) {
    test(`${ds}: the switch stays visible and legible under forced colours`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'forced-colors', 'the forced-colors project is the whole point');

        await bootPage(page, 'switch', ds);
        const parts = demoLabelled(page, 'switch', 'Notifications');
        const control = parts('control');
        await expect(control).toHaveAttribute('data-state', 'checked');

        const { png: checked, box } = await shoot(page, control);

        // The same rectangle with the control (and its thumb) not painted.
        await control.evaluate((el) => { el.style.visibility = 'hidden'; });
        const behind = await page.screenshot({ clip: box, animations: 'disabled' });
        await control.evaluate((el) => { el.style.visibility = ''; });

        expect(
            await strongDiff(page, checked, behind),
            `${ds}: the checked switch paints nothing a forced palette keeps — the control is Canvas on Canvas`,
        ).toBeGreaterThanOrEqual(MIN_PIXELS);

        await control.click();
        await expect(control).toHaveAttribute('data-state', 'unchecked');
        const { png: unchecked } = await shoot(page, control);

        expect(
            await strongDiff(page, unchecked, checked),
            `${ds}: checked and unchecked render identically under forced colours — the thumb is invisible`,
        ).toBeGreaterThanOrEqual(MIN_PIXELS);
    });
}
