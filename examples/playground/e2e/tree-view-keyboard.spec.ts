/**
 * TreeView — the APG tree keyboard contract in real engines.
 *
 * The tree controller flattens VISIBLE nodes into the shared list interface;
 * this spec proves the composite through a real focus pipeline: ArrowUp/Down
 * walk visible nodes only, ArrowRight expands-then-descends, ArrowLeft
 * collapses-then-climbs, Enter/Space select without toggling expansion,
 * disabled nodes are skipped by navigation AND typeahead, typeahead
 * moves focus by first characters, and a disabled node that a pointer focused
 * still navigates without selecting (#177). Since #271 it also holds the
 * pointer to the keyboard's reading of a branch row (a click selects it),
 * `*` expanding siblings, and the `expandOnClick={false}` + `loading` demo.
 * Since #287 it holds `multiple` too: the APG multi-select keys (Space,
 * Shift+Arrow, Ctrl/Cmd+Shift+End, Ctrl/Cmd+A) and the modifier clicks,
 * through real modifier state and a real text-selection pipeline.
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

test('a pointer-focused disabled node still roves, but never selects (#177)', async ({ page }) => {
    const secrets = item(page, 'secrets.env');
    // tabindex=-1 takes a click's focus in every engine — that is how a
    // disabled node ends up focused at all; keyboard roving skips it.
    // `force`: Playwright refuses to click an aria-disabled element, but a
    // user's mouse does not.
    await secrets.click({ force: true });
    await expect(secrets).toBeFocused();

    await page.keyboard.press('Enter');
    await page.keyboard.press(' ');
    await expect(secrets).not.toHaveAttribute('data-selected', '');

    // The step lands on its enabled neighbour, not the first node.
    await page.keyboard.press('ArrowUp');
    await expect(item(page, 'package.json')).toBeFocused();

    await secrets.click({ force: true });
    await expect(secrets).toBeFocused();
    await page.keyboard.press('Home');
    await expect(branch(page, 'src', 1)).toBeFocused();
});

test('a click on a branch row selects it, as Enter does, and toggles it (#271)', async ({ page }) => {
    const components = branch(page, 'components', 2);
    await expect(components).toHaveAttribute('aria-selected', 'false');
    await components.locator('> [data-part="branch-trigger"]').click();
    await expect(components).toHaveAttribute('aria-selected', 'true');
    await expect(components).toHaveAttribute('aria-expanded', 'true');
    await expect(components).toBeFocused();
    await expect(page.locator('code', { hasText: 'src/components' })).toBeVisible();
});

test("'*' expands every sibling branch of the focused node (#271)", async ({ page }) => {
    const components = branch(page, 'components', 2);
    await expect(components).toHaveAttribute('aria-expanded', 'false');
    await item(page, 'index.ts').focus();
    await page.keyboard.press('*');
    await expect(components).toHaveAttribute('aria-expanded', 'true');
    // Not a typeahead character: focus stays put.
    await expect(item(page, 'index.ts')).toBeFocused();
});

test('expandOnClick=false: the row selects, the indicator toggles; a loading branch is busy (#271)', async ({ page }) => {
    const remoteDemo = demoLabelled(page, 'tree-view', 'Remote files');
    const remote = remoteDemo('branch')
        .filter({ has: page.locator('[data-scope="tree-view"][data-part="branch-trigger"]', { hasText: 'remote' }) });
    const trigger = remote.locator('> [data-part="branch-trigger"]');
    const indicator = trigger.locator('[data-part="branch-indicator"]');

    await trigger.click();
    await expect(remote).toHaveAttribute('aria-selected', 'true');
    await expect(remote).toHaveAttribute('aria-expanded', 'false');

    await indicator.click();
    await expect(remote).toHaveAttribute('aria-expanded', 'true');
    await expect(remote).toHaveAttribute('aria-busy', 'true');
    await expect(indicator).toHaveAttribute('data-state', 'loading');
    await expect(remote.locator('> [data-part="branch-content"]')).toHaveAttribute('data-state', 'loading');

    // The "fetch" lands: the children render and the busy state clears.
    await expect(remoteDemo('item').filter({ hasText: 'server.ts' })).toBeVisible();
    await expect(remote).not.toHaveAttribute('aria-busy', 'true');
    await expect(indicator).toHaveAttribute('data-state', 'open');
});

// ── multiple (#287) ──

/** The Multi-select files tree, named by its label. */
const multi = (page: Page) => demoLabelled(page, 'tree-view', 'Multi-select files');
const multiItem = (page: Page, name: string): Locator => multi(page)('item').filter({ hasText: name });
const selection = (page: Page): Locator => page.getByTestId('tree-multi-selection');

test('multiple: the APG multi-select keys select, extend and skip disabled nodes (#287)', async ({ page }) => {
    await expect(multi(page)('tree')).toHaveAttribute('aria-multiselectable', 'true');
    const logo = multiItem(page, 'logo.svg');
    await logo.focus();

    // Space toggles, and anchors.
    await page.keyboard.press(' ');
    await expect(logo).toHaveAttribute('aria-selected', 'true');
    await expect(selection(page)).toHaveText('assets/logo.svg');

    // Shift+ArrowDown moves focus past the disabled draft.psd and extends.
    await page.keyboard.press('Shift+ArrowDown');
    await expect(multiItem(page, 'hero.png')).toBeFocused();
    await page.keyboard.press('Shift+ArrowDown');
    await expect(multiItem(page, 'index.html')).toBeFocused();
    await expect(selection(page)).toHaveText('assets/logo.svg, assets/hero.png, index.html');
    await expect(multiItem(page, 'draft.psd')).toHaveAttribute('aria-selected', 'false');

    // Ctrl/Cmd+Shift+End extends to the last visible node.
    await page.keyboard.press('ControlOrMeta+Shift+End');
    await expect(multiItem(page, 'main.js')).toBeFocused();
    await expect(selection(page)).toHaveText('assets/logo.svg, assets/hero.png, index.html, styles.css, main.js');

    // Space toggles the focused one out; Enter selects it alone.
    await page.keyboard.press(' ');
    await expect(multiItem(page, 'main.js')).toHaveAttribute('aria-selected', 'false');
    await page.keyboard.press('Enter');
    await expect(selection(page)).toHaveText('main.js');

    // Ctrl/Cmd+A selects every visible enabled node, and is no typeahead.
    await page.keyboard.press('ControlOrMeta+a');
    await expect(multiItem(page, 'main.js')).toBeFocused();
    await expect(selection(page)).toHaveText('main.js, assets, assets/logo.svg, assets/hero.png, index.html, styles.css');
});

test('multiple: click replaces, Ctrl/Cmd+click toggles, Shift+click selects the range (#287)', async ({ page }) => {
    await multiItem(page, 'hero.png').click();
    await expect(selection(page)).toHaveText('assets/hero.png');

    await multiItem(page, 'styles.css').click({ modifiers: ['ControlOrMeta'] });
    await expect(selection(page)).toHaveText('assets/hero.png, styles.css');

    await multiItem(page, 'styles.css').click({ modifiers: ['ControlOrMeta'] });
    await expect(selection(page)).toHaveText('assets/hero.png');

    // The anchor is styles.css (last toggled); the range runs up to logo.svg,
    // skipping the disabled draft.psd — and selects rows, not their text.
    await multiItem(page, 'logo.svg').click({ modifiers: ['Shift'] });
    await expect(selection(page)).toHaveText('assets/logo.svg, assets/hero.png, index.html, styles.css');
    await expect(multiItem(page, 'logo.svg')).toBeFocused();
    expect(await page.evaluate(() => window.getSelection()?.toString() ?? '')).toBe('');

    // A modified click on a branch row selects without folding it.
    const assets = multi(page)('branch').filter({ has: page.locator('[data-part="branch-trigger"]', { hasText: 'assets' }) });
    await assets.locator('> [data-part="branch-trigger"]').click({ modifiers: ['ControlOrMeta'] });
    await expect(assets).toHaveAttribute('aria-selected', 'true');
    await expect(assets).toHaveAttribute('aria-expanded', 'true');
});
