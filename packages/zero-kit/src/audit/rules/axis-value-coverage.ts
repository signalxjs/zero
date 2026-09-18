/**
 * `axis-value-coverage/*` — the declared-step-nobody-honours rules.
 *
 * A design system's `tokens.sizes` / `tokens.variants` / `tokens.roles` /
 * `tokens.axes` are not notes to self. They reach `manifest.json`, the docs
 * site and the generated `register.d.ts`; an app is entitled to pass any value
 * in them and `data-size="2xl"` reaches the DOM whether or not a rule matches.
 * A declared value nothing matches doesn't fail — it silently renders the base.
 *
 * So #258: zero-carbon declared `sm md lg xl 2xl` and only `button` shipped
 * `xl`/`2xl`. The other fourteen size-bearing scopes fell back to their `md`
 * base at both steps, which is *smaller than `lg`* — avatar 48 → 40px, checkbox
 * 22 → 18, switch 56×28 → 48×24. Growing the size axis shrank the control. The
 * full suite was green throughout: the css goldens recorded the absent rules
 * faithfully, `validate-recipes` only asks whether a value names a declared one
 * (it did not exist, so there was nothing to name), and the axis-coverage rule
 * asks whether a scope wires the axis *at all* — avatar wired `sm` and `lg`, so
 * it was wiring size. Nothing asked whether the ramp had holes in it.
 *
 * ── THE UN-ATTRIBUTED STEP ───────────────────────────────────────────────────
 * The naive rule — "every declared value must emit a rule in every scope" —
 * cannot be stated, because one step per axis legitimately emits nothing:
 *
 *     sm: { root: { base: { minHeight: '2rem' } } },
 *     md: {},   // the base already IS md; restating it is a second copy free to drift
 *     lg: { root: { base: { minHeight: '3rem' } } },
 *
 * That is right, and it is not always `md` — zero-carbon's button writes
 * `lg: {}` because Carbon's default button is the 48px one, and zero-heroui's
 * whole size axis is based on `md`.
 *
 * These rules read the empty entry AS the claim: **a declared value is
 * accounted for when it emits a rule in the default render, or when the recipe
 * writes it as an entry that emits nothing at all — which says "the base is
 * this step".** No new syntax, no schema change; it is already what every
 * author means. `defaultVariants` is deliberately NOT a second way to say it:
 * it would let a forgotten step be excused by a field written for a different
 * purpose, and the point of the empty entry is that an author who forgot a step
 * wrote nothing at all.
 *
 * "Emits nothing at all" is stricter than "emits nothing here": an entry whose
 * only rule sits inside a `@media` has clearly been thought about and is not
 * claiming to be the base, so it is a gap rather than a claim — which is also
 * the honest reading, since at the default viewport it renders as the base
 * without meaning to.
 *
 * The claim being singular is half the rule (`ambiguous-base`). Two silent
 * values both stand for the base, so they render identically — which is #258's
 * harm exactly, reached by the other door: "fix" a missing `xl` by writing
 * `xl: {}` and `xl` still renders as `md`. `gap` closes the hole
 * `ambiguous-base` would open, and `ambiguous-base` closes `gap`'s.
 *
 * ── WHY THE COMPILED CSS ─────────────────────────────────────────────────────
 * The same substrate and the same reasoning as `state-legibility.ts` and
 * `button-affordance.ts`: a value can be implemented through `variants`,
 * `compoundVariants` or the raw `css` escape hatch, and only the artifact sees
 * all three. Only the *default context* counts — a step whose only rule sits
 * inside a `@media` is not implemented at the default viewport, and what the
 * reader gets there is the base. (The recipe tree is read for exactly one
 * thing: whether a value was WRITTEN, which is not visible in CSS that an
 * empty entry by definition does not emit.)
 *
 * ── WHY IT IS NOT THE NAIVE RULE ─────────────────────────────────────────────
 * Measured before it was written: across the six design systems, "every
 * declared value in every scope with a recipe" reports **1267** findings. That
 * is the shape that got the per-part legibility guard reverted at 164. The
 * scoping below reports **0**, and reports the 28 that #258 actually was.
 *
 * Two restrictions get it there, and each is a claim rather than a threshold:
 *
 * 1. **Only scopes that participate.** A scope wiring nothing for an axis is
 *    not making a promise about it — zero's dialog, popover and tooltip take no
 *    size prop, and the axis-coverage rule already owns the question of which
 *    scopes ought to. (1267 → 124.)
 * 2. **Only values some scope in the design system implements.** A step
 *    `button` ships is a step the design system has decided exists, and a
 *    sibling that also takes the axis and skips it is the #258 gap. A value NO
 *    recipe implements is a different claim — the design system said a word and
 *    never used it — and `unused` takes that one at design-system granularity,
 *    where it is three findings instead of sixty-four. (124 → 0, once the
 *    un-attributed step is read.)
 *
 * Lifted verbatim from `__tests__/axis-value-coverage.test.ts` (#403), which
 * now calls these primitives for the six in-repo skins, keeps its material
 * ledger, and keeps its teeth.
 */
import type { RoleDecl } from '../../contract.js';
import type { CompiledDesignSystem } from '../../design-system.js';
import { axisClaims, offeredFor } from '../../design-system.js';
import type { CssRule } from '../css-rules.js';
import { parseRules } from '../css-rules.js';
import type { AuditContext } from '../context.js';
import type { AuditFinding, AuditWaiver, RuleOutput } from '../types.js';

/**
 * The value vocabulary this design system declares, per axis attribute.
 *
 * Keyed by the attribute the CSS matches on, which is what makes the vendor
 * API remap (#183) a non-issue here: zero-carbon's `kind` is the `variant` axis
 * under a vendor name, spelled kebab in `tokens.variants` and kebab in
 * `[data-variant="danger-tertiary"]`; the double-hyphen spelling exists only at
 * the prop boundary.
 *
 * An axis declared out of existence (`roles: {}`, `sizes: []`) is absent, not
 * empty — there is no vocabulary to honour.
 */
export function declaredVocabulary(compiled: CompiledDesignSystem): Record<string, readonly string[]> {
    const out: Record<string, readonly string[]> = {};
    const roles = Object.keys(compiled.tokens.roles);
    if (roles.length > 0) out['color'] = roles;
    if (compiled.tokens.sizes.length > 0) out['size'] = compiled.tokens.sizes;
    if (compiled.tokens.variants.length > 0) out['variant'] = compiled.tokens.variants;
    for (const [axis, values] of Object.entries(compiled.tokens.axes)) {
        if (values.length > 0) out[axis] = values;
    }
    return out;
}

/**
 * Rules that apply somewhere other than the plain, default-viewport render.
 * `@scope` is a WHERE, not a WHEN: the donut that bounds a non-carrier axis
 * rule (#317) narrows which elements match, exactly like the selector it
 * replaced, and applies in the default render — so it does not make a rule
 * conditional the way `@media` does.
 */
const isDefaultContext = (rule: CssRule): boolean =>
    rule.at.every((p) => p.startsWith('@layer') || p.startsWith('@scope'));

/**
 * The values of `axis` this stylesheet matches on.
 *
 * `where: 'default'` is what the reader gets with no query satisfied — the only
 * render a value can be said to be implemented in. `where: 'anywhere'` includes
 * `@media`, and exists to tell an entry that paints *somewhere* apart from one
 * that paints nowhere at all: only the second is the empty entry that claims
 * the base.
 */
export function paintedValues(css: string | readonly CssRule[], axis: string, where: 'default' | 'anywhere'): Set<string> {
    const out = new Set<string>();
    const attr = new RegExp(`\\[data-${axis}="([^"]+)"\\]`, 'g');
    const rules = typeof css === 'string' ? parseRules(css) : css;
    for (const rule of rules) {
        if (where === 'default' && !isDefaultContext(rule)) continue;
        for (const [, value] of rule.selector.matchAll(attr)) out.add(value!);
        // A non-carrier axis rule carries its attribute in the `@scope` donut
        // prelude rather than in its own selector (#317) — the value is still
        // painted by every rule inside the donut.
        for (const prelude of rule.at) {
            if (!prelude.startsWith('@scope')) continue;
            for (const [, value] of prelude.matchAll(attr)) out.add(value!);
        }
    }
    return out;
}

/**
 * The values of `axis` this recipe WROTE, whether or not they emit anything.
 *
 * `harvestAxes` already collects exactly this — the keys of `variants[axis]`
 * plus any value named in a `compoundVariants` match — which is why the empty
 * entry is legible at all: `md: {}` emits no CSS but is a key.
 */
const writtenValues = (axes: CompiledDesignSystem['components'][string], axis: string): Set<string> =>
    new Set(
        axis === 'color' ? axes.color
            : axis === 'size' ? axes.size
                : axis === 'variant' ? axes.variant
                    : (axes.axes[axis] ?? []),
    );

/**
 * The vocabulary one SCOPE offers for one axis — its `tokens.scopes` entry
 * where it declared one, else the design-system-wide list (#294).
 *
 * The distinction is what keeps the `gap` rule honest under a union: once
 * `tokens.variants` is the union of every scope's vocabulary, "a value a
 * sibling implements" stops meaning "a value this scope owes you".
 */
function vocabularyFor(compiled: CompiledDesignSystem, scope: string, axis: string): readonly string[] {
    const wired = compiled.components[scope];
    const offered = wired ? offeredFor(wired, axis) : undefined;
    return offered ?? declaredVocabulary(compiled)[axis] ?? [];
}

export interface AxisCell {
    scope: string;
    axis: string;
    /** Painted in the default render — the only place a value counts as implemented. */
    painted: Set<string>;
    /** Written as an entry, whether or not it emits anything. */
    written: Set<string>;
    /** Written and emitting nothing anywhere: the claim that the base IS this value. */
    claims: string[];
    /** The vocabulary this scope offers for the axis — see `vocabularyFor`. */
    offered: readonly string[];
    /** True when that vocabulary is the scope's own rather than the union's. */
    restricted: boolean;
}

/** The parsed rules per scope, from a context when one is given, else parsed on demand. */
const rulesOf = (compiled: CompiledDesignSystem, scope: string, parsed?: ReadonlyMap<string, readonly CssRule[]>): readonly CssRule[] =>
    parsed?.get(scope) ?? parseRules(compiled.componentCss[scope] ?? '');

/** Every (scope, axis) in one design system that participates in the axis. */
export function participatingCells(compiled: CompiledDesignSystem, parsed?: ReadonlyMap<string, readonly CssRule[]>): AxisCell[] {
    const cells: AxisCell[] = [];
    const axes = Object.keys(declaredVocabulary(compiled));
    for (const [scope, wired] of Object.entries(compiled.components)) {
        const rules = rulesOf(compiled, scope, parsed);
        for (const axis of axes) {
            const painted = paintedValues(rules, axis, 'default');
            const anywhere = paintedValues(rules, axis, 'anywhere');
            const written = writtenValues(wired, axis);
            const declared = offeredFor(wired, axis);
            // A scope that declared the axis out of existence FOR ITSELF is
            // not participating, whatever the CSS says. Wiring an axis you
            // declared away is a `validate-recipes` error, and this rule must
            // not report the same mistake a second time as a coverage gap.
            if (declared?.length === 0) continue;
            // A scope with a vocabulary of its own participates even when it
            // paints and writes nothing. Before per-scope vocabularies there
            // was no way to promise anything, so silence was the only honest
            // reading; a declared vocabulary IS the promise, and promising a
            // vocabulary and shipping none of it is the sharpest #258 there is.
            //
            // Otherwise: a scope that neither paints nor writes a single value
            // of this axis has nothing this rule can hold it to. Whether it
            // *should* participate is the axis-coverage rule's question, not
            // this one's — conflating the two would make this fail for a
            // reason it was not built to catch.
            if (!declared && anywhere.size === 0 && written.size === 0) continue;
            cells.push({
                scope,
                axis,
                painted,
                written,
                claims: [...written].filter((v) => !anywhere.has(v)),
                offered: vocabularyFor(compiled, scope, axis),
                restricted: declared !== undefined,
            });
        }
    }
    return cells;
}

/** Values `axis` is implemented for by at least one scope in this design system. */
export function implementedSomewhere(compiled: CompiledDesignSystem, axis: string, parsed?: ReadonlyMap<string, readonly CssRule[]>): Set<string> {
    const out = new Set<string>();
    for (const scope of Object.keys(compiled.componentCss)) {
        for (const value of paintedValues(rulesOf(compiled, scope, parsed), axis, 'default')) out.add(value);
    }
    return out;
}

/** `gap`: a step a sibling implements, that this scope neither paints nor claims. */
export function coverageGaps(compiled: CompiledDesignSystem, parsed?: ReadonlyMap<string, readonly CssRule[]>): AuditFinding[] {
    const out: AuditFinding[] = [];
    const declared = declaredVocabulary(compiled);
    const promised = new Map<string, Set<string>>(
        Object.keys(declared).map((axis) => [axis, implementedSomewhere(compiled, axis, parsed)]),
    );
    for (const cell of participatingCells(compiled, parsed)) {
        const claimed = new Set(cell.claims);
        // Two readings of "owes you this value", and which applies is exactly
        // whether the scope declared a vocabulary (#294):
        //
        // - **Restricted**: it named the values itself, so every one of them is
        //   owed and a sibling's set is irrelevant. This is what stops a union
        //   from making `button.variant: classic` a finding when `classic` was
        //   declared for `select` and painted there.
        // - **Unrestricted**: the original rule, unchanged — a value some
        //   sibling implements, since the whole union is on offer here.
        //
        // A design system where one scope restricts and a sibling does not gets
        // findings against the sibling, and that is the union's honest
        // consequence rather than a bug: the sibling really is still offering
        // values declared for someone else. `validateDesignSystem` names it at
        // the declaration, before it can arrive here.
        const missing = cell.offered.filter(
            (v) => !cell.painted.has(v) && !claimed.has(v)
                && (cell.restricted || promised.get(cell.axis)!.has(v)),
        );
        if (missing.length === 0) continue;
        out.push({
            rule: 'axis-value-coverage/gap',
            severity: 'error',
            where: `${cell.scope}.${cell.axis}`,
            scope: cell.scope,
            axis: cell.axis,
            values: missing,
            message: `${cell.scope}.${cell.axis}: ${missing.join(', ')} — declared, `
                + (cell.restricted ? 'promised by this scope\'s own vocabulary' : 'implemented by a sibling scope')
                + `, and neither painted nor claimed here, so an app passing it gets the base. Add the `
                + `step, or write it as an empty entry (\`${missing[0]}: {}\`) if the base IS this step.`,
        });
    }
    return out.sort((a, b) => a.where.localeCompare(b.where));
}

/** `ambiguous-base`: more than one value claiming to be the base. */
export function ambiguousBases(compiled: CompiledDesignSystem, parsed?: ReadonlyMap<string, readonly CssRule[]>): AuditFinding[] {
    return participatingCells(compiled, parsed)
        .filter((cell) => cell.claims.length > 1)
        .map((cell): AuditFinding => {
            const claims = [...cell.claims].sort();
            return {
                rule: 'axis-value-coverage/ambiguous-base',
                severity: 'error',
                where: `${cell.scope}.${cell.axis}`,
                scope: cell.scope,
                axis: cell.axis,
                values: claims,
                message: `${cell.scope}.${cell.axis}: ${claims.join(', ')} are all written as empty entries, `
                    + `so they all render as the base — and identically to each other. Exactly one value may `
                    + `claim the base; give the others a rule.`,
            };
        })
        .sort((a, b) => a.where.localeCompare(b.where));
}

/**
 * `unused`, in two classes that the union splits apart (#294):
 *
 * - **`unused`** — declared, in some scope's vocabulary, painted by nothing and
 *   claimed by nothing. The original rule: a word the design system says and
 *   never uses.
 * - **`unclaimed`** — declared, and in NO scope's vocabulary at all. Only
 *   reachable once every scope is restricted; while one is still open its
 *   vocabulary *is* the union, `axisClaims` says so, and the value falls to
 *   `unused` the old way.
 *
 * The two are different mistakes with different fixes — paint it somewhere,
 * versus give it to a scope or drop it from the union — so they are reported
 * apart rather than merged into "nobody uses this".
 */
export function unusedVocabulary(
    compiled: CompiledDesignSystem,
    parsed?: ReadonlyMap<string, readonly CssRule[]>,
): Array<{ axis: string; value: string; reason: 'unused' | 'unclaimed' }> {
    const out: Array<{ axis: string; value: string; reason: 'unused' | 'unclaimed' }> = [];
    const cells = participatingCells(compiled, parsed);
    for (const [axis, values] of Object.entries(declaredVocabulary(compiled))) {
        const painted = implementedSomewhere(compiled, axis, parsed);
        const claimed = new Set(cells.filter((c) => c.axis === axis).flatMap((c) => c.claims));
        const claims = axisClaims(compiled, axis);
        for (const value of values) {
            if (!claims.unrestricted && !claims.claimed.has(value)) {
                out.push({ axis, value, reason: 'unclaimed' });
            } else if (!painted.has(value) && !claimed.has(value)) {
                out.push({ axis, value, reason: 'unused' });
            }
        }
    }
    return out;
}

/**
 * A role that opted out of `-content` or `-soft` is a fill or a hairline —
 * Material's tonal `surface*` family, its `outline` — which is a token, not
 * something a control can be coloured. `tokens.roles` does double duty as the
 * palette and as the `color` vocabulary, and SKILL.md already tells authors to
 * filter exactly this predicate out of the axis. So a role like that which no
 * recipe wires is the declaration working as intended, not a gap — and it is
 * recorded as a waiver rather than dropped, so the let-through stays visible.
 */
export const isFillOrHairline = (decl: RoleDecl | undefined): boolean =>
    decl?.content === false || decl?.soft === false;

export function run(ctx: AuditContext): RuleOutput {
    const { compiled, cssRules } = ctx;
    const findings: AuditFinding[] = [...coverageGaps(compiled, cssRules), ...ambiguousBases(compiled, cssRules)];
    const waived: AuditWaiver[] = [];
    for (const u of unusedVocabulary(compiled, cssRules)) {
        const finding: AuditFinding = {
            rule: 'axis-value-coverage/unused',
            severity: 'warning',
            where: `${u.axis}.${u.value}`,
            axis: u.axis,
            values: [u.value],
            message: u.reason === 'unclaimed'
                ? `${u.axis}: "${u.value}" is declared and in no scope's vocabulary — every scope restricts `
                    + `the axis and none claims it. Give it to a scope in tokens.scopes, or drop it from the declaration.`
                : `${u.axis}: "${u.value}" is declared and no recipe paints or claims it — an app may pass it and `
                    + `get the base. Wire it somewhere, or drop it from the declaration.`,
        };
        if (u.axis === 'color' && isFillOrHairline(compiled.tokens.roles[u.value])) {
            waived.push({ ...finding, waivedBy: { mechanism: 'role-decl', detail: `roles.${u.value} is a fill or hairline (content: false / soft: false)` } });
            continue;
        }
        findings.push(finding);
    }
    return { findings, waived };
}
