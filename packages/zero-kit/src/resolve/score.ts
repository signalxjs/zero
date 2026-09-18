/**
 * The composite score — one number that moves while a design system is being
 * iterated on (docs/architecture.md, "The authoring surface").
 *
 * The coverage report is ratios and lists, which is the right shape for a
 * reviewer reading one design system. It is the wrong shape for the loop a
 * generating agent runs: "did that change make it better" needs a scalar,
 * and "is it done" needs a threshold. This module folds the report into five
 * named criteria — six once an audit is on hand — each 0–100 with an explicit
 * formula, weighted into a total and a letter grade.
 *
 * Three properties are deliberate and pinned by `score.test.ts`:
 *
 * - **A declined axis costs nothing.** `roles: {}` / `sizes: []` are
 *   statements, not gaps: an axis in `declaredOut` is left out of the
 *   vocabulary denominator, and a role declared as a fill (`content: false`
 *   or `soft: false`) is a token rather than a colour-axis value, so its
 *   being unwired says nothing.
 * - **`skipStates` is half credit, not full.** A state moved into
 *   `skipStates` is delegated, not styled; counting it as covered would let
 *   the score be raised by declaring everything delegated. A recipe that
 *   skips every state cannot score above 50 on that criterion.
 * - **The weakest theme is the one graded.** Contrast is the mean over the
 *   declared pairs (one weak pair costs proportionally) but the MIN over
 *   themes — a design system ships its worst theme too.
 *
 * Per-scope `variant` wiring is not scored at all: the fourteen carriers
 * that leave `variant` unwired do so by recorded decision
 * (`__tests__/axis-coverage.test.ts`, `NO_VARIANT`), and a score that
 * penalised it would grade every shipped skin on a choice the repo made.
 */
import { isFillRole } from '../contract.js';
import type { CompiledDesignSystem } from '../design-system.js';
import type { DesignSystemReport } from './report.js';

export type ScoreGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface ScoreCriterion {
    /** 0–100, one decimal. */
    score: number;
    /** The criterion's weight in the total; the weights of PRESENT criteria are renormalised. */
    weight: number;
    /** The counts the score was computed from — so a number can be argued with. */
    detail: Record<string, number | string>;
}

export interface ReportScore {
    /** Weighted mean of the present criteria, 0–100, one decimal. */
    total: number;
    /** A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60, else F. */
    grade: ScoreGrade;
    criteria: {
        /** Components with a recipe, over the manifest. */
        components: ScoreCriterion;
        /** Declared axis values honoured by at least one recipe and claimed by at least one scope. */
        vocabulary: ScoreCriterion;
        /** Part states and flags covered — `skipStates` at half credit. */
        states: ScoreCriterion;
        /** WCAG margin of the declared role pairs, in the weakest theme. */
        contrast: ScoreCriterion;
        /** Validation counts — present only when the report was built alongside a validation pass. */
        issues?: ScoreCriterion;
        /** The `zero:audit` hook — present only when an audit score was handed in. */
        audit?: ScoreCriterion;
    };
}

/** What `zero:audit` counted — the shape `AuditResult.summary` carries. */
export interface AuditCounts {
    errors: number;
    warnings: number;
    info: number;
}

export interface ScoreExtras {
    /**
     * The audit, when one ran: its counts (the usual form — `report.audit`
     * and `AuditResult.summary` both fit) scored by `auditScore`, or a
     * 0–100 number a caller already has. Absent → the criterion is omitted
     * and the weights renormalise.
     */
    audit?: number | AuditCounts;
}

/**
 * The audit criterion, the issues formula applied to audit findings:
 * `100 − 10·errors − 2·warnings`, floored at 0. `info` findings (the
 * contrast matrix's `unmeasured` cells) are listed, never charged — a cell
 * the estimate could not judge is not a defect.
 */
export function auditScore({ errors, warnings }: Pick<AuditCounts, 'errors' | 'warnings'>): number {
    return clamp(100 - 10 * errors - 2 * warnings);
}

/** The fixed weights. `issues` and `audit` drop out (and the rest renormalise) when absent. */
export const SCORE_WEIGHTS = {
    components: 25,
    vocabulary: 15,
    states: 20,
    contrast: 25,
    issues: 15,
    audit: 15,
} as const;

export const GRADE_FLOORS: ReadonlyArray<readonly [ScoreGrade, number]> = [
    ['A', 90],
    ['B', 80],
    ['C', 70],
    ['D', 60],
];

const round1 = (n: number): number => Number(n.toFixed(1));
const clamp = (n: number): number => Math.min(100, Math.max(0, n));

/**
 * One declared pair's contribution: full marks at the 4.5:1 AA text threshold,
 * half marks at the 3:1 floor the validator errors below, nothing at 1:1.
 * Linear between the knees so a pair that is nearly there scores nearly full.
 */
export function pairScore(ratio: number): number {
    if (ratio >= 4.5) return 100;
    if (ratio >= 3) return 50 + ((ratio - 3) / 1.5) * 50;
    if (ratio >= 1) return ((ratio - 1) / 2) * 50;
    return 0;
}

export function gradeFor(total: number): ScoreGrade {
    for (const [grade, floor] of GRADE_FLOORS) if (total >= floor) return grade;
    return 'F';
}

const AXES = ['color', 'size', 'variant'] as const;

function vocabularyCriterion(report: Omit<DesignSystemReport, 'score'>, compiled: CompiledDesignSystem): ScoreCriterion {
    const declaredOut = new Set(report.vocabulary.declaredOut);
    /** `axis:value` keys — one entry per declared value the design system is promising. */
    const declared = new Set<string>();
    const add = (axis: string, values: readonly string[]): void => {
        for (const value of values) declared.add(`${axis}:${value}`);
    };
    if (!declaredOut.has('color')) {
        add('color', report.vocabulary.roles.filter((role) => !isFillRole(compiled.tokens.roles[role])));
    }
    if (!declaredOut.has('size')) add('size', report.vocabulary.sizes);
    if (!declaredOut.has('variant')) add('variant', report.vocabulary.variants);
    for (const [axis, values] of Object.entries(report.vocabulary.axes)) {
        if (!declaredOut.has(axis)) add(`axes.${axis}`, values);
    }
    add('modifiers', report.vocabulary.modifiers);

    /** Declared values nobody wires or nobody claims — counted once each, and only if they were promised. */
    const broken = new Set<string>();
    for (const bucket of [report.unwired, report.unclaimed]) {
        for (const axis of AXES) for (const value of bucket[axis]) broken.add(`${axis}:${value}`);
        for (const [axis, values] of Object.entries(bucket.axes)) for (const value of values) broken.add(`axes.${axis}:${value}`);
        for (const value of bucket.modifiers) broken.add(`modifiers:${value}`);
    }
    const unhonoured = [...broken].filter((key) => declared.has(key));
    const total = declared.size;
    const score = total === 0 ? 100 : ((total - unhonoured.length) / total) * 100;
    return {
        score: round1(clamp(score)),
        weight: SCORE_WEIGHTS.vocabulary,
        detail: { declared: total, unhonoured: unhonoured.length, declaredOut: report.vocabulary.declaredOut.join(',') || 'none' },
    };
}

function statesCriterion(report: Omit<DesignSystemReport, 'score'>): ScoreCriterion {
    let covered = 0;
    let indirect = 0;
    let skipped = 0;
    let uncovered = 0;
    for (const component of Object.values(report.components)) {
        if (!component.styled) continue;
        for (const part of Object.values(component.parts)) {
            for (const split of [part.states, part.flags]) {
                covered += split.covered.length;
                indirect += split.coveredIndirectly.length;
                skipped += split.skipped.length;
                uncovered += split.uncovered.length;
            }
        }
    }
    const total = covered + indirect + skipped + uncovered;
    const score = total === 0 ? 100 : ((covered + indirect + 0.5 * skipped) / total) * 100;
    return {
        score: round1(clamp(score)),
        weight: SCORE_WEIGHTS.states,
        detail: { covered, coveredIndirectly: indirect, skipped, uncovered, total },
    };
}

function contrastCriterion(report: Omit<DesignSystemReport, 'score'>): ScoreCriterion {
    if (report.themes.length === 0) {
        return { score: 0, weight: SCORE_WEIGHTS.contrast, detail: { reason: 'no themes' } };
    }
    let worst: { name: string; mean: number; pairs: number } | null = null;
    for (const theme of report.themes) {
        const mean = theme.pairs.length === 0
            ? 0
            : theme.pairs.reduce((sum, pair) => sum + pairScore(pair.ratio), 0) / theme.pairs.length;
        if (worst === null || mean < worst.mean) worst = { name: theme.name, mean, pairs: theme.pairs.length };
    }
    const detail: Record<string, number | string> = { weakestTheme: worst!.name, pairs: worst!.pairs };
    if (worst!.pairs === 0) detail['reason'] = 'no measurable pair';
    return { score: round1(clamp(worst!.mean)), weight: SCORE_WEIGHTS.contrast, detail };
}

/**
 * Fold a report into its score. `compiled` supplies what the report does not
 * carry — the role declarations, so a fill can be told from an axis value.
 * `extras.audit` is the hook for `zero:audit`: hand in its 0–100 score and a
 * sixth criterion joins the weighting; leave it out and the five stand alone.
 */
export function computeScore(
    report: Omit<DesignSystemReport, 'score'>,
    compiled: CompiledDesignSystem,
    extras: ScoreExtras = {},
): ReportScore {
    const { componentsStyled, componentsTotal } = report.coverage;
    const criteria: ReportScore['criteria'] = {
        components: {
            score: round1(componentsTotal === 0 ? 100 : (componentsStyled / componentsTotal) * 100),
            weight: SCORE_WEIGHTS.components,
            detail: { styled: componentsStyled, total: componentsTotal },
        },
        vocabulary: vocabularyCriterion(report, compiled),
        states: statesCriterion(report),
        contrast: contrastCriterion(report),
    };
    if (report.issues) {
        const { errors, warnings } = report.issues;
        criteria.issues = {
            score: round1(clamp(100 - 10 * errors - 2 * warnings)),
            weight: SCORE_WEIGHTS.issues,
            detail: { errors, warnings },
        };
    }
    if (typeof extras.audit === 'number') {
        criteria.audit = { score: round1(clamp(extras.audit)), weight: SCORE_WEIGHTS.audit, detail: {} };
    } else if (extras.audit) {
        const { errors, warnings, info } = extras.audit;
        criteria.audit = {
            score: round1(auditScore(extras.audit)),
            weight: SCORE_WEIGHTS.audit,
            detail: { errors, warnings, info },
        };
    }
    const present = Object.values(criteria);
    const weight = present.reduce((sum, c) => sum + c.weight, 0);
    const total = round1(present.reduce((sum, c) => sum + c.score * c.weight, 0) / weight);
    return { total, grade: gradeFor(total), criteria };
}

/** The one-line summary `formatReport` prints first. */
export function formatScore(score: ReportScore): string {
    const parts = Object.entries(score.criteria).map(([name, c]) => `${name} ${c.score}`);
    return `score ${score.total} (${score.grade}): ${parts.join(' · ')}`;
}
