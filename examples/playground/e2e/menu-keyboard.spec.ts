/**
 * Menu-button keyboard behaviour the platform owns (#175).
 *
 * The unit suite proves the popup asks for the right end and that Enter on a
 * link item is not prevented; only a real engine proves the consequence — the
 * unprevented Enter becomes the anchor's own click, which navigates. The
 * same holds for Tab (#263): the unit suite proves the close and that the
 * key is not prevented; only a real engine moves focus to the next stop.
 */
import { test, expect, type Page } from '@playwright/test';
import { arrowGeometry, controlledPopup } from './demo';
import { bootPage } from './nav';

test.beforeEach(async ({ page }, testInfo) => {
    // Linux WebKit headless does not reliably synthesize keyboard input.
    test.skip(testInfo.project.name === 'webkit' && process.platform === 'linux', 'headless WPE keyboard');
    await bootPage(page, 'menu', 'basic');
});

const actions = (page: Page) => page.getByRole('button', { name: 'Actions', exact: true });
const goTo = (page: Page) => page.getByRole('button', { name: 'Go to', exact: true });

test('ArrowUp on the closed trigger opens on the last item, ArrowDown on the first', async ({ page }) => {
    await actions(page).focus();
    await page.keyboard.press('ArrowUp');
    const popup = await controlledPopup(page, actions(page), 'the Actions menu trigger');
    await expect(popup).toHaveAttribute('data-state', 'open');
    await expect(popup.locator('[data-part="item"]', { hasText: 'Delete' })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(popup).toHaveAttribute('data-state', 'closed');
    await expect(actions(page)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(popup).toHaveAttribute('data-state', 'open');
    await expect(popup.locator('[data-part="item"]', { hasText: 'Rename' })).toBeFocused();
});

test('Enter on an asChild link item navigates and still selects', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', (msg) => logs.push(msg.text()));
    await goTo(page).focus();
    await page.keyboard.press('ArrowUp');
    const popup = await controlledPopup(page, goTo(page), 'the Go to menu trigger');
    const dialogLink = popup.getByRole('menuitem', { name: 'Dialog page' });
    await expect(dialogLink).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/dialog$/);
    expect(logs.filter((l) => l.includes('go to select: dialog'))).toHaveLength(1);
});

// The next tab stop after the Actions menu in document order: the context
// menu's surface, named by its own text.
const contextSurface = (page: Page) =>
    page.locator('[data-scope="menu"][data-part="context-trigger"]', { hasText: 'Right-click' });

test('Tab closes the menu and focus moves on to the next tab stop (#263)', async ({ page }) => {
    await actions(page).focus();
    await page.keyboard.press('ArrowDown');
    const popup = await controlledPopup(page, actions(page), 'the Actions menu trigger');
    await expect(popup.locator('[data-part="item"]', { hasText: 'Rename' })).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(popup).toHaveAttribute('data-state', 'closed');
    await expect(popup).toBeHidden();
    // Not pulled back to the trigger and moved on from there — the stop
    // after the menu, reached from the item itself.
    await expect(contextSurface(page)).toBeFocused();
});

test('Shift+Tab closes the menu and focus moves to the previous tab stop (#263)', async ({ page }, testInfo) => {
    await actions(page).focus();
    await page.keyboard.press('ArrowUp');
    const popup = await controlledPopup(page, actions(page), 'the Actions menu trigger');
    await expect(popup.locator('[data-part="item"]', { hasText: 'Delete' })).toBeFocused();

    await page.keyboard.press('Shift+Tab');
    await expect(popup).toHaveAttribute('data-state', 'closed');
    await expect(popup).toBeHidden();
    await expect(actions(page)).toHaveAttribute('aria-expanded', 'false');
    if (testInfo.project.name !== 'webkit') {
        // The stop before the item in document order is the trigger.
        await expect(actions(page)).toBeFocused();
        return;
    }
    // WebKit leaves buttons out of the Tab order by default, so the stop
    // before the item is the one before the trigger: the same element a
    // Shift+Tab from the trigger itself reaches — and never the trigger,
    // which would mean the close had pulled focus back.
    await expect(actions(page)).not.toBeFocused();
    const landed = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return false;
        el.setAttribute('data-test-landed', '');
        return true;
    });
    expect(landed, 'Shift+Tab left focus on nothing').toBe(true);
    await actions(page).focus();
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('[data-test-landed]')).toBeFocused();
});

test('Tab from a nested submenu closes the whole chain (#263)', async ({ page }) => {
    await actions(page).focus();
    await page.keyboard.press('ArrowDown');
    const popup = await controlledPopup(page, actions(page), 'the Actions menu trigger');
    const share = popup.locator('[data-part="sub-trigger"]', { hasText: 'Share' });
    await share.focus();
    await page.keyboard.press('ArrowRight');
    const sharePopup = await controlledPopup(page, share, 'the Share sub-trigger');
    const social = sharePopup.locator('[data-part="sub-trigger"]', { hasText: 'Social' });
    await social.focus();
    await page.keyboard.press('ArrowRight');
    const socialPopup = await controlledPopup(page, social, 'the Social sub-trigger');
    await expect(socialPopup.getByRole('menuitem', { name: 'Mastodon' })).toBeFocused();

    await page.keyboard.press('Tab');
    for (const level of [socialPopup, sharePopup, popup]) {
        await expect(level).toHaveAttribute('data-state', 'closed');
        await expect(level).toBeHidden();
    }
    await expect(contextSurface(page)).toBeFocused();
});

test('a keyboard-opened menu\'s arrow points at its trigger (#279)', async ({ page }) => {
    const sort = page.getByRole('button', { name: 'Sort', exact: true });
    await sort.focus();
    await page.keyboard.press('Enter');
    const popup = await controlledPopup(page, sort, 'the Sort menu trigger');
    await expect(popup).toHaveAttribute('data-state', 'open');
    await expect(popup.getByRole('menuitem', { name: 'Newest first' })).toBeFocused();
    const { placement, popup: box, arrow, target: trigger } = await arrowGeometry(popup, sort, 'the Sort menu');
    expect(['top', 'bottom']).toContain(placement);
    expect(Math.abs(arrow.x + arrow.width / 2 - (trigger.x + trigger.width / 2))).toBeLessThanOrEqual(2);
    const edge = placement === 'bottom' ? box.y : box.y + box.height;
    expect(arrow.y).toBeLessThan(edge);
    expect(arrow.y + arrow.height).toBeGreaterThan(edge);
    // Arrow keys still walk the items only: the arrow is not one.
    await page.keyboard.press('ArrowDown');
    await expect(popup.getByRole('menuitem', { name: 'Oldest first' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(popup.getByRole('menuitem', { name: 'Newest first' })).toBeFocused();
});

/**
 * Tooltip → Menu.Trigger → Button.Root (#495): one element, the Button's,
 * carrying the menu button's ARIA and the tooltip's hover label. Named by
 * its accessible name, the menu through the `aria-controls` the lent menu
 * trigger put on the Button, and the tooltip by its text.
 */
test.describe('a tooltip lent through a Menu.Trigger to a Button (#495)', () => {
    const more = (page: Page) => page.getByRole('button', { name: 'More actions', exact: true });
    const tip = (page: Page) =>
        page.locator('[data-scope="tooltip"][data-part="popup"]', { hasText: /^More actions$/ });
    const menu = (page: Page) => controlledPopup(page, more(page), 'the More actions trigger');

    test('the element is the Button, with the menu button\'s ARIA', async ({ page }) => {
        const b = more(page);
        await expect(b).toHaveAttribute('data-scope', 'button');
        await expect(b).toHaveAttribute('data-part', 'root');
        await expect(b).toHaveAttribute('aria-haspopup', 'menu');
        await expect(b).toHaveAttribute('aria-expanded', 'false');
        await expect(page.locator('[data-demo="menu-tooltip-lend"] [data-scope="menu"][data-part="trigger"]')).toHaveCount(0);
        await expect(page.locator('[data-demo="menu-tooltip-lend"] [data-scope="tooltip"][data-part="trigger"]')).toHaveCount(0);
    });

    test('hover shows the tooltip; a click opens the menu without it', async ({ page }) => {
        const b = more(page);
        await b.hover();
        await expect(tip(page)).toHaveAttribute('data-state', 'open');
        await expect(b).toHaveAccessibleDescription('More actions');

        await b.click();
        const popup = await menu(page);
        await expect(popup).toHaveAttribute('data-state', 'open');
        await expect(popup).toBeVisible();
        await expect(b).toHaveAttribute('aria-expanded', 'true');
        await expect(tip(page)).toHaveAttribute('data-state', 'closed');
        // The pointer still rests on the Button: the tooltip stays shut over
        // the menu the press opened.
        await page.waitForTimeout(900);
        await expect(tip(page)).toHaveAttribute('data-state', 'closed');
        await expect(popup).toHaveAttribute('data-state', 'open');
    });

    test('Escape closes the menu first; focus returns to the Button', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        const b = more(page);
        // A script focus matches :focus-visible — the keyboard path, which
        // shows the tooltip; its own Escape closes only the tooltip.
        await b.focus();
        await expect(tip(page)).toHaveAttribute('data-state', 'open');
        await page.keyboard.press('Escape');
        await expect(tip(page)).toHaveAttribute('data-state', 'closed');
        await expect(b).toBeFocused();

        await page.keyboard.press('ArrowDown');
        const popup = await menu(page);
        await expect(popup).toHaveAttribute('data-state', 'open');
        await expect(popup.getByRole('menuitem', { name: 'Pin' })).toBeFocused();
        await expect(tip(page)).toHaveAttribute('data-state', 'closed');

        // One Escape closes the menu and nothing else is left open behind it
        // but, at most, the tooltip.
        await page.keyboard.press('Escape');
        await expect(popup).toHaveAttribute('data-state', 'closed');
        await expect(b).toBeFocused();
        await expect(b).toHaveAttribute('aria-expanded', 'false');

        // Decision G (#452): focus handed back by the keyboard close is a
        // keyboard focus, so the tooltip opens again — accepted, and pinned
        // here. The next Escape closes it and leaves the menu shut.
        await expect(tip(page)).toHaveAttribute('data-state', 'open');
        // Really showing: the focus lands inside the menu's own hide, when
        // a popover cannot show yet — the tooltip waits for it to finish.
        await expect(tip(page)).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(tip(page)).toHaveAttribute('data-state', 'closed');
        await expect(popup).toHaveAttribute('data-state', 'closed');
        await expect(b).toBeFocused();
        expect(errors).toEqual([]);
    });
});
