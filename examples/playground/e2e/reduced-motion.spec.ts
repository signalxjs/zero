/**
 * The reduced-motion contract for the two components that loop (#314).
 *
 * Skeleton and Spinner are the only parts in zero whose resting state is an
 * infinite animation, and an infinite animation is the one kind
 * `prefers-reduced-motion` is unambiguously about. Every design system writes
 * a `reduced-motion` block for them; this is what says the block is REACHED.
 *
 * ── WHY BOTH DIRECTIONS ─────────────────────────────────────────────────────
 * Asserting only "no animation under reduced motion" passes for a recipe that
 * never animated at all — which is the same green a working one produces, and
 * exactly the failure mode a `@media` block nobody exercises has. So the spec
 * runs in two projects and asserts the opposite thing in each: the animation
 * must be RUNNING in `chromium` and must be `none` in `reduced-motion`. One of
 * the two fails for a recipe that forgot the block, the other for a recipe
 * that forgot the animation.
 *
 * ── WHY `animation-name`, NOT `animation-duration` ──────────────────────────
 * The kit collapses declared `--duration-*` tokens to ~0 under reduced motion,
 * so a duration-based check would pass on a recipe that merely inherited that
 * collapse — and a looping animation at ~0s does not stop, it strobes, which
 * is worse than the motion it replaced. `animation-name: none` is the only
 * reading that distinguishes "stopped" from "sped up to invisible". It is also
 * why the recipes state these two durations as literals rather than tokens.
 *
 * All six design systems, one page load each: the answer is per-skin, and a
 * spec that checked only the default one would let five regress.
 */
import { test, expect, type Locator, type Page } from '@playwright/test';
import { rootLabelled, DESIGN_SYSTEMS } from './demo';
import { bootPage } from './nav';

/**
 * The looping parts, each located by NAME rather than by document order — the
 * convention in `e2e/demo.ts`, and it matters here because both pages render
 * more than one instance. Both roots carry their own text, so `rootLabelled`
 * finds them: a skeleton's is its placeholder content, a spinner's its
 * visually hidden label (#274) — which is why the demo gives each spinner a
 * distinct one.
 */
interface LoopingPart {
    page: string;
    scope: string;
    locate: (page: Page) => Locator;
}

const LOOPING: LoopingPart[] = [
    {
        page: 'skeleton',
        scope: 'skeleton',
        locate: (page) => rootLabelled(page, 'skeleton', 'Quarterly revenue summary')
            .and(page.locator('[data-state="loading"]')),
    },
    {
        page: 'spinner',
        scope: 'spinner',
        locate: (page) => rootLabelled(page, 'spinner', 'Loading results'),
    },
];

for (const ds of DESIGN_SYSTEMS) {
    for (const spec of LOOPING) {
        test(`${ds}: ${spec.scope} answers prefers-reduced-motion`, async ({ page }, testInfo) => {
            const reduced = testInfo.project.name === 'reduced-motion';
            test.skip(
                !reduced && testInfo.project.name !== 'chromium',
                'two projects are the whole point; the other engines add nothing here',
            );

            await bootPage(page, spec.page, ds);

            const el = spec.locate(page);
            await expect(el).toBeVisible();

            const animation = await el.evaluate((node) => {
                const cs = getComputedStyle(node);
                return { name: cs.animationName, duration: cs.animationDuration };
            });

            if (reduced) {
                expect(
                    animation.name,
                    `${ds}/${spec.scope}: the reduced-motion block is not reached — a looping animation `
                    + 'must STOP, and a duration collapsed to ~0 strobes instead of stopping',
                ).toBe('none');
            } else {
                expect(
                    animation.name,
                    `${ds}/${spec.scope}: nothing animates, so the reduced-motion assertion beside this `
                    + 'one would pass for the wrong reason',
                ).not.toBe('none');
                // …and the duration is a literal, not a collapsible token.
                expect(
                    parseFloat(animation.duration),
                    `${ds}/${spec.scope}: the loop runs at ~0s, which strobes rather than animates`,
                ).toBeGreaterThan(0.1);
            }
        });
    }
}

/**
 * The modal drawer sheet's slide (#83), in the skins that slide. A one-shot
 * transition rather than a loop, so the question is simpler than above: under
 * reduced motion there must be no `translate` transition at all, and the
 * sheet is at rest the moment it opens. Both directions again — in `chromium`
 * the slide must be running, or the reduced-motion half passes for a skin
 * that never slid.
 */
const SLIDES = ['daisyui', 'material', 'heroui', 'carbon'] as const;

for (const ds of SLIDES) {
    test(`${ds}: the drawer sheet's slide answers prefers-reduced-motion`, async ({ page }, testInfo) => {
        const reduced = testInfo.project.name === 'reduced-motion';
        test.skip(
            !reduced && testInfo.project.name !== 'chromium',
            'two projects are the whole point; the other engines add nothing here',
        );
        await bootPage(page, 'drawer', ds);
        const trigger = page.getByRole('button', { name: 'Open drawer', exact: true });
        const slide = await trigger.evaluate(async (btn: HTMLElement) => {
            btn.click();
            await new Promise((r) => setTimeout(r, 0));
            const panel = document.getElementById(btn.getAttribute('aria-controls')!)!;
            const t = panel.getAnimations().find((a) => (a as CSSTransition).transitionProperty === 'translate');
            return {
                duration: t ? (t.effect!.getComputedTiming().duration as number) : null,
                translate: getComputedStyle(panel).translate,
            };
        });
        if (reduced) {
            expect(slide.duration, `${ds}: the sheet still slides under reduced motion`).toBeNull();
            expect(slide.translate).toBe('none');
        } else {
            expect(slide.duration, `${ds}: the sheet does not slide, so the reduced-motion half proves nothing`).not.toBeNull();
            expect(slide.duration!).toBeGreaterThan(100);
        }
    });
}
