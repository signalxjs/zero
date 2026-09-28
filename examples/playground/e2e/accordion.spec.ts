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
 *
 * Collapsible's non-native mode (#453) gets the same claims where it has no
 * `<details>` to lean on: a trigger lent onto a Button inside a Card header,
 * a real tab stop that Enter, Space and a click toggle, a close that plays
 * before the panel goes back to `hidden="until-found"`, and find-in-page
 * reaching into the closed panel (a text fragment, which fires the same
 * `beforematch`).
 */
import { test, expect, type Locator, type Page } from '@playwright/test';
import { bootPage } from './nav';
import { demoLabelled, partsOf, rootLabelled } from './demo';

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

// ── Collapsible native={false} (#453) ──

/** The Card-header demo: a non-native Collapsible around a Card. */
const cardDisclosure = (page: Page) => rootLabelled(page, 'collapsible', 'Card header');
const cardTrigger = (page: Page) => cardDisclosure(page).getByRole('button', { name: 'Show details' });
const cardPanel = (page: Page) => partsOf(cardDisclosure(page), 'collapsible')('panel');

test.describe('collapsible native={false} in a card header (#453)', () => {
    test.beforeEach(async ({ page }) => {
        await bootPage(page, 'collapsible', 'basic');
    });

    test('a div root, no stray "Details" summary, and the trigger is the Button it was lent to', async ({ page }) => {
        const root = cardDisclosure(page);
        expect(await root.evaluate((el) => el.tagName)).toBe('DIV');
        // No <details>, so the browser inserts no default "Details" summary.
        await expect(root.locator('details, summary')).toHaveCount(0);
        await expect(root.getByText('Details', { exact: true })).toHaveCount(0);
        const trigger = cardTrigger(page);
        // One element, the Button's anatomy; the lent collapsible trigger
        // renders no part of its own.
        await expect(trigger).toHaveAttribute('data-scope', 'button');
        await expect(partsOf(root, 'collapsible')('trigger')).toHaveCount(0);
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
        await expect(trigger).toHaveAttribute('aria-controls', (await cardPanel(page).getAttribute('id'))!);
        // Closed: hidden but findable, and the box the UA leaves it collapsed.
        await expect(cardPanel(page)).toHaveAttribute('hidden', /.*/);
        expect((await cardPanel(page).boundingBox())?.height ?? 0).toBe(0);
        // `checkVisibility`: the text keeps a box under `content-visibility:
        // hidden`, which Playwright's own visibility reads as visible.
        expect(await cardPanel(page).getByText('tangerine quartz').evaluate((el) => el.checkVisibility())).toBe(false);
    });

    test('the trigger is a tab stop, and Enter, Space and a click toggle it', async ({ page }, testInfo) => {
        const trigger = cardTrigger(page);
        const panel = cardPanel(page);
        // From the native demo's summary, the next tab stop is the Button.
        // WebKit's Tab skips buttons unless "full keyboard access" is on;
        // Alt+Tab is its full keyboard order.
        await demoLabelled(page, 'collapsible', 'What is zero?')('trigger').focus();
        await page.keyboard.press(testInfo.project.name === 'webkit' ? 'Alt+Tab' : 'Tab');
        await expect(trigger).toBeFocused();

        await page.keyboard.press('Enter');
        await expect(trigger).toHaveAttribute('aria-expanded', 'true');
        await expect(panel).not.toHaveAttribute('hidden');
        await expect(panel.getByText('tangerine quartz')).toBeVisible();

        await page.keyboard.press('Space');
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
        await expect(panel).toHaveAttribute('hidden', /.*/);

        await trigger.click();
        await expect(trigger).toHaveAttribute('aria-expanded', 'true');
        await expect(panel.getByText('tangerine quartz')).toBeVisible();
        await expect(panel).toHaveAccessibleName('Show details');
    });

    test('a close plays the panel exit before the panel is hidden again', async ({ page }) => {
        const trigger = cardTrigger(page);
        await trigger.click();
        await expect(cardPanel(page)).toHaveAttribute('data-state', 'open');
        // Past the entry transition, so the close starts from full height.
        await page.waitForTimeout(500);
        const { before, frames } = await trigger.evaluate(async (button: HTMLElement, count) => {
            const panel = document.getElementById(button.getAttribute('aria-controls')!)!;
            const start = panel.getBoundingClientRect().height;
            button.click();
            const out: { state: string | null; open: boolean; height: number }[] = [];
            for (let i = 0; i < count; i++) {
                await new Promise((r) => requestAnimationFrame(r));
                out.push({
                    state: panel.getAttribute('data-state'),
                    // "open" here: the panel is not hidden yet.
                    open: !panel.hasAttribute('hidden'),
                    height: panel.getBoundingClientRect().height,
                });
            }
            return { before: start, frames: out };
        }, 40);
        expectPlayedExit('collapsible native={false}', before, frames);
    });

    test('find-in-page reaches into the closed panel and opens it (beforematch)', async ({ page, browserName }) => {
        test.skip(browserName !== 'chromium', 'text fragments and hidden="until-found" are Chromium-tested');
        await expect(cardPanel(page)).toHaveAttribute('hidden', 'until-found');
        // A text fragment runs the find-in-page reveal: `beforematch` on the
        // until-found panel, which writes the model.
        await page.goto('/#/collapsible:~:text=tangerine%20quartz');
        await expect(cardTrigger(page)).toHaveAttribute('aria-expanded', 'true');
        await expect(cardPanel(page)).toHaveAttribute('data-state', 'open');
        await expect(cardPanel(page)).not.toHaveAttribute('hidden');
        await expect(cardPanel(page).getByText('tangerine quartz')).toBeVisible();
    });
});
