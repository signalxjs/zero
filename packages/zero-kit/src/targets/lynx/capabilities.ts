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
 * Fifth round of on-device measurement (signalxjs/lynx#1183, iPhone 17 Pro /
 * iOS 26 simulator + Android emulator, lynx main `96e6c678` with
 * `@sigx/zero-daisyui` 0.9.0):
 *
 * - **`rem` resolves to 14px, not 16px.** Lynx resolves `rem` against the
 *   engine's default page font size, `DEFAULT_FONT_SIZE_DP 14`
 *   (`core/renderer/tasm/config.h`, via `LynxEnvConfig::DefaultFontSize()`),
 *   and nothing a stylesheet can declare moves it. Every rem-based size
 *   therefore drew 12.5% small: daisy's button ramp
 *   (`calc(var(--size-field) * 6..14)`) measured 21/28/35/42/49 instead of
 *   24/32/40/48/56, and a 10rem probe bar drew ~140dp instead of 160.
 *   Design systems are authored against the web's 16px rem, so the emitter
 *   rewrites every `rem` length to `px` at {@link LYNX_REM_PX} — in token
 *   values, declarations, `calc()` operands, raw `targets.lynx.css` and
 *   keyframes alike (`remToPx`). A translate, not a drop: the result is the
 *   size the author wrote. The px it produces also takes part in the engine's
 *   OS font scale, which scales px on font-relevant properties
 *   (font-size, line-height) only — the same contract a px-authored skin
 *   always had.
 *
 * Sixth round (signalxjs/lynx#1215–#1216, iPhone 17 Pro / iOS 26 simulator,
 * lynx main `c78a16af` with `@sigx/zero-daisyui` 0.12.0):
 *
 * - **An SVG data-URI image fails to decode on iOS.** Lynx hands a
 *   `background-image: url("data:image/svg+xml,…")` to SDWebImage, which
 *   cannot decode it (daisy's `--fx-noise` tile, an `feTurbulence` filter):
 *   `Load backgroundImage failed` / `Downloaded image decode failed`, raised
 *   as a level-error image failure — the dev client's red error screen on
 *   every checkbox and radio section, 28 of 28 shots. Every value carrying
 *   one is refused with a report entry: a token defining it, and every
 *   declaration reading it directly or through such a token. The texture is
 *   decorative (daisy paints it at `--noise`, 0 by default).
 * - **`clip-path` is not applied.** daisy's checkbox tick — a rotated box cut
 *   to an L by `clip-path: polygon(…)` — drew as the unclipped rotated
 *   square, a solid diamond. Every `clip-path` declaration is dropped with a
 *   report entry (the other basic shapes are unmeasured and get the same
 *   verdict until a probe says otherwise); the recipe's lynx section draws
 *   the shape another way (the checkbox tick is two borders on a rotated box).
 *
 * Seventh round (signalxjs/lynx#1250, iPhone 17 Pro / iOS 26 simulator +
 * Android emulator, lynx main `bc0d9186` with `@sigx/zero-daisyui` 0.14.0):
 *
 * - **The logical sizing properties (`block-size`, `inline-size` and their
 *   `min-`/`max-` variants) are ignored on lynx.** daisy's divider draws its
 *   rule thickness only through `block-size`/`inline-size`, so the bare rule
 *   painted nothing, labelled segments grew to the label row's height and
 *   the size ramp did nothing. Lynx has no writing modes — every flow is
 *   horizontal-tb, the same reason the logical spacing spellings are
 *   restated physically (#1084) — so `block-size` IS `height` and
 *   `inline-size` IS `width`. The emitter rewrites them
 *   ({@link LOGICAL_SIZE_PROPERTIES}) in declarations, raw
 *   `targets.lynx.css` and keyframes bodies: a translate, not a drop.
 *
 * Three verdicts:
 *
 *
 * - **translate** — silently, because the result is semantically equivalent:
 *   interaction states onto the runtime-stamped flag classes, `selectors:`
 *   keys that are attribute compounds on `&` (`[data-pressed]`,
 *   `[data-state="open"]`, …) onto the flag/state classes the anatomy
 *   declares — with `:not([data-disabled])` elided beside `pressed`, which
 *   the lynx runtime never stamps on a disabled part (zero#326) — anatomy pseudo
 *   parts onto real part classes, color functions onto culori-baked literals,
 *   `@layer` onto source order, `--text-fixed-*` onto materialized literals,
 *   `rem` onto `px` at 16px/rem (signalxjs/lynx#1183), the logical sizing
 *   properties onto `width`/`height` (signalxjs/lynx#1250).
 * - **drop, with a report entry** — the declaration cannot exist on lynx and
 *   losing it is legible styling degradation an author may want to patch in
 *   a lynx recipe section: `hover` states, pseudo-element `selectors:` keys,
 *   `@starting-style`, `@media`/`@supports` conditions, any `selectors:` key
 *   the class grammar cannot express — any declaration valued with
 *   `currentColor`, which never resolves on device (signalxjs/lynx#1079) —
 *   and any logical inset/margin/padding spelling or standalone
 *   `translate`/`rotate`/`scale` property, which resolve on iOS but not on
 *   Android (signalxjs/lynx#1084) — and any SVG data-URI image or
 *   `clip-path`, which iOS fails to decode / does not apply
 *   (signalxjs/lynx#1215, #1216).
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

/** Finds the runtime-published property a declaration name/value references, if any. */
export type RuntimePropertyMatcher = (text: string) => string | undefined;

/**
 * A matcher for references to runtime-published properties
 * (`var(--press-x)` …) — the web-only mechanism the contract's
 * `RUNTIME_PROPERTIES` doc names. Built from a name set so a build can pass
 * `runtimePropertiesOf(manifest)`, which adds what an ecosystem fragment
 * declares (#456). Matching the bare property too (not only `var()`) so a
 * recipe *writing* one of these on lynx is caught as well; both spellings
 * depend on the same absent runtime.
 */
export function runtimePropertyMatcher(names: Iterable<string>): RuntimePropertyMatcher {
    const list = [...new Set(names)];
    // Longest first so a name that prefixes another can never win the
    // alternation early; the lookarounds already bound it, but the order
    // makes the reported name the whole one either way.
    list.sort((a, b) => b.length - a.length);
    if (list.length === 0) return () => undefined;
    const pattern = new RegExp(
        `(?:^|[^a-zA-Z0-9-])(${list.map((p) => p.replace(/[-]/g, '\\-')).join('|')})(?![a-zA-Z0-9-])`,
    );
    return (text) => pattern.exec(text)?.[1];
}

/** The matcher over zero's own `RUNTIME_PROPERTIES` — what a caller without a manifest gets. */
const DEFAULT_MATCHER = runtimePropertyMatcher(RUNTIME_PROPERTIES);

/** The runtime property a declaration value/name references, if any. */
export function runtimePropertyIn(text: string, match: RuntimePropertyMatcher = DEFAULT_MATCHER): string | undefined {
    return match(text);
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
 * An SVG data-URI image — `url("data:image/svg+xml,…")`, quoted or not,
 * base64 or not. iOS Lynx hands it to SDWebImage, which cannot decode it
 * (measured, signalxjs/lynx#1215: daisy's `--fx-noise` tile, an
 * `feTurbulence` filter, failed with `Downloaded image decode failed` and
 * raised the dev client's red error screen). Raster data URIs (`image/png`)
 * decode and are not matched.
 */
const SVG_DATA_URI = /url\(\s*["']?\s*data:image\/svg\+xml/i;

export const hasSvgDataUri = (value: string): boolean => SVG_DATA_URI.test(value);

/** The report detail for a refused SVG data-URI image, shared by both emitters. */
export const SVG_DATA_URI_DETAIL = 'an SVG data-URI image fails to decode on iOS lynx — SDWebImage reports "Downloaded image decode failed" as a level-error image failure, the dev client\'s red error screen (measured, signalxjs/lynx#1215); dropped — the image is dropped with it, supply a raster or a lynx replacement in the recipe\'s lynx target section if it is not decorative';

/**
 * `clip-path` — measured not applied on iOS (signalxjs/lynx#1216: daisy's
 * checkbox tick, a rotated box cut to an L by `polygon()`, drew as the
 * unclipped square). Dropped wherever it appears, with a report entry.
 */
export const CLIP_PATH_DETAIL = 'clip-path is not applied on lynx (measured on iOS, signalxjs/lynx#1216 — daisy\'s polygon-cut checkbox tick drew as the unclipped rotated square); dropped, draw the shape another way (borders, radii, transforms) in the recipe\'s lynx target section';

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

/**
 * The px one `rem` is rewritten to on this target: the web's (and every
 * design system's authoring) default root font size. Lynx's own rem is the
 * engine's 14px default page font size (measured, signalxjs/lynx#1183).
 */
export const LYNX_REM_PX = 16;

/**
 * A `rem` length: an optionally signed number (integer, decimal or leading
 * dot, optional exponent) followed by `rem`, standing alone as a token — not
 * the tail of an identifier (`--gap-2rem`, `.zx-a-size-2rem`, `p2rem`) and
 * not followed by more identifier characters. Case-insensitive, as CSS units
 * are.
 */
const REM_LENGTH = /(?<![\w.+-])([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)rem(?![\w-])/gi;

/**
 * `url(…)` and quoted strings: text a unit rewrite must never touch. A quoted
 * url is consumed as its string, so a `)` inside it (a data URI's
 * `filter='url(%23a)'`) cannot end the span early; strings stop at a newline
 * as CSS strings do, so a stray quote cannot swallow the rest of the sheet.
 */
const OPAQUE_SPAN = /url\(\s*(?:"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|[^)'"]*)\s*\)|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/gi;

/** A px count without binary-float noise: 0.875 × 16 is 14, not 13.999…. */
const formatPx = (px: number): string => {
    const rounded = Number(px.toFixed(4));
    return `${Object.is(rounded, -0) ? 0 : rounded}px`;
};

/**
 * Rewrite every `rem` length in emitted lynx CSS to `px` at
 * {@link LYNX_REM_PX} (signalxjs/lynx#1183: lynx resolves 1rem = 14px).
 *
 * Runs over finished stylesheet text — both emitters apply it last, so
 * token values, recipe declarations, `calc()` operands, raw lynx css and
 * keyframes bodies are all covered by one pass and no emission path can
 * forget it. `url()` and quoted strings are skipped. Returns the text and
 * how many lengths it rewrote, so the caller can record the translation.
 */
export function remToPx(css: string): { css: string; count: number } {
    let count = 0;
    const rewrite = (text: string): string => text.replace(REM_LENGTH, (_whole, num: string) => {
        count++;
        return formatPx(Number(num) * LYNX_REM_PX);
    });
    let out = '';
    let last = 0;
    for (const match of css.matchAll(OPAQUE_SPAN)) {
        out += rewrite(css.slice(last, match.index)) + match[0];
        last = match.index + match[0].length;
    }
    out += rewrite(css.slice(last));
    return { css: out, count };
}

/**
 * The logical sizing properties and the physical property each one IS on
 * lynx. Lynx ignores the logical spellings (measured, signalxjs/lynx#1250 —
 * daisy's divider, whose thickness is only `block-size`/`inline-size`, drew
 * no rule at all) and has no writing modes, so the block axis is always the
 * vertical one: `block-size` is `height`, `inline-size` is `width`.
 */
export const LOGICAL_SIZE_PROPERTIES: Readonly<Record<string, string>> = {
    'block-size': 'height',
    'inline-size': 'width',
    'min-block-size': 'min-height',
    'min-inline-size': 'min-width',
    'max-block-size': 'max-height',
    'max-inline-size': 'max-width',
};

/** The report detail for a rewritten logical sizing property, shared by every emission path. */
export const LOGICAL_SIZE_DETAIL = 'lynx ignores the logical sizing properties (measured, signalxjs/lynx#1250 — daisy\'s divider drew no rule) and has no writing modes, so the block axis is always vertical; rewritten to the physical property it names there';

/**
 * A logical sizing property in RAW CSS TEXT (`targets.lynx.css`, keyframes
 * bodies), in declaration position: anchored so a custom property
 * (`--divider-inline-size:`) or a longer name (`contain-intrinsic-block-size`)
 * cannot match.
 */
const LOGICAL_SIZE_IN_TEXT = /(^|[{;\s])((?:min-|max-)?(?:block|inline)-size)(\s*:)/gi;

/**
 * Rewrite every logical sizing declaration in raw lynx CSS text to its
 * physical property (signalxjs/lynx#1250). Returns the text and how many it
 * rewrote, so the caller can record the translation.
 */
export function logicalSizeToPhysical(css: string): { css: string; count: number } {
    let count = 0;
    const rewrite = (text: string): string => text.replace(LOGICAL_SIZE_IN_TEXT, (_whole, head: string, prop: string, colon: string) => {
        count++;
        return `${head}${LOGICAL_SIZE_PROPERTIES[prop.toLowerCase()]!}${colon}`;
    });
    // `url()` and quoted strings are opaque, as in `remToPx`: a `content`
    // string or a data URI spelling `inline-size:` is not a declaration.
    let out = '';
    let last = 0;
    for (const match of css.matchAll(OPAQUE_SPAN)) {
        out += rewrite(css.slice(last, match.index)) + match[0];
        last = match.index + match[0].length;
    }
    out += rewrite(css.slice(last));
    return { css: out, count };
}
