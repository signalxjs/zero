/**
 * Input's affordances in real engines (#281).
 *
 * happy-dom holds the wiring — the parts, the names, the model writes. What
 * only a browser can show is focus and layout: a press on an adornment moves
 * focus into the input without selecting the adornment's text, a press on the
 * clear trigger never takes focus away from the field at all, the keyboard
 * path skips the (untabbable) clear trigger and lands on the visibility
 * toggle, and the control's row puts every affordance at the edge it names —
 * the reading-direction edge, since the recipes order with `order` and
 * logical padding rather than physical margins.
 *
 * Behaviour on three engines against one skin; the layout on chromium
 * against every skin, in both directions.
 */
import { test, expect, type Page } from '@playwright/test';
import { demoLabelled, DESIGN_SYSTEMS, settledBox } from './demo';
import { bootPage } from './nav';

const search = (page: Page) => demoLabelled(page, 'input', 'Search docs');
const password = (page: Page) => demoLabelled(page, 'input', 'New password');
const website = (page: Page) => demoLabelled(page, 'input', 'Website');

const media = (name: string) => name === 'reduced-motion' || name === 'forced-colors';

test.describe('behaviour', () => {
    test.beforeEach(async ({ page }, testInfo) => {
        test.skip(media(testInfo.project.name), 'engine behaviour, not a media feature');
        await bootPage(page, 'input', 'basic');
    });

    test('a press on an adornment focuses the input, and typing lands in it', async ({ page }) => {
        const parts = website(page);
        const input = parts('input');
        await parts('adornment').filter({ hasText: 'https://' }).click();
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
                const start = await settledBox(site('adornment').filter({ hasText: 'https://' }), 'start adornment');
                const end = await settledBox(site('adornment').filter({ hasText: '.com' }), 'end adornment');
                for (const [what, box] of [['start adornment', start], ['end adornment', end], ['input', input]] as const) {
                    expect(inside(box, control), `${what} inside the control`).toBe(true);
                }
                expect(before(start, input), 'start adornment precedes the input in reading order').toBe(true);
                expect(before(input, end), 'end adornment follows the input in reading order').toBe(true);

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
