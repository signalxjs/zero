/**
 * What moved between two coverage reports (docs/architecture.md, "The
 * authoring surface").
 *
 * The report says where a design system stands; the score says how far. Neither
 * says what the last change DID, and that is the question the loop a generating
 * agent runs actually asks — fix, validate, better or worse, and in what. This
 * module answers it from two reports alone: no design system, no manifest, no
 * `node:`, so it runs anywhere two `report.json` files can be read.
 *
 * Three choices are deliberate:
 *
 * - **Only like is compared with like.** A scope styled in one report and not
 *   the other shows up under `components`; its parts' states are NOT also
 *   listed as newly uncovered or resolved, because that would count one change
 *   twice. Within a scope both reports style, a state that is new to the
 *   manifest IS judged — uncovered on arrival is debt — while one that left it
 *   is owed nothing. A scope present in one report's manifest and absent from the other's
 *   is a manifest change (`manifest.added` / `removed`), not a styling change —
 *   a build that merged an ecosystem fragment and a validate that did not
 *   differ in what they were asked, not in what was styled. Likewise a theme or
 *   a pair present on one side only is skipped rather than reported as a
 *   crossing.
 * - **Skipping is not resolving.** A state that moves from `uncovered` into
 *   `skipStates` is delegated, not styled, so it lands under `skipped.newly`
 *   rather than `uncovered.resolved` — the same half-credit stance the score
 *   takes, kept here so the diff cannot read a waiver as progress.
 * - **A version mismatch throws.** The sections this reads changed shape at
 *   `reportVersion` 2, and a silent best-effort diff of two shapes would be a
 *   number that means nothing. The message says which file to regenerate.
 */
import type { DesignSystemReport } from './report.js';
import type { ScoreGrade } from './score.js';

export interface Delta {
    from: number;
    to: number;
    /** `to − from`, rounded to one decimal. */
    delta: number;
}

/** A declared role pair that crossed a contrast threshold between the two reports. */
export interface PairDelta {
    theme: string;
    bg: string;
    fg: string;
    from: number;
    to: number;
    /** The threshold crossed: the AA text ratio, or the floor the validator errors below. */
    threshold: 4.5 | 3;
}

export interface ReportDiff {
    /** The design system's name in the newer report. */
    name: string;
    /** Set when the two reports name different design systems. */
    previousName?: string;
    reportVersion: number;
    score: {
        total: Delta;
        grade: { from: ScoreGrade; to: ScoreGrade };
        /** Criteria present in BOTH reports; one that appeared or vanished is listed below. */
        criteria: Record<string, Delta>;
        /** Criteria present only in the newer / only in the older report. */
        added: string[];
        removed: string[];
    };
    /** Scopes in both manifests whose styled/unstyled status flipped. */
    components: { newlyStyled: string[]; newlyUnstyled: string[] };
    /** Scopes present in only one report's manifest — the reports were built against different manifests. */
    manifest: { added: string[]; removed: string[] };
    /** `axis:value` keys — `color:tertiary`, `axes.density:compact`, `modifiers:wide`. */
    unwired: { newly: string[]; resolved: string[] };
    /**
     * `scope.part.state` keys over scopes styled in both reports. `resolved`
     * means the state gained a rule (directly or under a condition) — a state
     * moved into `skipStates` is under `skipped.newly` instead.
     */
    uncovered: { newly: string[]; resolved: string[] };
    skipped: { newly: string[]; resolved: string[] };
    contrast: { newlyFailing: PairDelta[]; resolved: PairDelta[] };
    /** Present only when both reports were built alongside a validation pass. */
    issues?: { errors: Delta; warnings: Delta };
    /** False when nothing above moved — the one-line answer. */
    changed: boolean;
}

const THRESHOLDS = [4.5, 3] as const;

const round1 = (n: number): number => Number(n.toFixed(1));
const delta = (from: number, to: number): Delta => ({ from, to, delta: round1(to - from) });
const sorted = (values: Iterable<string>): string[] => [...values].sort();
const only = (a: ReadonlySet<string>, b: ReadonlySet<string>): string[] => sorted([...a].filter((x) => !b.has(x)));

function unwiredKeys(report: DesignSystemReport): Set<string> {
    const keys = new Set<string>();
    for (const axis of ['color', 'size', 'variant'] as const) {
        for (const value of report.unwired[axis]) keys.add(`${axis}:${value}`);
    }
    for (const [axis, values] of Object.entries(report.unwired.axes)) {
        for (const value of values) keys.add(`axes.${axis}:${value}`);
    }
    for (const value of report.unwired.modifiers) keys.add(`modifiers:${value}`);
    return keys;
}

type Bucket = 'covered' | 'coveredIndirectly' | 'skipped' | 'uncovered';

/** `scope.part.state` → which coverage bucket it sits in, over the given scopes. */
function coverage(report: DesignSystemReport, scopes: ReadonlySet<string>): Map<string, Bucket> {
    const out = new Map<string, Bucket>();
    for (const scope of scopes) {
        const component = report.components[scope];
        if (!component?.styled) continue;
        for (const [part, coverage] of Object.entries(component.parts)) {
            for (const split of [coverage.states, coverage.flags]) {
                for (const bucket of ['covered', 'coveredIndirectly', 'skipped', 'uncovered'] as const) {
                    for (const state of split[bucket]) out.set(`${scope}.${part}.${state}`, bucket);
                }
            }
        }
    }
    return out;
}

const styledScopes = (report: DesignSystemReport): Set<string> =>
    new Set(Object.entries(report.components).flatMap(([scope, c]) => (c.styled ? [scope] : [])));
const allScopes = (report: DesignSystemReport): Set<string> => new Set(Object.keys(report.components));

/** The lowest threshold `to` violates that `from` met — the most severe crossing. */
function crossedDown(from: number, to: number): 4.5 | 3 | null {
    let crossed: 4.5 | 3 | null = null;
    for (const threshold of THRESHOLDS) if (from >= threshold && to < threshold) crossed = threshold;
    return crossed;
}

/** The highest threshold `to` meets that `from` violated. */
function crossedUp(from: number, to: number): 4.5 | 3 | null {
    for (const threshold of THRESHOLDS) if (from < threshold && to >= threshold) return threshold;
    return null;
}

export function diffReports(prev: DesignSystemReport, next: DesignSystemReport): ReportDiff {
    // Typed as the current literal, but a file read off disk carries whatever
    // version wrote it — hence the widening before the comparison.
    const prevVersion = (prev as { reportVersion: number }).reportVersion;
    const nextVersion = (next as { reportVersion: number }).reportVersion;
    if (prevVersion !== nextVersion) {
        throw new Error(
            `cannot diff reportVersion ${prevVersion} against reportVersion ${nextVersion}`
            + ` — regenerate the older report with this kit (sigx zero:validate --report-json <path>, or sigx zero:build)`,
        );
    }

    const prevCriteria = new Set(Object.keys(prev.score.criteria));
    const nextCriteria = new Set(Object.keys(next.score.criteria));
    const criteria: Record<string, Delta> = {};
    for (const name of Object.keys(next.score.criteria)) {
        const before = prev.score.criteria[name as keyof typeof prev.score.criteria];
        const after = next.score.criteria[name as keyof typeof next.score.criteria];
        if (before && after) criteria[name] = delta(before.score, after.score);
    }

    const prevScopes = allScopes(prev);
    const nextScopes = allScopes(next);
    const shared = new Set([...prevScopes].filter((scope) => nextScopes.has(scope)));
    const prevStyled = new Set([...styledScopes(prev)].filter((scope) => shared.has(scope)));
    const nextStyled = new Set([...styledScopes(next)].filter((scope) => shared.has(scope)));
    const both = new Set([...prevStyled].filter((scope) => nextStyled.has(scope)));

    const prevUnwired = unwiredKeys(prev);
    const nextUnwired = unwiredKeys(next);

    const before = coverage(prev, both);
    const after = coverage(next, both);
    const uncovered = { newly: [] as string[], resolved: [] as string[] };
    const skipped = { newly: [] as string[], resolved: [] as string[] };
    // Walk the NEWER report's keys: a state that left the manifest is nothing
    // owed any more, but a state that entered it (a new state or flag on a
    // part both reports style) is new coverage debt the moment it is
    // uncovered — so a key with no `before` is judged on `now` alone.
    for (const [key, now] of after) {
        const was = before.get(key);
        const styledNow = now === 'covered' || now === 'coveredIndirectly';
        if (was === 'uncovered' && styledNow) uncovered.resolved.push(key);
        if (now === 'uncovered' && was !== 'uncovered') uncovered.newly.push(key);
        if (now === 'skipped' && was !== 'skipped') skipped.newly.push(key);
        if (was === 'skipped' && styledNow) skipped.resolved.push(key);
    }
    uncovered.newly.sort();
    uncovered.resolved.sort();
    skipped.newly.sort();
    skipped.resolved.sort();

    const contrast = { newlyFailing: [] as PairDelta[], resolved: [] as PairDelta[] };
    const prevThemes = new Map(prev.themes.map((theme) => [theme.name, theme]));
    for (const theme of next.themes) {
        const was = prevThemes.get(theme.name);
        if (!was) continue;
        const wasPairs = new Map(was.pairs.map((pair) => [`${pair.bg}|${pair.fg}`, pair.ratio]));
        for (const pair of theme.pairs) {
            const from = wasPairs.get(`${pair.bg}|${pair.fg}`);
            if (from === undefined) continue;
            const down = crossedDown(from, pair.ratio);
            if (down !== null) {
                contrast.newlyFailing.push({ theme: theme.name, bg: pair.bg, fg: pair.fg, from, to: pair.ratio, threshold: down });
            }
            const up = crossedUp(from, pair.ratio);
            if (up !== null) {
                contrast.resolved.push({ theme: theme.name, bg: pair.bg, fg: pair.fg, from, to: pair.ratio, threshold: up });
            }
        }
    }

    // Deterministic like every other section: theme, then bg, then fg.
    const byPair = (a: PairDelta, b: PairDelta): number =>
        a.theme.localeCompare(b.theme) || a.bg.localeCompare(b.bg) || a.fg.localeCompare(b.fg) || a.threshold - b.threshold;
    contrast.newlyFailing.sort(byPair);
    contrast.resolved.sort(byPair);

    const diff: ReportDiff = {
        name: next.name,
        reportVersion: nextVersion,
        score: {
            total: delta(prev.score.total, next.score.total),
            grade: { from: prev.score.grade, to: next.score.grade },
            criteria,
            added: only(nextCriteria, prevCriteria),
            removed: only(prevCriteria, nextCriteria),
        },
        components: {
            newlyStyled: only(nextStyled, prevStyled),
            newlyUnstyled: only(prevStyled, nextStyled),
        },
        manifest: { added: only(nextScopes, prevScopes), removed: only(prevScopes, nextScopes) },
        unwired: { newly: only(nextUnwired, prevUnwired), resolved: only(prevUnwired, nextUnwired) },
        uncovered,
        skipped,
        contrast,
        changed: false,
    };
    if (prev.name !== next.name) diff.previousName = prev.name;
    if (prev.issues && next.issues) {
        diff.issues = {
            errors: delta(prev.issues.errors, next.issues.errors),
            warnings: delta(prev.issues.warnings, next.issues.warnings),
        };
    }
    diff.changed = diff.score.total.delta !== 0
        || diff.score.grade.from !== diff.score.grade.to
        || Object.values(criteria).some((c) => c.delta !== 0)
        || diff.score.added.length + diff.score.removed.length > 0
        || diff.components.newlyStyled.length + diff.components.newlyUnstyled.length > 0
        || diff.manifest.added.length + diff.manifest.removed.length > 0
        || diff.unwired.newly.length + diff.unwired.resolved.length > 0
        || uncovered.newly.length + uncovered.resolved.length > 0
        || skipped.newly.length + skipped.resolved.length > 0
        || contrast.newlyFailing.length + contrast.resolved.length > 0
        || (diff.issues !== undefined && (diff.issues.errors.delta !== 0 || diff.issues.warnings.delta !== 0));
    return diff;
}

/** How many contrast crossings `formatReportDiff` prints per direction before summarising. */
const CONTRAST_LINES = 6;

const signed = (n: number): string => (n > 0 ? `+${n}` : `${n}`);
const moved = (d: Delta): string => `${d.from} → ${d.to} (${signed(d.delta)})`;

/** A list, capped so one sweeping change does not become a wall of keys. */
function list(keys: readonly string[], cap = 6): string {
    if (keys.length <= cap) return keys.join(', ');
    return `${keys.slice(0, cap).join(', ')} (+${keys.length - cap} more)`;
}

/** The human summary — one line per section that moved, nothing for the rest. */
export function formatReportDiff(diff: ReportDiff): string[] {
    const who = diff.previousName ? `${diff.previousName} → ${diff.name}` : diff.name;
    const lines: string[] = [`${who} — changes since the previous report`];
    if (!diff.changed) {
        lines.push('  no change');
        return lines;
    }

    const grade = diff.score.grade.from === diff.score.grade.to
        ? `grade ${diff.score.grade.to}`
        : `grade ${diff.score.grade.from} → ${diff.score.grade.to}`;
    lines.push(`  score ${moved(diff.score.total)}, ${grade}`);
    const movedCriteria = Object.entries(diff.score.criteria).filter(([, d]) => d.delta !== 0);
    if (movedCriteria.length > 0) {
        lines.push(`    ${movedCriteria.map(([name, d]) => `${name} ${moved(d)}`).join(' · ')}`);
    }
    if (diff.score.added.length > 0) lines.push(`    criteria now scored: ${diff.score.added.join(', ')}`);
    if (diff.score.removed.length > 0) lines.push(`    criteria no longer scored: ${diff.score.removed.join(', ')}`);

    if (diff.components.newlyStyled.length > 0) {
        lines.push(`  newly styled: ${list(diff.components.newlyStyled)}`);
    }
    if (diff.components.newlyUnstyled.length > 0) {
        lines.push(`  newly UNSTYLED: ${list(diff.components.newlyUnstyled)}`);
    }
    if (diff.manifest.added.length > 0 || diff.manifest.removed.length > 0) {
        const parts: string[] = [];
        if (diff.manifest.added.length > 0) parts.push(`added ${list(diff.manifest.added)}`);
        if (diff.manifest.removed.length > 0) parts.push(`removed ${list(diff.manifest.removed)}`);
        lines.push(`  manifest differs (same --extra-manifest flags on both runs?): ${parts.join('; ')}`);
    }
    if (diff.unwired.resolved.length > 0) lines.push(`  now wired: ${list(diff.unwired.resolved)}`);
    if (diff.unwired.newly.length > 0) lines.push(`  newly unwired: ${list(diff.unwired.newly)}`);
    if (diff.uncovered.resolved.length > 0) lines.push(`  states now covered: ${list(diff.uncovered.resolved)}`);
    if (diff.uncovered.newly.length > 0) lines.push(`  states newly uncovered: ${list(diff.uncovered.newly)}`);
    if (diff.skipped.newly.length > 0) lines.push(`  states newly skipped (delegated, not styled): ${list(diff.skipped.newly)}`);
    if (diff.skipped.resolved.length > 0) lines.push(`  states skipped before, styled now: ${list(diff.skipped.resolved)}`);
    // Capped like the key lists: a theme rewrite can move every pair at once,
    // and the count is the news then — the full list is in the JSON.
    const crossings = (pairs: readonly PairDelta[], verdict: string): void => {
        for (const pair of pairs.slice(0, CONTRAST_LINES)) {
            lines.push(`  contrast ${pair.theme} ${pair.bg}/${pair.fg}: ${pair.from.toFixed(2)} → ${pair.to.toFixed(2)}, ${verdict} ${pair.threshold}:1`);
        }
        if (pairs.length > CONTRAST_LINES) lines.push(`  …and ${pairs.length - CONTRAST_LINES} more pair(s) ${verdict} a threshold`);
    };
    crossings(diff.contrast.newlyFailing, 'now below');
    crossings(diff.contrast.resolved, 'now meets');
    if (diff.issues && (diff.issues.errors.delta !== 0 || diff.issues.warnings.delta !== 0)) {
        lines.push(`  issues: errors ${moved(diff.issues.errors)}, warnings ${moved(diff.issues.warnings)}`);
    }
    return lines;
}
