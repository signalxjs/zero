/**
 * Textarea autosize in real engines (#88).
 *
 * happy-dom can check that `data-autosize` and the row bounds are written; it
 * has no layout, so only a browser can show the box actually grows — with
 * soft wraps as well as newlines — floors at `minRows`, stops at `maxRows`
 * and scrolls past it, and shrinks back when the model is cleared from
 * outside an input event.
 *
 * Measured in rows rather than pixels: the rendered box less its block
 * padding and border, over the element's own computed `line-height`. That
 * holds whether the skin made the element `border-box` or `content-box` —
 * the difference `--textarea-block-chrome` exists to absorb.
 *
 * Three engines on one skin for the behavior, then every skin on chromium
 * for the bounds (a skin's padding, border and `box-sizing` are what vary).
 * The last test forces the measured fallback by reporting `field-sizing` as
 * unsupported, so the inline height `createAutosize` writes is held to the
 * same bounds in a real layout engine.
 */
import { test, expect, type Locator, type Page } from '@playwright/test';
import { demoLabelled } from './demo';
import { bootPage } from './nav';

const DESIGN_SYSTEMS = ['basic', 'daisyui', 'material', 'brutalist', 'heroui', 'carbon'] as const;
const DEMO = 'Composer (1–5 rows)';

const composer = (page: Page): Locator => demoLabelled(page, 'textarea', DEMO)('textarea');

/** The box height in rows of the element's own line height, chrome removed. */
async function rows(el: Locator): Promise<number> {
    await expect(el).toBeVisible();
    return el.evaluate((node) => {
        const cs = getComputedStyle(node);
        const px = (v: string) => Number.parseFloat(v) || 0;
        const chrome = px(cs.paddingTop) + px(cs.paddingBottom) + px(cs.borderTopWidth) + px(cs.borderBottomWidth);
        const lh = px(cs.lineHeight);
        return (node.getBoundingClientRect().height - chrome) / lh;
    });
}

async function expectRows(el: Locator, n: number, what: string): Promise<void> {
    await expect.poll(() => rows(el), { message: `${what}: expected ${n} row(s)` }).toBeCloseTo(n, 1);
}

async function expectScrolls(el: Locator, scrolls: boolean): Promise<void> {
    await expect.poll(() => el.evaluate((node) => node.scrollHeight > node.clientHeight + 1)).toBe(scrolls);
}

test('grows with newlines and soft wraps, stops at maxRows, and shrinks when cleared', async ({ page }) => {
    await bootPage(page, 'textarea', 'basic');
    const el = composer(page);
    await expect(el).toHaveAttribute('data-autosize', '');

    await expectRows(el, 1, 'empty');
    await el.click();
    await page.keyboard.type('one');
    await page.keyboard.press('Enter');
    await page.keyboard.type('two');
    await page.keyboard.press('Enter');
    await page.keyboard.type('three');
    await expectRows(el, 3, 'three lines');
    await expectScrolls(el, false);

    for (const line of ['four', 'five', 'six', 'seven']) {
        await page.keyboard.press('Enter');
        await page.keyboard.type(line);
    }
    await expectRows(el, 5, 'seven lines, clamped at maxRows');
    await expectScrolls(el, true);

    // A model write from outside an input event — the composer's send.
    await page.getByRole('button', { name: 'Clear draft' }).click();
    await expect(el).toHaveValue('');
    await expectRows(el, 1, 'cleared');

    // One long line, no newline: counting newlines into `rows` misses this.
    await el.fill('word '.repeat(60).trim());
    await expect.poll(() => rows(el)).toBeGreaterThan(1.9);
    await expect(el).toHaveCSS('resize', 'none');
});

// An app's global `box-sizing: border-box` reset (Tailwind's preflight, most
// CSS resets) is the case CSS alone gets wrong: `N * 1lh` would then include
// the padding and border, and every bound would come up short by them.
const BORDER_BOX_RESET = '*, ::before, ::after { box-sizing: border-box; }';

for (const ds of DESIGN_SYSTEMS) for (const reset of [false, true]) {
    const how = reset ? 'under a border-box reset' : 'as shipped';
    test(`${ds}: the row bounds hold whatever the skin's padding and box-sizing (${how})`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'chromium', 'cascade and box facts — one engine is enough');
        await bootPage(page, 'textarea', ds);
        if (reset) await page.addStyleTag({ content: BORDER_BOX_RESET });
        const el = composer(page);
        if (reset) await expect(el).toHaveCSS('box-sizing', 'border-box');
        await expectRows(el, 1, `${ds} empty`);
        await el.fill(['1', '2', '3'].join('\n'));
        await expectRows(el, 3, `${ds} three lines`);
        await el.fill(['1', '2', '3', '4', '5', '6', '7', '8'].join('\n'));
        await expectRows(el, 5, `${ds} eight lines`);
    });
}

test('the measured fallback holds the same bounds where field-sizing is unsupported', async ({ page }) => {
    await page.addInitScript(() => {
        const supports = CSS.supports.bind(CSS);
        CSS.supports = ((...args: [string, string?]) =>
            (args[0] === 'field-sizing' ? false : supports(...(args as [string, string])))) as typeof CSS.supports;
    });
    await bootPage(page, 'textarea', 'basic');
    const el = composer(page);
    await expectRows(el, 1, 'fallback empty');
    await el.click();
    for (const [i, line] of ['one', 'two', 'three'].entries()) {
        if (i) await page.keyboard.press('Enter');
        await page.keyboard.type(line);
    }
    // The inline height is the fallback's own — the native path writes none.
    await expect.poll(() => el.evaluate((node) => (node as HTMLElement).style.height)).not.toBe('');
    await expectRows(el, 3, 'fallback three lines');
    await el.fill(['1', '2', '3', '4', '5', '6', '7', '8'].join('\n'));
    await expectRows(el, 5, 'fallback eight lines');
    await page.getByRole('button', { name: 'Clear draft' }).click();
    await expectRows(el, 1, 'fallback cleared');
});
