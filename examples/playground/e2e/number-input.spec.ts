/**
 * NumberInput spin triggers in real engines.
 *
 * What the unit suite (fake timers, synthetic events) cannot prove: the
 * hold-to-repeat cadence against real timers, that a press released
 * OFF-element stops the spin via the window listener, and that the opt-in
 * wheel really is focus-gated in a real event pipeline.
 */
import { test, expect } from '@playwright/test';
import { demoLabelled, settledBox } from './demo';
import { bootPage } from './nav';

test.beforeEach(async ({ page }) => {
    await bootPage(page, 'number-input', 'basic');
});

/**
 * The two demos this spec drives, each named by its own label rather than by
 * where it happens to sit.
 *
 * The NumberInput page renders five (quantity, price, disabled, readonly,
 * invalid) and will render more. `roots.first()` / `roots.nth(1)` only pointed
 * at these two because every addition so far happened to be APPENDED — prepend
 * one and `nth(1)` silently becomes a different control while the comment next
 * to it still says "the allowWheel demo". The label is this instance's
 * identity; its index is not. See `demo.ts`.
 */
const qty = (page: import('@playwright/test').Page) =>
    demoLabelled(page, 'number-input', 'Quantity');
/** The one that opts into the wheel — `allowWheel`, step 0.1, formatted. */
const price = (page: import('@playwright/test').Page) =>
    demoLabelled(page, 'number-input', 'Price');

test('holding the increment trigger auto-repeats and release stops it', async ({ page }) => {
    const input = qty(page)('input');
    const inc = qty(page)('increment-trigger');
    await expect(input).toHaveValue('2');

    // hover() auto-scrolls the trigger into the viewport — raw page.mouse
    // coordinates are viewport-relative and never scroll on their own.
    await inc.hover();
    await page.mouse.down();
    // One immediate spin, then repeats after the 400ms delay.
    await expect(input).toHaveValue('3');
    await page.waitForTimeout(700);
    await page.mouse.up();
    const held = Number(await input.inputValue());
    expect(held).toBeGreaterThan(3);
    // Released: the value must not keep climbing.
    await page.waitForTimeout(400);
    expect(Number(await input.inputValue())).toBe(held);
});

test('a press released off-element stops the spin (window listener)', async ({ page }) => {
    const input = qty(page)('input');
    const inc = qty(page)('increment-trigger');

    await inc.hover();
    const box = await settledBox(inc, 'the quantity increment trigger');
    await page.mouse.down();
    // Drag off the trigger and release somewhere else entirely.
    await page.mouse.move(box.x + box.width / 2, box.y - 200, { steps: 3 });
    await page.mouse.up();
    const after = Number(await input.inputValue());
    await page.waitForTimeout(600);
    expect(Number(await input.inputValue())).toBe(after);
});

test('wheel steps only the focused opt-in input', async ({ page }) => {
    const priceInput = price(page)('input');
    await expect(priceInput).toHaveValue('19.90');

    // Unfocused: wheel scrolls, value holds.
    await priceInput.hover();
    await page.mouse.wheel(0, -120);
    await expect(priceInput).toHaveValue('19.90');

    await priceInput.click();
    await priceInput.hover();
    await page.mouse.wheel(0, -120);
    await expect(priceInput).toHaveValue('20.00');

    // The quantity input (no allowWheel) never wheel-steps, focused or not.
    const qtyInput = qty(page)('input');
    await qtyInput.click();
    await qtyInput.hover();
    await page.mouse.wheel(0, -120);
    await expect(qtyInput).toHaveValue('2');
});

test('typed drafts commit on blur with clamp and revert on garbage', async ({ page }) => {
    const input = qty(page)('input');
    await input.fill('120');
    await input.blur();
    await expect(input).toHaveValue('99'); // max clamp
    await input.fill('abc');
    await input.blur();
    await expect(input).toHaveValue('99'); // revert to last committed
});
