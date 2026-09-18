/**
 * Diff — the divider under a real pointer, real keyboard, and real RTL.
 *
 * The unit suite proves the value model and the ARIA; this spec proves the
 * geometry: a drag moves the REVEAL (the after pane's painted width, not
 * just an attribute), keyboard steps land, and RTL mirrors — which must be
 * measured in rendered boxes, because the reveal is a logical
 * `inline-size` and a physically-spelled regression would be invisible to
 * the direction lint (AGENTS.md's transform blind spot).
 */
import { test, expect, type Page } from '@playwright/test';
import { bootPage } from './nav';
import { demoLabelled, rootLabelled, settledBox } from './demo';

test.beforeEach(async ({ page }) => {
    await bootPage(page, 'diff', 'basic');
});

/** The 50% demo — the page renders a second instance starting at 25%. */
const demo = (page: Page) => demoLabelled(page, 'diff', 'Before');
const rootOf = (page: Page) => rootLabelled(page, 'diff', 'Before');

const afterWidth = (page: Page) =>
    demo(page)('after').evaluate((el) => el.getBoundingClientRect().width);

test('a pointer drag on the handle moves the reveal with the pointer', async ({ page }) => {
    const handle = demo(page)('handle');
    await handle.scrollIntoViewIfNeeded();
    const root = await settledBox(rootOf(page), 'the diff root');
    const start = await afterWidth(page);
    expect(Math.round(start)).toBeGreaterThan(0);

    const box = await settledBox(handle, 'the diff handle');
    const cy = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width / 2, cy);
    await page.mouse.down();
    // Drag to 80% of the root — and leave the box vertically: the window
    // listeners must keep the drag alive.
    await page.mouse.move(root.x + root.width * 0.8, cy + 80, { steps: 8 });
    await page.mouse.up();

    const end = await afterWidth(page);
    // The reveal followed the pointer: ~80% of the root's width.
    expect(end / root.width).toBeGreaterThan(0.7);
    expect(end / root.width).toBeLessThan(0.9);
    await expect(demo(page)('handle')).toHaveAttribute('aria-valuenow', /^(7[0-9]|8[0-9])$/);
});

test('keyboard steps the reveal per APG', async ({ page }) => {
    const handle = demo(page)('handle');
    await handle.focus();
    await expect(handle).toHaveAttribute('aria-valuenow', '50');

    await page.keyboard.press('ArrowRight');
    await expect(handle).toHaveAttribute('aria-valuenow', '51');
    await page.keyboard.press('PageDown');
    await expect(handle).toHaveAttribute('aria-valuenow', '41');
    await page.keyboard.press('End');
    await expect(handle).toHaveAttribute('aria-valuenow', '100');
    const root = await settledBox(rootOf(page), 'the diff root');
    await expect.poll(() => afterWidth(page)).toBeGreaterThan(root.width * 0.95);
    await page.keyboard.press('Home');
    await expect(handle).toHaveAttribute('aria-valuenow', '0');
    await expect.poll(() => afterWidth(page)).toBeLessThan(root.width * 0.05);
});

test('RTL mirrors the reveal and the keys, measured in boxes', async ({ page }) => {
    // Set dir AFTER boot — an addInitScript runs before documentElement
    // exists and the attribute is silently lost (the rtl.spec scar).
    await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));

    const root = await settledBox(rootOf(page), 'the diff root (RTL)');
    const after = demo(page)('after');
    const afterBox = await settledBox(after, 'the after pane (RTL)');
    // The reveal grows from the READING edge — the right, in RTL: the pane
    // hugs the root's right edge.
    expect(Math.abs((afterBox.x + afterBox.width) - (root.x + root.width))).toBeLessThan(2);

    // The handle sits at 50%; ArrowRight DECREASES in RTL, so the handle
    // moves physically right — the way the key points.
    const handle = demo(page)('handle');
    await handle.focus();
    const before = await settledBox(handle, 'the handle before the key (RTL)');
    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight');
    await expect(handle).toHaveAttribute('aria-valuenow', '40');
    const moved = await settledBox(handle, 'the handle after the keys (RTL)');
    expect(moved.x).toBeGreaterThan(before.x + 5);
});
