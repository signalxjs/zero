/**
 * Swipe to dismiss (#293), under a real pointer and real layout.
 *
 * The unit suite drives `createSwipe` with synthetic events; what only an
 * engine can say is whether the gesture survives real pointer capture, text
 * selection and top-layer hit testing, and whether each design system's
 * recipe actually moves the part with the published `--swipe-*` offset. So
 * the claims are measured in boxes:
 *
 * - in every design system, a toast and a bottom sheet FOLLOW the pointer
 *   along the dismiss axis mid-drag (the recipe composed the offset into the
 *   part's `transform`, and suppressed its transition while `data-swiping`),
 *   and a short, slow drag lets go back to where the part started;
 * - a drag past the threshold dismisses, and the close reports `swipe`;
 * - under `dir="rtl"` an end-side toast is swiped toward the END — leftward.
 *
 * Chromium and WebKit, as the issue scopes it: the gesture is pointer events
 * and a transform, which the three engines share, and those two are the ones
 * with the touch-first users a swipe is for.
 */
import { test, expect, type Page, type Locator } from '@playwright/test';
import { bootPage } from './nav';
import { DESIGN_SYSTEMS, controlledPopup, rootLabelled, settledBox } from './demo';

test.beforeEach(({ browserName }, testInfo) => {
    test.skip(
        !['chromium', 'webkit'].includes(testInfo.project.name),
        `chromium and webkit only (${browserName}, #293)`,
    );
});

type Point = { x: number; y: number };

const centreOf = (b: { x: number; y: number; width: number; height: number }): Point =>
    ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

/** Press at `from` and move to `to` in small steps, leaving the button down. */
async function press(page: Page, from: Point, to: Point): Promise<void> {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
}

/** A swiped toast: the one the demo raises, which never times out on its own. */
async function raiseToast(page: Page): Promise<Locator> {
    await page.getByRole('button', { name: 'Swipeable toast', exact: true }).click();
    const root = rootLabelled(page, 'toast', 'Swipe me away');
    await expect(root).toHaveAttribute('data-state', 'open');
    return root;
}

async function openBottomSheet(page: Page): Promise<Locator> {
    const trigger = page.getByRole('button', { name: 'Open bottom sheet', exact: true });
    await trigger.click();
    const panel = await controlledPopup(page, trigger, 'the bottom sheet trigger');
    await expect(panel).toHaveAttribute('data-state', 'open');
    return panel;
}

for (const ds of DESIGN_SYSTEMS) {
    test(`${ds}: a toast follows the pointer toward its edge and springs back from a short drag`, async ({ page }) => {
        await bootPage(page, 'toast', ds);
        const root = await raiseToast(page);
        const title = root.locator('[data-scope="toast"][data-part="title"]');
        const rest = await settledBox(root, `${ds} toast at rest`);
        const grab = centreOf(await settledBox(title, `${ds} toast title`));

        // bottom-end in a left-to-right document: the swipe goes right.
        await press(page, grab, { x: grab.x + 40, y: grab.y });
        await expect(root).toHaveAttribute('data-swiping', '');
        const mid = await root.boundingBox();
        expect(mid, `${ds}: the toast has a box mid-drag`).not.toBeNull();
        expect(mid!.x - rest.x, `${ds}: the toast tracks the pointer`).toBeGreaterThan(30);
        expect(Math.abs(mid!.y - rest.y), `${ds}: and only along the dismiss axis`).toBeLessThanOrEqual(1);

        // Slow enough to be no flick, short of the threshold: it goes back.
        await page.mouse.move(grab.x + 30, grab.y, { steps: 4 });
        await page.waitForTimeout(450);
        await page.mouse.up();
        await expect(root).not.toHaveAttribute('data-swiping', '');
        await expect(root).toHaveAttribute('data-state', 'open');
        const back = await settledBox(root, `${ds} toast after the spring back`);
        expect(Math.abs(back.x - rest.x), `${ds}: the toast is back where it started`).toBeLessThanOrEqual(1);
        await root.locator('[data-scope="toast"][data-part="close"]').click();
        await expect(root).toHaveCount(0);
    });

    test(`${ds}: a bottom sheet follows the pointer down and springs back from a short drag`, async ({ page }) => {
        await bootPage(page, 'drawer', ds);
        const panel = await openBottomSheet(page);
        const rest = await settledBox(panel, `${ds} bottom sheet at rest`);
        const title = panel.locator('[data-scope="drawer"][data-part="title"]');
        const grab = centreOf(await settledBox(title, `${ds} bottom sheet title`));

        await press(page, grab, { x: grab.x, y: grab.y + 40 });
        await expect(panel).toHaveAttribute('data-swiping', '');
        const mid = await panel.boundingBox();
        expect(mid, `${ds}: the sheet has a box mid-drag`).not.toBeNull();
        expect(mid!.y - rest.y, `${ds}: the sheet tracks the pointer`).toBeGreaterThan(30);
        expect(Math.abs(mid!.x - rest.x), `${ds}: and only along the dismiss axis`).toBeLessThanOrEqual(1);

        await page.mouse.move(grab.x, grab.y + 30, { steps: 4 });
        await page.waitForTimeout(450);
        await page.mouse.up();
        await expect(panel).not.toHaveAttribute('data-swiping', '');
        await expect(panel).toHaveAttribute('data-state', 'open');
        const back = await settledBox(panel, `${ds} bottom sheet after the spring back`);
        expect(Math.abs(back.y - rest.y), `${ds}: the sheet is back where it started`).toBeLessThanOrEqual(1);
    });
}

test('a swipe past the threshold dismisses a toast, reported as `swipe`', async ({ page }) => {
    await bootPage(page, 'toast', 'basic');
    const root = await raiseToast(page);
    const grab = centreOf(await settledBox(root.locator('[data-scope="toast"][data-part="title"]'), 'the toast title'));
    await press(page, grab, { x: grab.x + 150, y: grab.y });
    await page.mouse.up();
    await expect(root).toHaveCount(0);
    await expect(page.locator('output[aria-label="Last swipeable toast dismissal"]')).toHaveText('Dismissed by: swipe');
});

test('a swipe past the threshold closes a bottom sheet, reported as `swipe`', async ({ page }) => {
    await bootPage(page, 'drawer', 'basic');
    const panel = await openBottomSheet(page);
    const grab = centreOf(await settledBox(panel.locator('[data-scope="drawer"][data-part="title"]'), 'the sheet title'));
    await press(page, grab, { x: grab.x, y: grab.y + 150 });
    await page.mouse.up();
    await expect(panel).toHaveAttribute('data-state', 'closed');
    await expect(panel).not.toBeVisible();
    await expect(page.locator('output[aria-label="Bottom sheet close reason"]')).toHaveText('Bottom sheet closed by: swipe');

    // The next opening starts from the edge, not from where the swipe let go.
    const again = await openBottomSheet(page);
    const box = await settledBox(again, 'the reopened sheet');
    const vh = await page.evaluate(() => window.innerHeight);
    expect(Math.abs(box.y + box.height - vh), 'the reopened sheet rests on the block end').toBeLessThanOrEqual(1);
});

test('under dir="rtl" an end-side toast is swiped toward the end — leftward', async ({ page }) => {
    await bootPage(page, 'toast', 'basic');
    // AFTER boot: an init script runs before documentElement exists.
    await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    const root = await raiseToast(page);
    const rest = await settledBox(root, 'the RTL toast at rest');
    const grab = centreOf(await settledBox(root.locator('[data-scope="toast"][data-part="title"]'), 'the RTL toast title'));

    // Rightward is AWAY from the end here: resisted, never a dismissal.
    await press(page, grab, { x: grab.x + 150, y: grab.y });
    const resisted = await root.boundingBox();
    expect(resisted!.x - rest.x, 'the wrong way gives a little, not the whole drag').toBeLessThan(30);
    await page.mouse.up();
    await expect(root).toHaveAttribute('data-state', 'open');

    await press(page, grab, { x: grab.x - 150, y: grab.y });
    const mid = await root.boundingBox();
    expect(rest.x - mid!.x, 'the toast follows the pointer toward the end').toBeGreaterThan(100);
    await page.mouse.up();
    await expect(root).toHaveCount(0);
    await expect(page.locator('output[aria-label="Last swipeable toast dismissal"]')).toHaveText('Dismissed by: swipe');
});
