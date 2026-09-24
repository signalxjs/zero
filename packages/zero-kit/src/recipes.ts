/**
 * Recipe layer — the typed authoring surface (`defineRecipe`, `RecipeInput`,
 * `PartStyles`) and the condition vocabulary. Target-neutral: nothing here
 * emits CSS. The web emitter lives in `targets/web/recipe-css.ts`.
 */
import type { ManifestComponent } from './contract.js';

export type CssProps = Record<string, string | number>;

export interface PartStyles {
    base?: CssProps;
    /** state/flag/interaction name → declarations. */
    states?: Record<string, CssProps>;
    /** Nested selectors; `&` is the part selector, a key without `&` selects descendants, and each item of a list key is scoped on its own. */
    selectors?: Record<string, CssProps>;
    /**
     * Conditional styles for the same part — condition → the same shape,
     * recursively. Nesting composes the at-rules.
     *
     * Keys resolve in this order:
     * - starts with `@` → used verbatim as the at-rule prelude
     *   (`'@container (min-width: 20rem)'`, `'@supports (…)'`,
     *   `'@starting-style'`)
     * - a name in the design system's `breakpoints` → `@media (min-width: …)`
     * - `below-<breakpoint>` → `@media (width < …)`, the exact complement of
     *   that breakpoint's rule — desktop-first styling from the same tokens,
     *   never a hand-written `767.98px`
     * - a built-in: see `BUILTIN_CONDITIONS`
     * - anything else is a hard error listing what was available
     *
     * `variants` and `compoundVariants` hold `PartStyles` too, so responsive
     * variants need no separate mechanism.
     */
    at?: Record<string, PartStyles>;
}

/**
 * Condition keys that don't come from the design system's breakpoints.
 *
 * `prefers-dark` is deliberately not called `dark`: it compiles to
 * `prefers-color-scheme` and so ignores `[data-theme="…-dark"]` entirely.
 * `at.dark` would read as "my dark theme" and silently mean something else —
 * the exact class of trap the recipe layer keeps eliminating elsewhere.
 */
export const BUILTIN_CONDITIONS: Readonly<Record<string, string>> = {
    'reduced-motion': '@media (prefers-reduced-motion: reduce)',
    'hover-none': '@media (hover: none)',
    'prefers-dark': '@media (prefers-color-scheme: dark)',
    'forced-colors': '@media (forced-colors: active)',
    // The other medium where a background-painted mark disappears: printing
    // drops backgrounds by default (`print-color-adjust: economy`), so a
    // drawn indicator needs the same glyph fallback `forced-colors` gets.
    // Named for exactly that reason — `forced-colors` having a name while
    // `print` did not make the raw prelude look like the only route, which
    // pushes authors past the tier machinery for no reason.
    print: '@media print',
    // The state an element animates FROM on its first style change — the
    // entry half of presence. Spellable as the raw `@starting-style` prelude
    // too; naming it makes it discoverable and lets the validator recognise
    // an entry animation and check for the exit half.
    'starting-style': '@starting-style',
};

/**
 * The prefix of a max-width condition key: `below-md` is everything narrower
 * than the `md` breakpoint. Reserved — a breakpoint may not be named with it.
 */
export const BELOW_PREFIX = 'below-';

/** Compile-time context a recipe needs beyond its own component anatomy. */
export interface RecipeContext {
    /** The design system's declared breakpoints, in mobile-first order. */
    breakpoints?: Record<string, string>;
    /**
     * The manifest's anatomies by scope — what `composes` resolves a nested
     * scope's parts and states against. `compileDesignSystem` passes it.
     */
    components?: ReadonlyMap<string, ManifestComponent>;
    /**
     * The design system's recipes by scope, each already resolved for the
     * target being compiled — what a borrowing `composes` (`axes`, #91)
     * copies the nested scope's own axis rules from. `compileDesignSystem`
     * resolves every recipe first and passes them all, so the order of
     * `ds.recipes` never matters.
     */
    recipes?: ReadonlyMap<string, RecipeInput>;
}

/**
 * One nested scope a recipe styles in context — see `RecipeInput.composes`.
 */
export interface ComposedScope {
    /**
     * The part of THIS component the nested scope sits inside. Defaults to
     * the carrier part (`root`, else the first part).
     */
    within?: string;
    /** The nested scope's parts → styles; states resolve through ITS anatomy. */
    parts?: Record<string, PartStyles>;
    /**
     * The nested scope's own axis values to BORROW in this context (#91):
     * axis → value. `{ size: 'sm' }` makes a nested button look like the
     * design system's `sm` button here, whatever size it would otherwise
     * default to — the nested recipe's `variants.size.sm` rules, the
     * compounds that match `size: 'sm'`, and their `at` blocks, re-emitted
     * under this context.
     *
     * An explicit prop on the nested instance WINS: the borrowed rules only
     * apply while the nested carrier has no `data-<axis>` of its own. The
     * value must be one the nested scope's recipe wires in this design
     * system; the host's CSS is built from that recipe as compiled here.
     */
    axes?: Record<string, string>;
}

/**
 * The generated-content pseudo-elements — the only ones a recipe DRAWS, and so
 * the only ones whose existence is the recipe's decision rather than the
 * platform's. `::placeholder` or `::-webkit-slider-thumb` exist because the
 * element does; a derived system styling one relies on nothing the base could
 * rename. A `::before` exists because the base put `content` on it.
 */
export const HOOK_PSEUDO_ELEMENTS = ['::before', '::after'] as const;

/**
 * What a recipe exposes to a design system DERIVED from it (#73) — the names
 * an `extendDesignSystem` patch may rely on across the base's releases.
 * Everything a recipe sets, draws or animates that is not listed here is
 * private: a patch may still reach it, but `validateDesignSystem` warns,
 * because a private name can change in any release of the base.
 *
 * Metadata only: nothing here reaches the compiled CSS. It is checked at build
 * (a hook must name something the recipe really has) and emitted into the
 * design-system manifest as `components[scope].hooks`.
 *
 * Selector shapes (`[data-scope="table"][data-part="body"] > &`) have no hook
 * grammar on purpose: a patch that needs one should target the part and the
 * state the anatomy declares, which are the contract already.
 */
export interface RecipeHooks {
    /**
     * Component-level custom properties a derived system may read or set —
     * name → what it means (`{ '--switch-accent': 'The checked track fill.' }`).
     * Each must be set or read somewhere in the recipe.
     */
    properties?: Record<string, string>;
    /** Keyframe names a derived system may reference in `animation`; each must be in `keyframes`. */
    keyframes?: readonly string[];
    /**
     * Generated-content pseudo-elements a derived system may restyle, per
     * part: `{ root: ['::before'] }`. Each must be drawn by a `selectors` key
     * on that part. Only `::before` / `::after` — see `HOOK_PSEUDO_ELEMENTS`.
     */
    pseudo?: Record<string, readonly string[]>;
}

export interface RecipeInput {
    /** The component scope this recipe styles (e.g. `'tabs'`). */
    component: string;
    /**
     * The public surface a derived design system may rely on — see
     * `RecipeHooks`. Absent, every name in the recipe is private.
     */
    hooks?: RecipeHooks;
    /**
     * Component-level tokens declared on the carrier part (`root`, else the
     * first part). Emitted in `@layer zero.recipes`, which the layer order in
     * `zero/css/base.css` puts after `zero.tokens` — so a theme-level
     * declaration of the same property cannot override one of these.
     */
    tokens?: Record<string, string>;
    parts: Record<string, PartStyles>;
    /** axis → value → part → styles. Contract axes: color, size, variant. */
    variants?: Record<string, Record<string, Record<string, PartStyles>>>;
    /**
     * Presence-only modifiers: name → part → styles, emitted as
     * `[data-mod-<name>]`. Names must be declared in `tokens.modifiers`.
     *
     * There is no `defaultVariants` analogue — a modifier is absent by nature,
     * so absence already is the default.
     */
    modifiers?: Record<string, Record<string, PartStyles>>;
    /**
     * A conjunction over axis values, plus `true` for a modifier that must be
     * present. `{ variant: 'solid', block: true }` compiles to
     * `[data-variant="solid"][data-mod-block]`.
     */
    compoundVariants?: Array<{
        match: Record<string, string | true>;
        parts: Record<string, PartStyles>;
        /**
         * Nested scopes styled in context WHILE this component matches
         * `match` (#91) — a composition conditioned on the host's own axes:
         * `{ match: { size: 'sm' }, parts: {}, composes: { button: { axes:
         * { size: 'xs' } } } }` is a small composer shrinking its button.
         * Same shape and checks as the top-level `composes`; the condition
         * is read on this component's carrier, bounded like every other
         * carrier-anchored rule (an `@scope` donut), so a nested instance of
         * this component answers for its own subtree.
         */
        composes?: Record<string, ComposedScope>;
    }>;
    /**
     * Other scopes this component contains, styled in context: nested scope →
     * where it sits and how its parts look there. A composer's embedded
     * button, a card's footer actions. Compiles to
     * `[data-scope="<this>"][data-part="<within>"] [data-scope="<nested>"][data-part="<part>"]`,
     * which outranks the nested recipe's own base and axis rules, so the
     * context wins.
     *
     * Validated against the manifest like `parts` is: the nested scope must
     * be declared (and not be this one), `within` must be a part of this
     * component, and every part and state must be the nested scope's own —
     * a pack stays confined to what the manifest declares, but not blind to
     * what it contains. Web only: the lynx target drops it with a report
     * entry.
     *
     * Besides explicit `parts`, an entry may BORROW the nested scope's own
     * axis values in context (`axes`, #91), and a `compoundVariants` entry
     * may carry `composes` of its own — a composition conditioned on this
     * component's axes and modifiers.
     */
    composes?: Record<string, ComposedScope>;
    /** Values applied when the axis attribute is absent (CSS-only defaults). */
    defaultVariants?: Record<string, string>;
    /** name → raw keyframes body (`from { … } to { … }`). */
    keyframes?: Record<string, string>;
    /**
     * Raw CSS appended verbatim at the end of this component's
     * `@layer zero.recipes` block — the escape hatch for anything the typed
     * surface can't express. Lands in the component's own stylesheet, so it
     * stays with the rules it relates to.
     */
    css?: string;
    /**
     * Declared states intentionally left unstyled — part → state names.
     *
     * Two consumers read this, and an entry makes BOTH claims:
     * 1. the validator's coverage warning is silenced for that part+state;
     * 2. the state-legibility guard (`__tests__/state-legibility.test.ts`)
     *    accepts that the state is deliberately indistinguishable from its
     *    siblings — so listing a state here also asserts "this component does
     *    not need to look different in that state", which is a design claim
     *    and wants a comment saying why.
     *
     * Both readings are scoped to the part the entry names: skipping `checked`
     * on a `item-label` says nothing about `item-indicator`, and will not stop
     * the guard from requiring that the indicator draw its mark.
     */
    skipStates?: Record<string, readonly string[]>;
    /**
     * Declared states that paint the SAME on purpose — part → `{ state:
     * otherState }` (`{ root: { complete: 'loading' } }`: a finished tool
     * call recedes to the quiet look it had while queued).
     *
     * Narrower than `skipStates`, which excuses a state against every
     * sibling: this names the one pair, so the state-legibility guard still
     * requires every OTHER pair to differ. Chains are one class
     * (`{ complete: 'loading', closed: 'loading' }` makes all three alike).
     * The named state counts as addressed for the validator's coverage
     * warning — its styling is its partner's. Scoped to the part it names,
     * exactly like `skipStates`, and declared instead of disguising the
     * equivalence as a no-op declaration (`opacity: '1'`).
     */
    sameAs?: Record<string, Readonly<Record<string, string>>>;
    /**
     * Per-target sections, deep-merged over the shared recipe before that
     * target compiles (`resolveRecipeForTarget`). The division of labor:
     *
     * - DOM-only SPELLINGS stay in the shared sections — the lynx target
     *   drops what it cannot express, with a report entry per declaration.
     * - Declarations that depend on a WEB RUNTIME MECHANISM (`var(--press-*)`
     *   and the other `RUNTIME_PROPERTIES`, the raw `css` hatch) move into
     *   `targets.web`: the lynx target hard-rejects them in shared sections,
     *   because on lynx nothing ever writes those properties and silence
     *   would ship paint that never renders.
     * - `targets.lynx` supplies replacements where a drop leaves a state
     *   illegible (a mark drawn with `::before` on the web becomes a real
     *   part's style).
     *
     * Absent `targets`, both compiles see the shared recipe byte-identically.
     */
    targets?: {
        web?: RecipeTargetOverride;
        lynx?: RecipeTargetOverride;
    };
}

/**
 * What a per-target section may carry — the styling surface, not the recipe's
 * identity: `component`, `defaultVariants` and the coverage claims stay
 * shared, because they describe the ONE design decision both targets deliver.
 */
export type RecipeTargetOverride = Partial<Pick<RecipeInput,
    'tokens' | 'parts' | 'variants' | 'modifiers' | 'compoundVariants' | 'keyframes' | 'css' | 'skipStates' | 'sameAs'>>;

/** Identity with typing — the authoring entry point. */
export function defineRecipe(recipe: RecipeInput): RecipeInput {
    return recipe;
}

const mergeProps = (a?: CssProps, b?: CssProps): CssProps | undefined =>
    a || b ? { ...a, ...b } : undefined;

function mergePartStyles(a: PartStyles | undefined, b: PartStyles | undefined): PartStyles {
    const merged: PartStyles = {};
    const base = mergeProps(a?.base, b?.base);
    if (base) merged.base = base;
    for (const key of ['states', 'selectors'] as const) {
        const left = a?.[key];
        const right = b?.[key];
        if (!left && !right) continue;
        const out: Record<string, CssProps> = { ...left };
        for (const [name, props] of Object.entries(right ?? {})) {
            out[name] = { ...out[name], ...props };
        }
        merged[key] = out;
    }
    if (a?.at || b?.at) {
        const out: Record<string, PartStyles> = { ...a?.at };
        for (const [condition, styles] of Object.entries(b?.at ?? {})) {
            out[condition] = mergePartStyles(a?.at?.[condition], styles);
        }
        merged.at = out;
    }
    return merged;
}

function mergePartsRecord(
    a: Record<string, PartStyles> | undefined,
    b: Record<string, PartStyles> | undefined,
): Record<string, PartStyles> {
    const out: Record<string, PartStyles> = { ...a };
    for (const [part, styles] of Object.entries(b ?? {})) {
        out[part] = mergePartStyles(a?.[part], styles);
    }
    return out;
}

/**
 * The recipe one target actually compiles: the shared sections with that
 * target's override deep-merged over them (override wins per declaration),
 * and the `targets` key itself stripped so no emitter ever sees it.
 *
 * Merge shapes: props merge per declaration; parts/variants/modifiers merge
 * per part (and per state/selector/condition inside); `compoundVariants`
 * CONCATENATE (an array entry has no address to merge into — a target adds
 * rules, it does not edit the shared ones); `keyframes` merge per name;
 * `css` strings concatenate; `skipStates` union per part; `sameAs` merges
 * per part, the override's entry winning for a state both name.
 */
export function resolveRecipeForTarget(recipe: RecipeInput, target: 'web' | 'lynx'): RecipeInput {
    const { targets, ...shared } = recipe;
    const override: RecipeTargetOverride = targets?.[target] ?? {};

    const out: RecipeInput = { ...shared };
    if (shared.tokens || override.tokens) out.tokens = { ...shared.tokens, ...override.tokens };
    out.parts = mergePartsRecord(shared.parts, override.parts);
    if (shared.variants || override.variants) {
        const variants: NonNullable<RecipeInput['variants']> = { ...shared.variants };
        for (const [axis, values] of Object.entries(override.variants ?? {})) {
            const axisOut: Record<string, Record<string, PartStyles>> = { ...variants[axis] };
            for (const [value, parts] of Object.entries(values)) {
                axisOut[value] = mergePartsRecord(variants[axis]?.[value], parts);
            }
            variants[axis] = axisOut;
        }
        out.variants = variants;
    }
    if (shared.modifiers || override.modifiers) {
        const modifiers: NonNullable<RecipeInput['modifiers']> = { ...shared.modifiers };
        for (const [name, parts] of Object.entries(override.modifiers ?? {})) {
            modifiers[name] = mergePartsRecord(shared.modifiers?.[name], parts);
        }
        out.modifiers = modifiers;
    }
    if (shared.compoundVariants || override.compoundVariants) {
        out.compoundVariants = [...shared.compoundVariants ?? [], ...override.compoundVariants ?? []];
    }
    if (shared.keyframes || override.keyframes) {
        out.keyframes = { ...shared.keyframes, ...override.keyframes };
    }
    // The raw `css` hatch is web spelling by definition: the web resolution
    // concatenates shared + web sections, the lynx resolution carries ONLY a
    // `targets.lynx.css` (lynx-authored by construction) — a shared `css` is
    // reported as dropped by the lynx compile, never silently forwarded.
    const css = target === 'web'
        ? [shared.css, override.css].filter(Boolean).join('\n')
        : override.css ?? '';
    if (css) out.css = css;
    else delete out.css;
    if (shared.skipStates || override.skipStates) {
        const skip: Record<string, readonly string[]> = { ...shared.skipStates };
        const overrideSkip: Record<string, readonly string[]> = override.skipStates ?? {};
        for (const [part, states] of Object.entries(overrideSkip)) {
            skip[part] = [...new Set([...(skip[part] ?? []), ...states])];
        }
        out.skipStates = skip;
    }
    if (shared.sameAs || override.sameAs) {
        const same: Record<string, Readonly<Record<string, string>>> = { ...shared.sameAs };
        for (const [part, pairs] of Object.entries(override.sameAs ?? {})) {
            same[part] = { ...same[part], ...pairs };
        }
        out.sameAs = same;
    }
    return out;
}
