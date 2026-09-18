/**
 * `button-affordance` — the no-UA-chrome rule.
 *
 * zero picks the element each part renders as, and twenty-nine parts across
 * the component set render as a real `<button>`. That is an accessibility
 * decision (it is a button, so it is a `<button>`), and it comes with a
 * styling obligation the design system — not zero — owes: a `<button>` that
 * no rule claims is painted by the user agent. Chrome draws a 13.33px Arial
 * chip with a 2px outset bevel and its own focus ring, which belongs to no
 * design system and looks like a bug in all of them.
 *
 * Nothing asked. `validate-recipes` warns when a part is missing entirely, but
 * `trigger: { base: {}, states: { open: {}, closed: {}, disabled: {} } }`
 * mentions the part and every state, so it warned about nothing. The css
 * goldens recorded the absence faithfully and understood none of it. The
 * state-legibility rule asks whether two states differ, and `{}` vs `{}` under
 * a component whose OTHER part carries the difference is a legitimate answer.
 * So #213: all six design systems shipped a `tooltip/trigger` with no button
 * treatment at all, four of them as raw UA chrome, for as long as the component
 * had existed.
 *
 * ── THE PROXY ────────────────────────────────────────────────────────────────
 * `appearance` is the one declaration that means "I have taken this element's
 * paint away from the user agent", and it is the only one that means it: a
 * background, a border and a font can each be set on a `<button>` while the UA
 * still supplies the rest of the chip. Requiring it is narrow enough to be
 * mechanically checkable and honest about what it proves — it proves the design
 * system LOOKED at the part. A recipe can still set `appearance: none` and
 * nothing else, and this rule will pass it; what it cannot do any more is
 * never mention the part at all, which is the failure that actually happened.
 *
 * ── THE DEFAULT CONTEXT ──────────────────────────────────────────────────────
 * The same substrate and the same reasoning as `state-legibility.ts`: the
 * compiled CSS (because a reset can arrive through `base`, `selectors`,
 * `variants.*` or the raw `css` escape hatch, and only the artifact sees all of
 * them), read for the render a reader actually gets. A reset that only applies
 * under a `@media` query, in one state, or for one non-default variant leaves
 * the un-attributed button beveled, so only the unconditional rule counts.
 *
 * Lifted verbatim from `__tests__/button-affordance.test.ts` (#403), which now
 * calls `buttonFindings` for the six in-repo skins and keeps its own teeth.
 */
import type { ManifestComponent, ZeroManifest } from '../../contract.js';
import type { CssRule } from '../css-rules.js';
import type { AuditContext } from '../context.js';
import type { AuditFinding, RuleOutput } from '../types.js';

/** Every `(scope, part)` zero renders as a real `<button>`. */
export function buttonParts(manifest: Pick<ZeroManifest, 'components'>): Array<{ scope: string; part: string }> {
    return manifest.components.flatMap(
        (c: ManifestComponent) => c.parts.filter((p) => p.element === 'button').map((p) => ({ scope: c.scope, part: p.name })),
    );
}

/** Rules that apply somewhere other than the plain, un-attributed render. */
const isDefaultContext = (rule: CssRule): boolean => rule.at.every((p) => p.startsWith('@layer'));

/**
 * Does this rule apply to `part` with nothing else asked of the element?
 *
 * `[data-scope][data-part]` and any ancestor written the same way are the
 * unconditional cascade; a `[data-state=…]`, `[data-variant=…]`, `:hover` or
 * `::before` left over means the rule is conditional and the plain render does
 * not get it.
 */
export function isUnconditionalFor(rule: CssRule, part: string): boolean {
    const subjects = [...rule.selector.matchAll(/\[data-part="([^"]+)"\]/g)];
    if (subjects[subjects.length - 1]?.[1] !== part) return false;
    const residue = rule.selector
        .replace(/\[data-scope="[^"]+"\]/g, '')
        .replace(/\[data-part="[^"]+"\]/g, '')
        .trim();
    return residue === '';
}

export const declares = (rule: CssRule, prop: string): boolean =>
    rule.decls.some((d) => d.slice(0, d.indexOf(':')).trim().toLowerCase().replace(/^-\w+-/, '') === prop);

/** Does this part's CSS take its paint away from the UA in the default render? */
export const resetsAppearance = (rules: readonly CssRule[], part: string): boolean =>
    rules.some((r) => isDefaultContext(r) && isUnconditionalFor(r, part) && declares(r, 'appearance'));

/**
 * The cells in one design system where a `<button>` keeps its UA chrome.
 *
 * Reads the compiled CSS per scope; a scope with no CSS at all is the
 * "renders unstyled" failure `validate-recipes` already warns about, and is
 * not reported here.
 */
export function buttonFindings(
    manifest: Pick<ZeroManifest, 'components'>,
    rulesByScope: ReadonlyMap<string, readonly CssRule[]>,
): AuditFinding[] {
    const out: AuditFinding[] = [];
    for (const { scope, part } of buttonParts(manifest)) {
        const rules = rulesByScope.get(scope);
        if (rules === undefined) continue;
        if (resetsAppearance(rules, part)) continue;
        out.push({
            rule: 'button-affordance',
            severity: 'error',
            where: `${scope}.${part}`,
            scope,
            part,
            message: `${scope}.${part}: zero renders this part as a real <button> and no unconditional rule `
                + `declares \`appearance\` for it, so the user agent paints its chip (bevel, font, focus `
                + `ring). Set \`appearance: none\` in the part's base — a reset behind a state, a variant `
                + `or a media query leaves the plain render beveled.`,
        });
    }
    return out;
}

export function run(ctx: AuditContext): RuleOutput {
    return { findings: buttonFindings(ctx.manifest, ctx.cssRules), waived: [] };
}
