/**
 * The audit's public shape (#403).
 *
 * A finding is a verdict about one place in one design system — a rule id, a
 * severity, and a `where` in the same `scope.part` spelling `ValidationIssue`
 * uses — with the structured fields a tool needs beside the sentence a person
 * reads. The message names the fix, as the guards these rules were lifted from
 * always did.
 *
 * Severity is a property of the RULE, not of the design system: the rules
 * that lift a CI hard-fail (state legibility, button affordance, the two
 * ramp-hole assertions, a loop that never stops) are errors, and the two that
 * were only ever advisory (an accepted axis nobody wires, a declared word
 * nobody uses) are warnings. `info` is reserved for the contrast matrix's
 * `unmeasured` cells (the C slice), which must be listed and must never fail.
 */

import type { ContrastMatrix } from './contrast/matrix.js';

export type AuditRuleId =
    | 'state-legibility/component'
    | 'state-legibility/indicator'
    | 'state-legibility/disclosure'
    | 'button-affordance'
    | 'axis-coverage'
    | 'axis-value-coverage/gap'
    | 'axis-value-coverage/ambiguous-base'
    | 'axis-value-coverage/unused'
    | 'reduced-motion/loop'
    | 'contrast/text'
    | 'contrast/indicator'
    | 'contrast/unmeasured'
    | 'spacing/literal'
    | 'spacing/off-ramp';

/** Every rule the audit knows, in the order `formatAudit` groups them. */
export const AUDIT_RULES: readonly AuditRuleId[] = [
    'state-legibility/component',
    'state-legibility/indicator',
    'state-legibility/disclosure',
    'button-affordance',
    'axis-value-coverage/gap',
    'axis-value-coverage/ambiguous-base',
    'axis-value-coverage/unused',
    'axis-coverage',
    'reduced-motion/loop',
    'contrast/text',
    'contrast/indicator',
    'contrast/unmeasured',
    'spacing/literal',
    'spacing/off-ramp',
];

export type AuditSeverity = 'error' | 'warning' | 'info';

export const RULE_SEVERITY: Readonly<Record<AuditRuleId, AuditSeverity>> = {
    'state-legibility/component': 'error',
    'state-legibility/indicator': 'error',
    'state-legibility/disclosure': 'error',
    'button-affordance': 'error',
    'axis-value-coverage/gap': 'error',
    'axis-value-coverage/ambiguous-base': 'error',
    'axis-value-coverage/unused': 'warning',
    'axis-coverage': 'warning',
    'reduced-motion/loop': 'error',
    'contrast/text': 'error',
    'contrast/indicator': 'error',
    'contrast/unmeasured': 'info',
    // A literal that IS on the ramp renders correctly and only costs density;
    // one that is on no step is also a value no reader can trace.
    'spacing/literal': 'warning',
    'spacing/off-ramp': 'error',
};

export interface AuditFinding {
    rule: AuditRuleId;
    severity: AuditSeverity;
    /**
     * Where the finding points, in `ValidationIssue`'s dotted spelling:
     * `scope` (a component-level legibility finding), `scope.part`, or
     * `scope.axis` (a coverage finding about one scope) — and, for the one
     * rule that speaks at design-system level (`axis-value-coverage/unused`),
     * `axis.value` (`color.primary`, `size.2xl`), where `scope` is absent.
     * Read the structured fields beside it rather than parsing this.
     */
    where: string;
    /** Absent only for a design-system-level finding (a declared value no scope uses). */
    scope?: string;
    /**
     * The ecosystem package that owns `scope`, when a discovered pack does —
     * filled in from the merged manifest's provenance, so a finding about a
     * recipe the design system did not write says whose it is.
     */
    package?: string;
    part?: string;
    /** The states a legibility finding is about, when it is about a pair. */
    states?: readonly string[];
    /** The axis a coverage finding is about. */
    axis?: string;
    /** The axis values a coverage finding names. */
    values?: readonly string[];
    /** The theme a contrast finding was measured in. */
    theme?: string;
    /** The contrast cell (`ds/theme/scope/part/state/flag/axes`) a contrast finding is about. */
    cell?: string;
    /** The measured pair behind a contrast finding, and the floor it answered to. */
    contrast?: { ratio: number; inGroup: number; floor: number };
    /** Why a `contrast/unmeasured` finding could not be measured. */
    reason?: string;
    /** Names the fix, as the guard messages always did. */
    message: string;
}

/**
 * A finding a declared mechanism excused — visible rather than silent, the
 * way the browser contrast audit annotates what it suppressed. `skipStates`
 * and the anatomy's `hiddenIn` waive legibility pairs; `tokens.scopes`
 * waives an axis a scope declared out of existence for itself; a role
 * declared as a fill or hairline (`content: false` / `soft: false`) waives
 * its own absence from the `color` vocabulary.
 */
export interface AuditWaiver extends AuditFinding {
    waivedBy: {
        mechanism: 'skipStates' | 'hiddenIn' | 'tokens.scopes' | 'role-decl';
        detail: string;
    };
}

export interface AuditSummary {
    errors: number;
    warnings: number;
    info: number;
    byRule: Partial<Record<AuditRuleId, number>>;
}

export interface AuditResult {
    auditVersion: 1;
    name: string;
    /** Sorted severity → rule → where, so two runs over one input diff cleanly. */
    findings: AuditFinding[];
    waived: AuditWaiver[];
    /**
     * The static contrast matrix's full cell table, per theme — every cell
     * with its verdict, not only the failing ones, so a reviewer can see what
     * was measured and what was not. Empty when the `contrast/*` rules were
     * filtered out.
     */
    contrast: ContrastMatrix;
    summary: AuditSummary;
}

/** What one rule module hands back; `auditDesignSystem` merges and sorts. */
export interface RuleOutput {
    findings: AuditFinding[];
    waived: AuditWaiver[];
}
