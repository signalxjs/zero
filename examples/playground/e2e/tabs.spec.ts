/**
 * Tabs — the APG tabs pattern under a real keyboard.
 *
 * The unit suite proves the roving handler's arithmetic; this proves the
 * composite behavior only a real engine renders: exactly one tab stop in the
 * list, arrow keys actually MOVING focus (element.focus() through a real
 * focus pipeline), automatic activation following that focus, disabled tabs
 * skipped, and the orthogonal axis ignored.
 */
import { test, expect, type Page } from '@playwright/test';
import { bootPage } from './nav';
import { demoLabelled } from './demo';

test.beforeEach(async ({ page }) => {
    await bootPage(page, 'tabs', 'basic');
});

/** The one Tabs demo, named by the text on it (`demo.ts`). */
const demo = (page: Page) => demoLabelled(page, 'tabs', 'Overview');
/** A tab within the demo, by its visible label — identity, not position. */
const tab = (page: Page, name: string) =>
    demo(page)('tab').filter({ hasText: name });

test('one roving tab stop: only the active tab is tabbable, and the stop follows selection', async ({ page }) => {
    const parts = demo(page);
    // Counting within this one demo's own set is the carve-out `demo.ts`
    // allows: the subject IS "exactly one stop in this list".
    const stops = parts('tab').and(page.locator('[tabindex="0"]'));
    await expect(tab(page, 'Overview')).toHaveAttribute('tabindex', '0');
    await expect(stops).toHaveCount(1);

    await tab(page, 'Details').click();
    await expect(tab(page, 'Details')).toHaveAttribute('tabindex', '0');
    await expect(tab(page, 'Overview')).toHaveAttribute('tabindex', '-1');
    await expect(stops).toHaveCount(1);
});

test('arrow keys move focus and automatic activation follows; Home/End jump', async ({ page }) => {
    const parts = demo(page);
    await tab(page, 'Overview').focus();

    await page.keyboard.press('ArrowRight');
    await expect(tab(page, 'Details')).toBeFocused();
    await expect(tab(page, 'Details')).toHaveAttribute('data-state', 'active');
    await expect(parts('panel').filter({ hasText: 'labelled by its tab' })).toBeVisible();

    await page.keyboard.press('End');
    await expect(tab(page, 'History')).toBeFocused();
    await expect(tab(page, 'History')).toHaveAttribute('data-state', 'active');

    await page.keyboard.press('Home');
    await expect(tab(page, 'Overview')).toBeFocused();
    await expect(tab(page, 'Overview')).toHaveAttribute('data-state', 'active');
});

test('the disabled tab is skipped: ArrowRight from the last enabled tab wraps past it', async ({ page }) => {
    await expect(tab(page, 'Disabled')).toBeDisabled();
    await tab(page, 'History').click();
    await expect(tab(page, 'History')).toBeFocused();
    // History is the last ENABLED tab; with loop on, ArrowRight must land on
    // Overview — reaching Disabled would both focus and (automatic mode)
    // select it.
    await page.keyboard.press('ArrowRight');
    await expect(tab(page, 'Overview')).toBeFocused();
    await expect(tab(page, 'Overview')).toHaveAttribute('data-state', 'active');
    await expect(tab(page, 'Disabled')).toHaveAttribute('data-state', 'inactive');
});

test('horizontal orientation ignores vertical arrows', async ({ page }) => {
    const parts = demo(page);
    await expect(parts('list')).toHaveAttribute('aria-orientation', 'horizontal');
    await tab(page, 'Overview').focus();
    await page.keyboard.press('ArrowDown');
    await expect(tab(page, 'Overview')).toBeFocused();
    await expect(tab(page, 'Overview')).toHaveAttribute('data-state', 'active');
});

test('panels: the active one is shown, the rest are platform-hidden, each labelled by its tab', async ({ page }) => {
    const parts = demo(page);
    const overviewPanel = parts('panel').filter({ hasText: 'roving tab stop' });
    const detailsPanel = parts('panel').filter({ hasText: 'labelled by its tab' });
    await expect(overviewPanel).toBeVisible();
    await expect(detailsPanel).toBeHidden();

    const tabId = await tab(page, 'Overview').getAttribute('id');
    expect(tabId).toBeTruthy();
    await expect(overviewPanel).toHaveAttribute('aria-labelledby', tabId!);
    await expect(overviewPanel).toHaveAttribute('role', 'tabpanel');

    await tab(page, 'Details').click();
    await expect(detailsPanel).toBeVisible();
    await expect(overviewPanel).toBeHidden();
});
