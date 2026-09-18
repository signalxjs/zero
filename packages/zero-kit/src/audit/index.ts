/**
 * The audit — the compiled-CSS guards, shipped with the kit (#403).
 *
 * Validation answers "is this correct": a `var()` nobody declares, an axis
 * value outside the vocabulary, a part with no focus ring anywhere. Its errors
 * gate the build. The audit answers a different question — "does what you
 * built say what it claims?" — and its rules were, until #403, vitest files in
 * this repo that imported the six in-repo skins by name. The skill told an
 * external author "CI fails it"; for them, nothing did.
 *
 * So the rules moved here, verbatim, and the in-repo tests became thin callers
 * of them. Nine rules in this slice, all reading the ARTIFACT (`parseRules`
 * over each scope's compiled CSS) rather than the recipe tree, for the reason
 * every one of them records in its own docblock: only the emitted CSS sees
 * every door a declaration can arrive through. The contrast matrix — the
 * static half of the browser contrast audit — followed as three more rules
 * (`contrast/*`, `./contrast/`) and the cell table on the result.
 *
 * A finding is a verdict about one place; a waiver is a verdict a declared
 * mechanism excused, listed rather than swallowed. `auditDesignSystem` never
 * throws on a finding — a design system mid-iteration must be able to read
 * its own audit — and it never fails the build; `sigx zero:audit` (the B
 * slice) is where an exit code lives.
 */
import type { ZeroManifest } from '../contract.js';
import type { CompiledDesignSystem, DesignSystemInput } from '../design-system.js';
import { buildAuditContext } from './context.js';
import type { AuditContext } from './context.js';
import * as axisCoverage from './rules/axis-coverage.js';
import * as axisValueCoverage from './rules/axis-value-coverage.js';
import * as buttonAffordance from './rules/button-affordance.js';
import * as contrastRules from './rules/contrast.js';
import * as reducedMotion from './rules/reduced-motion.js';
import * as spacing from './rules/spacing.js';
import * as stateLegibility from './rules/state-legibility.js';
import type { AuditFinding, AuditResult, AuditRuleId, AuditSeverity, AuditWaiver, RuleOutput } from './types.js';
import { AUDIT_RULES } from './types.js';

export type {
    AuditFinding,
    AuditResult,
    AuditRuleId,
    AuditSeverity,
    AuditSummary,
    AuditWaiver,
    RuleOutput,
} from './types.js';
export { AUDIT_RULES, RULE_SEVERITY } from './types.js';
export type { AuditContext } from './context.js';
export { buildAuditContext, styledScopes } from './context.js';
export type { CssRule } from './css-rules.js';
export { parseRules } from './css-rules.js';
export type { LegibilityCase } from './rules/state-legibility.js';
export {
    NATIVE_PROXIES,
    caseOf,
    casesOf,
    componentFindings,
    disclosureFindings,
    distinguishes,
    fingerprint,
    groupOf,
    indicatorFindings,
    isIndicatorPart,
    isOverlayComponent,
    isPopupPart,
    isTriggerPart,
    ownGroups,
    pairsOf,
    presenceDiffers,
} from './rules/state-legibility.js';
export { buttonFindings, buttonParts, isUnconditionalFor, resetsAppearance } from './rules/button-affordance.js';
export type { AxisCell } from './rules/axis-value-coverage.js';
export {
    ambiguousBases,
    coverageGaps,
    declaredVocabulary,
    implementedSomewhere,
    isFillOrHairline,
    paintedValues,
    participatingCells,
    unusedVocabulary,
} from './rules/axis-value-coverage.js';
export { axisCoverage } from './rules/axis-coverage.js';
export { declaresLoop, loopFindings } from './rules/reduced-motion.js';
export { contrastFindings } from './rules/contrast.js';
export type { ContrastCell, ContrastMatrix, ContrastOptions, ContrastVerdict } from './contrast/matrix.js';
export { AA, DISABLED_FLOOR, FLOOR, buildContrastMatrix } from './contrast/matrix.js';
export type { UnmeasuredReason } from './contrast/cascade.js';
export { REFERENCE_MEDIA, UNMEASURED_REASONS, clipCollapsed, evaluateMedia } from './contrast/cascade.js';
export type { ThemeEnv } from './contrast/theme-env.js';
export { themeEnvironments } from './contrast/theme-env.js';
export type { RGB } from './contrast/color.js';
export { blend, contrast, hasInk, luminance, parseColor, resolveOver } from './contrast/color.js';
export type { Cell, Combo, IndicatorCell, IndicatorSpec, NodeSpec, WiredAxes } from './contrast/cells-index.js';
export {
    AXIS_CELL_BUDGET,
    INDICATORS,
    NOT_RENDERED_ON_WEB,
    PAINT_ONLY_PART,
    axisCellsFor,
    axisTag,
    cellKey,
    chainFor,
    colourBearingAxes,
    combosFor,
    derivedChainAncestors,
    indicatorAncestors,
    indicatorCellsFor,
    indicatorChains,
    restingCombos,
    textCells,
    uncoveredPaintParts,
} from './contrast/cells-index.js';

/** The `$schema` every emitted `audit.json` carries — the artifact's self-reference. */
export const AUDIT_SCHEMA_URL = 'https://signalxjs.github.io/zero/schemas/audit.schema.json';

/**
 * `dist/audit.json` — the result with its schema pointer in front, the way
 * `report.json` carries `report.schema.json`. Pure; `writeArtifacts` and
 * `sigx zero:audit --json` serialise it.
 */
export interface AuditArtifact extends AuditResult {
    $schema: typeof AUDIT_SCHEMA_URL;
}

export function buildAuditArtifact(result: AuditResult): AuditArtifact {
    const { auditVersion, name, findings, waived, contrast, summary } = result;
    return { $schema: AUDIT_SCHEMA_URL, auditVersion, name, findings, waived, contrast, summary };
}

export interface AuditOptions {
    /** Run only these rules; default every rule in `AUDIT_RULES`. */
    rules?: readonly AuditRuleId[];
    /** A compile the caller already has, so the audit does not repeat it. */
    compiled?: CompiledDesignSystem;
    /** Contrast: measure only these themes; default every declared theme. */
    themes?: readonly string[];
    /** Contrast: the chained-cell ceiling per (design system, theme); default `AXIS_CELL_BUDGET`. */
    axisCellBudget?: number;
}

interface RuleModule {
    ids: readonly AuditRuleId[];
    run(ctx: AuditContext): RuleOutput;
}

/** The registry, in `AUDIT_RULES` order. A module may own several ids. */
const MODULES: readonly RuleModule[] = [
    {
        ids: ['state-legibility/component', 'state-legibility/indicator', 'state-legibility/disclosure'],
        run: stateLegibility.run,
    },
    { ids: ['button-affordance'], run: buttonAffordance.run },
    {
        ids: ['axis-value-coverage/gap', 'axis-value-coverage/ambiguous-base', 'axis-value-coverage/unused'],
        run: axisValueCoverage.run,
    },
    { ids: ['axis-coverage'], run: axisCoverage.run },
    { ids: ['reduced-motion/loop'], run: reducedMotion.run },
    { ids: ['spacing/literal', 'spacing/off-ramp'], run: spacing.run },
];

const CONTRAST_RULES: readonly AuditRuleId[] = ['contrast/text', 'contrast/indicator', 'contrast/unmeasured'];

const SEVERITY_ORDER: Readonly<Record<AuditSeverity, number>> = { error: 0, warning: 1, info: 2 };

/** severity → rule (in `AUDIT_RULES` order) → where, so two runs over one input diff cleanly. */
export function compareFindings(a: AuditFinding, b: AuditFinding): number {
    return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
        || AUDIT_RULES.indexOf(a.rule) - AUDIT_RULES.indexOf(b.rule)
        || a.where.localeCompare(b.where)
        || a.message.localeCompare(b.message);
}

export function auditDesignSystem(
    ds: DesignSystemInput,
    manifest: Pick<ZeroManifest, 'components'>,
    options: AuditOptions = {},
): AuditResult {
    for (const rule of options.rules ?? []) {
        if (!AUDIT_RULES.includes(rule)) {
            throw new Error(`[zero-kit] unknown audit rule "${rule as string}" — known rules: ${AUDIT_RULES.join(', ')}`);
        }
    }
    const wanted = new Set<AuditRuleId>(options.rules ?? AUDIT_RULES);
    const ctx = buildAuditContext(ds, manifest, options.compiled);
    const findings: AuditFinding[] = [];
    const waived: AuditWaiver[] = [];
    let contrast: AuditResult['contrast'] = { themes: [] };
    for (const module of MODULES) {
        if (!module.ids.some((id) => wanted.has(id))) continue;
        const out = module.run(ctx);
        // A module owning several ids runs once and is filtered after — the
        // state-legibility rules share one parse and one case table.
        findings.push(...out.findings.filter((f) => wanted.has(f.rule)));
        waived.push(...out.waived.filter((f) => wanted.has(f.rule)));
    }
    // The contrast rules take options no other rule does (a theme filter,
    // the cell budget) and hand back the matrix beside their findings.
    if (CONTRAST_RULES.some((id) => wanted.has(id))) {
        const out = contrastRules.run(ctx, {
            ...(options.themes ? { themes: options.themes } : {}),
            ...(options.axisCellBudget !== undefined ? { axisCellBudget: options.axisCellBudget } : {}),
        });
        findings.push(...out.findings.filter((f) => wanted.has(f.rule)));
        contrast = out.contrast;
    }
    findings.sort(compareFindings);
    waived.sort(compareFindings);
    const summary: AuditResult['summary'] = { errors: 0, warnings: 0, info: 0, byRule: {} };
    for (const f of findings) {
        if (f.severity === 'error') summary.errors++;
        else if (f.severity === 'warning') summary.warnings++;
        else summary.info++;
        summary.byRule[f.rule] = (summary.byRule[f.rule] ?? 0) + 1;
    }
    return { auditVersion: 1, name: ds.name, findings, waived, contrast, summary };
}

/**
 * The human form — one line per finding under its rule, errors first, and a
 * closing count. Lossy on purpose, like `formatReport`: the structured
 * result is the machine form.
 */
export function formatAudit(result: AuditResult): string[] {
    const lines: string[] = [`${result.name} — audit`];
    if (result.findings.length === 0) {
        lines.push('  no findings');
    }
    let current: AuditRuleId | undefined;
    for (const f of result.findings) {
        if (f.rule !== current) {
            current = f.rule;
            lines.push(`  ${f.rule} (${f.severity}) ×${result.summary.byRule[f.rule] ?? 0}`);
        }
        // The owning package, when a discovered ecosystem pack owns the scope:
        // a reader must be able to tell "fix my recipe" from "report this
        // upstream" without cross-referencing the manifest.
        lines.push(`    ${f.message}${f.package ? ` [${f.package}]` : ''}`);
    }
    for (const theme of result.contrast.themes) {
        const count = (verdict: string): number => theme.cells.filter((c) => c.verdict === verdict).length;
        const measured = theme.cells.length - count('unmeasured') - count('unrendered') - count('unpainted');
        const unmeasured = count('unmeasured');
        lines.push(
            `  contrast ${theme.name}: ${theme.cells.length} cells, ${measured} measured, `
            + `${count('fail') + count('disabled-fail')} below floor, ${count('warn')} below 4.5:1`
            + (unmeasured > 0 ? `, ${unmeasured} unmeasured` : ''),
        );
    }
    if (result.waived.length > 0) {
        const byMechanism = new Map<string, number>();
        for (const w of result.waived) byMechanism.set(w.waivedBy.mechanism, (byMechanism.get(w.waivedBy.mechanism) ?? 0) + 1);
        lines.push(`  waived: ${[...byMechanism].map(([m, n]) => `${n} by ${m}`).join(', ')}`);
    }
    lines.push(`  ${result.summary.errors} error(s), ${result.summary.warnings} warning(s), ${result.summary.info} info`);
    return lines;
}
