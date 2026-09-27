/**
 * Card media is full-bleed (#302), measured in boxes.
 *
 * `card.media` is the band a skin draws edge to edge: the other bands pad
 * themselves and media does not, and it rounds the corners it shares with
 * the card. That is a claim about LAYOUT — the CSS goldens record the
 * declarations faithfully and cannot tell whether they add up to a flush
 * band (a `<figure>`'s UA margin, an `<img>`'s intrinsic width and a root's
 * border all get a say) — so this spec measures the three shapes the Card
 * page renders, in every design system:
 *
 * - a `div` band wrapping an image, first in the card;
 * - an asChild `<figure>`, last in the card (its UA margin must be gone);
 * - an asChild `<img>` that IS the band.
 *
 * Each band's border box must sit on the root's padding box on both inline
 * edges and on the block edge it shares, and a band that shares a corner
 * rounds it to the root's inner radius. Chromium only, one page load per
 * design system: box geometry is not where engines differ, the six skins
 * are where this could.
 */
import { expect, test, type Locator } from '@playwright/test';
import { bootPage } from './nav';
import { rootLabelled, settledBox, DESIGN_SYSTEMS } from './demo';

/** Sub-pixel slack: borders are `calc()`ed hairlines and boxes are fractional. */
const EPS = 1;

interface Geometry {
    /** The root's padding box — its border box less its own borders. */
    inner: { left: number; right: number; top: number; bottom: number };
    media: { left: number; right: number; top: number; bottom: number };
    /** The root's inner radius at each corner, and the media's own. */
    rootInnerRadius: { startStart: number; endEnd: number };
    mediaRadius: { startStart: number; endEnd: number };
    /** The wrapped image's width, when the band wraps one. */
    imageWidth: number | null;
}

/** Root and media measured in ONE read, so the two describe the same layout. */
async function geometry(root: Locator): Promise<Geometry> {
    await settledBox(root, 'the card root');
    return root.evaluate((el) => {
        const media = el.querySelector<HTMLElement>(':scope > [data-scope="card"][data-part="media"]')!;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const px = (v: string) => parseFloat(v) || 0;
        const bl = px(cs.borderLeftWidth), br = px(cs.borderRightWidth);
        const bt = px(cs.borderTopWidth), bb = px(cs.borderBottomWidth);
        const m = media.getBoundingClientRect();
        const ms = getComputedStyle(media);
        const img = media.tagName === 'IMG' ? null : media.querySelector('img');
        return {
            inner: { left: r.left + bl, right: r.right - br, top: r.top + bt, bottom: r.bottom - bb },
            media: { left: m.left, right: m.right, top: m.top, bottom: m.bottom },
            // A padding-box corner's radius is the outer radius less the
            // border it meets; the block border is the one that decides the
            // media's arc (horizontal-tb, which the playground is).
            rootInnerRadius: {
                startStart: Math.max(0, px(cs.borderTopLeftRadius) - bt),
                endEnd: Math.max(0, px(cs.borderBottomRightRadius) - bb),
            },
            mediaRadius: { startStart: px(ms.borderTopLeftRadius), endEnd: px(ms.borderBottomRightRadius) },
            imageWidth: img ? img.getBoundingClientRect().width : null,
        };
    });
}

test.describe('card media is a full-bleed band (#302)', () => {
    test.beforeEach(({}, testInfo) => {
        test.skip(testInfo.project.name !== 'chromium', 'box geometry is not engine-specific — one engine is enough');
    });

    for (const ds of DESIGN_SYSTEMS) {
        test(`${ds}: media runs to the card's edges and rounds the corners it shares`, async ({ page }) => {
            await bootPage(page, 'card', ds);

            // A div band wrapping an image, first in the card.
            const first = await geometry(rootLabelled(page, 'card', 'Ridge walk'));
            expect(first.media.left, `${ds}: the wrapper band's start edge`).toBeCloseTo(first.inner.left, 0);
            expect(first.media.right, `${ds}: the wrapper band's end edge`).toBeCloseTo(first.inner.right, 0);
            expect(Math.abs(first.media.top - first.inner.top), `${ds}: the wrapper band sits on the card's top`).toBeLessThanOrEqual(EPS);
            expect(first.imageWidth, `${ds}: the image fills its band`).not.toBeNull();
            expect(Math.abs(first.imageWidth! - (first.media.right - first.media.left)), `${ds}: the image fills its band`).toBeLessThanOrEqual(EPS);
            expect(Math.abs(first.mediaRadius.startStart - first.rootInnerRadius.startStart), `${ds}: the top corner matches the card's`).toBeLessThanOrEqual(EPS);

            // An asChild <figure>, last in the card: the UA margin is gone.
            const last = await geometry(rootLabelled(page, 'card', 'Field notes'));
            expect(last.media.left, `${ds}: the figure's start edge`).toBeCloseTo(last.inner.left, 0);
            expect(last.media.right, `${ds}: the figure's end edge`).toBeCloseTo(last.inner.right, 0);
            expect(Math.abs(last.media.bottom - last.inner.bottom), `${ds}: the figure sits on the card's bottom`).toBeLessThanOrEqual(EPS);
            expect(Math.abs(last.mediaRadius.endEnd - last.rootInnerRadius.endEnd), `${ds}: the bottom corner matches the card's`).toBeLessThanOrEqual(EPS);

            // An asChild <img> that IS the band.
            const self = await geometry(rootLabelled(page, 'card', 'decorative cover'));
            expect(self.media.left, `${ds}: the image band's start edge`).toBeCloseTo(self.inner.left, 0);
            expect(self.media.right, `${ds}: the image band's end edge`).toBeCloseTo(self.inner.right, 0);
            expect(Math.abs(self.media.top - self.inner.top), `${ds}: the image band sits on the card's top`).toBeLessThanOrEqual(EPS);
        });
    }
});
