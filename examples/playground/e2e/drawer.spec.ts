/**
 * Drawer — Dialog's top-layer machinery on an edge panel, in real engines.
 *
 * The unit suite (happy-dom) proves the state wiring; only a real engine has
 * `showModal()`, `:modal`, a ::backdrop that hit-tests as the dialog element
 * itself, a native `cancel` for Escape, and native focus restore. On top of
 * Dialog's contract this spec covers what is Drawer's OWN:
 *
 * - the EDGE: `data-placement="start|end"` is the logical pair, so the spec
 *   measures boxes rather than attributes — the start panel's inline-start
 *   edge sits on the viewport's reading edge, the end panel's on the far
 *   one (LTR here; the RTL sweep is rtl.spec.ts's jurisdiction);
 * - the scrim geometry (#324, inherited): a click on the panel's own
 *   padding must NOT close while a genuine scrim click must — and (#260)
 *   the press has to start on the scrim too, and Escape on a
 *   `dismissible={false}` sheet stays refused however often it is pressed;
 * - the INLINE mode: `show()` renders in flow — no `:modal`, no dismiss
 *   trap, Escape through zero's dismiss layer, focus restore through
 *   zero's `createFocusRestore`.
 */
import { test, expect, type Page } from '@playwright/test';
import { bootPage } from './nav';
import { controlledPopup, settledBox, DESIGN_SYSTEMS } from './demo';

test.beforeEach(async ({ page }) => {
    await bootPage(page, 'drawer', 'basic');
});

/**
 * `Drawer.Root` renders no element, so there is no demo root to hang parts
 * off — each demo is pinned by the text on its own trigger, and the panel
 * resolves through the `aria-controls` id that trigger publishes (`demo.ts`).
 * The page holds the start and end drawers, the measure and hidden-title
 * demos, and the inline filters panel.
 */
const startTrigger = (page: Page) => page.getByRole('button', { name: 'Open drawer', exact: true });
const endTrigger = (page: Page) => page.getByRole('button', { name: 'Open end drawer', exact: true });
const inlineTrigger = (page: Page) => page.getByRole('button', { name: 'Open filters', exact: true });

test('opens modal in the top layer and hugs the reading edge', async ({ page }) => {
    const trigger = startTrigger(page);
    await trigger.click();
    const panel = await controlledPopup(page, trigger, 'the start drawer trigger');
    await expect(panel).toHaveAttribute('data-state', 'open');
    await expect(panel).toHaveAttribute('data-placement', 'start');
    expect(await panel.evaluate((el) => el.matches(':modal'))).toBe(true);
    // The edge is a measured fact, not an attribute echo: the panel's
    // inline-start edge sits on the viewport's left (LTR) and it spans the
    // full height.
    const box = await settledBox(panel, 'the start drawer panel');
    expect(box.x).toBeLessThanOrEqual(1);
    const viewport = page.viewportSize()!;
    expect(box.height).toBeGreaterThanOrEqual(viewport.height - 2);
});

test('placement="end" pins the panel to the far edge', async ({ page }) => {
    const trigger = endTrigger(page);
    await trigger.click();
    const panel = await controlledPopup(page, trigger, 'the end drawer trigger');
    await expect(panel).toHaveAttribute('data-state', 'open');
    await expect(panel).toHaveAttribute('data-placement', 'end');
    const box = await settledBox(panel, 'the end drawer panel');
    const viewport = page.viewportSize()!;
    expect(box.x + box.width).toBeGreaterThanOrEqual(viewport.width - 1);
});

test('Escape closes (native cancel routed through the model) and restores focus', async ({ page }) => {
    const trigger = startTrigger(page);
    // Keyboard open, so the trigger genuinely HOLDS focus first — WebKit
    // does not focus buttons on click, so a click-open would leave the
    // restore target as body and assert nothing.
    await trigger.focus();
    await page.keyboard.press('Enter');
    const panel = await controlledPopup(page, trigger, 'the start drawer trigger');
    await expect(panel).toHaveAttribute('data-state', 'open');
    await page.keyboard.press('Escape');
    await expect(panel).toHaveAttribute('data-state', 'closed');
    await expect(panel).not.toBeVisible();
    await expect(trigger).toBeFocused();
});

test('a scrim click closes; a click on the panel\'s own padding does not', async ({ page }) => {
    const trigger = startTrigger(page);
    await trigger.click();
    const panel = await controlledPopup(page, trigger, 'the start drawer trigger');
    await expect(panel).toHaveAttribute('data-state', 'open');

    // Padding first: a click inside the panel's box that still targets the
    // <dialog> element itself (no child under the pointer — the bottom
    // inside corner is bare padding). Both clicks have e.target === dialog;
    // only the geometry differs.
    const box = await settledBox(panel, 'the start drawer panel');
    await page.mouse.click(box.x + 4, box.y + box.height - 4);
    await page.waitForTimeout(300);
    await expect(panel).toHaveAttribute('data-state', 'open');

    // Scrim: an edge panel leaves the rest of the viewport to its backdrop,
    // so a point well past the panel's inline edge is reliably outside.
    const viewport = page.viewportSize()!;
    expect(box.x + box.width).toBeLessThan(viewport.width - 20); // precondition
    await page.mouse.click(viewport.width - 8, Math.floor(viewport.height / 2));
    await expect(panel).toHaveAttribute('data-state', 'closed');
});

test('a press that starts on the title and ends over the scrim does not dismiss (#260)', async ({ page }) => {
    const trigger = startTrigger(page);
    await trigger.click();
    const panel = await controlledPopup(page, trigger, 'the start drawer trigger');
    await expect(panel).toHaveAttribute('data-state', 'open');
    const box = await settledBox(panel, 'the start drawer panel');
    const viewport = page.viewportSize()!;
    expect(box.x + box.width).toBeLessThan(viewport.width - 20); // precondition
    const title = await settledBox(panel.locator('[data-part="title"]'), 'the start drawer title');
    const scrim = { x: viewport.width - 8, y: Math.floor(viewport.height / 2) };

    await page.mouse.move(title.x + 4, title.y + title.height / 2);
    await page.mouse.down();
    await page.mouse.move(scrim.x, scrim.y, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    await expect(panel).toHaveAttribute('data-state', 'open');

    await page.mouse.click(scrim.x, scrim.y);
    await expect(panel).toHaveAttribute('data-state', 'closed');
});

test('Escape again and again on a non-dismissible drawer keeps it open (#260)', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Open pinned drawer', exact: true });
    await trigger.click();
    const panel = await controlledPopup(page, trigger, 'the pinned drawer trigger');
    await expect(panel).toHaveAttribute('data-state', 'open');
    for (let i = 0; i < 3; i++) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(150);
        await expect(panel).toHaveAttribute('data-state', 'open');
        expect(await panel.evaluate((el) => el.matches(':modal'))).toBe(true);
    }
    await panel.getByRole('button', { name: 'Done reviewing', exact: true }).click();
    await expect(panel).toHaveAttribute('data-state', 'closed');
});

test('the Close button closes and native focus restore lands on the trigger', async ({ page }) => {
    const trigger = startTrigger(page);
    // Keyboard open — see the Escape test for why (WebKit click focus).
    await trigger.focus();
    await page.keyboard.press('Enter');
    const panel = await controlledPopup(page, trigger, 'the start drawer trigger');
    await expect(panel).toHaveAttribute('data-state', 'open');
    await panel.locator('[data-part="close"]', { hasText: 'Close drawer' }).click();
    await expect(panel).toHaveAttribute('data-state', 'closed');
    await expect(trigger).toBeFocused();
});

test('inline mode: no :modal, in flow, outside clicks do not dismiss', async ({ page }) => {
    const trigger = inlineTrigger(page);
    await trigger.click();
    const panel = await controlledPopup(page, trigger, 'the inline drawer trigger');
    await expect(panel).toHaveAttribute('data-state', 'open');
    await expect(panel).toBeVisible();
    expect(await panel.evaluate((el) => el.matches(':modal'))).toBe(false);
    // In flow, not fixed to the viewport: the inline panel is furniture.
    expect(await panel.evaluate((el) => getComputedStyle(el).position)).not.toBe('fixed');

    // Furniture survives the user working elsewhere — clicking the page is
    // not a dismissal (and the click actually reaches the page: no
    // backdrop, no inertness).
    await page.locator('h1').click();
    await page.waitForTimeout(300);
    await expect(panel).toHaveAttribute('data-state', 'open');
});

test('inline mode: Escape closes via the dismiss-layer fallback and restores focus', async ({ page }) => {
    const trigger = inlineTrigger(page);
    // Keyboard open — see the modal Escape test for why (WebKit click focus).
    await trigger.focus();
    await page.keyboard.press('Enter');
    const panel = await controlledPopup(page, trigger, 'the inline drawer trigger');
    await expect(panel).toHaveAttribute('data-state', 'open');
    // Park focus OUTSIDE the panel: a non-modal <dialog> fires no cancel
    // event, so this Escape can only be seen by zero's document-level
    // dismiss layer — the platform contributes nothing here.
    await page.locator('h1').click();
    await page.keyboard.press('Escape');
    await expect(panel).toHaveAttribute('data-state', 'closed');
    // show() does not restore focus natively — this is createFocusRestore.
    await expect(trigger).toBeFocused();
});

test('the panel is labelled by its Title, or by the label prop when no Title renders', async ({ page }) => {
    const start = await controlledPopup(page, startTrigger(page), 'the start drawer trigger');
    const titleId = await start.locator('[data-part="title"]').getAttribute('id');
    expect(titleId).toBeTruthy();
    await expect(start).toHaveAttribute('aria-labelledby', titleId!);
    // Title wins over the label prop; both never render together.
    await expect(start).not.toHaveAttribute('aria-label', /.*/);
});

test('a visually hidden title still names the panel, and paints nothing (#51, #54)', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Open app menu', exact: true });
    await trigger.click();
    const panel = await controlledPopup(page, trigger, 'the app menu trigger');
    await expect(panel).toHaveAttribute('data-state', 'open');
    await expect(page.getByRole('dialog', { name: 'App menu', exact: true })).toBeVisible();
    const title = panel.locator('[data-scope="drawer"][data-part="title"]');
    await expect(title).toHaveAttribute('data-visually-hidden', '');
    const box = await title.evaluate((el) => el.getBoundingClientRect().toJSON() as DOMRect);
    expect(box.width).toBeLessThanOrEqual(1);
    expect(box.height).toBeLessThanOrEqual(1);
});

/** The skins whose modal sheet slides (#83); basic and brutalist keep the fade. */
const SLIDES: ReadonlySet<string> = new Set(['daisyui', 'material', 'heroui', 'carbon']);

/** What `var(--measure-<key>)` resolves to on this page, in px. */
const measurePx = (page: Page, key: string) => page.evaluate((k) => {
    const probe = document.createElement('div');
    probe.style.cssText = `position:absolute;inline-size:var(--measure-${k})`;
    document.body.append(probe);
    const w = probe.getBoundingClientRect().width;
    probe.remove();
    return w;
}, key);

for (const ds of DESIGN_SYSTEMS) {
    test(`${ds}: measure sizes the modal sheet from the ramp; full spans the viewport; unset keeps the skin's width (#51)`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'chromium', 'recipe geometry is engine-independent; chromium walks the six skins');
        // The file's beforeEach already booted basic on this URL; a same-URL
        // hash goto would not reload, so leave the page first.
        await page.goto('about:blank');
        await bootPage(page, 'drawer', ds);
        const viewport = page.viewportSize()!.width;

        const wideTrigger = page.getByRole('button', { name: 'Open wide drawer', exact: true });
        await wideTrigger.click();
        const wide = await controlledPopup(page, wideTrigger, 'the wide drawer trigger');
        await expect(wide).toHaveAttribute('data-l-measure', 'md');
        const expected = Math.min(await measurePx(page, 'md'), viewport);
        expect(Math.abs((await settledBox(wide, 'the wide panel')).width - expected)).toBeLessThanOrEqual(1);
        await page.keyboard.press('Escape');
        await expect(wide).toHaveAttribute('data-state', 'closed');

        const fullTrigger = page.getByRole('button', { name: 'Open full-screen drawer', exact: true });
        await fullTrigger.click();
        const full = await controlledPopup(page, fullTrigger, 'the full-screen drawer trigger');
        expect(Math.abs((await settledBox(full, 'the full-screen panel')).width - viewport)).toBeLessThanOrEqual(1);
        await page.keyboard.press('Escape');
        await expect(full).toHaveAttribute('data-state', 'closed');

        // No measure: the skin's own sheet width, narrower than the md rung.
        await startTrigger(page).click();
        const start = await controlledPopup(page, startTrigger(page), 'the start drawer trigger');
        const plain = (await settledBox(start, 'the start panel')).width;
        expect(plain).toBeGreaterThan(200);
        expect(plain).toBeLessThan(expected);
        await page.keyboard.press('Escape');
        await expect(start).toHaveAttribute('data-state', 'closed');

        // Inline, the same default caps the panel in flow: the skin's width,
        // not its container's.
        await inlineTrigger(page).click();
        const inline = await controlledPopup(page, inlineTrigger(page), 'the inline drawer trigger');
        expect(Math.abs((await settledBox(inline, 'the inline panel')).width - plain)).toBeLessThanOrEqual(1);
    });
}

/**
 * The exit keeps the sheet's box (#83). The sheet's geometry used to be keyed
 * on `:modal`, which stops matching the moment `close()` runs — while the
 * panel is still in the top layer for its exit — so it fell back to the
 * inline box mid-exit. Now it is keyed on the regime (`data-l-dock="sheet"`).
 *
 * Measured paused late in the exit (95% of its time — the exit curves
 * accelerate, so half the time is a fraction of the travel), from a close
 * started INSIDE the page so no round trip can outlast a ~110ms exit. Chromium only: `overlay` is what
 * keeps a closing dialog in the top layer at all, and elsewhere the exit is
 * instant (#17).
 */
for (const ds of DESIGN_SYSTEMS) {
    test(`${ds}: a closing sheet keeps its box through the exit${SLIDES.has(ds) ? ', sliding out to its edge' : ''} (#83)`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'chromium', 'only Chromium transitions `overlay`, so only there is an exit to measure (#17)');
        await page.goto('about:blank');
        await bootPage(page, 'drawer', ds);
        const trigger = startTrigger(page);
        await trigger.click();
        const panel = await controlledPopup(page, trigger, 'the start drawer trigger');
        const open = await settledBox(panel, 'the open start sheet');

        const mid = await panel.evaluate(async (el) => {
            el.querySelector<HTMLElement>('[data-scope="drawer"][data-part="close"]')!.click();
            await new Promise((r) => setTimeout(r, 0));
            const running = el.getAnimations();
            for (const a of running) {
                a.pause();
                a.currentTime = (a.effect!.getComputedTiming().duration as number) * 0.95;
            }
            const r = el.getBoundingClientRect();
            return {
                running: running.length,
                state: el.getAttribute('data-state'),
                position: getComputedStyle(el).position,
                x: r.x,
                width: r.width,
                height: r.height,
            };
        });
        expect(mid.state).toBe('closed');
        expect(mid.running, `${ds}: no exit transition is running to measure`).toBeGreaterThan(0);
        const viewport = page.viewportSize()!;
        expect(mid.position, `${ds}: mid-exit the sheet fell back to the inline geometry`).toBe('fixed');
        expect(mid.height).toBeGreaterThanOrEqual(viewport.height - 2);
        expect(Math.abs(mid.width - open.width)).toBeLessThanOrEqual(1);
        if (SLIDES.has(ds)) {
            // Most of the way out, toward the reading start (the left edge in LTR).
            expect(mid.x).toBeLessThan(open.x - open.width / 4);
            expect(mid.x).toBeGreaterThan(open.x - open.width);
        } else {
            // A fade: the box does not move at all.
            expect(Math.abs(mid.x - open.x)).toBeLessThanOrEqual(1);
        }
    });
}
