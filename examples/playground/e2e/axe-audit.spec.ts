/**
 * Automated ARIA audit — axe-core over every registry page (#326).
 *
 * The missing counterpart to the contrast audit: that spec proves ink is
 * legible, nothing proved the SEMANTICS — names, roles, required children,
 * reference integrity — beyond what each component's own unit tests assert.
 * This walks every page of the playground (the ids come from the rendered
 * sidebar, which derives from `src/pages/registry.ts` — importing the
 * registry here would drag every page's JSX through Playwright's
 * transpiler), opens the primary overlay on pages whose component idles
 * closed (a closed dialog is display:none — axe skips it entirely), and
 * hard-fails on any serious or critical WCAG A/AA violation.
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
import { demoPosting } from './demo';

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
 * Openers for pages whose primary surface idles closed. Axe only audits the
 * rendered tree — a closed popup contributes nothing — so each of these
 * puts the page into its interesting state before the scan.
 */
const OPENERS: Record<string, (page: Page) => Promise<void>> = {
    dialog: async (page) => {
        await page.getByRole('button', { name: 'Open dialog', exact: true }).click();
        await expect(page.locator('[data-scope="dialog"][data-part="popup"][data-state="open"]')).toBeVisible();
    },
    drawer: async (page) => {
        await page.getByRole('button', { name: 'Open drawer', exact: true }).click();
        await expect(page.locator('[data-scope="drawer"][data-part="panel"][data-state="open"]')).toBeVisible();
    },
    popover: async (page) => {
        await page.getByRole('button', { name: 'Filters', exact: true }).click();
        await expect(page.locator('[data-scope="popover"][data-part="popup"][data-state="open"]')).toBeVisible();
    },
    tooltip: async (page) => {
        // Focus opens immediately — no intent delay to wait out.
        await page.getByRole('button', { name: 'Hover me', exact: true }).focus();
        await expect(page.locator('[data-scope="tooltip"][data-part="popup"][data-state="open"]')).toBeVisible();
    },
    menu: async (page) => {
        await page.getByRole('button', { name: 'Actions', exact: true }).click();
        await expect(page.locator('[data-scope="menu"][data-part="popup"][data-state="open"]')).toBeVisible();
    },
    select: async (page) => {
        await demoPosting(page, 'select', 'fruit')('trigger').click();
        await expect(demoPosting(page, 'select', 'fruit')('popup')).toHaveAttribute('data-state', 'open');
    },
    combobox: async (page) => {
        // A bare input click only focuses — the caret Trigger is the opener.
        await demoPosting(page, 'combobox', 'country')('trigger').click();
        await expect(demoPosting(page, 'combobox', 'country')('popup')).toHaveAttribute('data-state', 'open');
    },
    toast: async (page) => {
        await page.getByRole('button', { name: 'Success toast', exact: true }).click();
        await expect(page.locator('[data-scope="toast"][data-part="root"]', { hasText: 'Saved' })).toBeVisible();
    },
    // accordion and collapsible need no opener: both demos idle OPEN
    // (defaultValue / defaultOpen), so their panels are already in the tree.
};

interface Finding {
    pageId: string;
    rule: string;
    impact: string;
    target: string;
    help: string;
}

const allowlisted = (rule: string, target: string): AllowlistEntry | undefined =>
    allowlist.find((entry) => entry.rule === rule && entry.selector === target);

test('axe: every registry page (overlays open) is free of serious/critical WCAG A/AA violations', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'semantics are engine-independent — one engine is enough');
    // ~35 pages × one scan each; the default budget is per-action, not
    // per-test, but be explicit about the shape of this test.
    test.setTimeout(300_000);

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
    // A stale opener is a silent coverage hole: its page would simply never
    // be opened. Fail loudly instead.
    for (const id of Object.keys(OPENERS)) {
        expect(pageIds, `opener for unknown page id "${id}"`).toContain(id);
    }

    const findings: Finding[] = [];
    const usedAllowlist = new Set<AllowlistEntry>();

    for (const pageId of pageIds) {
        await bootPage(page, pageId, 'basic');
        await OPENERS[pageId]?.(page);

        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
            // Contrast is governed by contrast-audit.spec.ts, which checks
            // every state × flag × design system × theme against deliberate
            // floors (3:1, with a disabled-state carve-out) — axe's single
            // resting-state sample would re-litigate that policy, not add
            // coverage. Everything else runs.
            .disableRules(['color-contrast'])
            .analyze();

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
                    rule: violation.id,
                    impact: violation.impact,
                    target,
                    help: violation.help,
                });
            }
        }
    }

    const report = findings
        .map((f) => `[${f.pageId}] ${f.rule} (${f.impact}) at ${f.target} — ${f.help}`)
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
