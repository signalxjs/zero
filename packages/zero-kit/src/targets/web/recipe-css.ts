/**
 * Web recipe emitter — compiles a `RecipeInput` to plain CSS against a
 * component's anatomy. Zero runtime: the output is a static stylesheet.
 *
 * State names resolve through the anatomy manifest:
 * - machine states → `[data-state="open"]`
 * - boolean flags → `[data-disabled]`
 * - interaction states → real pseudo-classes (`:hover:not([data-disabled])`)
 *
 * Unknown parts or states are hard errors — the manifest is the contract,
 * and failing the build is how recipes stay in lockstep with core.
 *
 * The target-neutral machinery (declaration guards, the emission sink and
 * its tiered condition ordering, token assertions) lives in `../shared.ts`;
 * this module owns only the web selector shapes.
 */
import type { ManifestComponent, ManifestPart } from '../../contract.js';
import { INTERACTION_STATES, MOD_ATTR_PREFIX, VARIANT_AXES, carrierPart, carriersOf, reachesCarrier } from '../../contract.js';
import type { ComposedScope, CssProps, PartStyles, RecipeContext, RecipeInput } from '../../recipes.js';
import type { Condition, ConditionRegistry, Sink } from '../shared.js';
import {
    assertAxisToken,
    assertKeyframesName,
    compareChains,
    declBlock,
    findPart,
    indent,
    push,
    renderBucket,
    resolveCondition,
} from '../shared.js';

function stateSelector(component: ManifestComponent, part: ManifestPart, state: string): string {
    // Anatomy wins over interaction pseudo-classes: a part with a machine
    // state named `active` styles [data-state="active"], not `:active`.
    const fromAnatomy = part.selectors[state];
    if (fromAnatomy) return fromAnatomy;
    const interaction = INTERACTION_STATES[state];
    if (interaction) return interaction;
    const known = [...Object.keys(part.selectors), ...Object.keys(INTERACTION_STATES)].join(', ');
    throw new Error(
        `[zero-kit] recipe for "${component.scope}"."${part.name}" styles unknown state "${state}" (known: ${known})`,
    );
}

const partSelector = (scope: string, part: string): string =>
    `[data-scope="${scope}"][data-part="${part}"]`;

/**
 * A pseudo-element name: `::backdrop`, `::details-content`,
 * `::-webkit-slider-thumb`. The suffix is written into a selector verbatim,
 * so this is the same injection surface as axis values — anything else is a
 * hard error, not something to escape.
 */
const PSEUDO_ELEMENT_PATTERN = /^::-?[a-z][a-z-]*$/;

/**
 * Where a part's rules actually attach: itself, or — for a projected part
 * (`pseudo` in the anatomy) — the host part plus a pseudo-element suffix.
 * The projection is manifest data, so it fails fast like unknown parts and
 * states do: a missing host would silently emit selectors matching nothing,
 * and a malformed suffix is selector injection.
 */
function partProjection(
    component: ManifestComponent,
    partName: string,
): { host: string; suffix: string } {
    const part = findPart(component, partName);
    if (!part.pseudo) return { host: partName, suffix: '' };
    findPart(component, part.pseudo.of);
    if (!PSEUDO_ELEMENT_PATTERN.test(part.pseudo.selector)) {
        throw new Error(
            `[zero-kit] "${component.scope}"."${partName}" projects onto "${part.pseudo.selector}", which is not a pseudo-element — it would be written into a selector verbatim`,
        );
    }
    return { host: part.pseudo.of, suffix: part.pseudo.selector };
}

/**
 * Where a part's axis-narrowed rules attach. On the carrier part the
 * attribute sits on the element itself, so the rule is flat. On any other
 * part the attribute is on the carrier ANCESTOR — and a bare descendant
 * selector (`[carrier][attr] [part]`) is unbounded: nest one instance of the
 * scope inside another (card in card) and the outer carrier's axis rules
 * reach the inner instance's parts too, with source order rather than
 * proximity deciding which value wins.
 *
 * So a non-carrier rule is emitted inside an `@scope` DONUT instead:
 *
 *     @scope ([carrier][attr]) to ([carrier]) { [part] { … } }
 *
 * The axis-carrying carrier is the scoping root, any nested same-scope
 * carrier is the lower boundary (its subtree leaves the scope), and when two
 * instances both carry a value, CSS scoping proximity — which outranks source
 * order — resolves each part to its NEAREST carrier. An unscoped rule counts
 * as infinitely far, so the axis refinement also keeps beating the flat base
 * rules it used to outrank by specificity.
 *
 * Returned as a prelude + inner selector rather than one string because the
 * donut is an at-rule: it joins the emission sink as a condition on the
 * rule's path (nesting correctly under/over `@media` and friends), not as a
 * selector fragment.
 */
function variantTarget(
    component: ManifestComponent,
    part: string,
    axisAttrs: string,
): { selector: string; scopePrelude?: string } {
    const carrier = carrierPart(component);
    if (part === carrier) return { selector: `${partSelector(component.scope, part)}${axisAttrs}` };
    const carrierSelector = partSelector(component.scope, carrier);
    return {
        selector: partSelector(component.scope, part),
        scopePrelude: `@scope (${carrierSelector}${axisAttrs}) to (${carrierSelector})`,
    };
}

/**
 * What can never appear in a selector fragment — re-stated here for the
 * `selectors` escape hatch, whose keys are spliced into emitted selectors
 * verbatim. Mirrors the declaration-value guard in `../shared.ts`.
 */
const CSS_BREAKOUT = /[{};\n\r]/;

/**
 * `pseudoSuffix` carries a projected part's pseudo-element (`::backdrop`). It
 * attaches AFTER every attribute/pseudo-class fragment — states narrow the
 * host element, which is the only thing an attribute selector can narrow —
 * so `states.open` on dialog's backdrop compiles to
 * `[data-part="popup"][data-state="open"]::backdrop`.
 */
function emitPartStyles(
    component: ManifestComponent,
    partName: string,
    styles: PartStyles,
    baseSelector: string,
    sink: Sink,
    context: RecipeContext,
    registry: ConditionRegistry,
    pseudoSuffix = '',
    path: readonly Condition[] = [],
    where = `recipe for "${component.scope}"."${partName}"`,
): void {
    const part = findPart(component, partName);
    const rule = (selector: string, props: CssProps) =>
        push(sink, path, `${selector} {\n${declBlock(props, '    ', where)}\n}`);

    if (styles.base && Object.keys(styles.base).length > 0) {
        rule(`${baseSelector}${pseudoSuffix}`, styles.base);
    }
    for (const [state, props] of Object.entries(styles.states ?? {})) {
        const sel = stateSelector(component, part, state);
        // Empty blocks are legal recipe entries (they mark a state as
        // deliberately covered for the validator) but emit no CSS.
        if (Object.keys(props).length === 0) continue;
        rule(`${baseSelector}${sel}${pseudoSuffix}`, props);
    }
    for (const [nested, props] of Object.entries(styles.selectors ?? {})) {
        if (Object.keys(props).length === 0) continue;
        // A `selectors` key is spliced into the emitted selector verbatim, so
        // it gets the same breakout guard declaration values do. Any real
        // selector passes — what cannot is one that closes the rule and opens
        // another (`'& svg { } [data-scope="dialog"] { … }'`).
        if (CSS_BREAKOUT.test(nested)) {
            throw new Error(
                `[zero-kit] ${where}: the selectors key "${nested}" cannot hold a brace, semicolon or newline — it is written into a selector verbatim`,
            );
        }
        rule(scopeNestedSelector(nested, `${baseSelector}${pseudoSuffix}`, where), props);
    }
    for (const [key, nested] of Object.entries(styles.at ?? {})) {
        const condition = resolveCondition(key, context, where, registry);
        emitPartStyles(component, partName, nested, baseSelector, sink, context, registry, pseudoSuffix, [...path, condition], where);
    }
}

interface KeyAmp {
    at: number;
    /**
     * The brackets enclosing it, innermost last. `args[n]` says whether the
     * bracket's nth comma-separated argument holds an `&` — final once lexing
     * ends.
     */
    frames: { args: boolean[] }[];
}

/**
 * Lex a `selectors` key once: the index of every top-level comma, and of every
 * `&` that is selector syntax rather than text — outside quoted strings and
 * `/* … *\/` comments, and not escaped (`\&`). A backslash escape outside a
 * string consumes the next character, so `.a\(b` opens no paren and `.a\"b`
 * no string. A key the lexer cannot balance — an unterminated string or
 * comment, a closer with no opener, an opener never closed — is a build error:
 * returning it as one item would leave the rest of the list unscoped.
 */
function lexSelectorKey(text: string, where: string): { commas: number[]; amps: KeyAmp[] } {
    const fail = (why: string): never => {
        throw new Error(`[zero-kit] ${where}: the selectors key "${text}" cannot be parsed as a selector list — ${why}`);
    };
    const commas: number[] = [];
    const amps: KeyAmp[] = [];
    const open: { closer: string; args: boolean[] }[] = [];
    for (let i = 0; i < text.length; i++) {
        const ch = text[i]!;
        if (ch === '\\') {
            i++;
            continue;
        }
        if (ch === '"' || ch === "'") {
            let closed = false;
            for (i++; i < text.length; i++) {
                if (text[i] === '\\') i++;
                else if (text[i] === ch) {
                    closed = true;
                    break;
                }
            }
            if (!closed) fail(`it has an unterminated ${ch} string`);
            continue;
        }
        if (ch === '/' && text[i + 1] === '*') {
            const close = text.indexOf('*/', i + 2);
            if (close < 0) fail('it has an unterminated comment');
            i = close + 1;
            continue;
        }
        if (ch === '(' || ch === '[') open.push({ closer: ch === '(' ? ')' : ']', args: [false] });
        else if (ch === ')' || ch === ']') {
            if (open.pop()?.closer !== ch) fail(`its "${ch}" at offset ${i} closes nothing it opened`);
        } else if (ch === ',') {
            if (open.length === 0) commas.push(i);
            else open[open.length - 1]!.args.push(false);
        } else if (ch === '&') {
            for (const frame of open) frame.args[frame.args.length - 1] = true;
            amps.push({ at: i, frames: [...open] });
        }
    }
    if (open.length > 0) fail(`it leaves ${open.length} bracket(s) unclosed`);
    return { commas, amps };
}

/**
 * Scope a `selectors` key to the part it sits on (#181). A key may be a
 * selector LIST, and every item is scoped on its own: `&` is replaced by the
 * part's selector, and an item without `&` is a descendant of it. Scoping the
 * key as one string would scope only the first item — `'svg, path'` would
 * emit `[part] svg, path`, leaving `path` a global rule in the recipes layer.
 *
 * An item with an `&` at its top level is scoped by it, whatever its nested
 * lists hold (`'&:not(.a, .b)'`). An item whose `&`s all sit inside brackets
 * is scoped only if every argument of each enclosing comma-separated list
 * holds an `&`: `':where(.dark &)'` and `':is(&.a, &.b)'` pass, while
 * `':is(&:hover, svg)'` would leave `svg` global and is rejected. An `&` in a
 * string, a comment or escaped is text, never substituted.
 */
function scopeNestedSelector(nested: string, self: string, where: string): string {
    const { commas, amps } = lexSelectorKey(nested, where);
    const bounds = [-1, ...commas, nested.length];
    const out: string[] = [];
    for (let k = 0; k < bounds.length - 1; k++) {
        const from = bounds[k]! + 1;
        const to = bounds[k + 1]!;
        const item = nested.slice(from, to);
        const trimmed = item.trim();
        if (trimmed === '') {
            throw new Error(
                `[zero-kit] ${where}: the selectors key "${nested}" has an empty item in its selector list`,
            );
        }
        const own = amps.filter((a) => a.at >= from && a.at < to);
        if (own.length === 0) {
            const lead = item.slice(0, item.length - item.trimStart().length);
            const trail = item.slice(item.trimEnd().length);
            out.push(`${lead}${self} ${trimmed}${trail}`);
            continue;
        }
        const topLevel = own.some((a) => a.frames.length === 0);
        if (!topLevel && own.some((a) => a.frames.some((f) => f.args.includes(false)))) {
            throw new Error(
                `[zero-kit] ${where}: the selectors key "${nested}" puts & only inside a nested selector list ("${trimmed}") with an argument that has no & — that argument would match outside the part; give every argument an &, write & at the top level of the item, or split the list`,
            );
        }
        let scoped = '';
        let cursor = from;
        for (const a of own) {
            scoped += nested.slice(cursor, a.at) + self;
            cursor = a.at + 1;
        }
        out.push(scoped + nested.slice(cursor, to));
    }
    return out.join(',');
}

function axisAttr(axis: string, scope: string): string {
    return VARIANT_AXES[axis] ?? `data-${assertAxisToken('axis', axis, scope)}`;
}

/** A presence-only modifier's attribute — `[data-mod-block]`, never valued. */
function modAttr(name: string, scope: string): string {
    return `${MOD_ATTR_PREFIX}${assertAxisToken('modifier', name, scope)}`;
}

/**
 * The attribute alternatives a compound `match` compiles to, as the cross
 * product of each entry's spellings. An axis contributes an equality test, a
 * modifier (`true`) a presence-only attribute, and an axis sitting at its
 * recipe DEFAULT contributes the absence of the attribute as a second
 * alternative — the CSS-only default the single-axis loop emits.
 *
 * `borrowed` (#91) replaces an axis a `composes` entry borrows: its value is
 * supplied by the context, so the entry contributes the guard that the
 * nested instance carries no value of its own. A compound naming a borrowed
 * axis at a DIFFERENT value can never match there and yields nothing.
 */
function matchAlternatives(
    match: Record<string, string | true>,
    defaults: Record<string, string> | undefined,
    scope: string,
    borrowed: Record<string, string> = {},
): string[] {
    const alternatives: string[][] = [];
    for (const [axis, value] of Object.entries(match)) {
        if (value === true) {
            alternatives.push([`[${modAttr(axis, scope)}]`]);
            continue;
        }
        const attr = axisAttr(axis, scope);
        if (Object.hasOwn(borrowed, axis)) {
            if (borrowed[axis] !== value) return [];
            alternatives.push([borrowGuard(attr)]);
            continue;
        }
        const present = `[${attr}="${assertAxisToken('value', value, scope)}"]`;
        alternatives.push(defaults?.[axis] === value ? [present, `:not([${attr}])`] : [present]);
    }
    return alternatives.reduce<string[]>(
        (acc, alts) => acc.flatMap((prefix) => alts.map((alt) => `${prefix}${alt}`)),
        [''],
    );
}

/**
 * The guard a borrowed axis puts on the nested carrier: "no value of your
 * own". Zero specificity on purpose (`:where` inside `:not`), so a borrowed
 * rule sits where an unconditioned `composes` rule sits and explicit `parts`,
 * emitted after it, win state for state (#91).
 */
const borrowGuard = (attr: string): string => `:not(:where([${attr}]))`;

/** Compile one recipe to CSS (inside `@layer zero.recipes`). */
export function compileRecipeCss(
    recipe: RecipeInput,
    component: ManifestComponent,
    context: RecipeContext = {},
): string {
    if (recipe.component !== component.scope) {
        throw new Error(
            `[zero-kit] recipe component "${recipe.component}" does not match anatomy scope "${component.scope}"`,
        );
    }
    const sink: Sink = new Map();
    const registry: ConditionRegistry = new Map();

    // Component-level tokens on the carrier part.
    if (recipe.tokens && Object.keys(recipe.tokens).length > 0) {
        const carrier = partSelector(component.scope, carrierPart(component));
        push(sink, [], `${carrier} {\n${declBlock(recipe.tokens, '    ', `recipe for "${component.scope}" tokens`)}\n}`);
    }

    for (const [partName, styles] of Object.entries(recipe.parts)) {
        const { host, suffix } = partProjection(component, partName);
        emitPartStyles(component, partName, styles, partSelector(component.scope, host), sink, context, registry, suffix);
    }

    // Nested scopes styled in context — see `RecipeInput.composes`. After the
    // component's own parts and before its axis rules: the (0,4,0) context
    // selector already outranks the nested recipe, so order only matters
    // among this recipe's own rules.
    //
    // `hostMatch` (#91) is a compound's attribute alternative: the
    // composition then applies only while this component matches it. The
    // attributes sit on this component's carrier, so the rules go inside a
    // donut rooted there — `@scope ([carrier][match]) to ([carrier])`, the
    // bound every carrier-anchored rule gets — and the context selector is
    // written from `:scope`, so `within` must be a descendant of THIS
    // instance's carrier rather than of any ancestor that happens to match.
    // `:scope` also lifts every conditioned rule one step, (0,5,0), above
    // the unconditioned (0,4,0) it refines.
    const emitComposes = (composes: Record<string, ComposedScope>, hostMatch?: string): void => {
        const carrierSelector = partSelector(component.scope, carrierPart(component));
        const hostPath = hostMatch === undefined
            ? []
            : [resolveCondition(`@scope (${carrierSelector}${hostMatch}) to (${carrierSelector})`, context, `recipe for "${component.scope}" composes`, registry)];
        for (const [scope, composed] of Object.entries(composes)) {
            const where = `recipe for "${component.scope}" composes "${scope}"`;
            if (scope === component.scope) {
                throw new Error(`[zero-kit] ${where}: a component cannot compose itself — style its own parts in \`parts\``);
            }
            const nested = context.components?.get(scope);
            if (!nested) {
                throw new Error(
                    context.components
                        ? `[zero-kit] ${where}: "${scope}" is not a component the manifest declares`
                        : `[zero-kit] ${where}: composes needs the manifest — compile through compileDesignSystem, or pass context.components`,
                );
            }
            const within = composed.within ?? carrierPart(component);
            const known = (c: ManifestComponent) => c.parts.map((p) => p.name).join(', ');
            if (!component.parts.some((p) => p.name === within)) {
                throw new Error(`[zero-kit] ${where}: within "${within}" is not a part of "${component.scope}" (known: ${known(component)})`);
            }
            if (findPart(component, within).pseudo) {
                throw new Error(`[zero-kit] ${where}: "${within}" is a pseudo-element part, which cannot contain another component`);
            }
            const parts = Object.entries(composed.parts ?? {});
            const borrowed = Object.entries(composed.axes ?? {});
            if (parts.length === 0 && borrowed.length === 0) {
                throw new Error(`[zero-kit] ${where} composes nothing — give it \`parts\` to style, \`axes\` to borrow, or both`);
            }
            for (const [partName] of parts) {
                if (!nested.parts.some((p) => p.name === partName)) {
                    throw new Error(`[zero-kit] ${where}: "${partName}" is not a part of "${scope}" (known: ${known(nested)})`);
                }
            }
            const withinSelector = partSelector(component.scope, within);
            const ctx = hostMatch === undefined
                ? withinSelector
                : within === carrierPart(component) ? `:scope${withinSelector}` : `:scope ${withinSelector}`;

            // Borrowed values first, explicit parts after: at equal
            // specificity the later rule wins, so an explicit in-context
            // style beats a borrowed one state for state.
            if (borrowed.length > 0) emitBorrowed(scope, nested, Object.fromEntries(borrowed), ctx, hostPath, where);
            for (const [partName, styles] of parts) {
                const { host, suffix } = partProjection(nested, partName);
                emitPartStyles(
                    nested, partName, styles, `${ctx} ${partSelector(scope, host)}`, sink, context, registry, suffix, hostPath,
                    `${where}."${partName}"`,
                );
            }
        }
    };

    // A borrowing `composes` (#91): the NESTED recipe's own rules for the
    // borrowed values — `variants.<axis>.<value>`, every compound matching
    // it, and their `at` blocks — re-emitted under the context. Each is
    // guarded by the nested carrier having no value of its own, so an
    // explicit prop on the instance wins. On the nested carrier the rule is
    // flat, `ctx [nested-carrier]<guard>` at (0,4,0); on any other nested
    // part it goes in the nested scope's own donut, rooted on that guarded
    // carrier, with `:scope` in front of the part: (0,3,0), one step above the
    // nested recipe's own donut rules at (0,2,0), which still match
    // underneath — the attribute is absent, so its DEFAULT twins apply too.
    // A part that re-carries the axis (#94) keeps a value of its own the
    // same way: the guard is repeated on it, and on any part inside it.
    const emitBorrowed = (
        scope: string,
        nested: ManifestComponent,
        borrowed: Record<string, string>,
        ctx: string,
        hostPath: Condition[],
        where: string,
    ): void => {
        if (!context.recipes) {
            throw new Error(`[zero-kit] ${where}: borrowing axis values needs the design system's recipes — compile through compileDesignSystem, or pass context.recipes`);
        }
        const source = context.recipes.get(scope);
        if (!source) {
            throw new Error(`[zero-kit] ${where}: "${scope}" has no recipe in this design system, so there is no ${Object.keys(borrowed).join('/')} to borrow`);
        }
        for (const [axis, value] of Object.entries(borrowed)) {
            assertAxisToken('axis', axis, component.scope);
            assertAxisToken('value', value, component.scope);
            const wired = new Set([
                ...Object.keys(source.variants?.[axis] ?? {}),
                ...(source.compoundVariants ?? []).flatMap((c) => (typeof c.match[axis] === 'string' ? [c.match[axis] as string] : [])),
            ]);
            if (!wired.has(value)) {
                throw new Error(
                    `[zero-kit] ${where}: borrows ${axis} "${value}", which the "${scope}" recipe does not wire`
                    + ` (wires: ${[...wired].join(', ') || 'no value of that axis'})`,
                );
            }
        }
        const nestedCarrier = partSelector(scope, carrierPart(nested));
        const target = (partName: string, styles: PartStyles, attrs: string, label: string): void => {
            const { host, suffix } = partProjection(nested, partName);
            const w = `${where} (${label})."${partName}"`;
            if (host === carrierPart(nested)) {
                emitPartStyles(nested, partName, styles, `${ctx} ${nestedCarrier}${attrs}`, sink, context, registry, suffix, hostPath, w);
                return;
            }
            let own = '';
            for (const axis of Object.keys(borrowed)) {
                const attr = axisAttr(axis, scope);
                for (const recarrier of carriersOf(nested, host, axis)) {
                    own += recarrier === host ? borrowGuard(attr) : `:not(:where(${partSelector(scope, recarrier)}[${attr}] *))`;
                }
            }
            emitPartStyles(
                nested, partName, styles, `:scope ${partSelector(scope, host)}${own}`, sink, context, registry, suffix,
                [...hostPath, resolveCondition(`@scope (${ctx} ${nestedCarrier}${attrs}) to (${nestedCarrier})`, context, w, registry)],
                w,
            );
        };
        for (const [axis, value] of Object.entries(borrowed)) {
            const guard = borrowGuard(axisAttr(axis, scope));
            for (const [partName, styles] of Object.entries(source.variants?.[axis]?.[value] ?? {})) {
                target(partName, styles, guard, `${axis}: ${value}`);
            }
        }
        for (const compound of source.compoundVariants ?? []) {
            if (!Object.entries(borrowed).some(([axis, value]) => compound.match[axis] === value)) continue;
            const matches = matchAlternatives(compound.match, source.defaultVariants, scope, borrowed);
            for (const [partName, styles] of Object.entries(compound.parts)) {
                for (const attrs of matches) target(partName, styles, attrs, 'compound');
            }
        }
    };

    emitComposes(recipe.composes ?? {});

    // One resolver for every axis-narrowed emission: flat on the carrier, an
    // `@scope` donut condition on any other part — see `variantTarget`.
    //
    // `carried` is the one-axis explicit-value case, the only one a part may
    // re-carry (#94, `ManifestPart.carries`). Each part between the styled
    // part and the carrier that re-carries the axis gets the same styles a
    // second time, anchored on ITS attribute: flat when it is the styled part
    // itself — `[marker][data-color="v"]` at (0,3,0) outranks the carrier's
    // donut rule at (0,2,0) — and an `@scope` donut rooted on it for a part
    // inside it, which scoping proximity resolves to the nearer carrier. The
    // lower bound is the scope's carrier (a nested instance) or any part that
    // re-carries the axis (a nested re-carrier, which answers for its own
    // subtree).
    // Never for the `:not([attr])` default twin: a part with no value of its
    // own follows its carrier, which is the whole point.
    //
    // The re-carried emissions are DEFERRED until every carrier-anchored rule
    // is in: their `@scope` preludes then register — and so emit — after the
    // carrier's, and a re-carrier always sits between the carrier and the
    // part it styles, so source order agrees with scoping proximity. The
    // browser needs neither, but a reader that ranks equal-specificity scoped
    // rules by order (the static contrast matrix) reads the same winner.
    const deferred: Array<() => void> = [];
    // The axes some part of this scope re-carries — empty for all but a
    // handful of scopes, so the common path never walks the part tree.
    const recarried = new Set(component.parts.flatMap((p) => p.carries ?? []));
    const emitVariantStyles = (
        partName: string,
        styles: PartStyles,
        axisAttrs: string,
        carried?: string,
    ): void => {
        const { host, suffix } = partProjection(component, partName);
        const where = `recipe for "${component.scope}"."${partName}"`;
        const own = carried === undefined || !recarried.has(carried) ? [] : carriersOf(component, host, carried);
        // The carrier's reading, as always — unless the part can never sit
        // under the carrier (a top-layer popup) and a re-carrier is the only
        // thing that reaches it, where the carrier-anchored rule is dead CSS.
        if (own.length === 0 || reachesCarrier(component, host)) {
            const target = variantTarget(component, host, axisAttrs);
            const path = target.scopePrelude
                ? [resolveCondition(target.scopePrelude, context, where, registry)]
                : [];
            emitPartStyles(component, partName, styles, target.selector, sink, context, registry, suffix, path);
        }
        for (const anchor of own) {
            const anchorSelector = `${partSelector(component.scope, anchor)}${axisAttrs}`;
            if (anchor === host) {
                deferred.push(() => emitPartStyles(component, partName, styles, anchorSelector, sink, context, registry, suffix, []));
                continue;
            }
            // Bounded by the carrier and by EVERY part that re-carries this
            // axis — a nested re-carrier, of the same part or another,
            // answers for its own subtree, so two re-carriers' donuts never
            // overlap and emission order cannot decide between them.
            const bounds = [carrierPart(component), ...component.parts.filter((p) => p.carries?.includes(carried!)).map((p) => p.name)];
            const prelude = `@scope (${anchorSelector}) to (${bounds.map((p) => partSelector(component.scope, p)).join(', ')})`;
            deferred.push(() => emitPartStyles(
                component, partName, styles, partSelector(component.scope, host), sink, context, registry, suffix,
                [resolveCondition(prelude, context, where, registry)],
            ));
        }
    };

    for (const [axis, values] of Object.entries(recipe.variants ?? {})) {
        const attr = axisAttr(axis, component.scope);
        for (const [value, parts] of Object.entries(values)) {
            for (const [partName, styles] of Object.entries(parts)) {
                emitVariantStyles(partName, styles, `[${attr}="${assertAxisToken('value', value, component.scope)}"]`, axis);

                // CSS-only default: the same styles apply when the attribute
                // is absent. Never conflicts with the explicit-value rule —
                // the attribute is either present or not.
                if (recipe.defaultVariants?.[axis] === value) {
                    emitVariantStyles(partName, styles, `:not([${attr}])`);
                }
            }
        }
    }

    // Presence-only modifiers: `[data-mod-<name>]`, no value to match on.
    for (const [name, parts] of Object.entries(recipe.modifiers ?? {})) {
        const attr = modAttr(name, component.scope);
        for (const [partName, styles] of Object.entries(parts)) {
            emitVariantStyles(partName, styles, `[${attr}]`);
        }
    }

    for (const compoundVariant of recipe.compoundVariants ?? []) {
        // `match` is a conjunction over two different grammars. An axis
        // contributes an equality test, and a modifier — spelled `true` —
        // contributes a presence-only attribute, which has no value to
        // compare. On top of that, an axis sitting at its DEFAULT value is
        // expressed by the attribute being absent as much as by it carrying
        // the value, the same CSS-only default the single-axis loop emits
        // above. So each entry contributes one alternative, or two when it is
        // a defaulted axis value, and the rule set is their cross product.
        // Without it a compound naming a defaulted axis matches nothing at
        // all: `<Button color="primary">` under
        // `defaultVariants: { variant: 'solid' }` carries no `data-variant`.
        const matches = matchAlternatives(compoundVariant.match, recipe.defaultVariants, component.scope);
        for (const [partName, styles] of Object.entries(compoundVariant.parts)) {
            // Separate rules rather than one comma-joined selector:
            // `emitPartStyles` appends pseudo-element suffixes, state selectors
            // and `&` substitutions to what it is handed, and those bind only to
            // the last selector of a list.
            for (const attrs of matches) {
                emitVariantStyles(partName, styles, attrs);
            }
        }
        // A composition conditioned on this component's axes (#91).
        if (compoundVariant.composes) {
            for (const attrs of matches) emitComposes(compoundVariant.composes, attrs);
        }
    }

    for (const emit of deferred) emit();

    // Flat rules first, then every conditional bucket. At-rules add no
    // specificity, so a conditional rule can only override the flat rule it
    // refines by coming later in the stylesheet.
    const flat = sink.get('');
    const conditional = [...sink.values()]
        .filter((b) => b.conditions.length > 0)
        .sort((a, b) => compareChains(a.conditions, b.conditions));

    const blocks: string[] = [];
    if (flat) blocks.push(flat.rules.map((r) => indent(r, 1)).join('\n\n'));
    for (const bucket of conditional) blocks.push(renderBucket(bucket.conditions, bucket.rules));
    if (recipe.css?.trim()) blocks.push(indent(recipe.css.trim(), 1));

    let css = `@layer zero.recipes {\n${blocks.join('\n\n')}\n}\n`;
    for (const [name, body] of Object.entries(recipe.keyframes ?? {})) {
        assertKeyframesName(name, component.scope);
        css += `@keyframes ${name} {\n    ${body.trim()}\n}\n`;
    }
    return css;
}
