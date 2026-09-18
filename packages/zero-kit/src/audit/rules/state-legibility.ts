/**
 * `state-legibility/*` — the states-look-alike rules.
 *
 * `data-state` is the contract's promise that a component tells you which state
 * it is in. A design system can accept that promise and then break it silently:
 * declare every state, style none of them differently, and every existing check
 * still passes. The validator's coverage warning only asks whether a state was
 * MENTIONED. The css goldens see the whole artifact and understand none of it.
 * Nothing asked whether two states actually render differently.
 *
 * So they did not. Before #226: material's and brutalist's checkbox indicator
 * painted no mark at all — three identical empty boxes — and every design
 * system's rating group set the same `color` for `full` and `half`, so a half
 * star rendered as a full one. Six design systems, the same two bugs, none of
 * them caught.
 *
 * ── WHY THE COMPILED CSS, NOT THE RECIPE TREE ───────────────────────────────
 * State styling reaches the stylesheet through `states`, `selectors`,
 * `variants.*`, `compoundVariants`, `modifiers`, nested `at`, and the raw `css`
 * escape hatch. Only the emitted CSS sees all seven. A rule reading `states`
 * would have called zero-basic and zero-daisyui broken for putting their tick
 * in `selectors['&[data-state="checked"]::after']` — the two that were right.
 * `css-golden.test.ts` already establishes compiled CSS as the kit's assertion
 * substrate; this is a second reader of it, one that understands what it reads.
 *
 * ── WHAT COUNTS AS A DIFFERENCE ──────────────────────────────────────────────
 * The default render, and only what the reader can see in it. Rules under any
 * `@media` are excluded (`isDefaultContext`) and motion-only declarations are
 * dropped (`isVisual`) — a rule that accepted either would have accepted the
 * bug it was written for: #226 gives every drawn mark a `forced-colors`/`print`
 * glyph fallback, so `content: "\2713"` vs `content: "\2212"` would have made
 * "the indicator distinguishes `checked` from `indeterminate`" true of an
 * indicator that draws two identical empty boxes. The teeth in
 * `__tests__/state-legibility.test.ts` keep both holes shut with fixtures.
 *
 * ── WHY THERE ARE THREE RULES AND NOT ONE ───────────────────────────────────
 * `component` judges the COMPONENT: some part of it, anywhere, tells the two
 * states apart. That is deliberately loose, because "the difference lives on a
 * sibling part" is legitimate and extremely common — and judging every part
 * separately reported 164 of those. `indicator` and `disclosure` are the two
 * places where that looseness is not good enough, and each names the part
 * whose job the state IS: an `indicator`, and the control of an in-flow
 * disclosure. Both are contract claims about a specific part, not heuristics
 * about components in general, which is why they can afford to be strict
 * where `component` cannot.
 *
 * `disclosure` exists because `component` cleared #220. zero-material's
 * collapsible and accordion triggers were byte-identical open vs closed —
 * `open: {}` and `closed: {}`, both empty — and `component` was satisfied by
 * `[data-part="root"][open]::details-content { block-size: auto }`, i.e. by the
 * panel physically expanding, which is what `<details>` does in every design
 * system whether or not the recipe says anything. A rule that passes on
 * browser behaviour rather than on a styling decision is a false green, and a
 * false green is worse than no rule because it is trusted.
 *
 * Lifted verbatim from `__tests__/state-legibility.test.ts` (#403). That file
 * now calls these primitives for the six in-repo skins and keeps its teeth.
 */
import type { ManifestComponent } from '../../contract.js';
import type { RecipeInput } from '../../recipes.js';
import type { CssRule } from '../css-rules.js';
import { parseRules } from '../css-rules.js';
import type { AuditContext } from '../context.js';
import { styledScopes } from '../context.js';
import type { AuditFinding, AuditWaiver, RuleOutput } from '../types.js';

/**
 * States the browser also carries natively, and the selectors that read them.
 *
 * A design system may style `open` as `[open]` on a `<details>` or `:checked`
 * on a real input rather than through `data-state` — zero renders both. Without
 * this, material's `<details>`-based accordion and collapsible look
 * undifferentiated when they are styled through
 * `[data-part="root"][open]::details-content`.
 */
export const NATIVE_PROXIES: Readonly<Record<string, readonly string[]>> = {
    open: ['[open]', ':popover-open', ':open'],
    checked: [':checked'],
    indeterminate: [':indeterminate'],
};

/** Every fragment that means "this rule applies in state `s`". */
const fragmentsFor = (state: string): readonly string[] =>
    [`[data-state="${state}"]`, ...(NATIVE_PROXIES[state] ?? [])];

/** The part a rule's subject is, plus any pseudo-element hung off it. */
export function groupOf(rule: CssRule): string | undefined {
    // The LAST `data-part` is the subject — `[data-color="x"] [data-part="y"]`
    // styles `y`, and pseudo-projected parts (`dialog.backdrop` →
    // `[data-part="popup"]::backdrop`) land under their host's name.
    const parts = [...rule.selector.matchAll(/\[data-part="([^"]+)"\]/g)];
    const part = parts[parts.length - 1]?.[1];
    if (!part) return undefined;
    // Key by (host part, pseudo suffix): a recipe-authored `::after` is a
    // different surface from the element itself, and a component that draws its
    // mark there is drawing it somewhere real.
    const pseudo = /(::[a-z-]+(?:\([^)]*\))?)\s*$/.exec(rule.selector)?.[1] ?? '';
    return `${part}${pseudo}`;
}

/**
 * Rules that only apply somewhere other than the default render.
 *
 * The question these rules ask is whether the state is legible in the render
 * the reader gets — so only the unconditional cascade counts. `@layer` is
 * structure and stays; every condition is disqualifying, and the two that
 * matter most are `forced-colors` and `print`. Both carry the glyph fallbacks
 * the drawn marks swap in (`content: "\2713"` vs `"\2212"`), and counting those
 * would make the assertion vacuous for exactly the pair it exists to protect:
 * an indicator that draws NOTHING in either state would still be "legible"
 * because a palette the reader is not using tells them apart. A breakpoint or a
 * `hover: none` difference is disqualified for the same reason — a difference
 * some readers never see is not the default render differentiating.
 */
const isDefaultContext = (rule: CssRule): boolean => rule.at.every((p) => p.startsWith('@layer'));

/**
 * Declarations that cannot change how a RESTING state looks.
 *
 * A state whose only declaration is `transition: scale … var(--duration-fast)`
 * differs in how it ARRIVES, not in how it looks once it has: material's
 * `&[data-state="checked"]::after` restates the transition to stagger the
 * second arm, and that alone must not count as drawing a mark. Kept out of the
 * fingerprint rather than out of the CSS, and a rule left with nothing else is
 * dropped whole — otherwise its bare existence would still differentiate.
 *
 * `animation-delay` joins them for the same reason; `animation` itself does
 * not, since a state can legitimately BE an animation (daisy's radio dot).
 */
const NON_VISUAL: ReadonlySet<string> = new Set([
    'transition',
    'transition-property',
    'transition-duration',
    'transition-timing-function',
    'transition-delay',
    'transition-behavior',
    'will-change',
    'animation-delay',
]);

const isVisual = (decl: string): boolean =>
    !NON_VISUAL.has(decl.slice(0, decl.indexOf(':')).trim().toLowerCase());

/**
 * The rules that apply to one group in one state, with the state itself blanked.
 *
 * Blanking is what makes the comparison meaningful: two rules that differ ONLY
 * in which state they name are the same paint, so the states are
 * indistinguishable. Declarations are sorted, because a reordering is not a
 * visual difference.
 */
export function fingerprint(rules: readonly CssRule[], group: string, state: string): string[] {
    const fragments = fragmentsFor(state);
    const out: string[] = [];
    for (const rule of rules) {
        if (!isDefaultContext(rule)) continue;
        if (groupOf(rule) !== group) continue;
        if (!fragments.some((f) => rule.selector.includes(f))) continue;
        const decls = rule.decls.filter(isVisual);
        if (!decls.length) continue;
        let selector = rule.selector;
        for (const f of fragments) selector = selector.split(f).join('[data-state="§"]');
        out.push([...rule.at, selector, [...decls].sort().join('; ')].join(' | '));
    }
    return out.sort();
}

export const distinguishes = (rules: readonly CssRule[], group: string, a: string, b: string): boolean =>
    fingerprint(rules, group, a).join('\n') !== fingerprint(rules, group, b).join('\n');

/** Every unordered pair of a closed state set. */
export function pairsOf(states: readonly string[]): Array<[string, string]> {
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < states.length; i++) {
        for (let j = i + 1; j < states.length; j++) pairs.push([states[i]!, states[j]!]);
    }
    return pairs;
}

export interface LegibilityCase {
    scope: string;
    component: ManifestComponent;
    rules: readonly CssRule[];
    groups: string[];
    /** The recipe's own exemptions, kept per part — see `skipsPair`. */
    skipStates: Readonly<Record<string, readonly string[]>>;
}

/** One judgeable unit: an anatomy, the recipe for it, and the CSS that came out. */
export function caseOf(component: ManifestComponent, recipe: RecipeInput, css: string | readonly CssRule[]): LegibilityCase {
    const rules = typeof css === 'string' ? parseRules(css) : css;
    return {
        scope: component.scope,
        component,
        rules,
        groups: [...new Set(rules.map(groupOf).filter((g): g is string => Boolean(g)))],
        skipStates: recipe.skipStates ?? {},
    };
}

/**
 * Has `part` declared this pair intentionally unstyled?
 *
 * `skipStates` already means "this declared state is intentionally left
 * unstyled" — the same claim these rules test, so the same opt-out, declared in
 * the design system's own source next to the recipe rather than in a test file
 * its author never opens. But it is declared PER PART, and it has to be read per
 * part: zero-brutalist's radio-group skips `checked`/`unchecked` on `item` and
 * `item-label` (a row and a text label that do not change when selected), and
 * that must not quietly excuse `item-indicator` — the one part whose entire job
 * is to look different. Flattening the map, as the first draft of the guard
 * did, turned two honest per-part claims into a component-wide opt-out.
 */
const skipsPair = (c: LegibilityCase, part: string, a: string, b: string): boolean => {
    const skipped = c.skipStates[part] ?? [];
    return skipped.includes(a) || skipped.includes(b);
};

/**
 * The exemption `skipStates` cannot express, because it is not a design
 * system's claim to make.
 *
 * Avatar's three states are CSS-identical in all six design systems and that
 * is correct: zero sets `hidden` on the image while `error` and on the
 * fallback while `loaded`, so a rule for those states can never paint. Stating
 * it through `skipStates` would mean six design systems each restating a fact
 * about zero's runtime; stating it in a test means a hand-maintained table of
 * it. It is the anatomy's fact, so the anatomy declares it —
 * `PartSpec.hiddenIn`, read back out of the manifest. A part rename now breaks
 * the declaration at its source instead of quietly widening an allowlist.
 *
 * It reaches the rules as two different questions, below.
 */
const hiddenStates = (c: LegibilityCase, part: string): readonly string[] =>
    c.component.parts.find((p) => p.name === part)?.hiddenIn ?? [];

/**
 * Does PRESENCE tell `a` from `b` — is some part rendered in exactly one of
 * them? The `component` rule's question, and the reason `hiddenIn` reads with
 * `some` over the parts where `skipStates` reads with `every`: a skip is a
 * WAIVER, which every part carrying those states has to sign, whereas
 * appearing and disappearing is a DIFFERENCE — one part making it is enough,
 * exactly as one part painting the states differently is.
 *
 * EXACTLY one, though. A part hidden in BOTH states is absent either way and
 * so differentiates nothing; the pair still has to be legible somewhere, and
 * `hidden.includes(a) || hidden.includes(b)` would have quietly excused it.
 */
export const presenceDiffers = (c: LegibilityCase, parts: readonly string[], a: string, b: string): boolean =>
    parts.some((name) => {
        const hidden = hiddenStates(c, name);
        return hidden.includes(a) !== hidden.includes(b);
    });

/**
 * Can this part's own CSS be asked to tell `a` from `b` at all? The
 * `indicator` rule's question, and it is the OR: a rule for a hidden state
 * never paints, so if the runtime hides the part in EITHER state, demanding a
 * visible difference demands something no recipe can supply. (When it hides
 * the part in exactly one, the reader can still tell them apart — the part is
 * simply gone.)
 */
const cannotPaintPair = (c: LegibilityCase, part: string, a: string, b: string): boolean => {
    const hidden = hiddenStates(c, part);
    return hidden.includes(a) || hidden.includes(b);
};

const waiver = (
    f: AuditFinding,
    mechanism: AuditWaiver['waivedBy']['mechanism'],
    detail: string,
): AuditWaiver => ({ ...f, waivedBy: { mechanism, detail } });

/**
 * `state-legibility/component`, for one component — at COMPONENT level, not
 * part level.
 *
 * "The difference lives on a sibling part" is legitimate and extremely common:
 * a checkbox's `control` renders `checked` and `indeterminate` identically in
 * most design systems because the `indicator` inside draws a check versus a
 * dash. Judging per part reports 164 of those; judging per component reports
 * the real thing, and the carve-out is structural instead of an allowlist
 * somebody has to maintain.
 *
 * `waived`, when given, receives every pair a mechanism excused.
 */
export function componentFindings(c: LegibilityCase, waived?: AuditWaiver[]): AuditFinding[] {
    const findings: AuditFinding[] = [];
    // Every distinct closed state set, with the parts that declare it — the
    // owners are what scopes a skip to the states it actually speaks about.
    const sets = new Map<string, string[]>();
    for (const part of c.component.parts) {
        if (!part.states?.length) continue;
        const key = JSON.stringify(part.states);
        const owners = sets.get(key) ?? [];
        owners.push(part.name);
        sets.set(key, owners);
    }
    for (const [key, owners] of sets) {
        for (const [a, b] of pairsOf(JSON.parse(key) as string[])) {
            const finding: AuditFinding = {
                rule: 'state-legibility/component',
                severity: 'error',
                where: c.scope,
                scope: c.scope,
                states: [a, b],
                message: `${c.scope}: states "${a}" and "${b}" are visually identical — no `
                    + `part of the component styles them differently. Style one of them, or `
                    + `declare skipStates: { <part>: ['${b}'] } with a reason.`,
            };
            // A skip is a claim about ONE part, so a component-wide "these two
            // states may look the same" needs it from every part that has those
            // states. Material's checkbox skips them on `root` and `label`
            // because a row and its text do not change when you tick it — which
            // says nothing about the box and the mark, and must not excuse them
            // both rendering nothing (#212). `hiddenIn`, in contrast, states a
            // difference rather than waiving one, so one matching part is enough.
            if (owners.every((p) => skipsPair(c, p, a, b))) {
                waived?.push(waiver(finding, 'skipStates', `every owner (${owners.join(', ')}) skips the pair`));
                continue;
            }
            if (presenceDiffers(c, owners, a, b)) {
                waived?.push(waiver(finding, 'hiddenIn', 'a part is rendered in exactly one of the two states'));
                continue;
            }
            if (c.groups.some((g) => distinguishes(c.rules, g, a, b))) continue;
            findings.push(finding);
        }
    }
    return findings;
}

/** Part-name roles the anatomy vocabulary reserves, read by the indicator and disclosure rules. */
export const isIndicatorPart = (name: string): boolean =>
    name === 'indicator' || name.endsWith('-indicator');
export const isTriggerPart = (name: string): boolean => name === 'trigger' || name.endsWith('-trigger');
export const isPopupPart = (name: string): boolean => name === 'popup' || name.endsWith('-popup');

/**
 * An overlay component — the revealed thing is not under the control, so the
 * `disclosure` rule's in-flow reasoning does not apply. Two honest signals,
 * both needed: a part NAMED popup (the anchored floats — popover, menu,
 * select), and a part whose ELEMENT is `dialog` (the top layer). The second
 * exists because Drawer (#339) names its surface `panel` — the truthful name
 * for an edge sheet — and a name-only rule would have classified it as an
 * in-flow disclosure and demanded its trigger tell open from closed while the
 * open drawer's scrim covers that trigger entirely.
 */
export const isOverlayComponent = (c: { parts: ReadonlyArray<{ name: string; element: string }> }): boolean =>
    c.parts.some((p) => isPopupPart(p.name) || p.element === 'dialog');

/**
 * The groups that ARE this part: the element itself and any pseudo-element hung
 * off it. A recipe-authored `::after` is where zero-basic and zero-daisyui
 * legitimately draw their marks, so it counts as the part drawing them.
 */
export const ownGroups = (c: LegibilityCase, part: string): string[] =>
    c.groups.filter((g) => g === part || g.startsWith(`${part}::`));

/**
 * `state-legibility/indicator`, for one component — an indicator must
 * distinguish its own states.
 *
 * Contract-grade rather than heuristic: an indicator part exists for exactly
 * one reason, which is to show which state the thing is in. If it renders
 * identically across its declared states it is not an indicator, it is a
 * spacer.
 */
export function indicatorFindings(c: LegibilityCase, waived?: AuditWaiver[]): AuditFinding[] {
    const findings: AuditFinding[] = [];
    for (const part of c.component.parts) {
        if (!isIndicatorPart(part.name)) continue;
        if (!part.states?.length) continue;
        const own = ownGroups(c, part.name);
        const alike = pairsOf(part.states).filter(([a, b]) => {
            const excused = skipsPair(c, part.name, a, b) ? 'skipStates'
                : cannotPaintPair(c, part.name, a, b) ? 'hiddenIn'
                    : undefined;
            if (excused) {
                waived?.push(waiver({
                    rule: 'state-legibility/indicator',
                    severity: 'error',
                    where: `${c.scope}.${part.name}`,
                    scope: c.scope,
                    part: part.name,
                    states: [a, b],
                    message: `${c.scope}.${part.name}: "${a}"/"${b}" excused.`,
                }, excused, excused === 'skipStates'
                    ? `skipStates.${part.name} names ${a} or ${b}`
                    : `hiddenIn on ${part.name} names ${a} or ${b}`));
                return false;
            }
            return !own.some((g) => distinguishes(c.rules, g, a, b));
        });
        if (!alike.length) continue;
        const pairs = alike.map(([a, b]) => `"${a}"/"${b}"`).join(', ');
        findings.push({
            rule: 'state-legibility/indicator',
            severity: 'error',
            where: `${c.scope}.${part.name}`,
            scope: c.scope,
            part: part.name,
            states: [...new Set(alike.flat())],
            message: `${c.scope}.${part.name}: an indicator part renders identically for `
                + `${pairs} — nothing it emits, on itself or its pseudo-elements, tells those `
                + `states apart. Draw the mark (this part exists for nothing else), or declare `
                + `skipStates: { '${part.name}': ['${alike[0]![1]}'] } with a reason.`
                + (own.length ? '' : ' It emits no rules at all.'),
        });
    }
    return findings;
}

/**
 * `state-legibility/disclosure`, for one component — an in-flow disclosure
 * control says which way it is pointing.
 *
 * ── WHAT IT JUDGES, AND WHY NOT EVERY TRIGGER ────────────────────────────────
 * A trigger whose component also declares a `popup` part opens an OVERLAY: the
 * revealed thing floats above the page, takes focus, and is the only thing the
 * reader is looking at. Whether the trigger underneath it also changes is a
 * taste question, and the six design systems answer it six ways: basic and
 * heroui differentiate every one of their dialog/popover/tooltip/menu triggers,
 * material and brutalist none of them, daisyui and carbon some. Twenty-two
 * findings if this rule had an opinion — the flood it was written to avoid —
 * and no reading of the contract says which answer is wrong. So it has none.
 *
 * A trigger whose component declares NO popup part discloses IN FLOW: the panel
 * is a sibling directly under the control, both are on screen in both states,
 * and the control is what the reader reads. It is also the case where "you can
 * see the panel, so you can tell" fails outright — a list of accordion items
 * that are all collapsed has no open one to compare against, and #220's
 * screenshots are exactly that. So here the control owes the reader a
 * difference, and "the panel expands" does not pay it.
 *
 * That is the hole this closes. The `component` rule judged material's
 * collapsible clean because `[data-part="root"][open]::details-content
 * { block-size: auto }` differentiates `open` from `closed` — the browser
 * opening the disclosure, true of every `<details>` in every design system,
 * signing off on a header that said nothing. The fix is not to teach the
 * `component` rule which rules are "really" the browser's (a property denylist
 * that a recipe styling its `panel` at all would defeat anyway); it is to ask
 * the question of the part the claim is about.
 *
 * ── WHY A SIBLING INDICATOR STILL CLEARS IT ──────────────────────────────────
 * Not any sibling — the one whose job this is. A `*-indicator` next to the
 * control is the disclosure marker, the chevron that rotates, and a reader
 * takes the control and its marker in as one thing. All six design systems
 * differentiate `tree-view.branch-trigger` that way and none of them touch the
 * trigger itself, which is correct and must not be reported. Collapsible and
 * accordion declare no indicator part at all, so for them there is nowhere else
 * for the signal to go — which is precisely why #220 was a bug and not a style.
 * The `indicator` rule independently forces that indicator to earn it, so this
 * is not a loophole: it is a hand-off to a stricter rule.
 */
export function disclosureFindings(c: LegibilityCase, waived?: AuditWaiver[]): AuditFinding[] {
    // An overlay component: the revealed thing is not under the control.
    if (isOverlayComponent(c.component)) return [];
    const indicators = c.component.parts.filter((p) => isIndicatorPart(p.name));
    const findings: AuditFinding[] = [];
    for (const part of c.component.parts) {
        if (!isTriggerPart(part.name) || !part.states?.length) continue;
        const own = ownGroups(c, part.name);
        const alike = pairsOf(part.states).filter(([a, b]) => {
            const excused = skipsPair(c, part.name, a, b) ? 'skipStates'
                : cannotPaintPair(c, part.name, a, b) ? 'hiddenIn'
                    : undefined;
            if (excused) {
                waived?.push(waiver({
                    rule: 'state-legibility/disclosure',
                    severity: 'error',
                    where: `${c.scope}.${part.name}`,
                    scope: c.scope,
                    part: part.name,
                    states: [a, b],
                    message: `${c.scope}.${part.name}: "${a}"/"${b}" excused.`,
                }, excused, excused === 'skipStates'
                    ? `skipStates.${part.name} names ${a} or ${b}`
                    : `hiddenIn on ${part.name} names ${a} or ${b}`));
                return false;
            }
            return !own.some((g) => distinguishes(c.rules, g, a, b))
                && !indicators.some((i) =>
                    ownGroups(c, i.name).some((g) => distinguishes(c.rules, g, a, b)));
        });
        if (!alike.length) continue;
        const pairs = alike.map(([a, b]) => `"${a}"/"${b}"`).join(', ');
        findings.push({
            rule: 'state-legibility/disclosure',
            severity: 'error',
            where: `${c.scope}.${part.name}`,
            scope: c.scope,
            part: part.name,
            states: [...new Set(alike.flat())],
            message: `${c.scope}.${part.name}: the control of an in-flow disclosure renders `
                + `identically for ${pairs} — the panel is a sibling under it, so a reader `
                + `looking at a collapsed one has only this control to read, and the panel `
                + `expanding is the browser's doing, not this design system's. Style the `
                + `control, or declare skipStates: { '${part.name}': ['${alike[0]![1]}'] } with `
                + `a reason.`
                + (indicators.length
                    ? ` (${c.scope} declares ${indicators.map((i) => `"${i.name}"`).join(', ')};`
                        + ` differentiating there would clear this too.)`
                    : ` (${c.scope} declares no indicator part — there is nowhere else for the`
                        + ` signal to live.)`),
        });
    }
    return findings;
}

/** Every judgeable case in a design system — one per styled scope. */
export const casesOf = (ctx: AuditContext): LegibilityCase[] =>
    styledScopes(ctx).map(({ component, recipe, rules }) => caseOf(component, recipe, rules));

export function run(ctx: AuditContext): RuleOutput {
    const findings: AuditFinding[] = [];
    const waived: AuditWaiver[] = [];
    for (const c of casesOf(ctx)) {
        findings.push(...componentFindings(c, waived));
        findings.push(...indicatorFindings(c, waived));
        findings.push(...disclosureFindings(c, waived));
    }
    return { findings, waived };
}
