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

/**
 * Which contract token groups apply to a part — a styling hint for tooling.
 *
 * The `radius-*` hints name a structural ROLE by its recommended token, not
 * a token every design system declares: a design system may map the role
 * onto a key of its own scale (`system.structural` in `@sigx/zero-kit`,
 * #422), and its compiled manifest records the token that plays it
 * (`tokens.structural['radius-box']` → `'radius-medium'`).
 */
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

/**
 * A named variant axis a non-carrier part may re-carry (`PartSpec.carries`).
 * Closed to the three with named props: a custom axis is design-system
 * vocabulary, so no anatomy can promise to carry it.
 */
export type CarriedAxis = 'color' | 'size' | 'variant';

/**
 * The facts a PAINT part declares (`PartSpec.paint`) beyond being one — what
 * the contrast audit needs to measure the mark the way a reader sees it.
 * Each key is optional; a paint part with none of them declares
 * `paint: true`.
 */
export interface PartPaint {
    /**
     * The default mark the component itself renders when the app passes no
     * children (`Select.Indicator` → `▾`, item indicators → `✓`,
     * `TreeView.BranchIndicator` → `›`, `RatingGroup.Item` → `★`). Omitted
     * when the recipe draws the mark (checkbox, switch, progress): zero
     * renders no glyph there, and the audit measures what is on screen.
     */
    glyph?: string;
    /**
     * The flag the part cannot exist WITHOUT — one of its own `flags`.
     * `Select.Item` mounts its `✓` only while selected, always with
     * `data-selected=""` on it, so a reading without the flag measures a
     * state that never renders.
     */
    only?: string;
    /**
     * The same-scope part the mark is measured ON, when `parent` names only
     * the containing part: menu's `item-indicator` declares
     * `parent: 'popup'` because it can sit in a checkbox or a radio row, and
     * `host: 'checkbox-item'` names the row the audit builds around it. Only
     * on a part that declares a `parent`, and the host must itself sit
     * inside it.
     */
    host?: string;
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
     * Presence-only DOMAIN facts this part can carry (#457), rendered as
     * `data-x-<name>=""` — a mail row's `unread`, a stepper item's
     * `optional`. ECOSYSTEM scopes only: zero's own anatomies never declare
     * one (the anatomy suite holds that), because the shared `flags`
     * vocabulary is closed and a fact zero's own components need belongs
     * there. A name is kebab-case and never a shared flag, a state, a state
     * synonym or an interaction state (`mergeManifests` refuses each, with a
     * hint); after the anatomy it is keyed `x-<name>` — in `selectors`, a
     * recipe's `states` and the contrast matrix.
     *
     * A styling and tooling fact the scope owns, with NO accessibility
     * meaning: the component must still expose the fact as text or ARIA. A
     * part that carries none OMITS the key rather than declaring `[]`, on
     * the `hiddenIn` reasoning.
     */
    domainFlags?: readonly string[];
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
    /**
     * The named variant axes this part RE-CARRIES (#94): besides the
     * scope's carrier (`root`, else the first part), this part takes the
     * axis as a prop of its own and renders the attribute on itself —
     * `Timeline.Marker color="success"` → `data-color="success"` on the
     * marker, one dot recoloured while the rest of the timeline keeps the
     * root's colour.
     *
     * The nearest carrier wins, which is the semantics the `@scope` donut
     * already gives nested scopes: the recipe compiler emits every
     * `variants.<axis>.<value>` rule that targets this part (or a part inside
     * it) a second time, anchored on this part's own attribute, so a value on
     * the part outranks the carrier's and a part without one still follows
     * the carrier. Only the named axes (`color`, `size`, `variant`) — a
     * custom axis is design-system vocabulary the anatomy cannot know — and
     * never on the carrier itself, which carries every axis already. A part
     * that re-carries nothing OMITS the key, on the `hiddenIn` reasoning.
     */
    carries?: readonly CarriedAxis[];
    /**
     * True (or the mark's facts, `PartPaint`) when the part's job is PAINT
     * rather than text — a check, a thumb, a range, a dot, a spinner, a
     * star. A reader who cannot see it cannot use the control, so it answers
     * to WCAG 1.4.11's non-text floor: the contrast audit (static and in the
     * browser) measures every declared paint part in every state, inside its
     * real ancestor chain. Declared rather than guessed from the part's
     * name, so a mark the naming pattern cannot see (the rating star, the
     * timeline marker) is measured like any other, and an ecosystem
     * component declares its own. A part that paints nothing of its own —
     * a surface, a text part — OMITS the key.
     */
    paint?: true | PartPaint;
    /** Contract token groups that typically style this part. */
    tokens?: readonly TokenHint[];
    /** True when the part supports `asChild`. */
    asChild?: boolean;
    /**
     * Present when the part may LEND its asChild bag to another part — a
     * zero host that takes it through `lend` (#452's composition rule: the
     * element that renders keeps its own anatomy). A lent part then renders
     * no `[data-scope][data-part]` element of its own: the host's scope and
     * part win, so the lent part's states and flags are never painted and
     * its recipe does not apply — it contributes behaviour and ARIA only.
     * Presence-only, like `visuallyHidden`; a part that never lends OMITS
     * the key. Invariants (zero's anatomy suite for zero's own parts,
     * `mergeManifests` for ecosystem fragments): it requires
     * `asChild: true`, it is never another part's `parent` (an absorbed
     * part has no element to contain anything), and it declares no
     * `hiddenIn`, `layout` or `pseudo` (each needs an element of its own).
     */
    absorbable?: true;
    /**
     * True when the consumer can hide the part from sight while it keeps
     * naming something — a label beside a compact control, a drawer title
     * whose heading is the brand row. The part then renders
     * `data-visually-hidden`, which `css/base.css` clips in
     * `@layer zero.structure`: no recipe can undo it, and a design system
     * has nothing to style. Declared rather than exempted, like
     * `placements`, so `expectAnatomy` fails the attribute on a part that
     * never offered it.
     */
    visuallyHidden?: boolean;
    /**
     * True when the consumer can ask the part to grow with its content
     * (`Textarea.Root minRows`/`maxRows`). The part then renders
     * `data-autosize` plus the row bounds as custom properties, and
     * `css/base.css` sizes it in `@layer zero.structure` — the same kind of
     * presentation request as `visuallyHidden`: nothing for a recipe to
     * style, never a flag, and declared so `expectAnatomy` fails the
     * attribute on a part that never offered it.
     */
    autosize?: boolean;
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

/**
 * The version of the manifest-fragment contract — the `version` an ecosystem
 * package's fragment (`{ version, package, components }`) declares. The kit's
 * `mergeManifests` hard-errors on a missing or unknown one. Exported here as
 * well as from the kit (parity-tested) because a `./fragment` entry must load
 * without the kit, which is a devDependency: this module is the one place a
 * fragment can read the constant from at runtime.
 */
export const FRAGMENT_VERSION = 1;

export interface PartJSON extends PartSpec {
    name: string;
    /**
     * Ready-made CSS selector fragments per state/flag — what the recipe
     * compiler and raw-CSS validators consume. `states` values map to
     * `[data-state="s"]`, flags to `[data-f]`, and a domain flag `d` to the
     * key `x-d` → `[data-x-d]`.
     */
    selectors: Record<string, string>;
}

export interface AnatomyJSON {
    scope: string;
    orientation?: boolean;
    parts: PartJSON[];
    /** The models the API carries, companions derived — absent when there are none. */
    models?: ModelJSON[];
    /**
     * CSS custom properties the runtime writes inline on this scope's parts —
     * absent when there are none.
     */
    runtimeProperties?: string[];
}

export interface Anatomy<S extends string = string, P extends string = string> {
    scope: S;
    parts: Record<P, PartSpec>;
    orientation?: boolean;
    /** The models the API carries, as declared (see `ModelSpec`). */
    models?: readonly ModelSpec[];
    /** The custom properties the runtime writes inline, as declared. */
    runtimeProperties?: readonly string[];
    /** All part names, in declaration order. */
    partNames(): P[];
    /**
     * CSS selector builder:
     * `dialogAnatomy.selector('trigger')` →
     * `[data-scope="dialog"][data-part="trigger"]`, optionally narrowed by a
     * state, flags and/or domain flags (`[data-x-<name>]`).
     */
    selector(part: P, opts?: { state?: string; flags?: readonly string[]; domainFlags?: readonly string[] }): string;
    /** JSON-safe snapshot for tooling/AI — includes per-state selectors. */
    toJSON(): AnatomyJSON;
}

export function defineAnatomy<S extends string, P extends string>(
    scope: S,
    parts: Record<P, PartSpec>,
    opts?: {
        orientation?: boolean;
        models?: readonly ModelSpec[];
        /**
         * CSS custom properties the component's runtime writes inline, which a
         * recipe may read without declaring them. Web-only: the lynx target
         * refuses them outside `targets.web`. An ecosystem scope prefixes each
         * with its own scope (`--ext-stepper-count`), which the kit's
         * `mergeManifests` enforces.
         */
        runtimeProperties?: readonly `--${string}`[];
    },
): Anatomy<S, P> {
    // No runtime guard that `pseudo.of` names a real part — defineAnatomy is
    // on every component's size budget, and zero's own anatomies (the only
    // web callers) are checked by the anatomy test suite instead.
    const selector = (part: P, o?: { state?: string; flags?: readonly string[]; domainFlags?: readonly string[] }): string => {
        const pseudo = parts[part].pseudo;
        let sel = `[data-scope="${scope}"][data-part="${pseudo?.of ?? part}"]`;
        if (o?.state) sel += `[data-state="${o.state}"]`;
        for (const flag of o?.flags ?? []) sel += `[data-${flag}]`;
        // `data-x-<name>` spelled out rather than through DOMAIN_FLAG_PREFIX:
        // this module stays import-free (it is on every component's budget).
        for (const flag of o?.domainFlags ?? []) sel += `[data-x-${flag}]`;
        return pseudo ? sel + pseudo.selector : sel;
    };

    return {
        scope,
        parts,
        orientation: opts?.orientation,
        models: opts?.models,
        runtimeProperties: opts?.runtimeProperties,
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
                for (const flag of spec.domainFlags ?? []) {
                    selectors[`x-${flag}`] = `[data-x-${flag}]`;
                }
                return { name, ...spec, selectors };
            }),
            ...(opts?.models?.length
                ? { models: opts.models.map((m) => ({ ...m, default: defaultPropOf(m.concept), change: changeEventOf(m.concept) })) }
                : {}),
            ...(opts?.runtimeProperties?.length ? { runtimeProperties: [...opts.runtimeProperties] } : {}),
        }),
    };
}
