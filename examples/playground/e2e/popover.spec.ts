/**
 * Popover — `popover="auto"` in real engines.
 *
 * The unit suite proves the state machine; this proves the parts the
 * platform and the focus behaviors own: the top layer actually showing, the
 * dialog-role focus move on open (#324's `focusFirst` — an unshown popover
 * cannot take focus, so the move is deferred past `showPopover()`), native
 * light dismiss and Escape, and focus restore to the trigger on close —
 * only while focus is still the popup's to hand back (#262). And the
 * geometry the strategy publishes for the arrow (#279): the arrow's tip over
 * the trigger's centre, on the edge facing it, in every skin — and still
 * over the trigger (and inside the popup) once the popup has been shifted
 * back from the viewport edge, which is the case a stylesheet alone cannot
 * get right. Plus `Popover.Anchor`: the popup lines up with it while the
 * trigger keeps focus restore.
 */
import { test, expect, type Page } from '@playwright/test';
import { bootPage } from './nav';
import { arrowGeometry, controlledPopup, demoPosting, DESIGN_SYSTEMS, settledBox } from './demo';

/**
 * The basic skin's demos in every engine — each test boots it (a describe of
 * its own, so the per-skin arrow tests below can boot theirs: init scripts
 * accumulate, and a file-wide boot would pin basic over them).
 */
test.describe('basic', () => {
    test.beforeEach(async ({ page }) => {
        await bootPage(page, 'popover', 'basic');
    });

    /**
     * `Popover.Root` renders no element, so the Filters demo is pinned by its
     * trigger's text and the popup resolves through `aria-controls` (`demo.ts`).
     */
    const trigger = (page: Page) => page.getByRole('button', { name: 'Filters', exact: true });

    test('open moves focus to the first tabbable inside the popup (#324)', async ({ page }) => {
        const t = trigger(page);
        await t.click();
        const popup = await controlledPopup(page, t, 'the Filters trigger');
        await expect(popup).toHaveAttribute('data-state', 'open');
        await expect(popup).toBeVisible();

        // APG dialog-role popup: focus moves in on open. The demo's first
        // tabbable is the Switch's native input — landing there (not on the
        // popup itself) proves focusFirst ran AND found the tabbable; the
        // popup's own tabIndex=-1 is only the fallback for tabbable-less
        // content.
        await expect(popup.locator('[data-scope="switch"][data-part="hidden-input"]')).toBeFocused();
    });

    test('Escape closes and focus returns to the trigger', async ({ page }) => {
        const t = trigger(page);
        // Keyboard open, so the trigger genuinely HOLDS focus before the popup
        // takes it — WebKit does not focus buttons on click, so a click-open
        // would leave the restore target as body and assert nothing.
        await t.focus();
        await page.keyboard.press('Enter');
        const popup = await controlledPopup(page, t, 'the Filters trigger');
        await expect(popup).toHaveAttribute('data-state', 'open');
        await page.keyboard.press('Escape');
        await expect(popup).toHaveAttribute('data-state', 'closed');
        await expect(popup).not.toBeVisible();
        await expect(t).toBeFocused();
    });

    test('a genuinely outside click light-dismisses', async ({ page }) => {
        const t = trigger(page);
        await t.click();
        const popup = await controlledPopup(page, t, 'the Filters trigger');
        await expect(popup).toHaveAttribute('data-state', 'open');
        // popover="auto": light dismiss is the platform's, not a zero handler.
        await page.locator('h1').click();
        await expect(popup).toHaveAttribute('data-state', 'closed');
    });

    test('an outside click into a text field light-dismisses and leaves focus in the field (#262)', async ({ page }) => {
        const t = trigger(page);
        // Keyboard open, so the trigger genuinely holds focus before the popup
        // takes it: a restore that ignored where focus went would pull it back
        // to a real target, not a no-op body (see the Escape test).
        await t.focus();
        await page.keyboard.press('Enter');
        const popup = await controlledPopup(page, t, 'the Filters trigger');
        await expect(popup).toHaveAttribute('data-state', 'open');
        await expect(popup.locator('[data-scope="switch"][data-part="hidden-input"]')).toBeFocused();

        const field = demoPosting(page, 'input', 'popover-search')('input');
        await field.click();
        await expect(popup).toHaveAttribute('data-state', 'closed');
        await expect(popup).not.toBeVisible();
        await expect(field).toBeFocused();
        // Not a momentary win: typing still lands in the field.
        await page.keyboard.type('abc');
        await expect(field).toHaveValue('abc');
        await expect(field).toBeFocused();
    });

    test('the Close button closes and restores focus to the trigger', async ({ page }) => {
        const t = trigger(page);
        // Keyboard open — see the Escape test for why (WebKit click focus).
        await t.focus();
        await page.keyboard.press('Enter');
        const popup = await controlledPopup(page, t, 'the Filters trigger');
        await expect(popup).toHaveAttribute('data-state', 'open');
        await popup.locator('[data-part="close"]', { hasText: 'Done' }).click();
        await expect(popup).toHaveAttribute('data-state', 'closed');
        await expect(t).toBeFocused();
    });

    test('the popup is a labelled dialog anchored under its trigger', async ({ page }) => {
        const t = trigger(page);
        await t.click();
        const popup = await controlledPopup(page, t, 'the Filters trigger');
        await expect(popup).toHaveAttribute('role', 'dialog');
        const titleId = await popup.locator('[data-part="title"]').getAttribute('id');
        expect(titleId).toBeTruthy();
        await expect(popup).toHaveAttribute('aria-labelledby', titleId!);
    });

    test.describe('Popover.Anchor', () => {
        test('the popup lines up with the anchor; the trigger toggles and gets focus back', async ({ page }) => {
            const t = page.getByRole('button', { name: 'Pick', exact: true });
            const anchor = page.locator('[data-scope="popover"][data-part="anchor"]', { has: t });
            await t.focus();
            await page.keyboard.press('Enter');
            const popup = await controlledPopup(page, t, 'the Pick trigger');
            await expect(popup).toHaveAttribute('data-state', 'open');
            const a = await settledBox(anchor, 'the anchor row');
            const b = await settledBox(t, 'the Pick trigger');
            const p = await settledBox(popup, 'the Pick popup');
            // bottom-start against the ROW: its start edge, not the button's
            // — below it, or above if the page end flipped it.
            expect(Math.abs(p.x - a.x)).toBeLessThanOrEqual(1);
            expect(b.x - a.x).toBeGreaterThan(40);
            const below = p.y >= a.y + a.height - 1;
            const above = p.y + p.height <= a.y + 1;
            expect(below || above, 'the popup sits off the row, not over it').toBe(true);
            // The description names the popup.
            const description = popup.locator('[data-part="description"]');
            await expect(popup).toHaveAttribute('aria-describedby', (await description.getAttribute('id'))!);

            await page.keyboard.press('Escape');
            await expect(popup).toHaveAttribute('data-state', 'closed');
            await expect(t).toBeFocused();
        });
    });
});

// ── Arrow (#279) ──

const centre = (b: { x: number; y: number; width: number; height: number }) =>
    ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

/** Open the popover whose trigger reads `name`; its popup and arrow, measured. */
async function openArrowed(page: Page, name: string) {
    const t = page.getByRole('button', { name, exact: true });
    await t.click();
    const popup = await controlledPopup(page, t, `the ${name} trigger`);
    await expect(popup).toHaveAttribute('data-state', 'open');
    const g = await arrowGeometry(popup, t, `the ${name} popup`);
    return { trigger: g.target, popup: g.popup, arrow: g.arrow, placement: g.placement };
}

test.describe('the arrow points at the trigger', () => {
    for (const ds of DESIGN_SYSTEMS) {
        test(`${ds}: below, and beside`, async ({ page }, testInfo) => {
            // The geometry is the kit's and the strategy's, the same in every
            // engine; what differs per skin is only the paint and its size.
            test.skip(testInfo.project.name !== 'chromium' && ds !== 'basic', 'one engine per skin; basic in all three');
            await bootPage(page, 'popover', ds);

            // Below — or above, where the skin's page runs taller and the
            // strategy flipped it: either way the arrow is on the edge that
            // faces the trigger.
            const block = await openArrowed(page, 'Sharing');
            expect(['bottom', 'top']).toContain(block.placement);
            // Centred on the trigger's centre along the edge…
            expect(Math.abs(centre(block.arrow).x - centre(block.trigger).x)).toBeLessThanOrEqual(2);
            // …and straddling the facing edge, tip toward the trigger.
            const edge = block.placement === 'bottom' ? block.popup.y : block.popup.y + block.popup.height;
            expect(block.arrow.y).toBeLessThan(edge);
            expect(block.arrow.y + block.arrow.height).toBeGreaterThan(edge);
            const tip = block.placement === 'bottom' ? block.arrow.y : block.arrow.y + block.arrow.height;
            expect(Math.abs(tip - centre(block.trigger).y)).toBeLessThan(Math.abs(edge - centre(block.trigger).y));
            await page.keyboard.press('Escape');

            const beside = await openArrowed(page, 'Beside');
            expect(beside.placement).toBe('right');
            expect(Math.abs(centre(beside.arrow).y - centre(beside.trigger).y)).toBeLessThanOrEqual(2);
            expect(beside.arrow.x).toBeLessThan(beside.popup.x);
            expect(beside.arrow.x + beside.arrow.width).toBeGreaterThan(beside.popup.x);
        });
    }

    test('after a shift off the viewport edge, it still points at the trigger, inside the popup', async ({ page }) => {
        // Narrow enough that an 18rem popup centred under a trigger at the
        // end of the column must be pushed back on screen.
        await page.setViewportSize({ width: 560, height: 800 });
        await bootPage(page, 'popover', 'basic');
        const r = await openArrowed(page, 'Near the edge');
        const viewport = page.viewportSize()!;

        // Preconditions: the popup really was shifted (its centre is not the
        // trigger's), and it sits inside the 8px collision padding.
        expect(Math.abs(centre(r.popup).x - centre(r.trigger).x)).toBeGreaterThan(20);
        expect(r.popup.x + r.popup.width).toBeLessThanOrEqual(viewport.width - 8 + 1);

        expect(Math.abs(centre(r.arrow).x - centre(r.trigger).x)).toBeLessThanOrEqual(2);
        expect(r.arrow.x).toBeGreaterThanOrEqual(r.popup.x);
        expect(r.arrow.x + r.arrow.width).toBeLessThanOrEqual(r.popup.x + r.popup.width);
    });
});
