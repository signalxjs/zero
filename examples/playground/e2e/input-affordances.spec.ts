/**
 * Input's affordances in real engines (#281).
 *
 * happy-dom holds the wiring — the parts, the names, the model writes. What
 * only a browser can show is focus and layout: a press on an affix moves
 * focus into the input without selecting the affix's text, a press on the
 * clear trigger never takes focus away from the field at all, the keyboard
 * path skips the (untabbable) clear trigger and lands on the visibility
 * toggle, and the control's row puts every affordance at the edge it names —
 * the reading-direction edge, since the recipes order with `order` and
 * logical padding rather than physical margins.
 *
 * Behaviour on three engines against one skin; the layout on chromium
 * against every skin, in both directions. And Material's split between an
 * icon and affix text (#467), measured in boxes.
 */
import { test, expect, type Locator, type Page } from '@playwright/test';
import { demoLabelled, DESIGN_SYSTEMS, rootLabelled, settledBox } from './demo';
import { bootPage } from './nav';

const search = (page: Page) => demoLabelled(page, 'input', 'Search docs');
const password = (page: Page) => demoLabelled(page, 'input', 'New password');
const website = (page: Page) => demoLabelled(page, 'input', 'Website');
const weight = (page: Page) => demoLabelled(page, 'input', 'Weight');

const media = (name: string) => name === 'reduced-motion' || name === 'forced-colors';

test.describe('behaviour', () => {
    test.beforeEach(async ({ page }, testInfo) => {
        test.skip(media(testInfo.project.name), 'engine behaviour, not a media feature');
        await bootPage(page, 'input', 'basic');
    });

    test('a press on an affix focuses the input, and typing lands in it', async ({ page }) => {
        const parts = website(page);
        const input = parts('input');
        await parts('affix').filter({ hasText: 'https://' }).click();
        await expect(input).toBeFocused();
        await page.keyboard.press('End');
        await page.keyboard.type('-docs');
        await expect(input).toHaveValue('example-docs');
    });

    test('the clear trigger empties the field without taking focus from it', async ({ page }) => {
        const parts = search(page);
        const input = parts('input');
        await input.focus();
        await expect(input).toHaveValue('anatomy');
        const blurs = await input.evaluate((el) => {
            const w = window as unknown as { __blurs: number };
            w.__blurs = 0;
            el.addEventListener('blur', () => { w.__blurs++; });
            return w.__blurs;
        });
        expect(blurs).toBe(0);
        await parts('clear-trigger').click();
        await expect(input).toHaveValue('');
        await expect(input).toBeFocused();
        expect(await page.evaluate(() => (window as unknown as { __blurs: number }).__blurs)).toBe(0);
        // Nothing to clear, nothing rendered; typing brings it back.
        await expect(parts('clear-trigger')).toHaveCount(0);
        await page.keyboard.type('x');
        await expect(parts('clear-trigger')).toHaveCount(1);
    });

    test('Escape in a search field clears it, then lets the next Escape through', async ({ page }) => {
        const parts = search(page);
        const input = parts('input');
        await input.focus();
        await page.keyboard.press('Escape');
        await expect(input).toHaveValue('');
        await expect(parts('clear-trigger')).toHaveCount(0);
        await expect(input).toBeFocused();
    });

    test('Tab skips the clear trigger and reaches the visibility toggle, which shows the password', async ({ page }, testInfo) => {
        const parts = password(page);
        const input = parts('input');
        const toggle = parts('visibility-trigger');
        await expect(input).toHaveAttribute('type', 'password');
        await input.focus();
        // WebKit's default Tab skips buttons (Safari's "press Tab to
        // highlight each item" is off); Alt+Tab is its full keyboard order.
        // A `tabindex="-1"` clear trigger is in neither.
        await page.keyboard.press(testInfo.project.name === 'webkit' ? 'Alt+Tab' : 'Tab');
        await expect(toggle).toBeFocused();
        await expect(toggle).toHaveAttribute('aria-pressed', 'false');
        await page.keyboard.press('Space');
        await expect(toggle).toHaveAttribute('aria-pressed', 'true');
        await expect(toggle).toHaveAttribute('data-state', 'on');
        await expect(input).toHaveAttribute('type', 'text');
        await expect(input).toHaveValue('correct horse');
        await toggle.click();
        await expect(input).toHaveAttribute('type', 'password');
    });
});

test.describe('layout', () => {
    for (const ds of DESIGN_SYSTEMS) {
        for (const dir of ['ltr', 'rtl'] as const) {
            test(`${ds} ${dir}: every affordance sits inside the control, at the edge it names`, async ({ page }, testInfo) => {
                test.skip(testInfo.project.name !== 'chromium', 'layout: one engine is enough');
                await bootPage(page, 'input', ds);
                // After boot: an init script runs before documentElement exists.
                if (dir === 'rtl') await page.evaluate(() => { document.documentElement.dir = 'rtl'; });

                const before = (a: { x: number; width: number }, b: { x: number; width: number }) =>
                    dir === 'ltr' ? a.x + a.width <= b.x + 0.5 : b.x + b.width <= a.x + 0.5;
                const inside = (inner: { x: number; y: number; width: number; height: number }, outer: typeof inner) =>
                    inner.x >= outer.x - 0.5 && inner.y >= outer.y - 0.5
                    && inner.x + inner.width <= outer.x + outer.width + 0.5
                    && inner.y + inner.height <= outer.y + outer.height + 0.5;

                const site = website(page);
                const control = await settledBox(site('control'), 'website control');
                const input = await settledBox(site('input'), 'website input');
                const start = await settledBox(site('affix').filter({ hasText: 'https://' }), 'start affix');
                const end = await settledBox(site('affix').filter({ hasText: '.com' }), 'end affix');
                for (const [what, box] of [['start affix', start], ['end affix', end], ['input', input]] as const) {
                    expect(inside(box, control), `${what} inside the control`).toBe(true);
                }
                expect(before(start, input), 'start affix precedes the input in reading order').toBe(true);
                expect(before(input, end), 'end affix follows the input in reading order').toBe(true);

                const icon = await settledBox(search(page)('adornment'), 'search icon');
                const searchControl = await settledBox(search(page)('control'), 'search control');
                const searchInput = await settledBox(search(page)('input'), 'search input');
                expect(inside(icon, searchControl), 'the icon adornment inside the control').toBe(true);
                expect(before(icon, searchInput), 'the icon adornment precedes the input').toBe(true);

                // The triggers are written before nothing and after the input,
                // and sit at the reading end, inside the box.
                const pw = password(page);
                const pwControl = await settledBox(pw('control'), 'password control');
                const pwInput = await settledBox(pw('input'), 'password input');
                const clear = await settledBox(pw('clear-trigger'), 'clear trigger');
                const toggle = await settledBox(pw('visibility-trigger'), 'visibility trigger');
                expect(inside(clear, pwControl), 'clear trigger inside the control').toBe(true);
                expect(inside(toggle, pwControl), 'visibility trigger inside the control').toBe(true);
                expect(before(pwInput, clear), 'clear trigger follows the input').toBe(true);
                expect(before(clear, toggle), 'the triggers keep their written order').toBe(true);
            });
        }
    }
});

// #467: an icon and affix text are different parts, so Material lays them
// out apart instead of guessing from the content. A leading icon moves the
// resting label past it and is centred in the box; affix text sits on the
// input's text line, never moves the label, and shows only once the label has
// floated.
test.describe('material: icon vs affix', () => {
    test.beforeEach(async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'chromium', 'layout: one engine is enough');
        await bootPage(page, 'input', 'material');
    });

    const labelX = async (page: Page, parts: ReturnType<typeof website>) => {
        const control = await settledBox(parts('control'), 'control');
        const label = await settledBox(parts('label'), 'label');
        return label.x - control.x;
    };

    test('a leading icon moves the resting label past it; a trailing suffix does not move it', async ({ page }) => {
        const searchParts = search(page);
        const weightParts = weight(page);
        // Both rest: empty and unfocused.
        await searchParts('input').fill('');
        await page.locator('body').click({ position: { x: 1, y: 1 } });
        await expect(rootLabelled(page, 'input', 'Search docs')).toHaveAttribute('data-placeholder', '');
        await expect(rootLabelled(page, 'input', 'Weight')).toHaveAttribute('data-placeholder', '');
        const withIcon = await labelX(page, searchParts);
        const withSuffix = await labelX(page, weightParts);
        expect(withIcon - withSuffix, 'the icon pushes the label 36dp further in').toBeGreaterThan(30);
    });

    test('an icon is centred in the box; affix text shares the input\'s text line', async ({ page }) => {
        const searchParts = search(page);
        const control = await settledBox(searchParts('control'), 'search control');
        const icon = await settledBox(searchParts('adornment'), 'search icon');
        const mid = (b: { y: number; height: number }) => b.y + b.height / 2;
        expect(Math.abs(mid(icon) - mid(control)), 'icon centred on the box').toBeLessThanOrEqual(1);

        const site = website(page);
        const prefix = site('affix').filter({ hasText: 'https://' });
        const textMidOf = (loc: Locator) => loc.evaluate((el) => {
            const r = document.createRange();
            r.selectNodeContents(el);
            const rect = r.getBoundingClientRect();
            return rect.y + rect.height / 2;
        });
        const input = await settledBox(site('input'), 'website input');
        const inputStyle = await site('input').evaluate((el) => {
            const cs = getComputedStyle(el);
            return { top: parseFloat(cs.paddingTop), bottom: parseFloat(cs.paddingBottom) };
        });
        const textMid = input.y + inputStyle.top + (input.height - inputStyle.top - inputStyle.bottom) / 2;
        expect(Math.abs((await textMidOf(prefix)) - textMid), 'prefix on the text line').toBeLessThanOrEqual(2);
    });

    test('an affix paints only once the label has floated', async ({ page }) => {
        const parts = weight(page);
        const suffix = parts('affix');
        await expect(rootLabelled(page, 'input', 'Weight')).toHaveAttribute('data-placeholder', '');
        await expect(suffix).toHaveCSS('opacity', '0');
        await parts('input').focus();
        await expect(suffix).toHaveCSS('opacity', '1');
        await page.keyboard.type('72');
        await page.locator('body').click({ position: { x: 1, y: 1 } });
        await expect(parts('input')).not.toBeFocused();
        await expect(suffix).toHaveCSS('opacity', '1');
    });
});

// #446: a search field draws zero's ClearTrigger and clears on Escape, so the
// engine's own `::-webkit-search-cancel-button` would be a second clear beside
// it. Chromium does not reflect that pseudo-element in getComputedStyle, so the
// claim is made in pixels: force-hiding it must change nothing the skin paints.
test.describe('native search cancel button', () => {
    const forceHide = (sel: string) => `${sel}::-webkit-search-cancel-button{display:none!important}`;

    for (const ds of DESIGN_SYSTEMS) {
        test(`${ds}: a search field paints no native cancel button`, async ({ page }, testInfo) => {
            test.skip(testInfo.project.name !== 'chromium', 'a -webkit- pseudo-element: one engine is enough');
            await bootPage(page, 'input', ds);

            // Precondition, so the comparison below cannot pass vacuously: on
            // a bare, unstyled search input with a value, the engine does paint
            // its button, and force-hiding it changes the pixels.
            await page.evaluate(() => {
                const bare = document.createElement('input');
                bare.type = 'search';
                bare.id = 'bare-search-446';
                bare.value = 'abc';
                bare.style.caretColor = 'transparent';
                document.body.prepend(bare);
            });
            const bare = page.locator('#bare-search-446');
            await bare.focus();
            await settledBox(bare, 'bare search input');
            const bareShown = await bare.screenshot({ animations: 'disabled' });
            const bareStyle = await page.addStyleTag({ content: forceHide('#bare-search-446') });
            const bareHidden = await bare.screenshot({ animations: 'disabled' });
            expect(bareShown.equals(bareHidden), 'the engine paints a cancel button on a bare search input').toBe(false);
            await bareStyle.evaluate((el) => (el as Element).remove());
            await bare.evaluate((el) => el.remove());

            const input = search(page)('input');
            await input.focus();
            await page.keyboard.press('End');
            await page.keyboard.type(' x');
            await expect(input).toHaveValue('anatomy x');
            // The caret blinks; keep it out of both frames.
            await input.evaluate((el) => { (el as HTMLElement).style.caretColor = 'transparent'; });
            await settledBox(input, 'search input');
            const skinned = await input.screenshot({ animations: 'disabled' });
            await page.addStyleTag({ content: forceHide('input') });
            const forced = await input.screenshot({ animations: 'disabled' });
            expect(skinned.equals(forced), 'force-hiding the native cancel button changes nothing').toBe(true);
        });
    }
});
