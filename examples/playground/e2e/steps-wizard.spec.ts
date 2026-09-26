/**
 * Steps as a wizard (#296) — the keyboard, the `linear` gate and the layout,
 * in real engines.
 *
 * The unit suite proves the arithmetic (which step Next reaches, which items
 * a `linear` rail locks); this proves what only a real focus pipeline and a
 * real layout can: arrow keys MOVE focus onto locked steps (they stay
 * focusable — `aria-disabled`, never native `disabled`), a real Enter or
 * click on a locked step activates nothing, the Next trigger keeps focus on
 * the press that reaches the last step (the carousel/pagination bound,
 * #270), and every design system wraps the panel and the triggers BELOW the
 * rail — the root is one flex row, so a recipe that forgot the wizard wrap
 * would lay the panel beside the steps.
 */
import { test, expect, type Page } from '@playwright/test';
import { bootPage } from './nav';
import { DESIGN_SYSTEMS, demoLabelled, settledBox } from './demo';

/** The one wizard demo, named by the text on it (`demo.ts`). */
const demo = (page: Page) => demoLabelled(page, 'steps', 'Account');
/** A step, by its visible title — identity, not position. */
const step = (page: Page, name: string) => demo(page)('item').filter({ hasText: name });
/** The active step's panel: the one content part not hidden. */
const shownPanel = (page: Page) => demo(page)('content').and(page.locator(':not([hidden])'));

test.describe('keyboard and linear gating', () => {
    test.beforeEach(async ({ page }) => {
        await bootPage(page, 'steps', 'basic');
    });

    test('arrows rove onto locked steps, which never activate by Enter, Space or a click', async ({ page }) => {
        const account = step(page, 'Account');
        const plan = step(page, 'Plan');
        const confirm = step(page, 'Confirm');
        await expect(account).toHaveAttribute('data-state', 'active');
        // `profile` is the next reachable step; everything past it is locked.
        for (const locked of [plan, confirm]) {
            await expect(locked).toHaveAttribute('aria-disabled', 'true');
            await expect(locked).toHaveAttribute('data-disabled', '');
            // Playwright's `toBeDisabled` reads aria-disabled too; the claim
            // here is the NATIVE attribute's absence, which is what keeps the
            // step focusable.
            expect(await locked.evaluate((el) => (el as HTMLButtonElement).disabled)).toBe(false);
        }

        await account.focus();
        await page.keyboard.press('ArrowRight');
        await expect(step(page, 'Profile')).toBeFocused();
        await page.keyboard.press('ArrowRight');
        await expect(plan).toBeFocused();
        await page.keyboard.press('Enter');
        await page.keyboard.press(' ');
        await expect(account).toHaveAttribute('data-state', 'active');
        await page.keyboard.press('End');
        await expect(confirm).toBeFocused();

        // `force`: Playwright's actionability treats aria-disabled as
        // disabled and would wait forever — the real click is the point.
        await confirm.click({ force: true });
        await expect(account).toHaveAttribute('data-state', 'active');
        await expect(shownPanel(page)).toContainText('email address');
    });

    test('Next walks the rail one step at a time and unlocks as it goes', async ({ page }) => {
        const next = demo(page)('next-trigger');
        const prev = demo(page)('prev-trigger');
        // At the first step Back is a focusable no-op.
        await expect(prev).toHaveAttribute('aria-disabled', 'true');
        await prev.focus();
        await page.keyboard.press('Enter');
        await expect(step(page, 'Account')).toHaveAttribute('data-state', 'active');

        await next.focus();
        await page.keyboard.press('Enter');
        await expect(step(page, 'Profile')).toHaveAttribute('data-state', 'active');
        await expect(step(page, 'Account')).toHaveAttribute('data-state', 'complete');
        await expect(shownPanel(page)).toContainText('still has errors');
        await expect(step(page, 'Plan')).not.toHaveAttribute('data-disabled', '');
        await expect(step(page, 'Confirm')).toHaveAttribute('data-disabled', '');

        await page.keyboard.press('Enter');
        await page.keyboard.press('Enter');
        await expect(step(page, 'Confirm')).toHaveAttribute('data-state', 'active');
        // The press that reached the bound kept focus on the trigger.
        await expect(next).toBeFocused();
        await expect(next).toHaveAttribute('aria-disabled', 'true');
        await page.keyboard.press('Enter');
        await expect(step(page, 'Confirm')).toHaveAttribute('data-state', 'active');

        // Going back is never gated — and a click on a walked step works too.
        await step(page, 'Account').click();
        await expect(step(page, 'Account')).toHaveAttribute('data-state', 'active');
        await expect(shownPanel(page)).toContainText('email address');
    });

    test('the invalid step says so in its accessible name', async ({ page }) => {
        await expect(step(page, 'Profile')).toHaveAttribute('data-invalid', '');
        await expect(step(page, 'Profile')).toHaveAccessibleName(/Profile.*, has errors/);
        await expect(step(page, 'Account')).not.toHaveAccessibleName(/has errors/);
    });

    test('the shown panel is a region named by its step title', async ({ page }) => {
        await expect(shownPanel(page)).toHaveCount(1);
        await expect(shownPanel(page)).toHaveRole('region');
        await expect(shownPanel(page)).toHaveAccessibleName('Account');
    });
});

// Layout is where a skin can be wrong: every design system, measured in boxes.
for (const ds of DESIGN_SYSTEMS) {
    test(`${ds}: the panel and the triggers wrap below the rail, Back at the start and Next at the end`, async ({ page }, info) => {
        test.skip(info.project.name !== 'chromium', 'layout is engine-independent here; one engine covers the six skins');
        await bootPage(page, 'steps', ds);
        const rail = await settledBox(step(page, 'Confirm'), 'the last step');
        const first = await settledBox(step(page, 'Account'), 'the first step');
        const panel = await settledBox(shownPanel(page), 'the shown panel');
        const prev = await settledBox(demo(page)('prev-trigger'), 'Back');
        const next = await settledBox(demo(page)('next-trigger'), 'Next');
        // The rail is one line: first and last step share a row.
        expect(Math.abs(first.y - rail.y)).toBeLessThan(1);
        // The panel sits below every step, and the triggers below the panel.
        expect(panel.y).toBeGreaterThanOrEqual(rail.y + rail.height - 0.5);
        expect(prev.y).toBeGreaterThanOrEqual(panel.y + panel.height - 0.5);
        expect(next.y).toBeGreaterThanOrEqual(panel.y + panel.height - 0.5);
        // Back at the start edge, Next pushed to the end edge.
        expect(prev.x).toBeLessThan(next.x);
        expect(next.x + next.width).toBeGreaterThan(rail.x + rail.width - 2);
    });
}
