/**
 * `axis-coverage` — the accepts-but-unwired rule.
 *
 * Every zero component composes `WithVariantAxes`: it accepts `color` /
 * `size` / `variant` at runtime and renders them as `data-*`. If a design
 * system declares an axis and a styled scope wires none of it, the attribute
 * matches nothing — and under an opted-in `/register` module the generated
 * type is `never`, so the prop is offered and then rejected. That is the
 * accepts-but-unwired gap (docs/architecture.md, "The ledgers"); #103 removed
 * it once and it came straight back with the next three components.
 *
 * This is the design-system half of `__tests__/axis-coverage.test.ts`
 * (#403). The other half — reading zero's component sources to discover the
 * carriers, and the two ledgers that record WHY `variant` stays unwired on
 * every scope but a few — is a fact about this repo's contract and stays in
 * the test. What ships is the question an external design system can be
 * asked: for each axis you declare, does every scope you style wire it?
 *
 * ── THE WAIVERS ──────────────────────────────────────────────────────────────
 * An axis a design system declares OUT of existence is not a gap: `roles: {}`
 * means there is no colour axis to wire, `sizes: []` no size ramp, and
 * demanding those would make a deliberately colourless design system
 * impossible to ship (`zero-heroui` is exactly that). A scope may say the
 * same for itself through `tokens.scopes.<scope>.colors: []` / `sizes: []`
 * (#294), and that is the recorded waiver: the scope declined the axis, so
 * its silence is an answer rather than an omission.
 *
 * `variant` is deliberately not checked: omitting `tokens.variants` means
 * "declared nothing", not "no variant axis" (`variants: []` is that claim,
 * #200/#295, and would be a waiver here if the axis were checked), and every
 * shipped skin wires it on a handful of scopes by decision. The
 * value-coverage rules judge the variant vocabulary a design system DOES
 * declare.
 */
import { offeredFor } from '../../design-system.js';
import type { AuditContext } from '../context.js';
import type { AuditFinding, AuditWaiver, RuleOutput } from '../types.js';

const CHECKED_AXES = ['color', 'size'] as const;

export function axisCoverage(ctx: AuditContext): RuleOutput {
    const { compiled } = ctx;
    const declared = {
        color: Object.keys(compiled.tokens.roles).length > 0,
        size: compiled.tokens.sizes.length > 0,
    };
    const findings: AuditFinding[] = [];
    const waived: AuditWaiver[] = [];
    for (const component of ctx.manifest.components) {
        const scope = component.scope;
        const wired = compiled.components[scope];
        // A scope with no recipe is a DIFFERENT failure — the validator
        // already warns "will render unstyled" — and conflating the two would
        // make this fail for a reason it was not built to catch.
        if (!wired) continue;
        for (const axis of CHECKED_AXES) {
            if (!declared[axis] || wired[axis].length > 0) continue;
            const base: Omit<AuditFinding, 'message'> = {
                rule: 'axis-coverage',
                severity: 'warning',
                where: `${scope}.${axis}`,
                scope,
                axis,
            };
            const offered = offeredFor(wired, axis);
            if (offered?.length === 0) {
                waived.push({
                    ...base,
                    message: `${scope}.${axis}: declared out of existence for this scope.`,
                    waivedBy: { mechanism: 'tokens.scopes', detail: `tokens.scopes.${scope}.${axis === 'color' ? 'colors' : 'sizes'}: []` },
                });
                continue;
            }
            findings.push({
                ...base,
                message: `${scope}.${axis}: this design system declares a ${axis} axis and the scope accepts `
                    + `it at runtime, but its recipe wires no value — \`data-${axis}\` matches nothing and `
                    + `the generated type is \`never\`. Wire the axis in the recipe, or declare it out of `
                    + `existence for this scope with tokens.scopes.${scope}.${axis === 'color' ? 'colors' : 'sizes'}: [].`,
            });
        }
    }
    return { findings, waived };
}

export const run = axisCoverage;
