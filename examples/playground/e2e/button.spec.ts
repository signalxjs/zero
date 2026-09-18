/**
 * Button in a real engine, across all six design systems (#50).
 *
 * Two claims a simulated DOM cannot check, because both are about paint:
 *
 * - **The link button holds its colour.** Recipe CSS lives in
 *   `@layer zero.recipes`, and any unlayered rule beats any layered one — so
 *   an app's plain `a { color }` repaints an `asChild` `<a>` button, whatever
 *   the specificity. That is the layering promise (app CSS always wins)
 *   working as designed, and it is why the README documents one unlayered
 *   `revert-layer` rule instead of zero shipping one. The spec first proves
 *   the problem is real (the link takes the app's red), then that the
 *   documented rule hands the colour back to the recipe: the link paints
 *   exactly like its native twin, with no underline. The underline half is
 *   also why every button recipe sets `text-decoration: none` — without it,
 *   `revert-layer` falls through to the UA's link underline.
 * - **The spinner is drawn.** `loading` renders a real `spinner` part; every
 *   design system must give it a box, or a loading button shows nothing.
 *
 * Chromium-only: both are cascade and layout facts, engine-independent.
 */
import { test, expect, type Locator } from '@playwright/test';
import { rootLabelled, partsOf } from './demo';
import { bootPage } from './nav';

const DESIGN_SYSTEMS = ['basic', 'daisyui', 'material', 'brutalist', 'heroui', 'carbon'] as const;

const APP_LINK_CSS = 'a { color: rgb(255, 0, 0); text-decoration: underline; }';
/** Verbatim from the README's link-button note. */
const DOCUMENTED_RULE = 'a[data-scope="button"][data-part="root"] { color: revert-layer; text-decoration: revert-layer; }';

/**
 * Computed paint once every transition has landed: basic and carbon
 * transition `color`, so a read straight after a stylesheet lands samples
 * the tween, not either end of it.
 */
const paint = (loc: Locator) => loc.evaluate(async (el) => {
    await Promise.all(el.getAnimations().map((a) => a.finished.catch(() => undefined)));
    const cs = getComputedStyle(el);
    return { color: cs.color, underline: cs.textDecorationLine };
});

for (const ds of DESIGN_SYSTEMS) {
    test.describe(`design system: ${ds}`, () => {
        test.beforeEach(async ({ page }, testInfo) => {
            test.skip(testInfo.project.name !== 'chromium', 'cascade and layout facts — one engine is enough');
            await bootPage(page, 'button', ds);
        });

        test('a link button keeps the recipe colour against an unlayered a { color }', async ({ page }) => {
            const link = rootLabelled(page, 'button', 'Link button');
            const twin = rootLabelled(page, 'button', 'Button twin');
            await expect(link).toHaveJSProperty('tagName', 'A');

            await page.addStyleTag({ content: APP_LINK_CSS });
            expect((await paint(link)).color, 'the unlayered app rule wins — the problem is real').toBe('rgb(255, 0, 0)');

            await page.addStyleTag({ content: DOCUMENTED_RULE });
            const [linkPaint, twinPaint] = [await paint(link), await paint(twin)];
            expect(linkPaint.color).toBe(twinPaint.color);
            expect(linkPaint.underline).toBe('none');
        });

        test('a loading button draws its spinner', async ({ page }) => {
            const loading = rootLabelled(page, 'button', 'Loading');
            await expect(loading).toHaveAttribute('data-state', 'loading');
            await expect(loading).toHaveAttribute('aria-busy', 'true');
            const spinner = partsOf(loading, 'button')('spinner');
            await expect(spinner).toBeVisible();
            const box = await spinner.boundingBox();
            expect(box, 'the spinner has a box').not.toBeNull();
            expect(box!.width).toBeGreaterThan(4);
            expect(box!.height).toBeGreaterThan(4);
        });
    });
}
