/**
 * Accordion and Collapsible under a real engine (#276).
 *
 * The unit suite proves the keyboard handler's arithmetic and simulates the
 * exit with stubbed animations; this proves what only a real engine can:
 * arrow keys MOVING focus through a real focus pipeline between `<summary>`
 * elements, every trigger staying in the Tab sequence, the panels exposed as
 * regions named by their triggers, and — the point of the size variables —
 * a close that PLAYS: the panel flips to `closed` at once, stays rendered
 * inside a still-open `<details>` while its block size shrinks from the
 * measured `--*-panel-height`, and only then does the element shut.
 *
 * Sampling happens inside the page, one entry per animation frame from the
 * click, because a Playwright round-trip per sample is slower than the exit.
 */
import { test, expect, type Locator, type Page } from '@playwright/test';
import { bootPage } from './nav';
import { demoLabelled, rootLabelled } from './demo';

test.beforeEach(({ browserName }, testInfo) => {
    test.skip(
        !['chromium', 'firefox', 'webkit'].includes(testInfo.project.name),
        `engine projects only (${browserName}); reduced motion is e2e/reduced-motion.spec.ts`,
    );
});

/** The one Accordion demo, named by the text on it (`demo.ts`). */
const accordion = (page: Page) => demoLabelled(page, 'accordion', 'Native details');
const trigger = (page: Page, name: string) => accordion(page)('trigger').filter({ hasText: name });

test.describe('accordion keyboard (APG)', () => {
    test.beforeEach(async ({ page }) => {
        await bootPage(page, 'accordion', 'basic');
    });

    test('arrows move focus between triggers and wrap; Home/End jump; nothing opens on arrival', async ({ page }) => {
        await trigger(page, 'Native details').focus();

        await page.keyboard.press('ArrowDown');
        await expect(trigger(page, 'Second section')).toBeFocused();
        // Focus only: arriving on a heading does not open it.
        await expect(trigger(page, 'Second section')).toHaveAttribute('aria-expanded', 'false');

        await page.keyboard.press('End');
        await expect(trigger(page, 'Keyboard')).toBeFocused();

        await page.keyboard.press('ArrowDown');
        await expect(trigger(page, 'Native details')).toBeFocused();

        await page.keyboard.press('ArrowUp');
        await expect(trigger(page, 'Keyboard')).toBeFocused();

        await page.keyboard.press('Home');
        await expect(trigger(page, 'Native details')).toBeFocused();
    });

    test('no roving tabindex: Tab walks every trigger', async ({ page }) => {
        const parts = accordion(page);
        // Counting within this one demo's own set is the carve-out `demo.ts`
        // allows: the subject IS "no trigger left the Tab sequence".
        await expect(parts('trigger').and(page.locator('[tabindex]'))).toHaveCount(0);
        await trigger(page, 'Second section').focus();
        await page.keyboard.press('Tab');
        await expect(trigger(page, 'Keyboard')).toBeFocused();
    });

    test('each open panel is a region named by its trigger', async ({ page }) => {
        const root = rootLabelled(page, 'accordion', 'Native details');
        await expect(root.getByRole('region', { name: 'Native details' })).toBeVisible();
        await expect(root).toHaveAttribute('data-orientation', 'vertical');
    });
});

interface Frame {
    state: string | null;
    open: boolean;
    height: number;
}

/**
 * Click `triggerEl`, then record `frames` animation frames of the disclosure
 * that contains it: the panel's `data-state`, the `<details>` element's
 * `open`, and the panel's rendered height.
 */
async function sampleClose(triggerEl: Locator, frames = 40): Promise<{ before: number; frames: Frame[] }> {
    return triggerEl.evaluate(async (summary: HTMLElement, count) => {
        const details = summary.closest('details')!;
        const panel = details.querySelector<HTMLElement>(':scope > [data-part="panel"]')!;
        const before = panel.getBoundingClientRect().height;
        summary.click();
        const out: { state: string | null; open: boolean; height: number }[] = [];
        for (let i = 0; i < count; i++) {
            await new Promise((r) => requestAnimationFrame(r));
            out.push({
                state: panel.getAttribute('data-state'),
                open: details.open,
                height: panel.getBoundingClientRect().height,
            });
        }
        return { before, frames: out };
    }, frames);
}

function expectPlayedExit(what: string, before: number, frames: Frame[]): void {
    expect(before, `${what}: the open panel has no height to close from`).toBeGreaterThan(0);
    expect(frames.every((f) => f.state === 'closed'), `${what}: data-state must flip to closed at once`).toBe(true);
    // Mid-exit: still open natively, still rendered, already smaller.
    const mid = frames.find((f) => f.open && f.height > 0 && f.height < before);
    expect(mid, `${what}: no frame caught the panel rendered and shrinking inside an open <details>`).toBeTruthy();
    // No snap back: once shrinking, the panel never paints at full size again
    // before the element shuts — the close lands on the exit's last frame.
    const after = frames.slice(frames.indexOf(mid!));
    expect(
        after.some((f) => f.open && f.height >= before),
        `${what}: the panel painted back at full size between the exit and the close`,
    ).toBe(false);
    // …and then it shuts.
    expect(frames.at(-1)!.open, `${what}: the <details> never closed after the exit`).toBe(false);
}

test('accordion: a close plays the panel exit before the <details> shuts', async ({ page }) => {
    await bootPage(page, 'accordion', 'basic');
    const { before, frames } = await sampleClose(trigger(page, 'Native details'));
    expectPlayedExit('accordion', before, frames);
});

test('collapsible: a close plays the panel exit before the <details> shuts', async ({ page }) => {
    await bootPage(page, 'collapsible', 'basic');
    const parts = demoLabelled(page, 'collapsible', 'What is zero?');
    await expect(parts('panel')).toHaveAttribute('aria-labelledby', (await parts('trigger').getAttribute('id'))!);
    const { before, frames } = await sampleClose(parts('trigger'));
    expectPlayedExit('collapsible', before, frames);
});

test('accordion: reopening mid-exit keeps the item open', async ({ page }) => {
    await bootPage(page, 'accordion', 'basic');
    const t = trigger(page, 'Native details');
    await t.evaluate(async (summary: HTMLElement) => {
        summary.click();
        await new Promise((r) => requestAnimationFrame(r));
        await new Promise((r) => requestAnimationFrame(r));
        summary.click();
    });
    await expect(t).toHaveAttribute('data-state', 'open');
    // Past any exit's length: the reopened item must still be open natively.
    await page.waitForTimeout(600);
    expect(await t.evaluate((summary) => summary.closest('details')!.open)).toBe(true);
    await expect(t).toHaveAttribute('aria-expanded', 'true');
});
