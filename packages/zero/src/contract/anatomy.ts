/**
 * Machine-readable component anatomy.
 *
 * Every zero component ships an `Anatomy`: the closed set of parts it
 * renders, the `data-state` values and boolean flags each part can carry,
 * and hints about which contract token groups apply. The anatomy is the
 * SOURCE OF TRUTH — the component imports part names from it, tests assert
 * against it, and the build emits the whole registry as `manifest.json` so
 * tooling (and AI generating a design system) can enumerate every styleable
 * selector without reading component code.
 */

/** Which contract token groups apply to a part — a styling hint for tooling. */
export type TokenHint =
    | 'color'
    | 'radius-selector'
    | 'radius-field'
    | 'radius-box'
    | 'size'
    | 'text';

/**
 * Web projection of a part that renders no element of its own: it hangs off
 * a pseudo-element of another part. `selector()` and the recipe compiler
 * compose `[data-part="<of>"]<state/flag fragments><selector>` — the
 * pseudo-element always last, so states narrow the HOST, which is the only
 * thing an attribute can narrow.
 *
 * The part itself stays real in the anatomy: platforms without the
 * pseudo-element (a Lynx dialog backdrop is a rendered view) project it like
 * any other part. Only the web selector shape is special.
 */
export interface PartPseudo {
    /** The rendered part the pseudo-element belongs to. */
    of: string;
    /** The pseudo-element, including the `::` (e.g. `'::backdrop'`). */
    selector: string;
}

export interface PartSpec {
    /**
     * Default rendered element, e.g. 'button', 'dialog', 'input'. For a
     * `pseudo` part, the element of the part it projects from.
     */
    element: string;
    /**
     * The same-scope part this part renders INSIDE — its containing part in
     * the rendered DOM. Omitted for a top-level part (one no other part of the
     * scope contains: a lone `root`, or a trigger/popup pair whose Root
     * renders a fragment).
     *
     * This is the anatomy's part TREE, and it is a statement about the DOM,
     * not about the compound-component API: menu's `sub-popup` nests under
     * `popup` because the rendered element really is a DOM descendant of the
     * parent popup, while dialog's `popup` is top-level because the native
     * top layer means it is never inside the trigger.
     *
     * `parent` names the CONTAINING part, not necessarily the immediate DOM
     * parent element — other parts (or consumer markup) may sit in between:
     * a menu `item` declares `parent: 'popup'` and may render inside a
     * `group`, which itself nests under the popup. `expectAnatomy` therefore
     * asserts that the declared parent appears among the rendered element's
     * same-scope ancestors.
     *
     * Tooling reads it wherever nesting matters: the contrast audit derives
     * its ancestor chains from it instead of hand-maintaining them, and the
     * recipe compiler bounds descendant-anchored axis rules at nested
     * same-scope instances. A `pseudo` part renders no element and declares
     * no parent — its host is `pseudo.of`.
     */
    parent?: string;
    /** Closed set of `data-state` values this part can carry, if any. */
    states?: readonly string[];
    /** Boolean `data-*` flags this part can carry (from the flag vocabulary). */
    flags?: readonly string[];
    /**
     * States in which the runtime hides this part outright: it sets the
     * `hidden` attribute, so while the part is in one of these states it
     * paints nothing and is absent from the accessibility tree.
     *
     * This is a STYLING fact, which is why it belongs to the anatomy. A rule
     * targeting a hidden state can never render, so a recipe that styles such
     * a state identically to a visible one is correct rather than lazy — the
     * difference between the two is presence, and the runtime owns it. Avatar
     * is the canonical case: `image` is hidden while `error` and `fallback`
     * while `loaded`, so all three of avatar's states are legitimately
     * CSS-identical. Tooling that asks whether a design system tells two
     * states apart (zero-kit's state-legibility guard) reads this instead of
     * carrying a hardcoded list of the components that work this way, and a
     * generator reads it to know which selectors are not worth emitting.
     *
     * Every entry must be one of this part's own `states`, and a part the
     * runtime never hides OMITS the key rather than declaring `[]` — the
     * manifest schema rejects an empty array, since a key claiming nothing
     * reads as a fact where there is none.
     *
     * Declare it ONLY for the `hidden` attribute: a part that merely animates
     * out, or that a design system chooses to `display: none` itself, is still
     * rendered by zero and still has to look like the state it is in.
     */
    hiddenIn?: readonly string[];
    /**
     * The `data-placement` values this part can carry, if any — a closed
     * subset of the contract's `PLACEMENT_VOCABULARY`. Declared contract data
     * exactly like `states`: the anchored-position behavior writes the
     * attribute on open floats (a popup that flipped reports where it
     * actually is) and Toast stamps its viewport and roots, so a design
     * system keys placement-dependent styling on it. A part the runtime never
     * stamps OMITS the key — `expectAnatomy` fails an undeclared
     * `data-placement` rather than blanket-exempting the attribute.
     */
    placements?: readonly string[];
    /**
     * The layout attributes this part may carry, if any — a closed subset of
     * `LAYOUT_VOCABULARY`'s keys. Declared contract data exactly like
     * `states` and `placements`: the part renders them under the `data-l-`
     * prefix, `expectAnatomy` rejects one it never declared, and the recipe
     * pack reads them to know which rules are worth emitting for the scope.
     *
     * A part that takes no layout attributes OMITS the key rather than
     * declaring `[]`, on the `hiddenIn` reasoning — a key claiming nothing
     * reads as a fact where there is none.
     */
    layout?: readonly string[];
    /** Contract token groups that typically style this part. */
    tokens?: readonly TokenHint[];
    /** True when the part supports `asChild`. */
    asChild?: boolean;
    /** Present when the part projects onto a pseudo-element on the web. */
    pseudo?: PartPseudo;
}

/**
 * One model the component's API carries — the machine-readable half of the
 * naming rule every zero model follows: a concept `N` binds through
 * `model` (or `model:<name>`), seeds through `default<N>` and emits
 * `<n>Change`. The anatomy declares the concept; `toJSON()` derives the
 * two companion names, so tooling reads them by name and the parity tests
 * hold the component sources to them.
 */
export interface ModelSpec {
    /**
     * The `model:<name>` key of a NAMED model (`model:open`,
     * `model:inputValue`). Omitted for the unnamed `model` prop. A named
     * model's concept IS its name.
     */
    name?: string;
    /**
     * What the model holds, and the stem of both companions: `open` →
     * `defaultOpen` + `openChange`; `expandedValues` →
     * `defaultExpandedValues` + `expandedValuesChange`. camelCase.
     */
    concept: string;
    /**
     * The value type as a TypeScript type expression — `boolean`,
     * `number | null`, `string[]`; on a generic root `T` is the item type
     * and `V` what `itemValue` returns.
     */
    type: string;
    /**
     * The compound member whose props carry the model when it is not
     * `Root` (`CheckboxItem`, `RadioGroup`, `Sub` on Menu). Omitted for
     * Root.
     */
    member?: string;
    /**
     * The `multiple` prop makes the model an array instead. `type` describes
     * the single-select shape; under `multiple` the model is an array of the
     * selectable value alone — the empty sentinel (`null`, `''`) has no
     * element form, the empty array is it (`T | null` → `T[]`).
     */
    multiple?: true;
    /** Posts to the enclosing form under `name` (the form contract, #441). */
    formControl?: true;
}

export interface ModelJSON extends ModelSpec {
    /** The seed prop: `default` + the capitalised concept. */
    default: string;
    /** The change event: the concept + `Change` (handler `on<Concept>Change`). */
    change: string;
}

/** `open` → `defaultOpen`: the seed prop of a model concept. */
export const defaultPropOf = (concept: string): string => `default${concept.charAt(0).toUpperCase()}${concept.slice(1)}`;
/** `open` → `openChange`: the change event of a model concept. */
export const changeEventOf = (concept: string): string => `${concept}Change`;

export interface PartJSON extends PartSpec {
    name: string;
    /**
     * Ready-made CSS selector fragments per state/flag — what the recipe
     * compiler and raw-CSS validators consume. `states` values map to
     * `[data-state="x"]`, flags to `[data-x]`.
     */
    selectors: Record<string, string>;
}

export interface AnatomyJSON {
    scope: string;
    orientation?: boolean;
    parts: PartJSON[];
    /** The models the API carries, companions derived — absent when there are none. */
    models?: ModelJSON[];
}

export interface Anatomy<S extends string = string, P extends string = string> {
    scope: S;
    parts: Record<P, PartSpec>;
    orientation?: boolean;
    /** The models the API carries, as declared (see `ModelSpec`). */
    models?: readonly ModelSpec[];
    /** All part names, in declaration order. */
    partNames(): P[];
    /**
     * CSS selector builder:
     * `dialogAnatomy.selector('trigger')` →
     * `[data-scope="dialog"][data-part="trigger"]`, optionally narrowed by a
     * state and/or flags.
     */
    selector(part: P, opts?: { state?: string; flags?: readonly string[] }): string;
    /** JSON-safe snapshot for tooling/AI — includes per-state selectors. */
    toJSON(): AnatomyJSON;
}

export function defineAnatomy<S extends string, P extends string>(
    scope: S,
    parts: Record<P, PartSpec>,
    opts?: { orientation?: boolean; models?: readonly ModelSpec[] },
): Anatomy<S, P> {
    // No runtime guard that `pseudo.of` names a real part — defineAnatomy is
    // on every component's size budget, and zero's own anatomies (the only
    // web callers) are checked by the anatomy test suite instead.
    const selector = (part: P, o?: { state?: string; flags?: readonly string[] }): string => {
        const pseudo = parts[part].pseudo;
        let sel = `[data-scope="${scope}"][data-part="${pseudo?.of ?? part}"]`;
        if (o?.state) sel += `[data-state="${o.state}"]`;
        for (const flag of o?.flags ?? []) sel += `[data-${flag}]`;
        return pseudo ? sel + pseudo.selector : sel;
    };

    return {
        scope,
        parts,
        orientation: opts?.orientation,
        models: opts?.models,
        partNames: () => Object.keys(parts) as P[],
        selector,
        toJSON: (): AnatomyJSON => ({
            scope,
            ...(opts?.orientation ? { orientation: true } : {}),
            parts: (Object.keys(parts) as P[]).map((name) => {
                const spec = parts[name];
                const selectors: Record<string, string> = {};
                for (const state of spec.states ?? []) {
                    selectors[state] = `[data-state="${state}"]`;
                }
                for (const flag of spec.flags ?? []) {
                    selectors[flag] = `[data-${flag}]`;
                }
                return { name, ...spec, selectors };
            }),
            ...(opts?.models?.length
                ? { models: opts.models.map((m) => ({ ...m, default: defaultPropOf(m.concept), change: changeEventOf(m.concept) })) }
                : {}),
        }),
    };
}
