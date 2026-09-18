/**
 * The three small axis gaps #57 closed, measured in boxes rather than
 * attributes — each one is a claim about LAYOUT, which the kit goldens record
 * faithfully and cannot check:
 *
 * - a Timeline with no start-side content reserves no start track (a `:has()`
 *   rule on the root in every skin — no prop, so nothing for a unit test to
 *   see rendered);
 * - Countdown's `inline` modifier sets it in a sentence: the paragraph's size,
 *   and digits on the paragraph's own line — measured after the per-tick
 *   entry animation has settled, since that animation is a translate;
 * - a sized Field sizes its control: the Select in the compact demo takes the
 *   Field's step (the control sets none of its own) and comes out shorter
 *   than the same Select in an unsized Field.
 *
 * Chromium only and one page load per design system per page, like the RTL
 * spec: grid tracks, inherited font sizes and control heights are not where
 * engines differ, and the six skins are where these claims could.
 */
import { expect, test, type Locator } from '@playwright/test';
import { bootPage } from './nav';
import { rootLabelled, settledBox } from './demo';

const DESIGN_SYSTEMS = ['basic', 'daisyui', 'material', 'brutalist', 'heroui', 'carbon'];

/** The first grid track of every item in a timeline, in px. */
const startTracks = (root: Locator): Promise<number[]> =>
    root.locator('[data-scope="timeline"][data-part="item"]').evaluateAll((items) =>
        items.map((item) => parseFloat(getComputedStyle(item).gridTemplateColumns.split(/\s+/)[0]!)));

test.describe('small axis gaps (#57)', () => {
    test.beforeEach(({}, testInfo) => {
        test.skip(
            testInfo.project.name !== 'chromium',
            'grid tracks, inherited fonts and control heights are not engine-specific — one engine is enough',
        );
    });

    for (const ds of DESIGN_SYSTEMS) {
        test(`${ds}: a timeline with no start content reserves no start track`, async ({ page }) => {
            await bootPage(page, 'timeline', ds);
            const noStart = rootLabelled(page, 'timeline', 'Task queued');
            await expect(noStart).toBeVisible();
            const collapsed = await startTracks(noStart);
            expect(collapsed.length).toBe(3);
            for (const track of collapsed) expect(track, 'the start track of an end-only timeline').toBe(0);

            // The control: one start-placed event is enough to keep the
            // column for every item, so the axis stays aligned down the list.
            const withStart = rootLabelled(page, 'timeline', 'v1.0 shipped');
            for (const track of await startTracks(withStart)) {
                expect(track, 'the start track of a timeline that uses it').toBeGreaterThan(0);
            }
        });

        test(`${ds}: an inline countdown sets in its sentence`, async ({ page }) => {
            await bootPage(page, 'countdown', ds);
            // Named by its accessible name: the digits tick, so its text is no handle.
            const inline = page.locator('[data-scope="countdown"][data-part="root"][aria-label="Pairing code expires in"]');
            await expect(inline).toHaveAttribute('data-mod-inline', '');
            const m = await inline.evaluate(async (el) => {
                // The demo ticks every second and each tick replays the entry
                // translate, so wait until NOTHING is animating, not merely
                // until the animations seen first have finished.
                for (;;) {
                    const running = el.getAnimations({ subtree: true });
                    if (running.length === 0) break;
                    await Promise.all(running.map((a) => a.finished.catch(() => {})));
                }
                const sentence = el.parentElement!;
                const lead = document.createRange();
                lead.selectNodeContents(sentence.firstChild!);
                const digits = document.createRange();
                digits.selectNodeContents(el.querySelector('[data-part="digits"]')!);
                const a = lead.getClientRects()[0]!;
                const b = digits.getClientRects()[0]!;
                return {
                    size: parseFloat(getComputedStyle(el).fontSize),
                    sentenceSize: parseFloat(getComputedStyle(sentence).fontSize),
                    leadTop: a.top, leadBottom: a.bottom, digitsTop: b.top, digitsBottom: b.bottom,
                };
            });
            expect(m.size, 'the countdown takes the sentence\'s size').toBe(m.sentenceSize);
            expect(Math.abs(m.digitsTop - m.leadTop), 'digits sit on the sentence\'s line').toBeLessThan(1);
            expect(Math.abs(m.digitsBottom - m.leadBottom), 'digits sit on the sentence\'s line').toBeLessThan(1);

            // The control: without the modifier the recipe's display step is bigger than its paragraph.
            const display = page.locator('[data-scope="countdown"][data-part="root"][aria-label="Time remaining"]');
            const displaySize = await display.evaluate((el) => [
                parseFloat(getComputedStyle(el).fontSize),
                parseFloat(getComputedStyle(el.parentElement!).fontSize),
            ]);
            expect(displaySize[0]).toBeGreaterThan(displaySize[1]!);
        });

        test(`${ds}: a sized Field sizes the control inside it`, async ({ page }) => {
            await bootPage(page, 'field', ds);
            // The label is visually hidden and still names the trigger.
            const compact = page.getByRole('combobox', { name: 'Mode for Bash' });
            const standard = page.getByRole('combobox', { name: 'Mode for Read (the default step)' });
            const field = page.locator('[data-demo="compact-field"] [data-scope="field"][data-part="root"]');
            const step = await field.getAttribute('data-size');
            expect(step, 'the compact field carries the design system\'s smallest step').not.toBeNull();
            await expect(page.locator('[data-demo="compact-field"] [data-scope="select"][data-part="root"]'))
                .toHaveAttribute('data-size', step!);
            const small = await settledBox(compact, 'compact trigger');
            const base = await settledBox(standard, 'default trigger');
            expect(small.height, `${ds}: the ${step} trigger against the unsized one`).toBeLessThan(base.height);
        });
    }
});
