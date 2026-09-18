/**
 * The layout tier's actual claim: spacing comes from the design system, so
 * switching the toolbar re-spaces the page rather than only re-skinning its
 * controls.
 *
 * Every other test of this tier asserts ATTRIBUTES — the unit tests check
 * what zero renders, the kit goldens check what each skin compiles. Neither
 * proves the two halves meet, because the step table and the component's
 * default are both custom properties: a specificity mistake between them
 * would leave every layout prop silently resolving to its default, and every
 * one of those tests would still pass. This measures the pixels instead.
 *
 * Chromium only. Nothing here is engine-specific — `column-gap`, custom
 * property resolution and `@media` are not where browsers differ — and the
 * cost is one page load per design system.
 */
import { expect, test } from '@playwright/test';
import { bootPage } from './nav';
import { rootLabelled, settledBox } from './demo';

/**
 * How many tracks a grid computes to.
 *
 * Split on whitespace OUTSIDE parentheses: a computed
 * `grid-template-columns` is usually a list of pixel lengths, but it does
 * not have to be, and `minmax(0, 1fr)` would otherwise count as two.
 */
const trackCountOf = (locator: import('@playwright/test').Locator): Promise<number> =>
    locator.evaluate((el) => {
        const value = getComputedStyle(el).gridTemplateColumns.trim();
        if (value === '' || value === 'none') return 0;
        return value.split(/\s+(?![^(]*\))/).length;
    });

/** The two skins whose spacing ramps differ most, so a real change is visible. */
const TIGHT = 'basic';
const COARSE = 'brutalist';

/**
 * The gap of the `Row` inside the demo labelled with a spacing step.
 *
 * Located through the labelled demo rather than a page-wide
 * `[data-scope="stack"]`, per the convention in `demo.ts`: the page renders
 * a dozen stacks and `.first()` would couple this to document order.
 */
async function gapOf(page: import('@playwright/test').Page, step: string): Promise<number> {
    // Named by the label the demo renders beside it, and NOT `.first()`:
    // the filter already yields exactly one, so leaving the positional call
    // off means Playwright's strictness fails loudly if a second demo ever
    // carries the same label, instead of silently picking one.
    const row = page.locator('[data-scope="stack"][data-part="root"]')
        .filter({ has: page.locator(`xpath=preceding-sibling::code[text()="${step}"]`) });
    await expect(row).toBeVisible();
    return row.evaluate((el) => parseFloat(getComputedStyle(el).columnGap));
}

test.describe('the layout tier resolves through the design system', () => {
    // The header's claim, enforced. Without this the spec runs in every
    // project (chromium/firefox/webkit, plus reduced-motion and
    // forced-colors) — it passes there, but it is six page loads per engine
    // to re-confirm that `column-gap` and custom properties work, which is
    // not where engines differ.
    test.beforeEach(({}, testInfo) => {
        test.skip(
            testInfo.project.name !== 'chromium',
            'custom-property resolution and column-gap are not engine-specific — one engine is enough',
        );
    });

    test('a gap step is a real length, not the unset default', async ({ page }) => {
        // The failure this catches: the table losing to the component's own
        // `--l-gap: 0` default. Every attribute assertion elsewhere would
        // still pass while the page rendered with no spacing at all.
        await bootPage(page, 'layout', TIGHT);
        for (const step of ['xs', 'sm', 'md', 'xl']) {
            expect(await gapOf(page, step), `${TIGHT} ${step}`).toBeGreaterThan(0);
        }
    });

    test('the ramp is ordered — a larger step is a larger gap', async ({ page }) => {
        await bootPage(page, 'layout', TIGHT);
        const [xs, sm, md, xl] = await Promise.all(
            ['xs', 'sm', 'md', 'xl'].map((s) => gapOf(page, s)),
        );
        expect(xs).toBeLessThan(sm!);
        expect(sm).toBeLessThan(md!);
        expect(md).toBeLessThan(xl!);
    });

    test('switching the design system re-spaces the same markup', async ({ page }) => {
        // THE claim. Same component, same prop, same DOM — a different
        // number, because `md` is a rung of a ramp each skin declares for
        // itself and the app never names a length.
        //
        // A page per skin, rather than re-booting one: `bootPage` pins the
        // design system through an init script, and those accumulate on a
        // page rather than replacing each other.
        const gapUnder = async (ds: string): Promise<number> => {
            const fresh = await page.context().newPage();
            await bootPage(fresh, 'layout', ds);
            const gap = await gapOf(fresh, 'md');
            await fresh.close();
            return gap;
        };
        expect(await gapUnder(COARSE)).not.toBe(await gapUnder(TIGHT));
    });

    test('a nested stack keeps its own spacing', async ({ page }) => {
        // Custom properties inherit, so this is the regression guard for the
        // anti-inheritance rule: without a re-declared default on each
        // carrier, the inner rows would both take the outer Col's gap.
        await bootPage(page, 'layout', TIGHT);
        // Attribute-named rather than positional, and strict: if a second
        // demo ever renders a `lg`-gapped stack this fails loudly instead of
        // quietly measuring the wrong one.
        const outer = page.locator('[data-scope="stack"][data-part="root"][data-l-gap="lg"]');
        await expect(outer).toBeVisible();
        const inner = outer.locator('[data-scope="stack"][data-part="root"]');
        const tightGap = await inner.filter({ has: page.locator('text=tight') })
            .evaluate((el) => parseFloat(getComputedStyle(el).columnGap));
        const looseGap = await inner.filter({ has: page.locator('text=loose') })
            .evaluate((el) => parseFloat(getComputedStyle(el).columnGap));
        const outerGap = await outer.evaluate((el) => parseFloat(getComputedStyle(el).columnGap));

        expect(tightGap).toBeLessThan(looseGap);
        expect(tightGap).not.toBe(outerGap);
    });

    test('a responsive value changes across the breakpoint it names', async ({ page }) => {
        // `gap={{ base: 'xs', md: 'xl' }}` — the per-instance half of the
        // contract, and the half a static stylesheet cannot express. Measured
        // either side of this design system's own `md`.
        await bootPage(page, 'layout', TIGHT);
        const responsive = page.locator('[data-scope="stack"][data-part="root"][data-l-md-gap="xl"]');
        await expect(responsive).toBeVisible();
        const gap = () => responsive.evaluate((el) => parseFloat(getComputedStyle(el).columnGap));

        await page.setViewportSize({ width: 1280, height: 800 });
        const wide = await gap();
        await page.setViewportSize({ width: 480, height: 800 });
        const narrow = await gap();

        expect(narrow).toBeLessThan(wide);
    });

    test('Grid lays out real columns, and a cell spans them', async ({ page }) => {
        // Measured as BOXES rather than declarations: `grid-template-columns`
        // computes to used pixel values, so this also proves the count
        // actually took effect rather than resolving to the `none` default.
        await bootPage(page, 'layout', TIGHT);
        await page.setViewportSize({ width: 1280, height: 900 });

        // Named by the text this demo alone renders, per the convention in
        // demo.ts — a page-wide `.first()` couples the spec to document order.
        const grid = rootLabelled(page, 'grid', 'full width');
        await expect(grid).toBeVisible();
        expect(await trackCountOf(grid)).toBe(3);

        // The spanning cell is as wide as the whole grid, which is what
        // `span="full"` means and what a per-cell attribute has to achieve.
        const gridBox = await settledBox(grid, 'the counted grid');
        const cellBox = await settledBox(
            grid.locator('[data-part="cell"][data-l-span="full"]'), 'the spanning cell',
        );
        expect(cellBox.width).toBeCloseTo(gridBox.width, 0);
    });

    test('cols="auto" reflows on width alone, with no breakpoint named', async ({ page }) => {
        // The mode worth having: the track count changes with the viewport
        // even though nothing in the markup mentions a breakpoint.
        await bootPage(page, 'layout', TIGHT);
        const auto = rootLabelled(page, 'grid', 'epsilon');
        await expect(auto).toBeVisible();

        await page.setViewportSize({ width: 1280, height: 900 });
        const wide = await trackCountOf(auto);
        await page.setViewportSize({ width: 420, height: 900 });
        const narrow = await trackCountOf(auto);

        expect(wide).toBeGreaterThan(narrow);
        // …and it never overflows: that is what `min(100%, …)` buys, since
        // auto-fit would otherwise honour a track wider than the viewport.
        const box = await settledBox(auto, 'the auto grid');
        expect(box.width).toBeLessThanOrEqual(420);
    });

    test('Center centres on both axes, and on one when asked', async ({ page }) => {
        await bootPage(page, 'layout', TIGHT);
        const centre = rootLabelled(page, 'center', 'middle');
        await expect(centre).toBeVisible();
        expect(await centre.evaluate((el) => getComputedStyle(el).placeItems)).toContain('center');
    });

    test('Container bounds the page, and the bound is the skin\'s own', async ({ page }) => {
        // The measure category's whole justification: how wide a page runs is
        // identity, so two skins should disagree. Measured as boxes, at a
        // viewport far wider than any rung, so the bound is what is being
        // read rather than the window.
        const widthUnder = async (ds: string): Promise<number> => {
            const fresh = await page.context().newPage();
            await bootPage(fresh, 'layout', ds);
            await fresh.setViewportSize({ width: 1600, height: 900 });
            // Named by the label the demo renders inside it, per the
            // convention in demo.ts, rather than a page-wide attribute
            // selector that would couple this to document order.
            const box = await settledBox(
                rootLabelled(fresh, 'container', 'measure="md"'),
                `the md container under ${ds}`,
            );
            await fresh.close();
            return box.width;
        };
        const tight = await widthUnder(TIGHT);
        const coarse = await widthUnder(COARSE);

        // Bounded well below the viewport…
        expect(tight).toBeLessThan(1600);
        // …and the two skins bound it differently.
        expect(coarse).not.toBe(tight);
    });

    test('`prose` tracks the type, not the page', async ({ page }) => {
        // In `ch`, so it is a typographic measure. Asserting it is narrower
        // than `md` is what proves the rung resolved at all rather than
        // falling through to the unbounded default.
        await bootPage(page, 'layout', TIGHT);
        await page.setViewportSize({ width: 1600, height: 900 });
        const widthOfMeasure = async (value: string) => (await settledBox(
            rootLabelled(page, 'container', `measure="${value}"`),
            `the ${value} container`,
        )).width;
        expect(await widthOfMeasure('prose')).toBeLessThan(1600);
        expect(await widthOfMeasure('xs')).toBeLessThan(await widthOfMeasure('md'));
    });

    test('Spacer flexes by default and is fixed when given a step', async ({ page }) => {
        await bootPage(page, 'layout', TIGHT);
        const widthOf = async (sel: string, what: string) =>
            (await settledBox(page.locator(sel), what)).width;

        // The toolbar spacer takes the leftover room…
        const flexible = await widthOf('[data-scope="spacer"][data-part="root"]:not([data-l-space])', 'the flexible spacer');
        // …while the one given a rung is that rung wide, and much smaller.
        const fixed = await widthOf('[data-scope="spacer"][data-part="root"][data-l-space="2xl"]', 'the fixed spacer');
        expect(fixed).toBeGreaterThan(0);
        expect(flexible).toBeGreaterThan(fixed);
    });
});
