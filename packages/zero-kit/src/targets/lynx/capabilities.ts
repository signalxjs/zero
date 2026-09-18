/**
 * The lynx capability set — the formalization `RUNTIME_PROPERTIES`' doc in
 * `../../contract.ts` promised: what the lynx target translates, drops, or
 * refuses, stated as one table so the emitters consult a decision instead of
 * re-deciding inline.
 *
 * Lynx's style engine (ground truth: the lynx repo's css-engine-probe and
 * `@sigx/lynx-plugin`'s README) supports class, compound and descendant
 * selectors, stylesheet/inline custom properties on a host class,
 * `@keyframes`/`transition`/`@font-face` — and none of the web's attribute
 * selectors, pseudo-classes, pseudo-elements, `:root`, `@layer`, `@property`,
 * `@starting-style`, `oklch()`, `color-mix()` or `light-dark()`.
 *
 * `var()` indirection: measured on device (signalxjs/lynx#1029, iPhone 16 Pro
 * / iOS 18.3, via the Zero Pilot probe card), lynx resolves a color token
 * `var()`, a var→var chain, `rem`, and `calc()` over a token `var()`. This
 * file previously assumed the last two did not work and dropped every
 * declaration using them — 216 of zero-daisyui's 594 drops, including the
 * whole of daisy's size system, which is `calc(var(--size-*) * n)`.
 *
 * The one thing `var()` does NOT do here is fall back. An unresolvable
 * reference does not compute to an initial value the way the web's
 * invalid-at-computed-value-time rule does; the declaration is dropped and
 * the element paints nothing at all. That is why `assertNoDanglingVars`
 * refuses to ship a stylesheet reading a property nothing defines.
 *
 * Second round of on-device measurement (signalxjs/lynx#1075, iOS 18.3):
 *
 * - A `var(--x)` consumption is ALSO dropped whenever `--x`'s own value
 *   contains `calc()` — bare, with a fallback, or nested inside a calc().
 *   Plain var→var chains and direct `calc(var())` keep working; only the
 *   indirection through a calc-holding property fails. Such chains are
 *   inlined at compile time (`calc-chains.ts`) or refused — never shipped;
 *   `assertNoCalcVarChains` backstops the whole stylesheet for cross-scope
 *   chains the per-recipe pass cannot see.
 * - `display: inline-flex` does not resolve (no inline formatting context) —
 *   the view keeps the broken default linear layout. The emitter rewrites it
 *   to `flex`. `grid`/`inline-grid` are equally unsupported but have NO
 *   mechanical rewrite, so they pass through as authored (daisy's toast
 *   still ships grid properties) — a lynx recipe target section is the fix.
 * - Descendant-from-host selectors (`.zx-root.zx-theme-x .zx-part`) and
 *   theme-baked plain per-theme definitions are proven working as emitted.
 *
 * Third round of on-device measurement (signalxjs/lynx#1079, 0.2.0-beta.4,
 * iPhone 16 Pro / iOS 18.3 + Pixel-density Android emulator / API 35):
 *
 * - **`currentColor` never resolves — on either platform.** A declaration
 *   valued with it ships and silently paints nothing (the daisy tabs border
 *   underline was transparent on both platforms because of it). It is the
 *   element's own computed `color`, a runtime value no compile-time pass can
 *   bake, so every occurrence is dropped with a report entry — the recipe's
 *   lynx section spends the same ink the element's `color:` rules deliver
 *   instead (a plain var() chain or a theme-baked literal, both proven).
 * Fourth round of on-device measurement (signalxjs/lynx#1084, four-bar probe
 * on the Android emulator; iOS resolves all four bars):
 *
 * - **The logical inset/margin/padding spellings (`inset-block-*`,
 *   `inset-inline-*`, `margin-block-*`, `margin-inline-*`, `padding-block-*`,
 *   `padding-inline-*`) and the standalone `translate`/`rotate`/`scale`
 *   properties resolve on iOS but NOT on Android.** An earlier mid-flight
 *   re-measure declared them working on both platforms — that verdict was
 *   wrong (the daisy slider thumb sat visibly off-center on Android because
 *   of it, user-reported and zoom-confirmed). Cross-platform-asymmetric is
 *   treated as unsupported: every occurrence is dropped with a report entry.
 *   Physical spellings (`top`/`right`/`bottom`/`left`, physical
 *   margins/paddings) and `transform`'s `translate…()`/`rotate()`/`scale()`
 *   functions are proven on BOTH platforms — the recipe's lynx target
 *   section restates the same geometry with those, which are this target's
 *   norm (lynx has no RTL flow to make the logical distinction meaningful).
 *
 * Three verdicts:
 *
 * - **translate** — silently, because the result is semantically equivalent:
 *   interaction states onto the runtime-stamped flag classes, anatomy pseudo
 *   parts onto real part classes, color functions onto culori-baked literals,
 *   `@layer` onto source order, `--text-fixed-*` onto materialized literals.
 * - **drop, with a report entry** — the declaration cannot exist on lynx and
 *   losing it is legible styling degradation an author may want to patch in
 *   a lynx recipe section: `hover` states, pseudo-element `selectors:` keys,
 *   `@starting-style`, `@media`/`@supports` conditions, any `selectors:` key
 *   the class grammar cannot express — any declaration valued with
 *   `currentColor`, which never resolves on device (signalxjs/lynx#1079) —
 *   and any logical inset/margin/padding spelling or standalone
 *   `translate`/`rotate`/`scale` property, which resolve on iOS but not on
 *   Android (signalxjs/lynx#1084).
 * - **reject, failing the build** — the recipe depends on a web runtime
 *   mechanism with no lynx equivalent (`var(--press-x)` and the other
 *   `RUNTIME_PROPERTIES`) or on a value nothing can bake. Silence would ship
 *   a stylesheet that quietly never paints what the author wrote.
 */
import { RUNTIME_PROPERTIES } from '../../contract.js';

/** One translated/dropped declaration, recorded for `report.json`. */
export interface LynxFinding {
    /** The validator's `where` style: `recipe for "tabs"."tab"`, `tokens theme "dark"`, … */
    where: string;
    /** What was found — a state name, a selector key, a property. */
    what: string;
    /** What happened to it, in one sentence. */
    detail: string;
    /** The anatomy scope, when the finding is about a recipe. */
    scope?: string;
    /** The ecosystem package owning `scope`, when a discovered pack does. */
    package?: string;
}

/** The capability report the lynx target folds into `report.json`. */
export interface LynxCapabilityReport {
    translated: LynxFinding[];
    dropped: LynxFinding[];
}

export const emptyReport = (): LynxCapabilityReport => ({ translated: [], dropped: [] });

/**
 * Interaction states on lynx: the runtime stamps `zx-f-*` classes from its
 * own press/focus behaviors (zero publishes `focus-visible` and `pressed` as
 * contract flags; plain `focus` exists only on inputs). `hover` has no
 * pointer to translate to — dropped with a report entry. The web target's
 * `INTERACTION_STATES` pseudo-classes are unreachable here by construction.
 */
export const INTERACTION_STATE_CLASSES: Record<string, string | null> = {
    hover: null,
    focus: 'zx-f-focus',
    'focus-visible': 'zx-f-focus-visible',
    active: 'zx-f-pressed',
};

/**
 * A reference to a runtime-published property (`var(--press-x)` …) — the
 * web-only mechanism the contract's `RUNTIME_PROPERTIES` doc names. Matching
 * the bare property too (not only `var()`) so a recipe *writing* one of these
 * on lynx is caught as well; both spellings depend on the same absent
 * runtime.
 */
const RUNTIME_PROPERTY_PATTERN = new RegExp(
    `(?:^|[^a-zA-Z0-9-])(${RUNTIME_PROPERTIES.map((p) => p.replace(/[-]/g, '\\-')).join('|')})(?![a-zA-Z0-9-])`,
);

/** The runtime property a declaration value/name references, if any. */
export function runtimePropertyIn(text: string): string | undefined {
    return RUNTIME_PROPERTY_PATTERN.exec(text)?.[1];
}

/**
 * The lynx emitter's refusal of a web-runtime property, as a type.
 *
 * It is the one lynx rejection a caller may legitimately treat as "this scope
 * is web-only" rather than "this build is broken" — ecosystem composition
 * degrades a discovered pack on it. Distinguishing it by class rather than by
 * matching the message keeps that decision from silently widening to every
 * lynx failure (an unknown component, a dangling var) the moment a message is
 * reworded.
 */
export class LynxRuntimePropertyError extends Error {
    override readonly name = 'LynxRuntimePropertyError';
    constructor(message: string, readonly property: string) {
        super(message);
    }
}

/**
 * Color functions lynx cannot parse; every occurrence must bake or reject.
 * Kept in lockstep with `COLOR_FN_START` below — a function only one of the
 * two knows either bypasses baking (leaks into emitted CSS) or bakes without
 * ever being flagged; the capabilities test pins the two lists equal.
 *
 * Case-insensitive, here and in every other function pattern in this file:
 * CSS function names are ASCII case-insensitive, so `OKLCH(…)` is the same
 * function to a browser and would otherwise walk straight past the gate.
 */
const COLOR_FUNCTION_PATTERN = /\b(?:oklch|oklab|lch|lab|color-mix|light-dark|color|hwb)\(/i;

export const hasUnsupportedColorFunction = (value: string): boolean =>
    COLOR_FUNCTION_PATTERN.test(value);

/**
 * CSS Values 4 comparison functions, which lynx's engine does not implement.
 *
 * `min()` was measured failing on device in both the shapes daisyUI uses —
 * `min(var, var)` and `min()` nested inside `calc()` — with the declaration
 * dropped and the element laid out as though it had never been written
 * (signalxjs/lynx#1066, iPhone 16 Pro / iOS 18.3). `max()` and `clamp()` are
 * the same spec feature; no engine has ever shipped one of the three without
 * the others, so they are refused on that evidence rather than each waiting
 * for its own probe.
 *
 * Dropped rather than folded. A folder would need to be unit-aware, and the
 * motivating case defeats it anyway: daisy's switch radius mixes `rem` (the
 * theme's radii) with `px` (`--border`), which cannot reduce to a single
 * literal without assuming a root font size. A recorded drop tells the design
 * system to supply a lynx replacement; emitting it anyway ships a declaration
 * that never applies, which is precisely the failure mode this target was
 * already bitten by.
 */
const COMPARISON_FUNCTION_PATTERN = /\b(?:min|max|clamp)\(/i;

export const hasComparisonFunction = (value: string): boolean =>
    COMPARISON_FUNCTION_PATTERN.test(value);

/**
 * The colour baking itself — `bakeColor`, `bakeColorValue`, `bakeSoft`,
 * `foldConstantCalc` — lives in `../../resolve/color-bake.ts` since #403:
 * the static contrast matrix resolves the same `oklch()` / `color-mix()` /
 * `light-dark()` values per theme that this target bakes to literals, and
 * one evaluator serving both is what keeps a recipe's lynx paint and its
 * audited web paint from ever disagreeing about a colour. Re-exported here
 * so this target's consumers and tests keep their import.
 */
export { bakeColor, bakeColorValue, bakeSoft, foldConstantCalc } from '../../resolve/color-bake.js';
