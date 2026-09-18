/**
 * `spacing/*` — the ramp is the vocabulary, and a number is not.
 *
 * `contract/tokens.ts` declares the spacing category with its own claim
 * attached: *"Density ramp for padding, gap and margin — how tightly the
 * system is packed."* Every design system declares one, and recipes use it
 * heavily (357 `var(--space-*)` references across 39 of zero-basic's 51
 * components). Nothing asked whether the rest were on it.
 *
 * They were not, and the leak was structural rather than careless.
 * zero-basic's `size` variants were written as literals:
 *
 *     xs: { tab: { base: { fontSize: 'var(--text-xs)', padding: '0.25rem 0.5rem' } } },
 *
 * `0.25rem` IS `--space-xs` and `0.5rem` IS `--space-md` — so `size` and the
 * spacing ramp were two uncoordinated systems doing the same job. Elsewhere
 * `padding: 0.5rem 0.875rem` put a value on no skin's ramp at all: a number
 * no reader can trace to a token, and no rule could have caught.
 *
 * ── WHY THIS IS WORTH A RULE ─────────────────────────────────────────────────
 * Not tidiness. Because a recipe references `var(--space-md)` rather than
 * `0.5rem`, an app gets a density mode for free:
 *
 *     [data-density="compact"] { --space-md: 0.375rem; --space-lg: 0.5rem; }
 *
 * Custom properties inherit, so that scopes to any subtree; app CSS is
 * unlayered, so it beats the `:where(:root)` a design system writes into
 * `zero.tokens`; it needs no JS and survives a design-system swap. Every
 * reference re-resolves — and every literal is inert. Spacing coherence is
 * what makes density possible, so a literal is not a style opinion, it is a
 * hole in a mechanism.
 *
 * ── WHAT IS DELIBERATELY NOT FLAGGED ─────────────────────────────────────────
 * - **`em` lengths.** `gap: 0.5em` is spacing that tracks TYPE rather than the
 *   ramp, which is a different and legitimate choice — it is what `em` is for,
 *   and a control whose gap should grow with its label wants exactly this.
 * - **Anything below the top level of a value.** In `calc(var(--space-lg) -
 *   2px)` the `2px` is arithmetic, not a step; the declaration already rides
 *   the ramp and already answers to density. Only top-level components of a
 *   value are judged, which is what separates that case from
 *   `padding: 0.5rem var(--space-md)`, where the literal is a step and is
 *   flagged.
 * - **Zero.** `0` needs no token, and `--space-none` would be a worse thing to
 *   have than the literal.
 * - **A design system that declares no ramp.** There is nothing to be off,
 *   so there is nothing to say.
 *
 * The properties judged are exactly the ones the category's own description
 * names: padding, margin and gap.
 */
import type { CssRule } from '../css-rules.js';
import type { AuditContext } from '../context.js';
import type { AuditFinding, RuleOutput } from '../types.js';

/** The positions the spacing category claims: "padding, gap and margin". */
const SPACING_PROPERTY = /^(padding|margin)(-(top|right|bottom|left|inline|block)(-(start|end))?)?$|^(row-|column-)?gap$/;

/** A bare length — `rem` and `px` only; `em` tracks type by design. */
const RAMPED_LENGTH = /^-?\d*\.?\d+(rem|px)$/;

/** `0`, `0px`, `0rem` — nothing a ramp should name. */
const ZERO = /^-?0(\.0+)?(rem|px)?$/;

/**
 * A value's TOP-LEVEL components: whitespace-separated, with anything inside
 * parentheses left alone. `calc(var(--space-lg) - 2px)` is one component and
 * yields no bare length; `0.5rem var(--space-md)` is two and yields one.
 */
export function topLevelComponents(value: string): string[] {
    const out: string[] = [];
    let depth = 0;
    let current = '';
    for (const ch of value) {
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        if (depth === 0 && /\s/.test(ch)) {
            if (current) out.push(current);
            current = '';
            continue;
        }
        current += ch;
    }
    if (current) out.push(current);
    return out;
}

/** Declared value → the ramp key that names it, for the suggestion. */
function rampIndex(spacing: Record<string, string> | undefined): Map<string, string> {
    const index = new Map<string, string>();
    for (const [key, value] of Object.entries(spacing ?? {})) {
        if (typeof value === 'string') index.set(value.trim(), key);
    }
    return index;
}

/** The part a rule is about, when its selector names one. */
function partOf(selector: string): string | undefined {
    return /\[data-part="([a-z0-9-]+)"\]/.exec(selector)?.[1];
}

export function spacingFindings(
    scope: string,
    rules: readonly CssRule[],
    ramp: ReadonlyMap<string, string>,
): AuditFinding[] {
    const findings: AuditFinding[] = [];
    if (ramp.size === 0) return findings;

    for (const rule of rules) {
        const part = partOf(rule.selector);
        for (const decl of rule.decls) {
            const colon = decl.indexOf(':');
            if (colon < 0) continue;
            const prop = decl.slice(0, colon).trim();
            if (!SPACING_PROPERTY.test(prop)) continue;

            for (const component of topLevelComponents(decl.slice(colon + 1).trim())) {
                if (ZERO.test(component) || !RAMPED_LENGTH.test(component)) continue;

                const key = ramp.get(component);
                findings.push(key !== undefined
                    ? {
                        rule: 'spacing/literal',
                        severity: 'warning',
                        where: part ? `${scope}.${part}` : scope,
                        scope,
                        ...(part ? { part } : {}),
                        message:
                            `"${prop}: ${component}" is --space-${key} written as a number, so it does not `
                            + `answer to a density override — write var(--space-${key})`,
                    }
                    : {
                        rule: 'spacing/off-ramp',
                        severity: 'error',
                        where: part ? `${scope}.${part}` : scope,
                        scope,
                        ...(part ? { part } : {}),
                        message:
                            `"${prop}: ${component}" is on no declared spacing step (${[...ramp.keys()].join(', ')}), `
                            + 'so it is both untraceable to a token and inert under a density override',
                    });
            }
        }
    }
    return findings;
}

export const ids = ['spacing/literal', 'spacing/off-ramp'] as const;

export function run(ctx: AuditContext): RuleOutput {
    // The design-system-level ramp. A per-theme `system.spacing` override
    // would be a theme that re-scales density, which is a different question
    // from whether a recipe rides the ramp at all.
    const ramp = rampIndex(ctx.ds.tokens.system?.spacing as Record<string, string> | undefined);
    const findings: AuditFinding[] = [];
    for (const [scope, rules] of ctx.cssRules) {
        findings.push(...spacingFindings(scope, rules, ramp));
    }
    return { findings, waived: [] };
}
