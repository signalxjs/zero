/**
 * The narrow-viewport sweep (#45): every registry page, in every design
 * system, at phone width.
 *
 * Everything else in this suite runs at the Playwright default width, so a
 * part that escapes its column at 420px — a `<textarea>` whose intrinsic
 * width comes from `cols`, a pagination row that never wraps — was invisible
 * until someone looked at a phone. This spec is what looks.
 *
 * It runs ONLY in the `narrow` project (see `playwright.config.ts`, which
 * gives that project its viewport and keeps this file out of the others), and
 * it is a sweep rather than per-component specs: for each page, two claims.
 *
 * 1. **The document does not scroll sideways.** `scrollWidth` against
 *    `clientWidth` on the root — the symptom a reader actually meets.
 * 2. **No rendered part escapes the content column.** Every
 *    `[data-scope][data-part]` inside `main`, measured against the CONTENT
 *    box of `main.shell-main`, not the viewport: the playground's own shell
 *    offsets everything, and measuring against the window reports every page
 *    as broken and buries the real signal.
 *
 * Two exclusions, both learned the hard way on the throwaway version (which
 * reported 747 "defects" of which 732 were these):
 *
 * - A part that is not visible (`checkVisibility()` with the opacity and
 *   visibility checks on) — a closed popup, a `hidden` panel, a swap's idle
 *   face — cannot be seen escaping anything. Neither can a 1px box, which is
 *   the visually-hidden pattern (hidden inputs, off-screen labels).
 *   A `position: fixed` part (the toast viewport, an open modal) is placed
 *   against the viewport, not the column, and is skipped for the same
 *   reason: the column is not its containing block.
 * - A part inside a horizontal scroller or clipper — any ancestor, up to
 *   `main`, whose `overflow-x` is not `visible` — is contained by that
 *   ancestor by design (carousel items, a scrolled pagination row, a table
 *   wrapper). The ancestor itself is still measured, which is the claim
 *   that matters.
 *
 * Deliberate exceptions live in `narrow-allowlist.json` as
 * `{ ds, scope, part, reason }` rows (`ds: "*"` for every design system) —
 * the axe audit's shape. A row nothing matched fails the spec as stale, so an
 * exception cannot outlive the thing it excused.
 *
 * Chromium only, like `narrow-dialog.spec.ts`: this is a claim about our own
 * cascade at a width, not about engine behaviour.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { bootPage } from './nav';
import { DESIGN_SYSTEMS } from './demo';

const here = dirname(fileURLToPath(import.meta.url));

interface AllowlistEntry {
    ds: string;
    scope: string;
    part: string;
    reason: string;
}

const allowlist: AllowlistEntry[] = JSON.parse(readFileSync(join(here, 'narrow-allowlist.json'), 'utf8'));

interface Escape {
    scope: string;
    part: string;
    /** How far past the column's inline-start edge (px, 0 when inside). */
    start: number;
    /** How far past the column's inline-end edge (px, 0 when inside). */
    end: number;
}

/**
 * Sub-pixel slack. `getBoundingClientRect()` is fractional and a centred or
 * percentage-placed box can land on a sub-pixel edge; the defects this
 * catches are whole pixels (the smallest in #45 was ~1px, so the slack stays
 * below it).
 */
const SLACK = 0.5;

for (const ds of DESIGN_SYSTEMS) {
    test(`${ds}: no registry page scrolls sideways or lets a part escape the content column`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'narrow', 'the sweep is the narrow project\'s own');
        // ~55 page loads per design system.
        test.setTimeout(300_000);

        // The sidebar derives from the registry — its links ARE the page
        // list (the axe audit's approach, for the same reason). `all` is
        // excluded: it re-renders every page's demos, doubling every finding.
        await bootPage(page, 'about', ds);
        const pageIds = (
            await page.locator('nav[aria-label="Pages"] a').evaluateAll((links) =>
                links.map((a) => a.getAttribute('href') ?? ''))
        )
            .map((h) => h.replace(/^#\//, ''))
            .filter((id) => id !== '' && id !== 'all');
        expect(pageIds.length).toBeGreaterThan(30);

        const findings: string[] = [];
        const used = new Set<AllowlistEntry>();

        for (const pageId of pageIds) {
            await bootPage(page, pageId, ds);
            // Let entry transitions land before measuring anything — the
            // FINITE ones: a spinner or skeleton loop never finishes, and
            // waiting on it is a hang, not a settle.
            await page.evaluate(() =>
                Promise.all(document.getAnimations()
                    .filter((a) => Number.isFinite(Number(a.effect?.getComputedTiming().endTime)))
                    .map((a) => a.finished.catch(() => {}))));

            const { docOverflow, escapes } = await page.evaluate((slack): {
                docOverflow: number;
                escapes: Escape[];
            } => {
                const main = document.querySelector<HTMLElement>('main.shell-main')!;
                const mainRect = main.getBoundingClientRect();
                const cs = getComputedStyle(main);
                const left = mainRect.left + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth);
                const right = mainRect.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth);
                const rtl = cs.direction === 'rtl';

                const contained = (el: Element): boolean => {
                    for (let p = el.parentElement; p && p !== main; p = p.parentElement) {
                        const s = getComputedStyle(p);
                        if (s.overflowX !== 'visible') return true;
                        if (s.position === 'fixed') return true;
                    }
                    return false;
                };

                const escapes: Escape[] = [];
                for (const el of main.querySelectorAll<HTMLElement>('[data-scope][data-part]')) {
                    const style = getComputedStyle(el);
                    if (style.position === 'fixed') continue;
                    // Not rendered, or rendered but invisible (a swap's
                    // idle face at opacity 0, a `visibility: hidden` layer):
                    // nothing a reader can see has escaped.
                    if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
                    if (contained(el)) continue;
                    const r = el.getBoundingClientRect();
                    // A 1px box is the visually-hidden pattern (a hidden
                    // input, a VisuallyHidden label) — clipped to nothing,
                    // and free to sit a pixel outside by design.
                    if (r.width <= 1 && r.height <= 1) continue;
                    const pastLeft = Math.max(0, left - r.left);
                    const pastRight = Math.max(0, r.right - right);
                    if (pastLeft <= slack && pastRight <= slack) continue;
                    escapes.push({
                        scope: el.dataset.scope!,
                        part: el.dataset.part!,
                        start: Math.round(rtl ? pastRight : pastLeft),
                        end: Math.round(rtl ? pastLeft : pastRight),
                    });
                }
                const root = document.documentElement;
                return { docOverflow: root.scrollWidth - root.clientWidth, escapes };
            }, SLACK);

            if (docOverflow > 0) {
                findings.push(`[${pageId}] the document scrolls sideways by ${docOverflow}px`);
            }
            // One line per scope/part per page: a list renders the same
            // overflow once per item, and the signal is the part, not the count.
            const seen = new Map<string, Escape>();
            for (const e of escapes) {
                const key = `${e.scope}/${e.part}`;
                const prev = seen.get(key);
                if (!prev || e.start + e.end > prev.start + prev.end) seen.set(key, e);
            }
            for (const [key, e] of seen) {
                const entry = allowlist.find((a) =>
                    (a.ds === '*' || a.ds === ds) && a.scope === e.scope && a.part === e.part);
                if (entry) {
                    used.add(entry);
                    continue;
                }
                findings.push(`[${pageId}] ${key} escapes the content column (start ${e.start}px, end ${e.end}px)`);
            }
        }

        expect(findings, `${ds} at ${page.viewportSize()!.width}px:\n${findings.join('\n')}`).toEqual([]);

        // Stale rows fail, per design system: a row that names this design
        // system (or all of them) and matched nothing no longer guards anything.
        const stale = allowlist.filter((a) => (a.ds === '*' || a.ds === ds) && !used.has(a));
        expect(
            stale,
            `${ds}: stale narrow-allowlist rows (nothing matched them):\n${stale.map((s) => `${s.scope}/${s.part}`).join('\n')}`,
        ).toEqual([]);
    });
}
