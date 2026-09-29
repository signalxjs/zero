/**
 * The app shell: the `AppShell` frame (#459) around the Navbar + responsive
 * Drawer + NavList composition (#133). `drawer-responsive.spec.ts` proves
 * the dock/sheet mechanism; this proves the COMPOSITION holds it — the same
 * NavList rendered once is the docked sidebar at `md` and a sheet below it,
 * the trigger lives in the bar and hides when docked, and the page keeps
 * exactly one banner and one navigation landmark either way.
 *
 * And it proves the FRAME: the root holds its box however much content the
 * regions carry, each region is its own scroll box — a real wheel over one
 * scrolls it and nothing else, not the other region, not the window — a
 * focused region scrolls from the keyboard, and the frame renders exactly
 * one `<main>` (its own part) and two named region landmarks.
 */
import { test, expect, type Locator, type Page } from '@playwright/test';
import { bootPage } from './nav';
import { controlledPopup, partsOf, settledBox } from './demo';

const WIDE = { width: 1280, height: 720 };
const NARROW = { width: 600, height: 720 };

const shell = (page: Page) => page.locator('[data-demo="app-shell"]');
/**
 * By its part, within the shell's own root — not `getByRole`, which skips
 * hidden elements, and the trigger is hidden whenever the panel is docked.
 */
const trigger = (page: Page) => shell(page).locator('[data-scope="drawer"][data-part="trigger"]');
const navList = (page: Page) => shell(page).locator('[data-scope="nav-list"][data-part="root"]');
/** The AppShell root inside the demo, and its parts through it. */
const frame = (page: Page) => shell(page).locator('[data-scope="app-shell"][data-part="root"]');
const frameParts = (page: Page) => partsOf(frame(page), 'app-shell');
const region = (page: Page, name: string) => frame(page).getByRole('region', { name });
const REGIONS = ['Messages', 'Reading pane'] as const;

const scrollTop = (loc: Locator) => loc.evaluate((el) => el.scrollTop);

async function boot(page: Page, viewport: { width: number; height: number }) {
    await page.setViewportSize(viewport);
    await bootPage(page, 'app-shell', 'basic');
    await expect(trigger(page)).toHaveCount(1);
}

test('wide: the sidebar is docked in flow beside main, the bar has no menu button', async ({ page }) => {
    await boot(page, WIDE);
    const panel = await controlledPopup(page, trigger(page), 'the shell drawer trigger');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-l-dock', 'inline');
    await expect(navList(page)).toBeVisible();
    await expect(trigger(page)).toBeHidden();
    // Side by side: the panel's right edge is at or left of main's left edge.
    const panelBox = await settledBox(panel, 'the docked sidebar');
    const mainBox = await settledBox(frameParts(page)('main'), 'the shell main');
    expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(mainBox.x + 1);
    expect(await navList(page).evaluate((el) => el.closest('[data-part="panel"]') !== null)).toBe(true);
});

test('narrow: the menu button opens the same navigation as a sheet', async ({ page }) => {
    await boot(page, NARROW);
    const panel = await controlledPopup(page, trigger(page), 'the shell drawer trigger');
    await expect(trigger(page)).toBeVisible();
    await expect(panel).toBeHidden();
    await trigger(page).click();
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-l-dock', 'sheet');
    await expect(navList(page)).toBeVisible();
    await expect(navList(page).getByRole('link', { name: /Overview/ })).toHaveAttribute('aria-current', 'page');
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
});

test('one header, one navigation landmark, in both regimes', async ({ page }) => {
    for (const viewport of [WIDE, NARROW]) {
        await boot(page, viewport);
        // The Navbar's <header> is the banner landmark only at document
        // scope (ARIA's rule, and the anatomy's reasoning); nested in a demo
        // it is a plain header, so this counts the element, not the role.
        expect(await shell(page).locator('header').count()).toBe(1);
        // The <nav> is NavList's; Navbar's <header> deliberately carries none.
        expect(await shell(page).locator('nav').count()).toBe(1);
        await expect(shell(page).locator('nav')).toHaveAttribute('aria-label', 'Main');
        // Exactly one <main>, and it is the frame's own part — not a raw
        // element an app had to spell with asChild.
        await expect(shell(page).locator('main')).toHaveCount(1);
        await expect(shell(page).locator('main')).toHaveAttribute('data-scope', 'app-shell');
        await expect(shell(page).locator('main')).toHaveAttribute('data-part', 'main');
        // Both regions are named region landmarks.
        await expect(frameParts(page)('region')).toHaveCount(2);
        for (const name of REGIONS) await expect(region(page, name)).toHaveCount(1);
    }
});

test('the frame holds its box however much content the regions carry', async ({ page }) => {
    await boot(page, WIDE);
    const root = frame(page);
    const before = await settledBox(root, 'the app-shell root');
    const scrollY = await page.evaluate(() => window.scrollY);

    // Grow one region's content well past what it already overflows by.
    await region(page, 'Messages').locator('ul').evaluate((ul) => {
        for (let i = 0; i < 60; i++) ul.append(Object.assign(document.createElement('li'), { textContent: `Added ${i}` }));
    });

    const after = await settledBox(root, 'the app-shell root');
    expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(0.5);
    // The root never overflows (the regions absorb it), and the page did
    // not move.
    const { scrollHeight, clientHeight } = await root.evaluate((el) => ({ scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }));
    expect(scrollHeight).toBeLessThanOrEqual(clientHeight);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
    // And the frame's box is the bounded demo's, not the content's.
    const demo = await settledBox(shell(page), 'the demo wrapper');
    expect(after.height).toBeLessThanOrEqual(demo.height);
});

for (const name of REGIONS) {
    test(`the "${name}" region scrolls on its own under a real wheel`, async ({ page }) => {
        await boot(page, WIDE);
        const own = region(page, name);
        const other = region(page, REGIONS.find((r) => r !== name)!);
        const { scrollHeight, clientHeight } = await own.evaluate((el) => ({ scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }));
        expect(scrollHeight, `${name} must overflow for this test to mean anything`).toBeGreaterThan(clientHeight);

        await own.scrollIntoViewIfNeeded();
        const scrollY = await page.evaluate(() => window.scrollY);
        const box = await settledBox(own, `the ${name} region`);
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.wheel(0, 200);

        await expect.poll(() => scrollTop(own), { message: `${name} scrolls under the wheel` }).toBeGreaterThan(0);
        expect(await scrollTop(other)).toBe(0);
        expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
    });
}

test('a focused region scrolls from the keyboard', async ({ page }) => {
    // Reached with focus(), not Tab: WebKit's default Tab order skips
    // non-form controls, so a Tab-based assertion would prove nothing there.
    await boot(page, WIDE);
    const own = region(page, 'Reading pane');
    await expect(own).toHaveAttribute('tabindex', '0');
    await own.focus();
    await expect(own).toBeFocused();
    await page.keyboard.press('PageDown');
    await expect.poll(() => scrollTop(own), { message: 'PageDown scrolls the focused region' }).toBeGreaterThan(0);
    expect(await scrollTop(region(page, 'Messages'))).toBe(0);
});
