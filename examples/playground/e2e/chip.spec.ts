/**
 * Chip and ChipGroup in real engines (#544).
 *
 * What the unit suite cannot prove: that the arrows rove REAL focus across a
 * group's actions (skipping a disabled chip, wrapping, one tab stop), that a
 * keyboard removal lands focus on the neighbouring chip before the app drops
 * the removed one from the DOM, and — per design system, in boxes — that a
 * chip's trailing remove sits inside the chip it belongs to.
 */
import { test, expect, type Page } from '@playwright/test';
import { bootPage } from './nav';
import { DESIGN_SYSTEMS, settledBox } from './demo';

const group = (page: Page, name: string) => page.getByRole('group', { name, exact: true });
const action = (page: Page, groupName: string, name: string) =>
    group(page, groupName).getByRole('button', { name, exact: true });

test.describe('behaviour', () => {
    test.beforeEach(async ({ page }) => {
        await bootPage(page, 'chip', 'basic');
    });

    test('one tab stop, and the arrows rove it past a disabled chip, wrapping', async ({ page }) => {
        const open = action(page, 'Filters', 'Open');
        const mine = action(page, 'Filters', 'Assigned to me');
        const bugs = action(page, 'Filters', 'Bugs');
        const archived = action(page, 'Filters', 'Archived');

        // The selected chip holds the stop.
        await expect(open).toHaveAttribute('tabindex', '0');
        await expect(mine).toHaveAttribute('tabindex', '-1');
        await open.focus();
        await page.keyboard.press('ArrowRight');
        await expect(mine).toBeFocused();
        await page.keyboard.press('ArrowRight');
        await expect(bugs).toBeFocused();
        await expect(archived).toBeDisabled();
        await page.keyboard.press('ArrowRight');
        await expect(open).toBeFocused();
        await page.keyboard.press('ArrowLeft');
        await expect(bugs).toBeFocused();

        // Tab leaves the group rather than walking its chips.
        await page.keyboard.press('Tab');
        const inside = await group(page, 'Filters').evaluate((el) => el.contains(document.activeElement));
        expect(inside).toBe(false);
    });

    test('the arrows move focus, not the value; Space and a click select', async ({ page }) => {
        const filters = page.getByTestId('chip-filters');
        const bugs = action(page, 'Filters', 'Bugs');
        await expect(filters).toHaveText('Filters: open');

        await action(page, 'Filters', 'Open').focus();
        await page.keyboard.press('ArrowRight');
        await expect(filters).toHaveText('Filters: open');
        await page.keyboard.press('Space');
        await expect(filters).toHaveText('Filters: open, mine');
        await expect(action(page, 'Filters', 'Assigned to me')).toHaveAttribute('aria-pressed', 'true');

        await bugs.click();
        await expect(filters).toHaveText('Filters: open, mine, bugs');
        await bugs.click();
        await expect(filters).toHaveText('Filters: open, mine');
        await expect(bugs).toHaveAttribute('aria-pressed', 'false');
    });

    test('a single choice with deselectable={false} keeps one chip chosen', async ({ page }) => {
        const sort = page.getByTestId('chip-sort');
        const oldest = action(page, 'Sort', 'Oldest');
        await oldest.click();
        await expect(sort).toHaveText('Sort: oldest');
        await oldest.click();
        await expect(sort).toHaveText('Sort: oldest');
        await expect(oldest).toHaveAttribute('aria-pressed', 'true');
        await expect(action(page, 'Sort', 'Newest')).toHaveAttribute('aria-pressed', 'false');
    });

    test('Delete and Backspace remove a chip and hand focus to its neighbour', async ({ page }) => {
        const count = page.getByTestId('chip-people');
        await expect(count).toHaveText('Recipients: 4');

        await action(page, 'Recipients', 'Grace Hopper').focus();
        await page.keyboard.press('Delete');
        await expect(count).toHaveText('Recipients: 3');
        await expect(action(page, 'Recipients', 'Grace Hopper')).toHaveCount(0);
        await expect(action(page, 'Recipients', 'Katherine Johnson')).toBeFocused();

        // The last chip has no next neighbour: focus goes back one.
        await action(page, 'Recipients', 'Margaret Hamilton').focus();
        await page.keyboard.press('Backspace');
        await expect(count).toHaveText('Recipients: 2');
        await expect(action(page, 'Recipients', 'Katherine Johnson')).toBeFocused();
    });

    test('the remove button is named, out of the tab order, and removes on click', async ({ page }) => {
        const remove = group(page, 'Recipients').getByRole('button', { name: 'Remove Ada Lovelace' });
        await expect(remove).toHaveAttribute('tabindex', '-1');
        await expect(action(page, 'Recipients', 'Ada Lovelace')).toHaveAttribute('aria-keyshortcuts', 'Backspace Delete');
        await remove.click();
        await expect(page.getByTestId('chip-people')).toHaveText('Recipients: 3');
        await expect(remove).toHaveCount(0);
    });

    test('an action chip acts, and an asChild chip is a real link', async ({ page }) => {
        await action(page, 'Actions', 'Share').click();
        await expect(page.getByTestId('chip-shared')).toHaveText('Shared 1 times');
        await expect(action(page, 'Actions', 'Share')).not.toHaveAttribute('aria-pressed', /.*/);
        const link = group(page, 'Actions').getByRole('link', { name: 'Open docs' });
        await expect(link).toHaveAttribute('data-scope', 'chip');
        await expect(link).toHaveAttribute('data-part', 'action');
        await expect(link).toHaveAttribute('href', '#/chip');
    });
});

test.describe('every design system', () => {
    test.skip(({ browserName }) => browserName !== 'chromium', 'geometry is engine-independent; chromium measures it');

    for (const ds of DESIGN_SYSTEMS) {
        test(`${ds}: a removable chip holds its remove button, and a selected chip changes paint`, async ({ page }) => {
            await bootPage(page, 'chip', ds);
            const chipRoot = group(page, 'Recipients').locator('[data-scope="chip"][data-part="root"]')
                .filter({ hasText: 'Ada Lovelace' });
            const rootBox = await settledBox(chipRoot, 'the Ada chip');
            const removeBox = await settledBox(chipRoot.locator('[data-part="remove"]'), 'its remove button');
            // Inside the chip on both axes (1px for subpixel rounding).
            expect(removeBox.x).toBeGreaterThanOrEqual(rootBox.x - 1);
            expect(removeBox.x + removeBox.width).toBeLessThanOrEqual(rootBox.x + rootBox.width + 1);
            expect(removeBox.y).toBeGreaterThanOrEqual(rootBox.y - 1);
            expect(removeBox.y + removeBox.height).toBeLessThanOrEqual(rootBox.y + rootBox.height + 1);
            // And after the label, at the reading end.
            const actionBox = await settledBox(chipRoot.locator('[data-part="action"]'), 'its action');
            expect(removeBox.x).toBeGreaterThanOrEqual(actionBox.x + actionBox.width - 1);

            // A selected chip must not paint like an unselected one.
            const paint = (text: string) => group(page, 'Filters')
                .locator('[data-scope="chip"][data-part="root"]').filter({ hasText: text })
                .evaluate((el) => {
                    const cs = getComputedStyle(el);
                    return `${cs.backgroundColor}|${cs.color}|${cs.borderColor}|${cs.boxShadow}`;
                });
            expect(await paint('Open')).not.toBe(await paint('Bugs'));
        });
    }
});
