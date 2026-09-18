/**
 * TreeView — the APG tree keyboard contract in real engines.
 *
 * The tree controller flattens VISIBLE nodes into the shared list interface;
 * this spec proves the composite through a real focus pipeline: ArrowUp/Down
 * walk visible nodes only, ArrowRight expands-then-descends, ArrowLeft
 * collapses-then-climbs, Enter/Space select without toggling expansion,
 * disabled nodes are skipped by navigation AND typeahead, and typeahead
 * moves focus by first characters.
 */
import { test, expect, type Locator, type Page } from '@playwright/test';
import { bootPage } from './nav';
import { demoLabelled } from './demo';

test.beforeEach(async ({ page }) => {
    await bootPage(page, 'tree-view', 'basic');
});

/** The one Project-files tree, named by its label (`demo.ts`). */
const demo = (page: Page) => demoLabelled(page, 'tree-view', 'Project files');

/** A leaf item, by its exact visible text — identity, not position. */
const item = (page: Page, name: string): Locator =>
    demo(page)('item').filter({ hasText: name });

/**
 * A branch, by its trigger row's text plus its level. The level is not
 * decoration: an ancestor branch CONTAINS its descendants' trigger rows, so
 * "the branch that has a trigger reading `components`" matches `src` too —
 * `aria-level` is what pins the one branch that owns the row.
 */
const branch = (page: Page, name: string, level: number): Locator =>
    demo(page)('branch')
        .filter({ has: page.locator(`[data-scope="tree-view"][data-part="branch-trigger"]`, { hasText: name }) })
        .and(page.locator(`[aria-level="${level}"]`));

test('ArrowDown walks visible enabled nodes only; the walk stops at the last one', async ({ page }) => {
    const src = branch(page, 'src', 1);
    await src.focus();

    await page.keyboard.press('ArrowDown');
    await expect(item(page, 'index.ts')).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await expect(branch(page, 'components', 2)).toBeFocused();

    // `components` is collapsed: its children are hidden, not merely styled
    // away, so the next visible node is package.json — and secrets.env is
    // disabled, so the walk cannot continue past package.json (no loop).
    await page.keyboard.press('ArrowDown');
    await expect(item(page, 'package.json')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(item(page, 'package.json')).toBeFocused();

    await page.keyboard.press('ArrowUp');
    await expect(branch(page, 'components', 2)).toBeFocused();
});

test('ArrowRight expands then descends; ArrowLeft collapses then climbs', async ({ page }) => {
    const components = branch(page, 'components', 2);
    const content = components.locator('[data-part="branch-content"]');
    await components.focus();
    await expect(components).toHaveAttribute('data-state', 'closed');
    await expect(content).toBeHidden();

    // Closed branch: ArrowRight expands, focus stays put.
    await page.keyboard.press('ArrowRight');
    await expect(components).toHaveAttribute('data-state', 'open');
    await expect(content).toBeVisible();
    await expect(components).toBeFocused();

    // Open branch: ArrowRight descends to the first child.
    await page.keyboard.press('ArrowRight');
    await expect(item(page, 'App.tsx')).toBeFocused();

    // Leaf: ArrowLeft climbs back to the parent branch.
    await page.keyboard.press('ArrowLeft');
    await expect(components).toBeFocused();
    await expect(components).toHaveAttribute('data-state', 'open');

    // Open branch: ArrowLeft collapses, focus stays put.
    await page.keyboard.press('ArrowLeft');
    await expect(components).toHaveAttribute('data-state', 'closed');
    await expect(content).toBeHidden();
    await expect(components).toBeFocused();

    // Closed branch: ArrowLeft climbs to the parent.
    await page.keyboard.press('ArrowLeft');
    await expect(branch(page, 'src', 1)).toBeFocused();
});

test('Enter and Space select; selection never toggles expansion', async ({ page }) => {
    const src = branch(page, 'src', 1);
    await item(page, 'package.json').focus();
    await page.keyboard.press('Enter');
    await expect(item(page, 'package.json')).toHaveAttribute('data-selected', '');
    await expect(page.locator('code', { hasText: 'package.json' })).toBeVisible();

    await item(page, 'index.ts').focus();
    await page.keyboard.press(' ');
    await expect(item(page, 'index.ts')).toHaveAttribute('data-selected', '');
    await expect(item(page, 'package.json')).not.toHaveAttribute('data-selected', '');

    // Selecting the branch itself must not collapse it — separate acts.
    await src.focus();
    await page.keyboard.press('Enter');
    await expect(src).toHaveAttribute('data-selected', '');
    await expect(src).toHaveAttribute('data-state', 'open');
});

test('typeahead jumps by first characters and skips disabled nodes', async ({ page }) => {
    const src = branch(page, 'src', 1);
    await src.focus();
    await page.keyboard.press('p');
    await expect(item(page, 'package.json')).toBeFocused();

    // From package.json, "s" reaches secrets.env first in document order —
    // but it is disabled, so the match wraps around to the src branch.
    await page.waitForTimeout(1100); // let the 1 s typeahead buffer reset
    await page.keyboard.press('s');
    await expect(src).toBeFocused();
});
