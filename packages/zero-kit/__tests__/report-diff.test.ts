/**
 * The report diff (issue #415; docs/architecture.md, "The authoring surface").
 *
 * Two kinds of fixture: REAL variations of zero-basic (a recipe dropped, a
 * state skipped) so the diff is read off `buildReport` rather than off a shape
 * this file invented; and mutated copies of a real report for the cases a
 * design system cannot cheaply produce (a contrast pair crossing a threshold,
 * a version mismatch).
 *
 * The load-bearing assertion is the skipped-state one: a state moved into
 * `skipStates` must NOT appear as resolved. The score already refuses to read a
 * waiver as full credit; the diff refusing to read it as progress is the same
 * stance, and the one a generating agent would otherwise game.
 */
import { describe, it, expect } from 'vitest';
import {
    buildReport,
    compileDesignSystem,
    diffReports,
    formatReportDiff,
    validateDesignSystem,
} from '@sigx/zero-kit';
import type { DesignSystemInput, DesignSystemReport, ManifestComponent, RecipeInput } from '@sigx/zero-kit';
import { anatomies } from '@sigx/zero/anatomy';
import { designSystem as basicDS } from '@sigx/zero-basic';

const manifest = {
    components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[],
};

const basic = basicDS as DesignSystemInput;

const reportFor = (ds: DesignSystemInput, withIssues = false): DesignSystemReport =>
    buildReport(compileDesignSystem(ds, manifest), ds, manifest, withIssues ? validateDesignSystem(ds, manifest) : undefined);

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const baseline = reportFor(basic);

/** The first styled part with an uncovered state, so the skip fixture is real. */
function firstUncovered(report: DesignSystemReport): { scope: string; part: string; state: string; kind: 'states' | 'flags' } {
    for (const [scope, component] of Object.entries(report.components)) {
        if (!component.styled) continue;
        for (const [part, coverage] of Object.entries(component.parts)) {
            for (const kind of ['states', 'flags'] as const) {
                const state = coverage[kind].uncovered[0];
                if (state) return { scope, part, state, kind };
            }
        }
    }
    throw new Error('zero-basic covers everything — pick another fixture');
}

describe('diffReports', () => {
    it('a report against itself is no change', () => {
        const diff = diffReports(baseline, baseline);
        expect(diff.changed).toBe(false);
        expect(diff.score.total.delta).toBe(0);
        expect(diff.score.grade).toEqual({ from: baseline.score.grade, to: baseline.score.grade });
        expect(Object.values(diff.score.criteria).every((d) => d.delta === 0)).toBe(true);
        expect(diff.components).toEqual({ newlyStyled: [], newlyUnstyled: [] });
        expect(diff.manifest).toEqual({ added: [], removed: [] });
        expect(diff.unwired).toEqual({ newly: [], resolved: [] });
        expect(diff.uncovered).toEqual({ newly: [], resolved: [] });
        expect(diff.skipped).toEqual({ newly: [], resolved: [] });
        expect(diff.contrast).toEqual({ newlyFailing: [], resolved: [] });
        expect(diff.issues).toBeUndefined();
        expect(formatReportDiff(diff)).toEqual(['basic — changes since the previous report', '  no change']);
    });

    it('a dropped recipe is newly unstyled, and the score falls', () => {
        const without: DesignSystemInput = { ...basic, recipes: basic.recipes.filter((r) => r.component !== 'kbd') };
        const diff = diffReports(baseline, reportFor(without));
        expect(diff.changed).toBe(true);
        expect(diff.components.newlyUnstyled).toEqual(['kbd']);
        expect(diff.components.newlyStyled).toEqual([]);
        expect(diff.score.total.delta).toBeLessThan(0);
        expect(diff.score.criteria['components']!.delta).toBeLessThan(0);
        // The dropped scope's states are NOT also listed as newly uncovered —
        // one change, counted once.
        expect(diff.uncovered.newly.some((key) => key.startsWith('kbd.'))).toBe(false);
        // …and the other direction reads as a gain.
        const back = diffReports(reportFor(without), baseline);
        expect(back.components.newlyStyled).toEqual(['kbd']);
        expect(back.score.total.delta).toBeGreaterThan(0);
        expect(formatReportDiff(diff)).toContain('  newly UNSTYLED: kbd');
    });

    it('a state moved into skipStates is skipped, not resolved — and earns less than a rule would', () => {
        const target = firstUncovered(baseline);
        const recipes = basic.recipes.map((recipe): RecipeInput => {
            if (recipe.component !== target.scope) return recipe;
            const existing = recipe.skipStates?.[target.part] ?? [];
            return { ...recipe, skipStates: { ...recipe.skipStates, [target.part]: [...existing, target.state] } };
        });
        const skipped = reportFor({ ...basic, recipes });
        const diff = diffReports(baseline, skipped);
        const key = `${target.scope}.${target.part}.${target.state}`;

        expect(diff.uncovered.resolved).toEqual([]);
        expect(diff.skipped.newly).toEqual([key]);
        const states = diff.score.criteria['states']!;
        const total = Number(skipped.score.criteria.states.detail['total']);
        expect(states.delta).toBeGreaterThan(0);
        expect(states.delta).toBeLessThan(100 / total); // half credit, never the full share
        expect(formatReportDiff(diff)).toContain(`  states newly skipped (delegated, not styled): ${key}`);

        // Reverse direction: un-skipping without styling is "newly uncovered".
        const back = diffReports(skipped, baseline);
        expect(back.uncovered.newly).toEqual([key]);
        expect(back.skipped.newly).toEqual([]);
    });

    it('a theme pair falling through 4.5:1 is newly failing at that threshold, and climbing back resolves it', () => {
        const worse = clone(baseline);
        const theme = worse.themes[0]!;
        const pair = theme.pairs.find((p) => p.ratio >= 5)!;
        const from = pair.ratio;
        pair.ratio = 3.2;
        const diff = diffReports(baseline, worse);
        expect(diff.contrast.newlyFailing).toEqual([
            { theme: theme.name, bg: pair.bg, fg: pair.fg, from, to: 3.2, threshold: 4.5 },
        ]);
        expect(diff.contrast.resolved).toEqual([]);
        expect(formatReportDiff(diff)).toContain(
            `  contrast ${theme.name} ${pair.bg}/${pair.fg}: ${from.toFixed(2)} → 3.20, now below 4.5:1`,
        );

        // Through both knees at once reports the more severe one.
        const muchWorse = clone(worse);
        muchWorse.themes[0]!.pairs.find((p) => p.bg === pair.bg && p.fg === pair.fg)!.ratio = 2.1;
        expect(diffReports(baseline, muchWorse).contrast.newlyFailing[0]!.threshold).toBe(3);

        const recovered = diffReports(worse, baseline);
        expect(recovered.contrast.resolved).toEqual([
            { theme: theme.name, bg: pair.bg, fg: pair.fg, from: 3.2, to: from, threshold: 4.5 },
        ]);
        // A pair only the newer report has is not a crossing.
        const extra = clone(baseline);
        extra.themes[0]!.pairs.push({ bg: 'nowhere', fg: 'nobody', ratio: 1.2 });
        expect(diffReports(baseline, extra).contrast.newlyFailing).toEqual([]);
    });

    it('contrast crossings are sorted by theme, bg, fg and the printout is capped', () => {
        const worse = clone(baseline);
        const theme = worse.themes[0]!;
        const movable = theme.pairs.filter((p) => p.ratio >= 5).slice(0, 8);
        expect(movable.length).toBeGreaterThan(6);
        for (const pair of movable.reverse()) pair.ratio = 2.5; // reversed, so input order ≠ sorted order
        const diff = diffReports(baseline, worse);
        const keys = diff.contrast.newlyFailing.map((p) => `${p.theme}|${p.bg}|${p.fg}`);
        expect(keys).toEqual([...keys].sort());
        expect(diff.contrast.newlyFailing).toHaveLength(movable.length);
        const lines = formatReportDiff(diff).filter((l) => l.includes('contrast ') || l.includes('more pair'));
        expect(lines).toHaveLength(7);
        expect(lines[6]).toBe(`  …and ${movable.length - 6} more pair(s) now below a threshold`);
    });

    it('a scope missing from one manifest is a manifest change, not a styling change', () => {
        // A build that merged an ecosystem fragment and a validate that did
        // not: the extra scope was styled in one report and absent from the
        // other. That is not "newly unstyled" — nothing about its recipe
        // changed — and its states must not leak into the coverage lists.
        const narrower = clone(baseline);
        delete narrower.components['kbd'];
        narrower.coverage.componentsTotal -= 1;
        narrower.coverage.componentsStyled -= 1;
        const diff = diffReports(baseline, narrower);
        expect(diff.manifest).toEqual({ added: [], removed: ['kbd'] });
        expect(diff.components).toEqual({ newlyStyled: [], newlyUnstyled: [] });
        expect(diff.uncovered.newly.some((key) => key.startsWith('kbd.'))).toBe(false);
        expect(diff.changed).toBe(true);
        expect(formatReportDiff(diff)).toContain('  manifest differs (same --extra-manifest flags on both runs?): removed kbd');
        expect(diffReports(narrower, baseline).manifest).toEqual({ added: ['kbd'], removed: [] });
    });

    it('a state new to the manifest on a shared scope is judged on arrival', () => {
        // Both reports style `button`; the newer manifest gave `button.root` a
        // state no recipe covers yet. That is debt from the moment it exists,
        // so it is newly uncovered — while a state that LEFT the manifest is
        // owed nothing and is not "resolved".
        const grown = clone(baseline);
        const root = (grown.components['button'] as { parts: Record<string, { states: { uncovered: string[] } }> }).parts['root']!;
        root.states.uncovered.push('brand-new');
        const diff = diffReports(baseline, grown);
        expect(diff.uncovered.newly).toEqual(['button.root.brand-new']);
        const shrunk = diffReports(grown, baseline);
        expect(shrunk.uncovered.resolved).toEqual([]);
        expect(shrunk.changed).toBe(false);
    });

    it('unwired values are keyed by axis, and appear/resolve symmetrically', () => {
        const more = clone(baseline);
        more.unwired.color.push('tertiary');
        more.unwired.axes['density'] = ['compact'];
        more.unwired.modifiers.push('wide');
        const diff = diffReports(baseline, more);
        expect(diff.unwired.newly).toEqual(['axes.density:compact', 'color:tertiary', 'modifiers:wide']);
        expect(diffReports(more, baseline).unwired.resolved).toEqual(['axes.density:compact', 'color:tertiary', 'modifiers:wide']);
    });

    it('issue counts diff only when both reports carry them', () => {
        const withIssues = reportFor(basic, true);
        expect(diffReports(baseline, withIssues).issues).toBeUndefined();
        expect(diffReports(baseline, withIssues).score.added).toEqual(['issues']);
        expect(diffReports(withIssues, baseline).score.removed).toEqual(['issues']);
        const worse = clone(withIssues);
        worse.issues = { errors: 3, warnings: 14 };
        const diff = diffReports(worse, withIssues);
        expect(diff.issues).toEqual({
            errors: { from: 3, to: 0, delta: -3 },
            warnings: { from: 14, to: withIssues.issues!.warnings, delta: withIssues.issues!.warnings - 14 },
        });
        expect(diff.changed).toBe(true);
        expect(formatReportDiff(diff).at(-1)).toMatch(/^ {2}issues: errors 3 → 0 \(-3\), warnings 14 → \d+ \(-\d+\)$/);
    });

    it('refuses to diff across report versions, naming both', () => {
        const old = clone(baseline) as unknown as { reportVersion: number };
        old.reportVersion = 1;
        expect(() => diffReports(old as unknown as DesignSystemReport, baseline)).toThrow(
            /cannot diff reportVersion 1 against reportVersion 2 — regenerate the older report/,
        );
    });

    it('names both design systems when they differ', () => {
        const other = clone(baseline);
        other.name = 'basic-fork';
        const diff = diffReports(baseline, other);
        expect(diff.previousName).toBe('basic');
        expect(formatReportDiff(diff)[0]).toBe('basic → basic-fork — changes since the previous report');
    });

    it('formats the score line first and lists only the criteria that moved', () => {
        const better = clone(baseline);
        better.score.total = baseline.score.total + 1.5;
        better.score.criteria.states.score = baseline.score.criteria.states.score + 7.5;
        const lines = formatReportDiff(diffReports(baseline, better));
        expect(lines[1]).toBe(`  score ${baseline.score.total} → ${better.score.total} (+1.5), grade ${baseline.score.grade}`);
        expect(lines[2]).toBe(
            `    states ${baseline.score.criteria.states.score} → ${better.score.criteria.states.score} (+7.5)`,
        );
        expect(lines).toHaveLength(3);
    });
});
