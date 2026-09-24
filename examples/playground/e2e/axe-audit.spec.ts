/**
 * Automated ARIA audit — axe-core over every registry page (#326).
 *
 * The missing counterpart to the contrast audit: that spec proves ink is
 * legible, nothing proved the SEMANTICS — names, roles, required children,
 * reference integrity — beyond what each component's own unit tests assert.
 * This walks every page of the playground (the ids come from the rendered
 * sidebar, which derives from `src/pages/registry.ts` — importing the
 * registry here would drag every page's JSX through Playwright's
 * transpiler), scans each page once per surface that idles closed — every
 * dialog, submenu, context menu, select/combobox popup and the app shell's
 * narrow-viewport sheet (`SCANS` below; a closed popup is display:none, so
 * axe skips it entirely) — and hard-fails on any serious or critical WCAG
 * A/AA violation.
 *
 * Chromium-only, zero-basic only: the tree axe audits is the runtime's
 * output, which is engine- and design-system-independent — recipes add
 * paint, not semantics. (The one semantic thing a design system CAN break —
 * contrast — has its own audit with a deliberately different floor; see
 * `disableRules` below.)
 *
 * Exceptions live in `axe-allowlist.json` as `{ rule, selector, reason }`
 * rows — for findings that are genuinely correct but flagged. A real bug
 * never goes in the allowlist; it gets fixed in `packages/zero`.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, type Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { bootPage } from './nav';
import { controlledPopup, demoPosting } from './demo';

const here = dirname(fileURLToPath(import.meta.url));

interface AllowlistEntry {
    rule: string;
    selector: string;
    reason: string;
}

const allowlist: AllowlistEntry[] = JSON.parse(
    readFileSync(join(here, 'axe-allowlist.json'), 'utf8'),
);

/**
 * The states each page is scanned in. Axe only audits the rendered tree — a
 * closed popup is display:none and contributes nothing — so a page whose
 * surfaces idle closed lists one SCAN per surface: a named sequence of steps
 * that puts the page into that state, after which the page is scanned. Every
 * scan starts from a fresh load of its page, so no state leaks from one scan
 * into the next (an open submenu, a narrowed viewport).
 *
 * One scan per page was the old shape (#194), and it left every surface but
 * the first unscanned: submenus, the context menu, the alertdialogs, the
 * grouped and virtual selects, the forms page's popups, the app-shell's
 * modal sheet. A page absent from this map is scanned once, as it idles.
 */
interface Scan {
    /** What the scan covers, for the report. */
    name: string;
    /** Runs the steps. Viewport changes are undone after the scan. */
    open: (page: Page) => Promise<void>;
    /** A viewport to scan at instead of the project's (the app-shell sheet). */
    viewport?: { width: number; height: number };
}

const openDialog = (label: string) => async (page: Page) => {
    await page.getByRole('button', { name: label, exact: true }).click();
    // By the trigger's own aria-controls: the page holds several dialogs.
    const popup = await controlledPopup(page, page.getByRole('button', { name: label, exact: true }), label);
    await expect(popup).toHaveAttribute('data-state', 'open');
    await expect(popup).toBeVisible();
};

const openSelect = (scope: 'select' | 'combobox', name: string) => async (page: Page) => {
    const demo = demoPosting(page, scope, name);
    await demo('trigger').click();
    await expect(demo('popup')).toHaveAttribute('data-state', 'open');
    await expect(demo('popup')).toBeVisible();
};

const menuTrigger = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const subTrigger = (page: Page, text: string) =>
    page.locator('[data-scope="menu"][data-part="sub-trigger"]', { hasText: text });

/** Open a submenu from its (already visible) sub-trigger, by keyboard. */
async function openSub(page: Page, text: string): Promise<void> {
    await subTrigger(page, text).focus();
    await page.keyboard.press('ArrowRight');
    const popup = await controlledPopup(page, subTrigger(page, text), `the ${text} sub-trigger`);
    await expect(popup).toHaveAttribute('data-state', 'open');
    await expect(popup).toBeVisible();
}

async function openMenu(page: Page, name: string): Promise<void> {
    await menuTrigger(page, name).click();
    const popup = await controlledPopup(page, menuTrigger(page, name), `the ${name} menu trigger`);
    await expect(popup).toHaveAttribute('data-state', 'open');
    await expect(popup).toBeVisible();
}

const SCANS: Record<string, Scan[]> = {
    dialog: [
        { name: 'modal dialog', open: openDialog('Open dialog') },
        { name: 'non-modal find bar', open: openDialog('Open find bar') },
        { name: 'alertdialog', open: openDialog('Delete file…') },
        { name: 'alertdialog with dependents', open: openDialog('Delete workspace…') },
    ],
    drawer: [{
        name: 'modal drawer',
        open: async (page) => {
            await page.getByRole('button', { name: 'Open drawer', exact: true }).click();
            // By name: the page also idles a responsive drawer docked open (#82).
            await expect(page.getByRole('dialog', { name: 'Navigation', exact: true })).toBeVisible();
        },
    }],
    popover: [{
        name: 'popover',
        open: async (page) => {
            await page.getByRole('button', { name: 'Filters', exact: true }).click();
            await expect(page.locator('[data-scope="popover"][data-part="popup"][data-state="open"]')).toBeVisible();
        },
    }],
    tooltip: [{
        name: 'tooltip',
        open: async (page) => {
            // Focus opens immediately — no intent delay to wait out.
            await page.getByRole('button', { name: 'Hover me', exact: true }).focus();
            await expect(page.locator('[data-scope="tooltip"][data-part="popup"][data-state="open"]')).toBeVisible();
        },
    }],
    menu: [
        { name: 'Actions menu', open: (page) => openMenu(page, 'Actions') },
        {
            name: 'Actions menu, nested submenus open',
            open: async (page) => {
                await openMenu(page, 'Actions');
                await openSub(page, 'Share');
                await openSub(page, 'Social');
            },
        },
        {
            name: 'context menu with its submenu open',
            open: async (page) => {
                const surface = page.locator('[data-scope="menu"][data-part="context-trigger"]');
                await surface.scrollIntoViewIfNeeded();
                await surface.click({ button: 'right' });
                const popup = await controlledPopup(page, surface, 'the context surface');
                await expect(popup).toHaveAttribute('data-state', 'open');
                await expect(popup).toBeVisible();
                await openSub(page, 'Send to');
            },
        },
        { name: 'selection-items menu', open: (page) => openMenu(page, 'View') },
    ],
    select: [
        { name: 'children select', open: openSelect('select', 'fruit') },
        { name: 'options-driven select', open: openSelect('select', 'sugar-fruit') },
        { name: 'grouped select', open: openSelect('select', 'grouped-fruit') },
        { name: 'virtual select', open: openSelect('select', 'station') },
        { name: 'virtual grouped select', open: openSelect('select', 'station-by-line') },
    ],
    combobox: [
        // A bare input click only focuses — the caret Trigger is the opener.
        { name: 'children combobox', open: openSelect('combobox', 'country') },
        { name: 'grouped combobox', open: openSelect('combobox', 'grouped-country') },
        { name: 'virtual combobox', open: openSelect('combobox', 'station-search') },
        { name: 'virtual grouped combobox', open: openSelect('combobox', 'station-search-by-line') },
    ],
    forms: [
        { name: 'form select', open: openSelect('select', 'form-fruit') },
        { name: 'form combobox', open: openSelect('combobox', 'form-country') },
    ],
    'app-shell': [
        { name: 'docked sidebar', open: async () => {} },
        {
            // Below `md` the same NavList is a modal sheet — a presentation
            // the desktop viewport never renders.
            name: 'narrow: modal navigation sheet',
            viewport: { width: 600, height: 720 },
            open: async (page) => {
                const shell = page.locator('[data-demo="app-shell"]');
                const trigger = shell.locator('[data-scope="drawer"][data-part="trigger"]');
                await trigger.click();
                const panel = await controlledPopup(page, trigger, 'the shell drawer trigger');
                await expect(panel).toBeVisible();
                await expect(panel).toHaveAttribute('data-l-dock', 'sheet');
            },
        },
    ],
    toast: [{
        name: 'toast',
        open: async (page) => {
            await page.getByRole('button', { name: 'Success toast', exact: true }).click();
            await expect(page.locator('[data-scope="toast"][data-part="root"]', { hasText: 'Saved' })).toBeVisible();
        },
    }],
    // accordion and collapsible need no scan list: both demos idle OPEN
    // (defaultValue / defaultOpen), so their panels are already in the tree.
};

/** Every scan's starting point: a fresh document on `pageId`. */
async function freshBoot(page: Page, pageId: string): Promise<void> {
    // A second `bootPage` onto the SAME id would be a no-op hash navigation,
    // leaving the previous scan's open surfaces in place.
    await page.goto('about:blank');
    await bootPage(page, pageId, 'basic');
}

interface Finding {
    pageId: string;
    scan: string;
    rule: string;
    impact: string;
    target: string;
    help: string;
}

const allowlisted = (rule: string, target: string): AllowlistEntry | undefined =>
    allowlist.find((entry) => entry.rule === rule && entry.selector === target);

test('axe: every registry page (overlays open) is free of serious/critical WCAG A/AA violations', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'semantics are engine-independent — one engine is enough');
    // ~60 pages, ~85 scans, each from a fresh load; the default budget is
    // per-action, not per-test, but be explicit about the shape of this test.
    test.setTimeout(600_000);

    // The sidebar derives from the registry — its links ARE the page list.
    // `all` is excluded: it re-renders every page's demos on one document,
    // so auditing it would double-count every finding.
    await bootPage(page, 'about', 'basic');
    const hrefs = await page.locator('nav[aria-label="Pages"] a').evaluateAll(
        (links) => links.map((a) => a.getAttribute('href') ?? ''),
    );
    const pageIds = hrefs
        .map((h) => h.replace(/^#\//, ''))
        .filter((id) => id !== '' && id !== 'all');
    expect(pageIds.length).toBeGreaterThan(30);
    // A stale scan list is a silent coverage hole: its page would simply
    // never be opened. Fail loudly instead.
    for (const id of Object.keys(SCANS)) {
        expect(pageIds, `scans for unknown page id "${id}"`).toContain(id);
    }

    const findings: Finding[] = [];
    const usedAllowlist = new Set<AllowlistEntry>();
    const defaultViewport = page.viewportSize();

    for (const pageId of pageIds) {
        for (const scan of SCANS[pageId] ?? [{ name: 'idle', open: async () => {} }]) {
            if (scan.viewport) await page.setViewportSize(scan.viewport);
            await freshBoot(page, pageId);
            await scan.open(page);

            const results = await new AxeBuilder({ page })
                .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
                // Contrast is governed by contrast-audit.spec.ts, which checks
                // every state × flag × design system × theme against deliberate
                // floors (3:1, with a disabled-state carve-out) — axe's single
                // resting-state sample would re-litigate that policy, not add
                // coverage. Everything else runs.
                .disableRules(['color-contrast'])
                .analyze();
            if (scan.viewport && defaultViewport) await page.setViewportSize(defaultViewport);

            for (const violation of results.violations) {
                if (violation.impact !== 'serious' && violation.impact !== 'critical') continue;
                for (const node of violation.nodes) {
                    const target = node.target.join(' ');
                    const entry = allowlisted(violation.id, target);
                    if (entry) {
                        usedAllowlist.add(entry);
                        continue;
                    }
                    findings.push({
                        pageId,
                        scan: scan.name,
                        rule: violation.id,
                        impact: violation.impact,
                        target,
                        help: violation.help,
                    });
                }
            }
        }
    }

    const report = findings
        .map((f) => `[${f.pageId} · ${f.scan}] ${f.rule} (${f.impact}) at ${f.target} — ${f.help}`)
        .join('\n');
    expect(findings, `axe violations:\n${report}`).toEqual([]);

    // An allowlist row nothing matched is stale — either the bug got fixed
    // (delete the row) or the selector drifted (it no longer guards anything).
    const stale = allowlist.filter((entry) => !usedAllowlist.has(entry));
    expect(
        stale,
        `stale allowlist entries (nothing matched them):\n${stale.map((s) => `${s.rule} at ${s.selector}`).join('\n')}`,
    ).toEqual([]);
});
