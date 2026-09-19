/**
 * The responsive Drawer (#82) — `modal={{ below: 'md' }}`: docked open inline
 * at or above the design system's `md`, a modal sheet below it — across a
 * REAL viewport resize, in all three engines.
 *
 * What only a real engine can show:
 *
 * - **First paint.** The server cannot see the viewport, so it renders the
 *   docked markup, and the compiled per-breakpoint CSS alone has to paint the
 *   right half on each side of the breakpoint. Proved with scripting OFF:
 *   the demo's docked DOM (identical to the server's — `ssr.test.tsx` pins
 *   that) under the page's own stylesheets. The client path is sampled per
 *   animation frame from boot, so a flash between first render and mount
 *   would be caught rather than raced past.
 * - **A silent regime switch.** A resize is not a dismissal: no
 *   `openChange`, no `close`, read off the demo's own report line.
 * - **Focus across the switch.** The choice, documented in Drawer.tsx: a
 *   sheet outgrown by the viewport keeps focus where it was (the same
 *   element, now in the docked panel) rather than the native restore to a
 *   trigger that just hid; a docked panel that stops showing hands focus
 *   inside it to the trigger, which is what shows instead.
 *
 * basic's `md` is 768px; the specs straddle it at 1280 and 600.
 */
import { test, expect, type Page } from '@playwright/test';
import { bootPage } from './nav';
import { controlledPopup } from './demo';

const WIDE = { width: 1280, height: 720 };
const NARROW = { width: 600, height: 720 };

/**
 * The trigger by its text — not `getByRole`, which skips hidden elements, and
 * the trigger is hidden whenever the panel is docked.
 */
const trigger = (page: Page) =>
    page.locator('[data-scope="drawer"][data-part="trigger"]', { hasText: 'Open workspace menu' });
const panelOf = (page: Page) => controlledPopup(page, trigger(page), 'the workspace drawer trigger');
/** The demo's own count of what the drawer reported. */
const reports = (page: Page) => page.getByRole('status', { name: 'Workspace drawer reports' });

async function boot(page: Page, viewport: { width: number; height: number }) {
    await page.setViewportSize(viewport);
    await bootPage(page, 'drawer', 'basic');
    // The stylesheet is live before the page has rendered.
    await expect(trigger(page)).toHaveCount(1);
}

test('wide: docked inline and in flow — no trigger, no close, no :modal', async ({ page }) => {
    await boot(page, WIDE);
    const panel = await panelOf(page);
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-state', 'open');
    await expect(panel).toHaveAttribute('data-l-dock-above', 'md');
    expect(await panel.evaluate((el) => el.matches(':modal'))).toBe(false);
    // In flow beside the content, not the UA's absolutely positioned dialog.
    expect(await panel.evaluate((el) => getComputedStyle(el).position)).toBe('relative');
    await expect(trigger(page)).toBeHidden();
    await expect(panel.locator('[data-part="close"]')).toBeHidden();
    await expect(page.getByRole('dialog', { name: 'Workspace', exact: true })).toBeVisible();
});

test('narrow: the trigger opens a modal sheet, and Close closes it', async ({ page }) => {
    await boot(page, NARROW);
    const panel = await panelOf(page);
    await expect(panel).toBeHidden();
    await expect(trigger(page)).toBeVisible();

    await trigger(page).click();
    await expect(panel).toHaveAttribute('data-state', 'open');
    expect(await panel.evaluate((el) => el.matches(':modal'))).toBe(true);
    await panel.locator('[data-part="close"]').click();
    await expect(panel).toBeHidden();
    await expect(reports(page)).toHaveText('openChange ×2, close ×1');
});

test('first paint, no script: the docked markup paints the right half on each side', async ({ page, browser }) => {
    await boot(page, WIDE);
    // The docked DOM before anything opened — what the server renders — and
    // every rule the page loaded, inlined so the scriptless page needs no
    // module graph.
    const { markup, css } = await page.evaluate(() => {
        const dock = document.querySelector('.demo-dock')!;
        const rules = [...document.styleSheets].map((sheet) => {
            try {
                return [...sheet.cssRules].map((r) => r.cssText).join('\n');
            } catch {
                return '';
            }
        });
        return { markup: dock.outerHTML, css: rules.join('\n') };
    });
    expect(markup).toMatch(/<dialog[^>]*\sopen/);

    const context = await browser.newContext({ javaScriptEnabled: false, viewport: WIDE });
    try {
        const still = await context.newPage();
        await still.setContent(`<!doctype html><html><head><style>${css}</style></head><body>${markup}</body></html>`);
        const panel = still.locator('[data-scope="drawer"][data-part="panel"]');
        const stillTrigger = still.locator('[data-scope="drawer"][data-part="trigger"]');
        await expect(panel).toBeVisible();
        await expect(stillTrigger).toBeHidden();

        await still.setViewportSize(NARROW);
        await expect(panel).toBeHidden();
        await expect(stillTrigger).toBeVisible();
    } finally {
        await context.close();
    }
});

test('first paint, client path: no frame shows the wrong half', async ({ page }) => {
    // Sample every animation frame from the first one, before the app has
    // rendered at all, until the spec reads the log.
    await page.addInitScript(() => {
        const seen: string[] = [];
        (window as unknown as { __dockFrames: string[] }).__dockFrames = seen;
        const sample = () => {
            const panel = document.querySelector('.demo-dock [data-scope="drawer"][data-part="panel"]');
            const trig = document.querySelector('.demo-dock [data-scope="drawer"][data-part="trigger"]');
            if (panel && trig) {
                const shown = (el: Element) => el.getClientRects().length > 0;
                seen.push(`${innerWidth >= 768 ? 'wide' : 'narrow'}:${shown(panel) ? 'panel' : '-'}:${shown(trig) ? 'trigger' : '-'}`);
            }
            requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
    });
    for (const [viewport, expected] of [[NARROW, 'narrow:-:trigger'], [WIDE, 'wide:panel:-']] as const) {
        await page.goto('about:blank');
        await boot(page, viewport);
        await page.waitForTimeout(200);
        const frames = await page.evaluate(() => (window as unknown as { __dockFrames: string[] }).__dockFrames);
        expect(frames.length).toBeGreaterThan(0);
        expect(new Set(frames)).toEqual(new Set([expected]));
    }
});

test('widening with the sheet up docks it silently, and focus stays where it was', async ({ page }) => {
    await boot(page, NARROW);
    const panel = await panelOf(page);
    // Keyboard open, so the sheet's focus is a real one in every engine.
    await trigger(page).focus();
    await page.keyboard.press('Enter');
    await expect(panel).toHaveAttribute('data-state', 'open');
    const inbox = panel.getByRole('link', { name: 'inbox' });
    await inbox.focus();
    await expect(inbox).toBeFocused();
    await expect(reports(page)).toHaveText('openChange ×1, close ×0');

    await page.setViewportSize(WIDE);
    await expect.poll(() => panel.evaluate((el) => el.matches(':modal'))).toBe(false);
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-state', 'open');
    await expect(trigger(page)).toBeHidden();
    await expect(inbox).toBeFocused();
    // Past the close event's task: still nothing reported.
    await page.waitForTimeout(300);
    await expect(reports(page)).toHaveText('openChange ×1, close ×0');

    // The sheet went away with its regime: narrowing does not bring it back.
    await page.setViewportSize(NARROW);
    await expect(panel).toBeHidden();
    await expect(trigger(page)).toBeVisible();
    await page.waitForTimeout(300);
    await expect(reports(page)).toHaveText('openChange ×1, close ×0');
});

test('narrowing hands focus inside the docked panel to the trigger, silently', async ({ page }) => {
    await boot(page, WIDE);
    const panel = await panelOf(page);
    const archive = panel.getByRole('link', { name: 'archive' });
    await archive.focus();
    await expect(archive).toBeFocused();

    await page.setViewportSize(NARROW);
    await expect(panel).toBeHidden();
    await expect(trigger(page)).toBeFocused();
    await page.waitForTimeout(300);
    await expect(reports(page)).toHaveText('openChange ×0, close ×0');

    // The sheet opened from here restores to that trigger natively.
    await page.keyboard.press('Enter');
    await expect(panel).toHaveAttribute('data-state', 'open');
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(trigger(page)).toBeFocused();
    await expect(reports(page)).toHaveText('openChange ×2, close ×1');
});
