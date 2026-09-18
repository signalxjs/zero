/**
 * RatingGroup half-star pointer math in real engines — the part happy-dom
 * cannot prove: `getBoundingClientRect` is real here, so the left half of a
 * symbol must commit index − 0.5 and the right half the full index, and the
 * whole mapping must flip under RTL.
 *
 * Plus the other thing only a real engine can answer: whether the default
 * symbol has font coverage at all (#222).
 */
import { test, expect } from '@playwright/test';
import { demoPosting, rootPosting, settledBox } from './demo';
import { bootPage } from './nav';

/**
 * The halves demo, named by the field it posts (`name="stars"`).
 *
 * The RatingGroup page renders four — halves, whole-stars-deselectable,
 * a readonly average and an invalid one — and `.first()` picked this one only
 * because it happens to come first. The posted field name is the instance's
 * identity; its position is not. See `demo.ts`.
 */
const halvesParts = (page: import('@playwright/test').Page) =>
    demoPosting(page, 'rating-group', 'stars');
const halves = (page: import('@playwright/test').Page) =>
    rootPosting(page, 'rating-group', 'stars');
const hidden = (page: import('@playwright/test').Page) => halvesParts(page)('hidden-input');
// Positional, deliberately: `n` indexes THIS group's own five symbols, which
// is what "the third star" means. That is the convention's carve-out, not a
// reach across demos.
const item = (page: import('@playwright/test').Page, n: number) =>
    halvesParts(page)('item').nth(n - 1);

/** Boot the RatingGroup page with one design system pinned. */
const pin = (ds: string) => async ({ page }: { page: import('@playwright/test').Page }) => {
    await bootPage(page, 'rating-group', ds);
};

test.describe('half-star pointer and keyboard math', () => {
    test.beforeEach(pin('basic'));

    test('the left half of a star commits index − 0.5, the right half the index', async ({ page }) => {
        const third = item(page, 3);
        await third.scrollIntoViewIfNeeded();
        const box = await settledBox(third, 'the third star');
        await page.mouse.click(box.x + box.width * 0.25, box.y + box.height / 2);
        await expect(hidden(page)).toHaveValue('2.5');
        await expect(third).toHaveAttribute('data-state', 'half');

        await page.mouse.click(box.x + box.width * 0.75, box.y + box.height / 2);
        await expect(hidden(page)).toHaveValue('3');
        await expect(third).toHaveAttribute('data-state', 'full');
    });

    test('hover previews the fill without committing', async ({ page }) => {
        const fifth = item(page, 5);
        await fifth.scrollIntoViewIfNeeded();
        const box = await settledBox(fifth, 'the fifth star');
        await page.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2);
        await expect(fifth).toHaveAttribute('data-state', 'full');
        await expect(fifth).toHaveAttribute('data-highlighted', '');
        // The committed value did not move (playground model starts at 3.5).
        await expect(hidden(page)).toHaveValue('3.5');
        // Leaving the control restores the committed display.
        await page.locator('h1').hover();
        await expect(fifth).toHaveAttribute('data-state', 'empty');
    });

    test('RTL flips the half mapping', async ({ page }) => {
        await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
        const third = item(page, 3);
        await third.scrollIntoViewIfNeeded();
        const box = await settledBox(third, 'the third star (RTL)');
        // Visual LEFT half is now the FULL side (reading direction runs
        // right-to-left), and the right half is the half-step.
        await page.mouse.click(box.x + box.width * 0.25, box.y + box.height / 2);
        await expect(hidden(page)).toHaveValue('3');
        await page.mouse.click(box.x + box.width * 0.75, box.y + box.height / 2);
        await expect(hidden(page)).toHaveValue('2.5');
    });

    test('keyboard steps the value and the tab stop follows', async ({ page }) => {
        const second = item(page, 2);
        await second.scrollIntoViewIfNeeded();
        // Focus the current tab stop (ceil(3.5) = item 4) via keyboard-visible path.
        await item(page, 4).focus();
        await page.keyboard.press('ArrowUp');
        await expect(hidden(page)).toHaveValue('4');
        await page.keyboard.press('End');
        await expect(hidden(page)).toHaveValue('5');
        await expect(item(page, 5)).toBeFocused();
        await page.keyboard.press('Home');
        await expect(hidden(page)).toHaveValue('0.5');
        await expect(item(page, 1)).toBeFocused();
    });
});

/**
 * The default symbol must actually be in the font (#222).
 *
 * Pinned to `material` on purpose. Four of the six design systems retire the
 * runtime's text symbol outright (`font-size: 0`, or a transparent fill), so
 * measuring it there proves nothing — `basic`, which the block above uses, is
 * one of them. `material` and `daisyui` are the two that still PAINT the
 * symbol and merely halve it (a hard-stop gradient under `background-clip:
 * text` here, a `mask-size: 50% 100%` there), so on those two an unmapped
 * codepoint is visibly on screen — and halving a tofu box yields half a tofu
 * box.
 *
 * The instrument is the one from the issue, and the only one that works:
 * `document.fonts.check()` consults `@font-face` rules and returns true for
 * anything, so instead measure the glyph's advance width in the item's OWN
 * computed font and compare it against U+10FFFD, a guaranteed-unmapped
 * codepoint. Equal widths mean both resolved to the same last-resort glyph.
 *
 * It runs on EVERY engine, deliberately. Font coverage is a property of the
 * platform's font stack as each engine resolves it, so a glyph that resolves
 * in Chromium but tofus in Firefox or WebKit is exactly the defect class this
 * test exists to catch — measuring only the baseline lane would be blind to
 * it.
 *
 * The one exception is the `forced-colors` project, which returns an EMPTY
 * computed `font` shorthand (found by running it there). There is no honest
 * way around that: the only alternative is reassembling the shorthand from
 * `fontStyle`/`fontWeight`/`fontSize`/`fontFamily` by hand, and an invalid
 * `ctx.font` assignment is silently IGNORED rather than throwing — so a string
 * that failed to parse would leave this measuring some other font entirely and
 * make the gate incapable of failing. Better to skip the one project than to
 * run a test there that cannot fail.
 *
 * One measured caveat, so nobody mistakes a green Firefox run for coverage:
 * re-running this against a deliberately restored U+2BEA build failed on
 * chromium, webkit and reduced-motion — and PASSED on firefox, whose advance
 * width for `⯪` does NOT equal its unmapped-codepoint control. The width
 * comparison therefore has no teeth on that engine; what catches the
 * regression there is the `glyph` equality below, which failed on all five
 * projects. Both assertions are load-bearing — do not drop either.
 */
test.describe('the default symbol resolves to a real glyph', () => {
    test.beforeEach(pin('material'));

    test('every state\'s symbol measures differently from an unmapped codepoint', async ({ page }, testInfo) => {
        test.skip(testInfo.project.name === 'forced-colors',
            'forced-colors returns an empty computed font shorthand — see the block comment');
        // The playground's first rating is 3.5: 1–3 full, 4 half, 5 empty.
        await expect(item(page, 4)).toHaveAttribute('data-state', 'half');

        const measured = await halves(page).evaluate((root) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d')!;
            const UNMAPPED = '\u{10FFFD}';
            return [...root.querySelectorAll<HTMLElement>('[data-part="item"]')].map((el) => {
                const cs = getComputedStyle(el);
                // The computed `font` SHORTHAND, never one reassembled by hand:
                // an invalid `ctx.font` assignment is silently IGNORED (the
                // canvas keeps its previous font rather than throwing), which
                // would leave this measuring some other font entirely and make
                // the whole gate incapable of failing. The asserted
                // `size`/`applied` pair below is what proves it took.
                ctx.font = cs.font;
                const glyph = el.textContent ?? '';
                return {
                    state: el.getAttribute('data-state'),
                    glyph,
                    children: el.children.length,
                    computed: cs.font,
                    size: cs.fontSize,
                    applied: ctx.font,
                    width: ctx.measureText(glyph).width,
                    unmapped: ctx.measureText(UNMAPPED).width,
                };
            });
        });

        expect(measured.map((m) => m.state))
            .toEqual(['full', 'full', 'full', 'half', 'empty']);
        // A bare text node in every state — design systems gate their drawn
        // geometry on `:not(:has(> *))` / `:has(*)`, so the default must never
        // become an element.
        expect(measured.map((m) => m.children)).toEqual([0, 0, 0, 0, 0]);
        expect(measured.map((m) => m.glyph)).toEqual(['★', '★', '★', '★', '☆']);

        for (const m of measured) {
            // The instrument is wired up: the element HAS a computed shorthand,
            // the canvas ACCEPTED it (it is no longer at its `10px sans-serif`
            // default), and what it accepted carries the item's own size. Fail
            // here rather than measure a font nobody is looking at.
            expect(m.computed, `${m.state}: no computed font shorthand`).not.toBe('');
            expect(m.applied, `${m.state}: canvas kept its default font`).not.toBe('10px sans-serif');
            // Compared as a NUMBER: the canvas re-serialises what it accepted
            // and rounds (`20.249599px` comes back as `20.2496px`), so a
            // substring match would fail on the serialisation, not the fact.
            expect(parseFloat(m.applied), `${m.state}: canvas font ${m.applied} is not the item's ${m.size}`)
                .toBeCloseTo(parseFloat(m.size), 2);
            expect(m.width).toBeGreaterThan(0);
            // The load-bearing assertion: `⯪` (U+2BEA) measured EXACTLY the
            // unmapped width in all six design systems before the fix.
            expect(Math.abs(m.width - m.unmapped),
                `${m.state} symbol ${JSON.stringify(m.glyph)} measured the unmapped width in ${m.applied}`)
                .toBeGreaterThan(0.01);
        }
    });
});
