/**
 * Top-layer exit animations in every engine (#17).
 *
 * The recipes fade a popup out in CSS once `data-state` flips to `closed`;
 * transitioning `overlay` keeps it in the top layer for the fade. `overlay`
 * is Chromium-only, so on Firefox and WebKit zero holds the native
 * `close()`/`hidePopover()` back until the exit has played
 * (`createTopLayerExit`). This spec proves both paths from the same
 * observable — a frame where the popup is `closed`, still rendered, and
 * partway through its fade — and tells them apart by what carries the popup
 * through it: on Chromium the native close has already run (CSS `overlay`
 * holds it), elsewhere the element is still `:modal` / `:popover-open`
 * (zero's deferral holds it).
 *
 * Sampling happens inside the page, one entry per animation frame from the
 * click that starts the exit, because a Playwright round-trip per sample is
 * slower than the fade itself.
 */
import { test, expect, type Locator, type Page } from '@playwright/test';
import { bootPage } from './nav';
import { controlledPopup } from './demo';

test.beforeEach(({ browserName }, testInfo) => {
    // The engine projects only: reduced-motion and forced-colors are Chromium
    // with a media override, and the reduced-motion case is covered below
    // per engine.
    test.skip(!['chromium', 'firefox', 'webkit'].includes(testInfo.project.name), `engine projects only (${browserName})`);
});

interface Frame {
    state: string | null;
    rendered: boolean;
    opacity: number;
    /** Still shown natively: `:modal` for a dialog, `:popover-open` for a popover. */
    native: boolean;
}

/**
 * Click the popup's close part named `closeText`, then record `frames`
 * animation frames. `reopen` clicks the popup's trigger — the element whose
 * `aria-controls` names it — on the second frame, mid-exit.
 */
async function sampleExit(popup: Locator, closeText: string, reopen = false, frames = 40): Promise<Frame[]> {
    return popup.evaluate(async (el, [text, trigger, count]) => {
        const nativeShown = (): boolean => el.matches('dialog') ? el.matches(':modal') : el.matches(':popover-open');
        const close = [...el.querySelectorAll<HTMLElement>('[data-part="close"]')]
            .find((b) => b.textContent?.trim() === text);
        if (!close) throw new Error(`no close part "${text}" in the popup`);
        close.click();
        const out: Frame[] = [];
        for (let i = 0; i < (count as number); i++) {
            await new Promise((r) => requestAnimationFrame(r));
            if (i === 1 && trigger) document.querySelector<HTMLElement>(`[aria-controls="${el.id}"]`)!.click();
            const cs = getComputedStyle(el);
            out.push({
                state: el.getAttribute('data-state'),
                rendered: cs.display !== 'none',
                opacity: Number(cs.opacity),
                native: nativeShown(),
            });
        }
        return out;
    }, [closeText, reopen, frames] as const);
}

const fading = (frames: Frame[]): Frame[] =>
    frames.filter((f) => f.state === 'closed' && f.rendered && f.opacity > 0 && f.opacity < 1);

async function openDialog(page: Page): Promise<Locator> {
    await bootPage(page, 'dialog', 'basic');
    const trigger = page.getByRole('button', { name: 'Open dialog', exact: true });
    await trigger.click();
    const popup = await controlledPopup(page, trigger, 'the modal dialog trigger');
    await expect(popup).toHaveAttribute('data-state', 'open');
    // Past the entry, so the exit starts from the resting open frame.
    await expect.poll(() => popup.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
    return popup;
}

async function openPopover(page: Page): Promise<{ popup: Locator }> {
    await bootPage(page, 'popover', 'basic');
    const trigger = page.getByRole('button', { name: 'Filters', exact: true });
    await trigger.click();
    const popup = await controlledPopup(page, trigger, 'the Filters popover trigger');
    await expect(popup).toHaveAttribute('data-state', 'open');
    await expect.poll(() => popup.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
    return { popup };
}

test('a modal dialog fades out before it leaves the top layer', async ({ page, browserName }) => {
    const popup = await openDialog(page);
    const frames = await sampleExit(popup, 'Got it');
    const mid = fading(frames);
    expect(mid.length, `a closed, still-rendered, partly faded frame in ${JSON.stringify(frames)}`).toBeGreaterThan(0);
    // Chromium: close() already ran, `overlay` carries the fade. Elsewhere:
    // the dialog is still modal — the deferred close is what carries it.
    for (const f of mid) expect(f.native).toBe(browserName !== 'chromium');
    await expect(popup).toBeHidden();
    expect(await popup.evaluate((el) => (el as HTMLDialogElement).open)).toBe(false);
});

test('a popover fades out before it leaves the top layer', async ({ page, browserName }) => {
    const { popup } = await openPopover(page);
    const frames = await sampleExit(popup, 'Done');
    const mid = fading(frames);
    expect(mid.length, `a closed, still-rendered, partly faded frame in ${JSON.stringify(frames)}`).toBeGreaterThan(0);
    for (const f of mid) expect(f.native).toBe(browserName !== 'chromium');
    await expect(popup).toBeHidden();
    expect(await popup.evaluate((el) => el.matches(':popover-open'))).toBe(false);
});

test('reopening mid-exit keeps the popover open — the pending close is dropped', async ({ page }) => {
    const { popup } = await openPopover(page);
    await sampleExit(popup, 'Done', true, 4);
    // Well past the exit's length: a close that survived the reopen would
    // have landed by now.
    await page.waitForTimeout(600);
    await expect(popup).toHaveAttribute('data-state', 'open');
    expect(await popup.evaluate((el) => el.matches(':popover-open'))).toBe(true);
    await expect.poll(() => popup.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
});

test('under reduced motion the close is prompt in every engine', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const popup = await openDialog(page);
    const frames = await sampleExit(popup, 'Got it', false, 10);
    // No exit to wait for: at most the one frame the deferral spends looking.
    const lingering = frames.filter((f) => f.state === 'closed' && f.rendered);
    expect(lingering.length, JSON.stringify(frames)).toBeLessThanOrEqual(2);
    expect(fading(frames)).toEqual([]);
});
