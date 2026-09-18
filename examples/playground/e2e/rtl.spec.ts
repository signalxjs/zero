/**
 * The inline axis, in a real engine and in the other writing direction
 * (signalxjs/zero#277, #290).
 *
 * Until this file there was no RTL coverage in CI at all. Everything the repo
 * knew about direction had been established by hand: #278's fix was verified
 * with a one-off Chromium probe, and the premise it was filed under —
 * "brutalist is the one package that does not flip" — turned out to be wrong in
 * four more places that nothing was watching.
 *
 * ## Why a spec, when the kit already lints for this
 *
 * `validate-recipes` warns on a physical property that has a logical twin, and
 * that lint is what found most of the sites this file now guards. It cannot
 * find the rest, and the gap is structural rather than an oversight: a
 * `transform` has NO logical spelling, so `translateX(8px)` is invisible to any
 * check that reads declarations. The fix there is a direction-valued custom
 * property — a shape, not a rename — and whether it actually took effect is a
 * question about a box on a screen.
 *
 * heroui's switch is the standing proof. Its thumb anchored with
 * `inset-inline-start` and then travelled with a bare positive `translate`, so
 * under RTL the anchor moved it to the reading end and the travel carried it
 * further the same way — off the track entirely. Perfectly clean to the lint.
 * That is why this file measures boxes and reads computed values, and never
 * asserts that a declaration is spelled a particular way.
 *
 * ## Setting `dir`
 *
 * After boot, never in `addInitScript`. The document element does not exist
 * when an init script runs, so the attribute is silently dropped and every
 * assertion then measures an LTR page — which reads exactly like a fix that did
 * not work. `rating-group.spec.ts` established the same pattern for the same
 * reason.
 *
 * ## Cost
 *
 * One page load per design system, chromium only. Chromium only because these
 * are claims about OUR cascade resolving, not about engine behaviour — the same
 * reasoning that keeps the contrast matrices on one engine. The one genuinely
 * engine-shaped question here, whether `:dir()` is supported at all, is
 * deliberately hedged in the CSS instead: every rule is written
 * `:where(:dir(rtl), [dir="rtl"], [dir="rtl"] *)`, so an engine without
 * `:dir()` drops that argument and still matches the attribute form this spec
 * sets.
 */
import { test, expect, type Locator, type Page } from '@playwright/test';
import { demoLabelled, rootLabelled, settledBox } from './demo';

const DESIGN_SYSTEMS = ['basic', 'daisyui', 'material', 'brutalist', 'heroui', 'carbon'] as const;

/**
 * Boot with one design system pinned, then turn the document around.
 *
 * On the kitchen-sink route: this file measures switch, toast, tree-view,
 * progress and menu boxes in one visit, and `#/all` is the one document that
 * renders them all — which is what keeps the documented one-page-load-per-DS
 * cost model true.
 */
async function pinRtl(page: Page, ds: string): Promise<void> {
    await page.addInitScript((id) => {
        localStorage.setItem('zero-ds', id);
    }, ds);
    await page.goto('/#/all');
    await expect(page.locator('link[data-zero-ds]')).toHaveAttribute('data-zero-ds', ds);
    // AFTER boot — see the header.
    await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
}

/** The box, without waiting out animations — for parts that never settle. */
async function boxOf(loc: Locator, what: string) {
    await expect(loc, `${what}: not visible, so it has no box to measure`).toBeVisible();
    const box = await loc.boundingBox();
    expect(box, `${what}: visible, but boundingBox() was null`).not.toBeNull();
    return box!;
}

const centre = (b: { x: number; width: number }) => b.x + b.width / 2;

for (const ds of DESIGN_SYSTEMS) {
    test.describe(`${ds}: the inline axis under dir="rtl"`, () => {
        test.beforeEach(async ({ page }, testInfo) => {
            test.skip(
                testInfo.project.name !== 'chromium',
                'claims about our own cascade, not about engine behaviour — one engine is the coverage',
            );
            await pinRtl(page, ds);
        });

        /**
         * The switch thumb: at the reading start when off, travelled toward the
         * reading end when on. In RTL the reading start is the RIGHT edge.
         *
         * The containment assertion is the one that matters. A thumb whose
         * anchor mirrors and whose travel does not does not merely sit on the
         * wrong side — it leaves the control, which is how heroui's shipped for
         * as long as it did without anyone seeing it.
         */
        test('the switch thumb starts at the reading edge and travels inward', async ({ page }) => {
            // "Disabled" is the playground's only unchecked switch — both
            // "Notifications" (`switchOn: true`) and "Autosave" (`defaultChecked`)
            // are on. Disabled changes the ink, not the geometry.
            //
            // The expectation is derived from the control's own `data-state`
            // rather than hardcoded per demo: a spec that assumes which demo is
            // checked inverts silently the day the playground changes its
            // defaults, and passes for the wrong reason in the meantime.
            for (const label of ['Disabled', 'Autosave']) {
                const parts = demoLabelled(page, 'switch', label);
                const control = await settledBox(parts('control'), `${ds}: ${label} switch control`);
                const thumb = await settledBox(parts('thumb'), `${ds}: ${label} switch thumb`);
                const state = await parts('control').getAttribute('data-state');
                expect(['checked', 'unchecked'], `${ds}: ${label} has no switch state`)
                    .toContain(state);

                // This is the assertion that matters. A thumb whose anchor
                // mirrors and whose travel does not does not merely sit on the
                // wrong side — it leaves the control, which is how heroui's
                // shipped for as long as it did without anyone seeing it.
                expect(
                    thumb.x,
                    `${ds}: the ${state} thumb starts outside its own control — a logical anchor `
                    + 'with a physical travel puts it there',
                ).toBeGreaterThanOrEqual(control.x - 1);
                expect(
                    thumb.x + thumb.width,
                    `${ds}: the ${state} thumb ends outside its own control`,
                ).toBeLessThanOrEqual(control.x + control.width + 1);

                // Unchecked sits toward the inline start (visual right under
                // RTL); checked toward the inline end. Halves rather than exact
                // offsets — the six pad their tracks differently.
                if (state === 'unchecked') {
                    expect(
                        centre(thumb),
                        `${ds}: an unchecked thumb belongs at the reading start, the right half in RTL`,
                    ).toBeGreaterThan(centre(control));
                } else {
                    expect(
                        centre(thumb),
                        `${ds}: a checked thumb belongs at the reading end, the left half in RTL`,
                    ).toBeLessThan(centre(control));
                }
            }
        });

        /**
         * `ToastPlacement` is spelled logically, so `bottom-end` must be the
         * reading end — the LEFT edge here. This is #277's filed item, and it
         * was identical in all six packages, which is what marked it as a
         * copied idiom rather than six mistakes.
         *
         * The playground only ever mounts `bottom-end` (`App.tsx`), but the CSS
         * keys purely off `data-placement`, so the opposite placement is
         * reachable by setting the attribute — no playground change needed.
         */
        test('a toast viewport sits on the side its placement names', async ({ page }) => {
            await page.getByRole('button', { name: 'Success toast' }).click();
            const viewport = page.locator('[data-scope="toast"][data-part="viewport"]');
            const width = await page.evaluate(() => document.documentElement.clientWidth);

            const atEnd = await settledBox(viewport, `${ds}: the bottom-end toast viewport`);
            expect(
                atEnd.x,
                `${ds}: bottom-end must be the READING end — the left edge under RTL, not the right`,
            ).toBeLessThan(width - (atEnd.x + atEnd.width));

            await viewport.evaluate((el) => el.setAttribute('data-placement', 'bottom-start'));
            const atStart = await settledBox(viewport, `${ds}: the bottom-start toast viewport`);
            expect(
                width - (atStart.x + atStart.width),
                `${ds}: bottom-start must be the READING start — the right edge under RTL`,
            ).toBeLessThan(atStart.x);
        });

        /**
         * The tree's collapsed branch glyph points at the reading end. It comes
         * from the runtime as element text rather than `content:`, so the skins
         * mirror it instead of swapping it — `scale` composes outside the
         * `rotate` that opens it, so only the closed state turns around.
         */
        test('a collapsed branch indicator points at the reading end', async ({ page }) => {
            const tree = rootLabelled(page, 'tree-view', 'Project files');
            const collapsed = tree.locator(
                '[data-scope="tree-view"][data-part="branch-indicator"][data-state="closed"]',
            );
            const scale = await collapsed.first().evaluate((el) => getComputedStyle(el).scale);
            expect(
                scale,
                `${ds}: the collapsed branch glyph is element text, so RTL has to mirror it — `
                + 'it points into the page otherwise',
            ).toMatch(/^-1\b/);
        });

        /**
         * The indeterminate sweep travels start → end, which is right → left
         * here. Driven off `getAnimations()` rather than sampled in flight: the
         * animation loops, so two wall-clock samples can straddle a wrap and
         * report the opposite of the truth.
         *
         * This is the item #277 filed as "possibly a deliberate no-op". It is
         * not: the determinate `width` on the same element is an ordinary flow
         * child and was already mirroring, so the bar filled one way and swept
         * the other.
         */
        test('the indeterminate progress sweep travels the reading way', async ({ page }) => {
            const range = rootLabelled(page, 'progress', 'Indeterminate (no value)')
                .locator('[data-scope="progress"][data-part="range"]');
            await expect(range).toHaveAttribute('data-state', 'indeterminate');

            const seek = (fraction: number) => range.evaluate((el, f) => {
                const anim = el.getAnimations()[0];
                if (!anim) throw new Error('the indeterminate range is not animating');
                anim.pause();
                const timing = anim.effect?.getComputedTiming();
                anim.currentTime = (timing?.duration as number) * f;
                return undefined;
            }, fraction);

            await seek(0.05);
            const early = await boxOf(range, `${ds}: the sweep near its start`);
            await seek(0.95);
            const late = await boxOf(range, `${ds}: the sweep near its end`);

            expect(
                late.x,
                `${ds}: the sweep must run toward the reading end (leftward under RTL) — the `
                + 'determinate fill on this same element already does',
            ).toBeLessThan(early.x);
        });

        /**
         * The submenu chevron. Material declines to draw one at all — its
         * `pressable()` owns both pseudo-elements and a chevron is content the
         * app supplies — so there is nothing to mirror there.
         *
         * Zero keeps popups mounted rather than unmounting them, so the
         * sub-trigger is reachable without opening its menu.
         */
        test('the submenu chevron points at the reading end', async ({ page }) => {
            test.skip(ds === 'material', 'material draws no submenu chevron — pressable owns both pseudo-elements');
            const share = page
                .locator('[data-scope="menu"][data-part="sub-trigger"]')
                .filter({ hasText: 'Share' });
            const content = await share.first().evaluate(
                (el) => getComputedStyle(el, '::after').content,
            );
            expect(
                content,
                `${ds}: › points right in every writing direction, so RTL needs its mirror ‹`,
            ).toContain('‹');
        });
    });
}
