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
import { rootLabelled, partsOf, DESIGN_SYSTEMS } from './demo';
import { bootPage } from './nav';

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

/**
 * The button contract on a non-button element, under a real keyboard (#275).
 *
 * The unit suite dispatches synthetic key events; only an engine proves the
 * contract is real — a `<span>` is a Tab stop, Enter and Space each activate
 * it exactly once (Space on release, so no double from the native keyup
 * path), `focusableWhenDisabled` keeps a disabled button reachable without
 * letting it act, and a disabled link leaves the tab order entirely. Three
 * engines: tab order and key activation are engine behaviour. One skin:
 * none of it is paint.
 */
test.describe('asChild button semantics (#275)', () => {
    test.beforeEach(async ({ page }, testInfo) => {
        test.skip(!['chromium', 'firefox', 'webkit'].includes(testInfo.project.name), 'keyboard behaviour — the three engines');
        // Linux WebKit headless does not reliably synthesize keyboard input.
        test.skip(testInfo.project.name === 'webkit' && process.platform === 'linux', 'headless WPE keyboard');
        await bootPage(page, 'button', 'basic');
    });

    test('a span button is a tab stop that Enter and Space each activate once', async ({ page }) => {
        const span = rootLabelled(page, 'button', 'Span button');
        const presses = page.getByTestId('span-button-presses');
        await expect(span).toHaveJSProperty('tagName', 'SPAN');
        await expect(span).toHaveAttribute('role', 'button');
        await expect(span).toHaveAttribute('tabindex', '0');

        await span.focus();
        await expect(span).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(presses).toHaveText('Pressed 1×');
        await page.keyboard.press('Space');
        await expect(presses).toHaveText('Pressed 2×');
    });

    test('focusableWhenDisabled keeps the tab stop and blocks activation', async ({ page }, testInfo) => {
        const span = rootLabelled(page, 'button', 'Span button');
        const disabled = rootLabelled(page, 'button', 'Focusable disabled');
        const presses = page.getByTestId('span-button-presses');
        await expect(disabled).toHaveAttribute('aria-disabled', 'true');
        // Not the native attribute (Playwright's toBeDisabled reads
        // aria-disabled too, so ask the element itself).
        await expect(disabled).toHaveJSProperty('disabled', false);

        // Reached by Tab from the span before it — the real tab order.
        // WebKit's default Tab skips buttons (Safari's "press Tab to
        // highlight each item" is off); Option+Tab is its full-keyboard Tab.
        await span.focus();
        await page.keyboard.press(testInfo.project.name === 'webkit' ? 'Alt+Tab' : 'Tab');
        await expect(disabled).toBeFocused();
        await page.keyboard.press('Enter');
        await page.keyboard.press('Space');
        // force: Playwright's actionability waits out aria-disabled.
        await disabled.click({ force: true });
        await expect(presses).toHaveText('Pressed 0×');
    });

    test('a disabled link has no href and no tab stop', async ({ page }) => {
        const link = rootLabelled(page, 'button', 'Disabled link');
        await expect(link).toHaveJSProperty('tagName', 'A');
        expect(await link.getAttribute('href'), 'the disabled link renders no href').toBeNull();
        await expect(link).toHaveAttribute('role', 'link');
        await expect(link).toHaveAttribute('aria-disabled', 'true');
        await expect(link).toHaveAttribute('tabindex', '-1');
        const url = page.url();
        await link.click({ force: true });
        expect(page.url()).toBe(url);
    });
});
