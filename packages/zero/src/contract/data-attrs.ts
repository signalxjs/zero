/**
 * The normative data-attribute spec — how zero components expose their
 * anatomy and state to CSS. Design systems style *only* against these
 * attributes (plus real pseudo-classes); zero itself ships no styling.
 *
 * ## The spec
 *
 * Every rendered part carries exactly:
 *
 * - `data-scope="<component>"` — component name, kebab-case, on EVERY part.
 * - `data-part="<part>"` — part name, kebab-case, unique within its scope.
 * - `data-state="<value>"` — enumerated lifecycle states only, ONE value at
 *   a time from a closed per-part set (`open|closed`,
 *   `checked|unchecked|indeterminate`, `active|inactive`). Enumerated states
 *   let CSS animate transitions (`[data-state="open"]`).
 * - Boolean flags — presence = true, ABSENT = false, empty-string value
 *   (`data-disabled=""`). Never `data-disabled="false"`. Flags compose:
 *   `[data-part="item"][data-highlighted][data-disabled]`.
 * - `data-orientation="horizontal|vertical"` on parts that need
 *   directional CSS.
 * - Contract variant axes pass through as `data-color` / `data-size` /
 *   `data-variant` — zero attaches no styling to them.
 * - Layout attributes render under the `data-l-` prefix
 *   (`data-l-gap="md"`, and per breakpoint `data-l-md-gap="lg"`), from the
 *   closed `LAYOUT_VOCABULARY` in `layout-attrs.ts` — kept out of THIS
 *   module because every component imports it, and a table only the layout
 *   tier reads has no business on that path. A part declares which ones it
 *   may carry as `PartSpec.layout`, exactly as it declares `placements`.
 *
 * The split is machine-checkable: a part has at most one `data-state` value
 * from a closed set, plus any subset of its declared flags.
 */

/**
 * The shared boolean-flag vocabulary. Components never invent synonyms —
 * a new flag is a contract change.
 *
 * `pressed` and `press-animating` are the press-feedback pair, produced by
 * `createPressFeedback`: `pressed` is present while a pointer or key is
 * physically down on the part (the *held* state a design system tints or
 * translates), `press-animating` from press-start until the design system's
 * press animation finishes — not until release, so a one-shot effect like a
 * ripple always plays to completion. The press point is published alongside
 * as `--press-x` / `--press-y` / `--press-r` custom properties.
 */
export const FLAG_VOCABULARY = [
    'disabled',
    'highlighted',
    'selected',
    'invalid',
    'required',
    'readonly',
    'placeholder',
    'focus-visible',
    'pressed',
    'press-animating',
] as const;

export type FlagName = typeof FLAG_VOCABULARY[number];

/**
 * The governed `data-state` vocabulary, grouped by family. Flags have been a
 * closed vocabulary from the start; states were the asymmetric half — every
 * component free to invent `on|off` next to `active|inactive` — so this
 * closes them the same way: every value in every anatomy's `states` must be a
 * member, and a NEW state value is a contract change here first.
 *
 * The families are documentation (which values belong together), not a
 * per-part constraint: progress legitimately mixes `loading|complete` with
 * `indeterminate`, because an indeterminate progress bar is exactly a
 * checkbox-style third state on a loading lifecycle. Membership is checked
 * against the union.
 */
export const STATE_VOCABULARY = {
    /** Disclosure and presence — popups, panels, dismissables. */
    presence: ['open', 'closed'],
    /** Selection controls — checkbox, radio, and their third state. */
    selection: ['checked', 'unchecked', 'indeterminate'],
    /** One-of-many activation — tabs. */
    activation: ['active', 'inactive'],
    /** Two-state toggles that are neither selection nor disclosure. */
    toggle: ['on', 'off'],
    /** Asynchronous lifecycles — avatar, skeleton, progress. */
    loading: ['loading', 'loaded', 'complete', 'error'],
    /** Graded fill — the rating star. */
    fill: ['full', 'half', 'empty'],
} as const;

/** Every governed `data-state` value, flat — the membership check's set. */
export const STATE_NAMES: ReadonlySet<string> = new Set(Object.values(STATE_VOCABULARY).flat());

/**
 * The synonym table — spellings the vocabulary deliberately does NOT contain,
 * mapped to the member that means the same thing. Purely diagnostic: a
 * governance failure that says "expanded → use open" is actionable where a
 * bare rejection is a scavenger hunt. Mirrored in `@sigx/zero-kit` (parity-
 * tested) so `mergeManifests` can say the same thing to ecosystem fragments.
 */
export const STATE_SYNONYMS: Record<string, string> = {
    expanded: 'open',
    collapsed: 'closed',
    visible: 'open',
    shown: 'open',
    hidden: 'closed',
    dismissed: 'closed',
    selected: 'checked',
    unselected: 'unchecked',
    mixed: 'indeterminate',
    current: 'active',
    pressed: 'on',
    unpressed: 'off',
    busy: 'loading',
    pending: 'loading',
    done: 'complete',
    finished: 'complete',
    failed: 'error',
    errored: 'error',
};

/**
 * The closed `data-placement` vocabulary — side, optionally refined by an
 * alignment, plus the two bare LOGICAL inline sides. Written by the
 * anchored-position behavior on floating parts, by Toast on its viewport and
 * roots, and by the content-tier parts that anchor along an axis (an
 * indicator's middle-row slots, a chat row, a timeline side); a part that can
 * carry the attribute declares which subset in its anatomy
 * (`PartSpec.placements`).
 *
 * `start`/`end` (#334) are not shorthand for `left`/`right`: `left` names a
 * physical side of the glass — where a floating popup really landed after
 * flipping — while `start` names the reading edge, which is `left` in LTR
 * and `right` in RTL. A chat row from the other party sits at the reading
 * start in BOTH directions, so spelling it physically would be wrong in one
 * of them; recipes style these with logical properties
 * (`inset-inline-start`, `margin-inline-*`) and need no `:dir()` correction.
 */
export const PLACEMENT_VOCABULARY = [
    'top', 'top-start', 'top-end',
    'bottom', 'bottom-start', 'bottom-end',
    'left', 'left-start', 'left-end',
    'right', 'right-start', 'right-end',
    'start', 'end',
] as const;

export type PlacementName = typeof PLACEMENT_VOCABULARY[number];

/**
 * Presence-boolean helper: `dataAttr(props.disabled)` → `'' | undefined`.
 * Spread-friendly: an `undefined` value removes the attribute entirely.
 */
export const dataAttr = (cond: unknown): '' | undefined => (cond ? '' : undefined);

/**
 * Enumerated two-state helper: `stateAttr(open, 'open', 'closed')`.
 */
export const stateAttr = <T extends string, F extends string>(
    cond: unknown,
    truthy: T,
    falsy: F,
): T | F => (cond ? truthy : falsy);

export type Orientation = 'horizontal' | 'vertical';
