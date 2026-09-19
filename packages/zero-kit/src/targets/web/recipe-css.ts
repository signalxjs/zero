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
import type { CssProps, PartStyles, RecipeContext, RecipeInput } from '../../recipes.js';
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
        const self = `${baseSelector}${pseudoSuffix}`;
        const sel = nested.includes('&') ? nested.replace(/&/g, self) : `${self} ${nested}`;
        rule(sel, props);
    }
    for (const [key, nested] of Object.entries(styles.at ?? {})) {
        const condition = resolveCondition(key, context, where, registry);
        emitPartStyles(component, partName, nested, baseSelector, sink, context, registry, pseudoSuffix, [...path, condition], where);
    }
}

function axisAttr(axis: string, scope: string): string {
    return VARIANT_AXES[axis] ?? `data-${assertAxisToken('axis', axis, scope)}`;
}

/** A presence-only modifier's attribute — `[data-mod-block]`, never valued. */
function modAttr(name: string, scope: string): string {
    return `${MOD_ATTR_PREFIX}${assertAxisToken('modifier', name, scope)}`;
}

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
    for (const [scope, composed] of Object.entries(recipe.composes ?? {})) {
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
        const container = partSelector(component.scope, within);
        for (const [partName, styles] of Object.entries(composed.parts)) {
            if (!nested.parts.some((p) => p.name === partName)) {
                throw new Error(`[zero-kit] ${where}: "${partName}" is not a part of "${scope}" (known: ${known(nested)})`);
            }
            const { host, suffix } = partProjection(nested, partName);
            emitPartStyles(
                nested, partName, styles, `${container} ${partSelector(scope, host)}`, sink, context, registry, suffix, [],
                `${where}."${partName}"`,
            );
        }
    }

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
    // lower bound is the scope's carrier (a nested instance) or the same
    // part again (a nested re-carrier, which answers for its own subtree).
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
    const emitVariantStyles = (
        partName: string,
        styles: PartStyles,
        axisAttrs: string,
        carried?: string,
    ): void => {
        const { host, suffix } = partProjection(component, partName);
        const where = `recipe for "${component.scope}"."${partName}"`;
        const own = carried === undefined ? [] : carriersOf(component, host, carried);
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
            const prelude = `@scope (${anchorSelector}) to (${partSelector(component.scope, carrierPart(component))}, ${partSelector(component.scope, anchor)})`;
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
        const alternatives = Object.entries(compoundVariant.match).map(([axis, value]) => {
            if (value === true) return [`[${modAttr(axis, component.scope)}]`];
            const attr = axisAttr(axis, component.scope);
            const present = `[${attr}="${assertAxisToken('value', value, component.scope)}"]`;
            return recipe.defaultVariants?.[axis] === value ? [present, `:not([${attr}])`] : [present];
        });
        const matches = alternatives.reduce<string[]>(
            (acc, alts) => acc.flatMap((prefix) => alts.map((alt) => `${prefix}${alt}`)),
            [''],
        );
        for (const [partName, styles] of Object.entries(compoundVariant.parts)) {
            // Separate rules rather than one comma-joined selector:
            // `emitPartStyles` appends pseudo-element suffixes, state selectors
            // and `&` substitutions to what it is handed, and those bind only to
            // the last selector of a list.
            for (const attrs of matches) {
                emitVariantStyles(partName, styles, attrs);
            }
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
