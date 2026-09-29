/**
 * A fragment-declared runtime property reaches layout (#456), measured in
 * boxes.
 *
 * `ext-stepper` is an ecosystem scope: its anatomy declares
 * `runtimeProperties: ['--ext-stepper-count']`, its root writes the item
 * count there, and its recipe pack reads it bare in `targets.web` alone —
 * `grid-template-columns: repeat(var(--ext-stepper-count), minmax(min-content, 1fr))`.
 * The unit suites prove the declaration validates and compiles; only a real
 * engine can prove the value the runtime wrote is the one the grid used.
 * So: the computed property reads the demo's item count, and the four items
 * share the row evenly — which a flex row of "Cart", "Details", "Pay" and
 * "Done" would not.
 *
 * Chromium only, and only the design systems that adopt the pack (basic and
 * heroui list `@sigx/zero-ext-example` as a devDependency; every other skin
 * leaves the scope unstyled-but-accessible, where there is no grid to
 * measure) — a per-spec subset, as #193 allows.
 */
import { expect, test } from '@playwright/test';
import { bootPage } from './nav';
import { demoLabelled, rootLabelled, settledBox } from './demo';

/** The skins whose build adopts the ext-example pack. */
const ADOPTERS = ['basic', 'heroui'] as const;

/** Sub-pixel slack: grid tracks resolve to fractional widths. */
const EPS = 1;

test.describe('ext-stepper publishes its declared runtime property (#456)', () => {
    test.beforeEach(({}, testInfo) => {
        test.skip(testInfo.project.name !== 'chromium', 'box geometry is not engine-specific — one engine is enough');
    });

    for (const ds of ADOPTERS) {
        test(`${ds}: the root's --ext-stepper-count lays the items out as equal tracks`, async ({ page }) => {
            await bootPage(page, 'ext-stepper', ds);
            const root = rootLabelled(page, 'ext-stepper', 'Cart');
            await settledBox(root, 'the stepper root');

            const count = await root.evaluate((el) => getComputedStyle(el).getPropertyValue('--ext-stepper-count').trim());
            expect(count, `${ds}: the root publishes its item count`).toBe('4');
            expect(
                await root.evaluate((el) => getComputedStyle(el).display),
                `${ds}: the pack's web target lays the root out as a grid`,
            ).toBe('grid');

            // Indexing within this one demo's own ordered items: the carve-out.
            const item = demoLabelled(page, 'ext-stepper', 'Cart')('item');
            await expect(item).toHaveCount(4);
            const widths: number[] = [];
            for (let i = 0; i < 4; i++) {
                widths.push((await settledBox(item.nth(i), `ext-stepper item ${i}`)).width);
            }
            const spread = Math.max(...widths) - Math.min(...widths);
            expect(spread, `${ds}: item widths ${widths.map((w) => w.toFixed(1)).join(', ')} share the row evenly`)
                .toBeLessThanOrEqual(EPS);
        });
    }
});
