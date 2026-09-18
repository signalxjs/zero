/**
 * State-matrix contrast audit — the dynamic half of the split-pair problem
 * (signalxjs/zero#116, #118, #119).
 *
 * The token validator contrast-checks declared role PAIRS; it cannot see what
 * the recipe cascade produces when states combine. This audit can. It runs two
 * matrices over the same colour math:
 *
 * 1. **text legibility** — for every part whose anatomy hints text, in every
 *    renderable state combination (each `data-state` value, each boolean flag,
 *    each state × flag pair), across every design system × theme, it renders
 *    the attribute combination against the compiled CSS and checks the computed
 *    text color against the effective background;
 * 2. **indicator paint** (signalxjs/zero#228) — the same check for parts whose
 *    entire job is paint rather than text: the checkbox tick, the radio dot,
 *    the switch thumb, the progress range, the select/tree chevrons, the
 *    rating star. Text legibility cannot see these at all — an indicator
 *    declares `tokens: ['color']`, never `['text']` — which is how Material's
 *    radio dot shipped at 1.02:1 (#211): pure white painted over an unfilled
 *    control on a 99%-white page.
 *
 * `disabled` has its own, lower floor in both matrices (#207). Dimming below
 * AA is the point of the state, so it does not answer to the 3:1 floor — but
 * "dimmed" is not "gone", and readings that were produced and then dropped let
 * a 1.05:1 label pass silently. See `DISABLED_FLOOR`, and `inGroup` for the
 * separation it rests on.
 *
 * Both matrices also carry the design system's own axis surface (#207): a
 * design system whose colour vocabulary rides on `data-variant` — HeroUI's
 * `danger-soft`, carbon's `danger-ghost` — has no colour to measure at all
 * until the attribute is set. See `axisCellsFor` for the cell product and why
 * `size` is not part of it.
 *
 * What this deliberately does NOT cover:
 * - interaction pseudo-classes (`:hover`, `:focus-visible`) — attributes
 *   can't force them; those styles are exercised by the interaction specs;
 * - the axis surface of scopes that wire no `variant` — a bare `data-color`
 *   selects role tokens whose pairing the token validator already checks
 *   statically, and `data-size` moves metrics, not ink. See `axisCellsFor`;
 * - part nesting beyond what the anatomy's part tree declares — a text part
 *   below its scope's carrier and every indicator render inside the ancestor
 *   chain the tree derives (`PartSpec.parent`, #317), on the app surface
 *   (base-100/base-content); a part with no path to the carrier is a
 *   one-element probe on that surface, the same backdrop the real surfaces
 *   sit on in every shipped design system;
 * - `box-shadow`, in the INDICATOR matrix. A shadow is the one delineation the
 *   reader can lose: `forced-colors: active` strips it outright. A mark whose
 *   only separation from its backdrop is a shadow (basic/daisyUI/HeroUI all
 *   ringed the switch's off-thumb that way) is a mark that disappears in high
 *   contrast mode, so this audit does not count it. `border-color` IS counted —
 *   see `borderInk`: since #232, marks are drawn geometry, and for two of the
 *   six the stroke is the whole shape rather than a ring around a fill.
 *
 * Chromium-only: the math is engine-independent (computed colors resolved
 * through a canvas pixel, so oklch()/oklab()/color-mix() outputs all work),
 * so one engine is enough and the forced-colors/reduced-motion projects
 * would only distort it.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test, expect, type Page } from '@playwright/test';
// Not a hand copy, and since #403 (slice D) not a copy at all: the cell
// product — which parts are measured, in which state combinations, through
// which ancestor chain, under which key — is IMPORTED from `@sigx/zero-kit`,
// where the static contrast matrix consumes the same functions. Two products
// would let the browser and the static reader agree with each other while
// both drifting from the third thing, the CSS (#297); one product is what
// makes the parity block below a comparison rather than a coincidence.
import {
    AA,
    AXIS_CELL_BUDGET,
    DISABLED_FLOOR,
    FLOOR,
    INDICATORS,
    REFERENCE_MEDIA,
    auditDesignSystem,
    axisCellsFor,
    carrierPart,
    cellKey,
    chainFor,
    colourBearingAxes,
    derivedChainAncestors,
    indicatorCellsFor,
    textCells,
    uncoveredPaintParts,
} from '@sigx/zero-kit';
import type {
    AuditRuleId,
    Cell,
    ContrastCell,
    DesignSystemInput,
    DesignSystemManifest,
    IndicatorCell,
    ManifestComponent as KitManifestComponent,
    ManifestPart as KitManifestPart,
} from '@sigx/zero-kit';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/**
 * No touch emulation here. The chromium project turns it on for the
 * press-feedback spec, and Chromium answers `(hover: hover)` / `(pointer:
 * fine)` differently once a touchscreen exists — which is not the page the
 * static matrix models (`REFERENCE_MEDIA`) and not one this spec ever
 * touches. The `reference media` test below is what notices if the two
 * drift apart again.
 */
test.use({ hasTouch: false });
const read = (p: string): string => readFileSync(join(root, p), 'utf8');

/**
 * The anatomy's own types, not a local restatement of them. `hiddenIn` and
 * `selectors` were missing from the copy this replaces, which is the ordinary
 * way a hand-maintained mirror rots: nothing fails, the extra facts are simply
 * invisible to the file that needed them (#297).
 */
type ManifestPart = KitManifestPart;
type ManifestComponent = KitManifestComponent;

const anatomy: { components: ManifestComponent[] } = JSON.parse(read('packages/zero/dist/manifest.json'));
const baseCss = read('packages/zero/css/base.css');

const DESIGN_SYSTEMS = ['basic', 'daisyui', 'material', 'brutalist', 'heroui', 'carbon'] as const;

/** A design system's compiled input, loaded from its built `dist/` — see `staticMatrix`. */
type DesignSystemModule = { designSystem: DesignSystemInput };

/**
 * The text cells every design system measures — every text-bearing part of
 * every component, in every renderable combination, chained below its
 * scope's carrier where the part tree says so (`textCells` in the kit; the
 * probe used to render every text part alone on the app surface, and the
 * static reader showed why that was a blind spot — a recipe's component
 * tokens are declared on the CARRIER, so a lone `trigger` reads them as
 * nothing and inherits a pass).
 */
const cells: Cell[] = textCells(anatomy.components);

/**
 * Combinations this audit does not currently assert. Keep this list SHORT and
 * commented — every entry is either a claim that low contrast is the design,
 * or, as today, DEBT: a cell whose failure is real, filed, and scheduled, held
 * out only so the gate can land ahead of the fixes.
 *
 * A debt entry names its issue and is deleted by the PR that closes it. It is
 * not a decision about the cell.
 *
 * Entries are exact `cellKey` strings on purpose — one key, one cell. Never
 * widen one to a scope or a theme: that would swallow the next regression in
 * the same neighbourhood, which is the failure mode an allowlist has.
 *
 * The list is guarded from both sides, because neither guard alone is enough:
 * `allowlist coverage` fails an entry that names no cell, and `staleEntries`
 * fails one whose cell now passes. Add carelessly and the first catches you;
 * forget to remove and the second does.
 */
const INTENDED_LOW_CONTRAST = new Set<string>([
    // Empty, and worth keeping that way. Both original entries were debt
    // rather than decisions — heroui's `pending` fade (#263) and daisyui's
    // nord placeholder (#264) — and both are now fixed at the source rather
    // than suppressed here.
]);

/**
 * The floors. `FLOOR` is WCAG's non-text/large-text minimum and what every
 * asserting cell answers to; `AA` is the body-text target, warned about rather
 * than asserted, because a 3.2:1 label is a finding and not yet a build break.
 *
 * `DISABLED_FLOOR` is the state's own, lower bar, and it is measured on the
 * IN-GROUP ratio (see `inGroup`) rather than on what the reader finally sees.
 *
 * The split is the whole point. A disabled control is supposed to recede, and
 * all six design systems do it the same way: one `opacity` between 0.25 and
 * 0.5 on the whole control. That fade is uniform, deliberate and the state
 * working — measured through it, every disabled cell in every design system
 * lands between 1.3:1 and 2:1, which is a statement about `--disabled-opacity`
 * and not about any recipe. What IS a recipe decision is the colour pair
 * chosen underneath the fade, and that is the reading #207 found being
 * produced and then dropped: a `disabled` label painted `base-300` on
 * `base-200` measures 1.05:1 before any fade, and used to pass in silence.
 * So the pair is asserted at 2:1 and the faded reality is annotated beside it.
 *
 * **Do not "fix" this back to the post-fade reading.** It was tried, and it
 * fails 440 cells across 20 of the 30 matrix tests — every disabled cell in every
 * design system, because each one dims by the same uniform token. A test that
 * red across the board on one design decision is not measuring recipes; it is
 * legislating `--disabled-opacity` from inside an e2e spec. WCAG 1.4.3 agrees
 * on the substance: inactive user-interface components are exempt from the
 * contrast minimum. The colour pair underneath is not, and that is what this
 * floor holds.
 */
// `FLOOR`, `AA` and `DISABLED_FLOOR` are the kit's — the static matrix
// answers to the same three numbers, which is what makes the parity block a
// comparison of readings and not of policies.

/**
 * The half of an allowlist nobody ever does. `allowlist coverage` proves an
 * entry NAMES a real cell; this proves it is still NEEDED — a suppression whose
 * cell now clears its floor is dead weight, and dead weight is how an allowlist
 * stops being a list of exceptions and becomes a hole in the gate. The recipe
 * fix lands, the entry stays, and the next regression on that exact cell is
 * silently absorbed by a comment citing an issue that closed months ago.
 *
 * It cannot be a static check: only the browser knows a ratio. So each matrix
 * runs it over its OWN readings, against the same floor the cell would have
 * answered to had it not been listed — `DISABLED_FLOOR` on the in-group pair
 * for a `disabled` cell, `FLOOR` on what the reader sees for everything else.
 *
 * `measured` is the caller's answer to "did this cell produce a reading at
 * all" — `unrendered` in the text matrix, `unpainted` in the indicator one.
 * Nothing painted is NOT evidence the entry can go: a cell with no reading has
 * no ratio to clear a floor with, and reporting it stale would trade a dead
 * suppression for a deleted one that was still doing work.
 *
 * It reads the SAME rounded number the failure buckets read, and that is the
 * point rather than an oversight. `failures` asks `ratio < FLOOR` and this asks
 * `ratio >= FLOOR`: exact complements over one value, so every measured cell is
 * in exactly one of "still failing" and "safe to delete". Giving this side an
 * epsilon would open the gap it looks like it closes — a cell that still fails
 * when unlisted while also being reported stale, which no edit can satisfy.
 * Move the rounding and both sides move together; that is the invariant.
 */
interface Suppressible {
    key: string;
    ratio: number;
    inGroup: number;
    disabled: boolean;
}

function staleEntries<R extends Suppressible>(readings: R[], measured: (r: R) => boolean): string[] {
    return readings
        .filter((r) => INTENDED_LOW_CONTRAST.has(r.key) && measured(r))
        .filter((r) => (r.disabled ? r.inGroup >= DISABLED_FLOOR : r.ratio >= FLOOR))
        .map((r) => (r.disabled
            ? `${r.key} → ${r.inGroup}:1 before the state's fade, clearing the ${DISABLED_FLOOR}:1 disabled floor`
            : `${r.key} → ${r.ratio}:1, clearing the ${FLOOR}:1 floor`));
}

const STALE_MESSAGE =
    'INTENDED_LOW_CONTRAST entries whose cell now passes on its own — the suppression is doing nothing. '
    + 'Delete each listed key from INTENDED_LOW_CONTRAST and close the issue its comment cites; '
    + 'left in place it silently absorbs the next regression on that exact cell.';

// `cellKey` is the kit's: `ds/theme/scope/part/state/flag/axes`, seven
// segments of vocabulary, and the key the static matrix reports under — the
// parity block joins the two matrices on it.

// ── The axis surface (#207) ─────────────────────────────────────────────────
//
// `axisCellsFor`, `colourBearingAxes` and `derivedChainAncestors` are the
// kit's, docblocks and all. The reasoning that used to live here — why the
// gate is `variant` and not `color`, why `size` is not in the product, why
// modifiers are taken one at a time, why a chained cell keeps only its
// resting combos, and why the chains are DERIVED from the part tree rather
// than hand-listed — is on the functions in `zero-kit/src/audit/contrast/cells.ts`.

// ── Colour math, shared by both matrices ────────────────────────────────────

type RGB = [number, number, number];

interface ColorMath {
    /** Resolve any computed CSS color to sRGB, composited over `under`. */
    resolve(color: string, under?: RGB): RGB;
    /** `over` seen through `t` opacity on top of `under`. */
    blend(over: RGB, under: RGB, t: number): RGB;
    contrast(a: RGB, b: RGB): number;
    alphaOf(color: string): number;
    hasInk(color: string): boolean;
}

declare global {
    interface Window { zeroColorMath: ColorMath }
}

/**
 * Installed into the page once per test. Both matrices resolve colors through
 * the same 1x1 canvas: assigning `fillStyle` is the only reliable way to turn
 * `oklch()` / `color-mix()` / `lab()` output into sRGB, and reading the pixel
 * back composites semi-transparent ink for free.
 */
function installColorMath(): void {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const resolve = (color: string, under?: RGB): RGB => {
        ctx.clearRect(0, 0, 1, 1);
        if (under) {
            ctx.fillStyle = `rgb(${under[0]} ${under[1]} ${under[2]})`;
            ctx.fillRect(0, 0, 1, 1);
        }
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        return [r, g, b];
    };
    const blend = (over: RGB, under: RGB, t: number): RGB => [
        Math.round(under[0] + (over[0] - under[0]) * t),
        Math.round(under[1] + (over[1] - under[1]) * t),
        Math.round(under[2] + (over[2] - under[2]) * t),
    ];
    const luminance = ([r, g, b]: RGB): number => {
        const lin = (c: number): number => {
            const s = c / 255;
            return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    };
    const contrast = (a: RGB, b: RGB): number => {
        const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
        return (l1 + 0.05) / (l2 + 0.05);
    };
    /**
     * Exact alpha via canvas normalization: assigning fillStyle
     * canonicalizes any CSS color to `#rrggbb` (opaque) or
     * `rgba(r, g, b, a)` — no string-sniffing the many spellings
     * of transparent.
     */
    const alphaOf = (c: string): number => {
        ctx.fillStyle = '#000';
        ctx.fillStyle = c;
        const s = String(ctx.fillStyle);
        if (s.startsWith('#')) return 1;
        const m = /rgba?\([^)]*[,\s/]\s*([\d.]+)\s*\)$/.exec(s);
        return m ? parseFloat(m[1]) : 1;
    };
    window.zeroColorMath = { resolve, blend, contrast, alphaOf, hasInk: (c) => alphaOf(c) > 0 };
}

// ── The indicator matrix (#228) ─────────────────────────────────────────────
//
// The selection rule (`PAINT_ONLY_PART`), the hand opt-ins and the `glyph` /
// `only` facts are the kit's `INDICATORS` table (`zero-kit/src/audit/contrast/
// paint-parts.ts`), with the ancestor chains DERIVED from the anatomy's part
// tree — every containing part up to the top, popup ancestors pinned open.
// The hand-listed chains this file used to carry were pinned equal to the
// derived ones, row for row, in the kit's `contrast-static.test.ts` before
// they were retired here; one entry (`menu`) keeps a hand chain, because the
// anatomy names the containing popup while the mark sits on a host ROW the
// tree does not know.
const indicatorCells: IndicatorCell[] = indicatorCellsFor(anatomy.components);

interface Reading {
    key: string;
    color: string;
    bg: string;
    /** What the reader sees — the group fade applied to ink and backdrop alike. */
    ratio: number;
    /** The colour pair the recipe chose, before the group fade. See DISABLED_FLOOR. */
    inGroup: number;
    disabled: boolean;
    /** Painted nowhere in this state (`display: none`, `opacity: 0`, …). */
    unrendered: boolean;
}

interface IndicatorReading {
    key: string;
    scope: string;
    part: string;
    /** Which layer carried the paint: the element's own fill, or a pseudo's. */
    carrier: string;
    ink: string;
    bg: string;
    /** What the reader sees — the group fade applied to mark and backdrop alike. */
    ratio: number;
    /** The mark against what it is drawn on, before the group fade. See DISABLED_FLOOR. */
    inGroup: number;
    disabled: boolean;
    /** True when nothing is painted in this state — see `collapsed` below. */
    unpainted: boolean;
}

test('indicator coverage: every paint-only part has an ancestor chain', ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'one engine is enough');

    // The kit's own guard, as a function — the same selection rule and the
    // same table the static matrix measures.
    expect(
        uncoveredPaintParts(anatomy.components),
        'paint-only parts with no ancestor chain declared — add them to INDICATORS in the kit (or, if the web never renders them, to NOT_RENDERED_ON_WEB)',
    ).toEqual([]);
    // And not vacuously: the table must name the marks the six skins draw.
    expect(INDICATORS.length).toBeGreaterThanOrEqual(20);
});

/**
 * Every text-bearing part of a colour-bearing scope has to be REACHED — by the
 * one-element probe when it is the carrier, or through a chain the part tree
 * derives (rooted at the carrier by construction) when it is not.
 *
 * Before #297 this said something narrower and stricter: the carrier had to be
 * the only text-bearing part, full stop. That was the honest statement of what
 * the probe could render, and it is why thirteen of the fourteen `variant`
 * carriers could not be wired at all — `select`'s text lives in `trigger`,
 * `value` and `item`, none of which is the carrier. The rule is the same
 * ("nothing silently measures nothing"); what changed is that there is now a
 * way to say yes.
 *
 * A chain must be rooted at the carrier because that is where the compiler
 * anchors the selector. A chain rooted anywhere else would build a DOM the
 * emitted CSS never matches, and report the unvaried colour as a pass.
 */
test('axis coverage: every text-bearing part of a variant-wiring scope is reachable', ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'one engine is enough');

    const unreachable: string[] = [];
    for (const ds of DESIGN_SYSTEMS) {
        const manifest: DesignSystemManifest = JSON.parse(read(`packages/zero-${ds}/dist/manifest.json`));
        for (const [scope, wired] of Object.entries(manifest.components)) {
            const fused = Object.keys(colourBearingAxes(wired));
            if (fused.length === 0) continue;
            const component = anatomy.components.find((c) => c.scope === scope);
            if (!component) {
                unreachable.push(`${ds}/${scope} — the anatomy declares no such component`);
                continue;
            }
            const carrier = carrierPart(component);
            for (const part of component.parts) {
                if (!part.tokens?.includes('text')) continue;
                if (part.name === carrier) continue;
                if (!derivedChainAncestors(component, part)) {
                    unreachable.push(
                        `${ds}/${scope}/${part.name} — text below the carrier "${carrier}" with no parent path to it`,
                    );
                }
            }
        }
    }

    expect(
        unreachable,
        'variant surfaces nothing renders — declare the part tree (PartSpec.parent) down to the part, or the axis cells silently measure nothing',
    ).toEqual([]);
});

/**
 * The derivation itself, held to the same two checks the hand list used to
 * get: every derived chain resolves against the anatomy (a dangling parent or
 * a pin on a state the part lost throws in `chainFor`), and it is rooted at
 * the carrier by construction — asserted anyway, because the axis attributes
 * go on `nodes[0]` and a chain rooted anywhere else would measure the
 * unvaried colour and call it a pass.
 */
test('axis chains: every derived chain resolves against the anatomy, rooted at the carrier', ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'one engine is enough');

    let derived = 0;
    for (const component of anatomy.components) {
        const carrier = carrierPart(component);
        for (const part of component.parts) {
            if (part.name === carrier || !part.tokens?.includes('text')) continue;
            const ancestors = derivedChainAncestors(component, part);
            if (!ancestors) continue;
            derived += 1;
            expect(() => chainFor(component, [...ancestors, part.name])).not.toThrow();
            expect(
                ancestors[0]?.split('=')[0],
                `derived chain for ${component.scope}/${part.name} must be rooted at the carrier`,
            ).toBe(carrier);
        }
    }
    // The guard must not pass vacuously — select alone contributes three.
    expect(derived).toBeGreaterThanOrEqual(3);
});

/**
 * An allowlist entry that matches no cell suppresses nothing and says nothing
 * — it just sits there looking like coverage. A key is `ds/theme/scope/part/
 * state/flag/axes`, seven segments of vocabulary that all move, so a typo or a
 * renamed part is not a hypothetical.
 *
 * This is the half a browser cannot check: whether the STRING names a cell.
 * Whether the cell it names still needs suppressing is checked inside each
 * matrix, against real readings.
 */
test('allowlist coverage: every INTENDED_LOW_CONTRAST entry names a cell some matrix renders', ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'one engine is enough');

    const known = new Set<string>();
    for (const ds of DESIGN_SYSTEMS) {
        const manifest: DesignSystemManifest = JSON.parse(read(`packages/zero-${ds}/dist/manifest.json`));
        const dsCells: Cell[] = [...cells, ...axisCellsFor(manifest.components, anatomy.components), ...indicatorCells];
        for (const theme of manifest.themes) {
            for (const cell of dsCells) known.add(cellKey(ds, theme.name, cell));
        }
    }

    expect(
        [...INTENDED_LOW_CONTRAST].filter((key) => !known.has(key)),
        'INTENDED_LOW_CONTRAST entries matching no cell in either matrix — a mistyped or outdated key, which silences nothing',
    ).toEqual([]);
});

// ── Parity with the static matrix (#403, slice D) ───────────────────────────

/**
 * The static contrast matrix (`auditDesignSystem`'s `contrast/*` rules,
 * `zero-kit/src/audit/contrast/`) computes these two matrices from compiled
 * CSS, so a design system built outside this repo gets the same floors. This
 * spec is what keeps it honest: the browser is the ground truth, and every
 * cell the static reader CLAIMS — a verdict other than `unmeasured` — is held
 * to the browser's reading of the same cell, under the same key.
 *
 * Three things are compared, and a fourth is pinned:
 *
 * - the cell product is ONE product: a reading the static side does not list
 *   at all, or a static claim the browser has no reading for, is a
 *   disagreement (the two sides no longer measure the same cells);
 * - "painted at all" agrees: static `unrendered`/`unpainted` against the
 *   browser's `unrendered`/`unpainted`;
 * - the number agrees to `tolerance(ratio)` — canvas rounding and culori's
 *   oklch conversion differ in the last digit, not the first — and the floor
 *   verdict agrees (`< 3`, `< 2` on the in-group pair for `disabled`), except
 *   for a cell the browser puts within tolerance of the floor itself, which
 *   is annotated rather than failed: a 2.97 against a 3.02 is one reading,
 *   not two;
 * - and the measured SHARE is pinned per design system from both sides
 *   (`STATIC_COVERAGE`), so the estimate can neither retreat into
 *   `unmeasured` unnoticed nor quietly claim more than it did when the pin
 *   was set.
 *
 * The static side runs Node-side, once per design system per worker, from
 * the skin's built `dist/design-system.js` — the same artifact `zero:audit`
 * reads — so the comparison costs milliseconds and no browser time.
 */
const CONTRAST_RULES: AuditRuleId[] = ['contrast/text', 'contrast/indicator', 'contrast/unmeasured'];

/**
 * How far the two readings of one cell may differ before it is a
 * disagreement: `0.15`, or 2% of the ratio, whichever is larger.
 *
 * The absolute part is the last-digit noise of two different colour
 * pipelines (a canvas pixel against culori's oklch conversion). The relative
 * part is the canvas: it composites a translucent wash — `oklch(… / 0.06)`
 * over a dark surface — in 8-bit premultiplied arithmetic, so one channel of
 * the backdrop lands one unit off, and near black that one unit is a
 * measurable slice of the ratio's denominator. Measured at 11–16:1 the
 * two sides differ by 1.0–1.5%, in BOTH directions; a floor at 3:1 is
 * still held to 0.15. Widen this only with a reading in hand.
 */
const tolerance = (ratio: number): number => Math.max(0.15, ratio * 0.02);

/**
 * The measured share each design system's static matrix claims, in percent
 * of its cells across both matrices, pinned from BOTH ends: a run below the
 * pin means the estimate retreated into `unmeasured`; a run more than
 * `COVERAGE_HEADROOM` points above it means it now claims more than when the
 * pin was set — raise the pin, on purpose, having looked at what it newly
 * claims. Set from this gate's first green run: 802 / 1994 / 650 / 634 / 590 /
 * 590 cells per theme, with daisyui's 206 and heroui's 20 unmeasured.
 */
const STATIC_COVERAGE: Record<(typeof DESIGN_SYSTEMS)[number], number> = {
    basic: 100,
    // `+active` is `filter: brightness()`; the control fills carry daisy's
    // noise texture as a second background layer; the star preview brightens.
    // 89.7 → 89.6 with #446: NativeSelect's cells, every one of them
    // measured, left the denominator; the 206 unmeasured are unchanged.
    daisyui: 89.6,
    material: 100,
    brutalist: 100,
    // The half star is a hard-stop gradient on `::before`.
    heroui: 96.6,
    carbon: 100,
};
const COVERAGE_HEADROOM = 5;

const staticMatrices = new Map<string, Promise<Map<string, ContrastCell[]>>>();

/** The static matrix for one design system, keyed by theme — computed once per worker. */
function staticMatrix(ds: string): Promise<Map<string, ContrastCell[]>> {
    let pending = staticMatrices.get(ds);
    if (!pending) {
        pending = (async () => {
            // The skin's compiled input from its built `dist/` — by path, not
            // through the package entry, which registers themes with
            // `@sigx/zero` and has no business running under Node.
            const url = pathToFileURL(join(root, `packages/zero-${ds}/dist/design-system.js`)).href;
            const { designSystem } = (await import(url)) as DesignSystemModule;
            const result = auditDesignSystem(designSystem, anatomy, { rules: CONTRAST_RULES });
            return new Map(result.contrast.themes.map((t) => [t.name, t.cells]));
        })();
        staticMatrices.set(ds, pending);
    }
    return pending;
}

/** What both matrices agree a browser reading is: a ratio, its pre-fade pair, and whether anything was painted. */
interface BrowserReading {
    key: string;
    ratio: number;
    inGroup: number;
    disabled: boolean;
    /** `unrendered` in the text matrix, `unpainted` in the indicator one. */
    gone: boolean;
    /** What the browser painted with and on — for the disagreement line, so a miss is diagnosable from the log. */
    ink: string;
    bg: string;
}

interface Parity {
    /** Cells the static side claimed, i.e. everything but `unmeasured`. */
    claimed: number;
    disagreements: string[];
    /** Floor verdicts that differ where the browser reading is within tolerance of the floor. */
    nearFloor: string[];
}

/** The static cells of one matrix against the browser's readings of the same cells. */
function parity(matrix: 'text' | 'indicator', statics: ContrastCell[], readings: BrowserReading[]): Parity {
    const out: Parity = { claimed: 0, disagreements: [], nearFloor: [] };
    const cellsOf = statics.filter((c) => c.matrix === matrix);
    const staticKeys = new Set(cellsOf.map((c) => c.key));
    const byKey = new Map(readings.map((r) => [r.key, r]));
    const goneWord = matrix === 'text' ? 'unrendered' : 'unpainted';
    const sides = (c: ContrastCell, r: BrowserReading): string =>
        `[static ${c.carrier ? `${c.carrier} ` : ''}${c.ink ?? '?'} on ${c.bg ?? '?'}${c.detail ? ` (${c.detail})` : ''}; browser ${r.ink} on ${r.bg}]`;

    for (const r of readings) {
        if (!staticKeys.has(r.key)) out.disagreements.push(`${r.key} — the browser measures a cell the static matrix does not list at all`);
    }
    for (const c of cellsOf) {
        if (c.verdict === 'unmeasured') continue;
        out.claimed += 1;
        const r = byKey.get(c.key);
        if (!r) {
            out.disagreements.push(`${c.key} — static ${c.verdict}, the browser has no reading for this cell`);
            continue;
        }
        const staticGone = c.verdict === 'unrendered' || c.verdict === 'unpainted';
        if (staticGone !== r.gone) {
            out.disagreements.push(`${c.key} — static ${c.verdict}, browser ${r.gone ? goneWord : `${r.ratio}:1`} ${sides(c, r)}`);
            continue;
        }
        if (staticGone) continue;

        // `disabled` is judged on the pre-fade pair on both sides.
        const floor = r.disabled ? DISABLED_FLOOR : FLOOR;
        const sRatio = r.disabled ? c.inGroup : c.ratio;
        const bRatio = r.disabled ? r.inGroup : r.ratio;
        if (sRatio === undefined) {
            out.disagreements.push(`${c.key} — static ${c.verdict} carries no ratio`);
            continue;
        }
        const delta = Math.abs(sRatio - bRatio);
        const allowed = tolerance(bRatio);
        if (!(delta <= allowed)) {
            out.disagreements.push(`${c.key} — static ${sRatio}:1, browser ${bRatio}:1 (Δ ${delta.toFixed(2)} > ${allowed.toFixed(2)}) ${sides(c, r)}`);
            continue;
        }
        const staticFail = r.disabled ? c.verdict === 'disabled-fail' : c.verdict === 'fail';
        const browserFail = bRatio < floor;
        if (staticFail !== browserFail) {
            const line = `${c.key} — static ${c.verdict} at ${sRatio}:1, browser ${bRatio}:1 against the ${floor}:1 floor ${sides(c, r)}`;
            if (Math.abs(bRatio - floor) <= tolerance(floor)) out.nearFloor.push(line);
            else out.disagreements.push(line);
        }
    }
    return out;
}

/** Percent of a theme's cells (both matrices) the static side claimed, to one decimal. */
function measuredShare(statics: ContrastCell[]): number {
    const unmeasured = statics.filter((c) => c.verdict === 'unmeasured').length;
    return statics.length === 0 ? 0 : Math.round((1 - unmeasured / statics.length) * 1000) / 10;
}

/**
 * The static matrix evaluates `@media` against `REFERENCE_MEDIA` — the page
 * it assumes this spec renders. If the chromium project ever drifts from that
 * page (a viewport change, a touch emulation that flips `hover`), the parity
 * block would start disagreeing about `@media (min-width: …)` rules for a
 * reason that has nothing to do with either matrix; this names the cause.
 */
test('reference media: the chromium project renders the page the static matrix assumes', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'the static matrix models the chromium project only');

    await page.setContent('<p>probe</p>');
    const seen = await page.evaluate((media) => {
        const unmet: string[] = [];
        const unknown: string[] = [];
        for (const [feature, value] of Object.entries(media.discrete)) {
            const query = `(${feature}: ${value})`;
            if (matchMedia(query).matches) continue;
            // Media Queries 4: a feature the engine does not implement is
            // `unknown`, and `not unknown` is still unknown — so both the
            // query and its negation fail to match. A feature the engine
            // KNOWS and answers differently matches the negation.
            (matchMedia(`not ${query}`).matches ? unmet : unknown).push(query);
        }
        return { width: innerWidth, height: innerHeight, unmet, unknown };
    }, REFERENCE_MEDIA);

    // A feature this engine has not implemented cannot contradict the table;
    // it is on the record so the day it lands, its answer is looked at.
    for (const q of seen.unknown) testInfo.annotations.push({ type: 'reference-media-unknown', description: `${q} — not implemented by this engine` });
    expect(seen.width, 'viewport width must match REFERENCE_MEDIA.width').toBe(REFERENCE_MEDIA.width);
    expect(seen.height, 'viewport height must match REFERENCE_MEDIA.height').toBe(REFERENCE_MEDIA.height);
    expect(seen.unmet, 'media features the page answers differently — REFERENCE_MEDIA and the chromium project describe different pages').toEqual([]);
});

for (const ds of DESIGN_SYSTEMS) {
    const dsCss = read(`packages/zero-${ds}/dist/css/index.css`);
    const dsManifest: DesignSystemManifest = JSON.parse(read(`packages/zero-${ds}/dist/manifest.json`));
    const themes = dsManifest.themes;
    // The axis surface is per design system — a shared list cannot express
    // "carbon wires `danger-ghost` and heroui does not".
    const dsTextCells: Cell[] = [...cells, ...axisCellsFor(dsManifest.components, anatomy.components)];

    /** The app baseline every real app provides, plus the compiled DS CSS. */
    const stage = async (page: Page, theme: string): Promise<void> => {
        await page.setContent(
            `<style>${baseCss}\n${dsCss}</style>` +
            // Unlayered app baseline — what every real app provides.
            `<style>body { background: var(--color-base-100); color: var(--color-base-content); }</style>`,
        );
        await page.evaluate((themeName) => {
            document.documentElement.setAttribute('data-theme', themeName);
        }, theme);
        // Resting styles only, in BOTH matrices. A popup with
        // `@starting-style` + `transition` computes its ENTRY style
        // (`opacity: 0`) for the frame it is inserted in, and a part whose
        // recipe animates it in (`countdown`'s digits, from `opacity: 0`)
        // is mid-keyframe at that same instant — either reads as "not
        // painted" and the cell silently leaves the matrix. Killing
        // transitions and animations settles every probe immediately; entry
        // and exit motion is not what this audit measures anyway.
        await page.addStyleTag({
            content: '*, *::before, *::after { transition: none !important; animation: none !important; }',
        });
        await page.evaluate(installColorMath);
    };

    for (const theme of themes) {
        test(`contrast: ${ds} / ${theme.name}`, async ({ page }, testInfo) => {
            test.skip(testInfo.project.name !== 'chromium', 'one engine; canvas-resolved colors are engine-independent');

            await stage(page, theme.name);

            // The chained product is the one that grows without anyone
            // noticing, so it is counted out loud on every run and capped
            // hard. A silent cap reads as "covered everything" when it did not.
            const chainedCount = dsTextCells.filter((c) => c.chain).length;
            testInfo.annotations.push({
                type: 'axis-cell-count',
                description: `${ds}/${theme.name}: ${dsTextCells.length} text cells `
                    + `(${chainedCount} through a declared chain, budget ${AXIS_CELL_BUDGET})`,
            });
            expect(
                chainedCount,
                `chained axis cells exceed AXIS_CELL_BUDGET — raise it deliberately, with the wall-clock cost in hand`,
            ).toBeLessThanOrEqual(AXIS_CELL_BUDGET);

            const readings: Reading[] = await page.evaluate(({ cells }) => {
                const { resolve, blend, contrast, hasInk } = window.zeroColorMath;
                const bodyBg = resolve(getComputedStyle(document.body).backgroundColor, [255, 255, 255]);
                const num = (v: string): number => {
                    const n = parseFloat(v);
                    return Number.isFinite(n) ? n : 1;
                };
                const out: Reading[] = [];

                for (const cell of cells) {
                    /**
                     * A chained cell rebuilds its declared ancestors and
                     * measures the innermost node; an unchained one is the
                     * one-element probe this matrix has always used. Either
                     * way `el` is the measured element and `root` is what gets
                     * appended and removed.
                     *
                     * The ancestors carry `data-scope`/`data-part` and their
                     * `=state` pins ONLY. Their own states and flags are not
                     * varied: the cell's state/flag belongs to the measured
                     * part, and a chain that permuted every ancestor too would
                     * multiply the product by the very dimension `restingCombos`
                     * exists to bound.
                     */
                    const build = (part: string, tag: string): HTMLElement => {
                        const node = document.createElement(tag);
                        node.setAttribute('data-scope', cell.scope);
                        node.setAttribute('data-part', part);
                        return node;
                    };
                    const chain = cell.chain ?? [];
                    let root: HTMLElement;
                    let el: HTMLElement;
                    if (chain.length > 0) {
                        const nodes = chain.map((n) => {
                            const node = build(n.part, n.element === 'input' ? 'div' : n.element);
                            if (n.pin) node.setAttribute('data-state', n.pin);
                            return node;
                        });
                        for (let i = 1; i < nodes.length; i++) nodes[i - 1].appendChild(nodes[i]);
                        root = nodes[0];
                        el = nodes[nodes.length - 1];
                    } else {
                        root = el = build(cell.part, 'div');
                    }
                    if (cell.state) el.setAttribute('data-state', cell.state);
                    if (cell.flag) el.setAttribute('data-' + cell.flag, '');
                    // The design system's own axis surface: `data-variant`,
                    // `data-color` and any custom axis are all `data-<axis>`
                    // (VARIANT_AXES in `@sigx/zero-kit`), modifiers are
                    // presence-only under the `data-mod-` namespace.
                    //
                    // They go on the CHAIN ROOT, never on the probe: the
                    // compiler emits `[data-part="root"][data-variant="x"]
                    // [data-part="trigger"]`, so putting them on the measured
                    // element would select a rule that does not exist and
                    // report the unvaried colour as though the axis had been
                    // applied (#297).
                    for (const [axis, value] of Object.entries(cell.axes ?? {})) {
                        root.setAttribute('data-' + axis, value);
                    }
                    for (const mod of cell.mods ?? []) root.setAttribute('data-mod-' + mod, '');
                    el.textContent = 'Sample';
                    document.body.appendChild(root);

                    const cs = getComputedStyle(el);
                    /**
                     * Effective background: the part's own paint over what is
                     * behind it. For a chained cell that backdrop is the
                     * nearest painted ancestor rather than the page — a menu
                     * item sits on the popup's fill, and measuring it against
                     * base-100 would report a contrast nobody sees.
                     */
                    let behind = bodyBg;
                    for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
                        const nb = getComputedStyle(node).backgroundColor;
                        if (hasInk(nb)) { behind = resolve(nb, bodyBg); break; }
                    }
                    const ownBg = cs.backgroundColor;
                    const bg = hasInk(ownBg) ? resolve(ownBg, behind) : behind;
                    // Text renders over that background; semi-transparent ink
                    // (color-mix fades) composites before measuring.
                    const ink = resolve(cs.color, bg);
                    /**
                     * `opacity` makes the element a GROUP: its fill and its
                     * text composite against each other first, and only the
                     * finished group is faded over the page. So the fade is
                     * applied once, to ink and backdrop alike — the same
                     * accounting the indicator matrix does.
                     *
                     * It is load-bearing rather than pedantic. Every design
                     * system spells `disabled` as an `opacity` between 0.25 and
                     * 0.5, and HeroUI's `pending` modifier is `opacity: 0.7`;
                     * measured without this, those cells report the ratio of a
                     * state nobody is looking at.
                     */
                    const opacity = num(cs.opacity);
                    const seenInk = blend(ink, behind, opacity);
                    const seenBg = blend(bg, behind, opacity);
                    out.push({
                        key: cell.key,
                        color: cs.color,
                        bg: hasInk(ownBg) ? ownBg : (chain.length > 0 ? 'inherit(ancestor)' : 'inherit(base-100)'),
                        ratio: Math.round(contrast(seenInk, seenBg) * 100) / 100,
                        inGroup: Math.round(contrast(ink, bg) * 100) / 100,
                        disabled: cell.flag === 'disabled',
                        // Nothing painted is nothing to read — the text
                        // matrix's counterpart to the indicator matrix's
                        // `unpainted`, and the honest reading for a part a
                        // recipe hides in this state.
                        unrendered: cs.display === 'none' || cs.visibility === 'hidden' || opacity <= 0,
                    });
                    root.remove();
                }
                return out;
            }, { cells: dsTextCells.map((c) => ({ ...c, key: cellKey(ds, theme.name, c) })) });

            const visible = readings.filter((r) => !r.unrendered && !INTENDED_LOW_CONTRAST.has(r.key));
            for (const r of readings.filter((r) => r.unrendered)) {
                testInfo.annotations.push({ type: 'contrast-unrendered', description: `${r.key} — not painted in this state` });
            }
            // Every suppressed cell puts its live ratio on the record, so the
            // debt is countable from a green run rather than only from the red
            // one that preceded it.
            for (const s of readings.filter((r) => INTENDED_LOW_CONTRAST.has(r.key) && !r.unrendered)) {
                testInfo.annotations.push({
                    type: 'contrast-suppressed',
                    description: `${s.key} → ${s.ratio}:1 (${s.color} on ${s.bg}) — held out by INTENDED_LOW_CONTRAST`,
                });
            }

            const failures = visible.filter((r) => !r.disabled && r.ratio < FLOOR);
            const warnings = visible.filter((r) => !r.disabled && r.ratio >= FLOOR && r.ratio < AA);
            // `disabled` answers to its own floor rather than to none — see
            // DISABLED_FLOOR.
            const disabled = visible.filter((r) => r.disabled);
            const dimmedOut = disabled.filter((r) => r.inGroup < DISABLED_FLOOR);

            for (const w of warnings) {
                testInfo.annotations.push({ type: 'contrast-warning', description: `${w.key} → ${w.ratio}:1 (${w.color} on ${w.bg})` });
            }
            // The band just above the disabled floor, annotated the same way
            // the 3–4.5 band is: the pair is on the record with the faded ratio
            // beside it, which is what makes `--disabled-opacity` arguable
            // rather than invisible. Above 3:1 there is nothing to say — the
            // fade is a pure function of one token and carries no information.
            for (const d of disabled.filter((r) => r.inGroup < FLOOR)) {
                testInfo.annotations.push({
                    type: 'disabled-contrast',
                    description: `${d.key} → ${d.inGroup}:1 before the state's fade, ${d.ratio}:1 as seen (${d.color} on ${d.bg})`,
                });
            }

            // Soft, so one run reports every finding in both buckets rather
            // than stopping at the first — a gate whose output is a work list.
            expect.soft(
                failures.map((f) => `${f.key} → ${f.ratio}:1 (${f.color} on ${f.bg})`),
                `state combinations below ${FLOOR}:1 — a state that changes background must bring a readable color with it`,
            ).toEqual([]);
            expect.soft(
                dimmedOut.map((f) => `${f.key} → ${f.inGroup}:1 (${f.color} on ${f.bg})`),
                `disabled colour pairs below ${DISABLED_FLOOR}:1 before the state's own fade — dimming is the state, choosing ink nobody could have read is not`,
            ).toEqual([]);
            expect.soft(staleEntries(readings, (r) => !r.unrendered), STALE_MESSAGE).toEqual([]);

            // ── Parity: the static matrix against these readings ──
            const statics = (await staticMatrix(ds)).get(theme.name);
            expect(statics, `the static matrix has no theme "${theme.name}" for ${ds}`).toBeDefined();
            const check = parity('text', statics!, readings.map((r) => ({
                key: r.key, ratio: r.ratio, inGroup: r.inGroup, disabled: r.disabled, gone: r.unrendered, ink: r.color, bg: r.bg,
            })));
            testInfo.annotations.push({
                type: 'static-parity',
                description: `${ds}/${theme.name}: ${check.claimed} text cells claimed by the static matrix, `
                    + `${check.disagreements.length} disagreements, ${check.nearFloor.length} straddling a floor within tolerance`,
            });
            for (const n of check.nearFloor) testInfo.annotations.push({ type: 'static-parity-near-floor', description: n });
            expect.soft(
                check.disagreements,
                `cells where the static contrast matrix and the browser disagree — the browser is the ground truth; make the static side report unmeasured for the construct it misread, never bend the floor`,
            ).toEqual([]);
            // Not vacuously: a design system whose static side claims nothing
            // would "agree" on every cell.
            expect(check.claimed, 'the static matrix claims no text cells at all').toBeGreaterThan(0);

            // ── Coverage: pinned from both ends ──
            const share = measuredShare(statics!);
            const pin = STATIC_COVERAGE[ds];
            testInfo.annotations.push({
                type: 'static-coverage',
                description: `${ds}/${theme.name}: ${share}% of ${statics!.length} cells measured statically (pin ${pin}%)`,
            });
            expect(
                share,
                `the static matrix measures less of ${ds} than STATIC_COVERAGE pins — it retreated into unmeasured; find out why before lowering the pin`,
            ).toBeGreaterThanOrEqual(pin);
            expect(
                share,
                `the static matrix now measures more than ${COVERAGE_HEADROOM} points above STATIC_COVERAGE's pin for ${ds} — raise the pin deliberately, having looked at what it newly claims`,
            ).toBeLessThanOrEqual(pin + COVERAGE_HEADROOM);
        });

        test(`indicator contrast: ${ds} / ${theme.name}`, async ({ page }, testInfo) => {
            test.skip(testInfo.project.name !== 'chromium', 'one engine; canvas-resolved colors are engine-independent');

            await stage(page, theme.name);

            const readings: IndicatorReading[] = await page.evaluate(({ cells }) => {
                const { resolve, blend, contrast, hasInk } = window.zeroColorMath;
                const bodyBg = resolve(getComputedStyle(document.body).backgroundColor, [255, 255, 255]);
                const num = (v: string): number => {
                    const n = parseFloat(v);
                    return Number.isFinite(n) ? n : 1;
                };

                /**
                 * A `clip-path` that encloses no area — the mark is clipped
                 * away, whatever it is painted in.
                 *
                 * This is how five of the six design systems now draw a partial
                 * fill (#232), so reading it is load-bearing rather than
                 * defensive: basic collapses its rating fill to a DEGENERATE
                 * POLYGON (every point on one edge), brutalist to
                 * `inset(0 100% 0 0)`. Measured without this, the `empty` star
                 * reports the full-strength ink it clips entirely away, and a
                 * blank cell reads as a passing mark.
                 *
                 * Percentages only: the shipped clips are all percentage-based,
                 * and a `px` inset would need the box it is relative to. A
                 * length reads as 0 rather than as "unknown", which can only
                 * ever under-report a collapse — never invent one.
                 */
                const clipCollapsed = (clip: string): boolean => {
                    if (!clip || clip === 'none') return false;
                    if (/^(?:circle|ellipse)\(\s*0(?:px|%)?[\s)]/.test(clip)) return true;
                    const inset = /^inset\(([^)]*)\)/.exec(clip);
                    if (inset) {
                        // The optional `round <radius>` tail changes corners, not extent.
                        const sides = inset[1].split(/\s+round\s+/)[0].trim().split(/\s+/)
                            .map((v) => (v.endsWith('%') ? parseFloat(v) : 0));
                        const [t = 0, r = t, b = t, l = r] = sides;
                        if (t + b >= 100 || l + r >= 100) return true;
                    }
                    const poly = /^polygon\(([^)]*)\)/.exec(clip);
                    if (poly) {
                        // A leading fill-rule is legal and says nothing about extent.
                        const points = poly[1].replace(/^\s*(?:nonzero|evenodd)\s*,/, '')
                            .split(',').map((p) => p.trim().split(/\s+/).map(parseFloat));
                        if (points.length >= 3 && points.every((p) => p.length === 2 && p.every(Number.isFinite))) {
                            // Shoelace: zero area means every point is collinear,
                            // which is exactly how a "no fill" star is authored.
                            let area = 0;
                            for (let i = 0; i < points.length; i++) {
                                const [x1, y1] = points[i];
                                const [x2, y2] = points[(i + 1) % points.length];
                                area += x1 * y2 - x2 * y1;
                            }
                            if (Math.abs(area) / 2 < 0.5) return true;
                        }
                    }
                    return false;
                };
                /**
                 * Geometry that collapses a mark to nothing — the honest way to
                 * tell "unchecked, so there is no dot" from "there is a dot and
                 * nobody can see it". Both are `background: white`; only the
                 * geometry differs, so it is read rather than guessed:
                 *
                 * - `transform` always resolves to a matrix, so a zero
                 *   determinant covers `scale(0)`, `scale(1, 0)` and the
                 *   `matrix3d` equivalents (Material and brutalist grow their
                 *   radio dot from `scale(0)`);
                 * - the independent `scale` property is checked in its own
                 *   right (HeroUI drives `translate`/`rotate`/`scale` directly,
                 *   and carbon wipes its rating fill with `scale: 0 1`);
                 * - `clip-path`, per `clipCollapsed` above.
                 */
                const collapsed = (cs: CSSStyleDeclaration): boolean => {
                    const matrix = /^matrix(3d)?\(([^)]*)\)$/.exec(cs.transform);
                    if (matrix) {
                        const n = matrix[2].split(',').map(Number);
                        const det = matrix[1]
                            ? n[0] * (n[5] * n[10] - n[9] * n[6])
                                - n[4] * (n[1] * n[10] - n[9] * n[2])
                                + n[8] * (n[1] * n[6] - n[5] * n[2])
                            : n[0] * n[3] - n[1] * n[2];
                        if (Math.abs(det) < 1e-6) return true;
                    }
                    const scale = cs.getPropertyValue('scale');
                    if (scale && scale !== 'none' && scale.split(/\s+/).some((v) => parseFloat(v) === 0)) return true;
                    return clipCollapsed(cs.getPropertyValue('clip-path'));
                };
                /** Rendered at all — before asking what colour it is. */
                const rendered = (cs: CSSStyleDeclaration): boolean =>
                    cs.display !== 'none' && cs.visibility !== 'hidden' && num(cs.opacity) > 0
                    && !collapsed(cs);

                /**
                 * The ink a glyph actually prints in.
                 *
                 * `-webkit-text-fill-color` WINS over `color` where both are
                 * set, and Material's half-star sets exactly that pair: the
                 * fill colour transparent, the glyph painted by a hard-stop
                 * gradient clipped to the text. Reading `color` alone would
                 * report a transparent glyph — which is why this returns the
                 * fill colour, and why `imageInks` below exists.
                 */
                const glyphInk = (s: CSSStyleDeclaration): string =>
                    s.getPropertyValue('-webkit-text-fill-color') || s.color;

                /**
                 * The colours a `background-image` paints with, in source order.
                 *
                 * Only consulted for a background CLIPPED TO TEXT, where the
                 * image is the glyph's only ink. A gradient painting a BOX is
                 * deliberately not measured: its extent is a `background-size`
                 * this audit cannot reason about, so counting it would let a
                 * zero-width fill layer (HeroUI's rating star) report as paint.
                 *
                 * Computed values have already resolved `var()` and
                 * `color-mix()`, so the stops are concrete colour functions.
                 */
                const imageInks = (image: string): string[] => (image === 'none' ? [] : (
                    image.match(/(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\([^()]*\)|#[0-9a-f]{3,8}\b/gi) ?? []
                ));

                /** A background painted INSIDE the glyph rather than behind it. */
                const clipsText = (s: CSSStyleDeclaration): boolean =>
                    s.getPropertyValue('background-clip') === 'text'
                    || s.getPropertyValue('-webkit-background-clip') === 'text';

                /**
                 * The mark's own stroke, if it has one — the widest edge that
                 * paints.
                 *
                 * Counted as a carrier because since #232 the stroke IS the
                 * shape for two of the six: carbon's empty rating box is a 2px
                 * `border-strong` frame around nothing, and brutalist's rating
                 * cell is an `inked` frame whose FILL is deliberately the page's
                 * own paper. Measuring fill alone reports the first as unpainted
                 * and the second as 1:1 — both wrong about a mark the reader can
                 * plainly see. `box-shadow` still does not count (see the file
                 * header): a border survives `forced-colors`, a shadow does not.
                 */
                const borderInk = (s: CSSStyleDeclaration): string | undefined => {
                    let widest = 0;
                    let ink: string | undefined;
                    for (const side of ['top', 'right', 'bottom', 'left']) {
                        const style = s.getPropertyValue(`border-${side}-style`);
                        if (style === 'none' || style === 'hidden') continue;
                        const width = parseFloat(s.getPropertyValue(`border-${side}-width`));
                        const color = s.getPropertyValue(`border-${side}-color`);
                        if (!(width > 0) || !hasInk(color) || width <= widest) continue;
                        widest = width;
                        ink = color;
                    }
                    return ink;
                };

                const out: IndicatorReading[] = [];

                for (const cell of cells) {
                    // Rebuild the real chain: root > control > indicator, each
                    // node carrying the state/flag it declares — the same
                    // attributes the component itself writes.
                    const nodes: HTMLElement[] = [];
                    let parent: HTMLElement = document.body;
                    for (const node of cell.chain) {
                        const el = document.createElement(node.element);
                        el.setAttribute('data-scope', cell.scope);
                        el.setAttribute('data-part', node.part);
                        if (node.pin) el.setAttribute('data-state', node.pin);
                        else if (cell.state && node.states.includes(cell.state)) {
                            el.setAttribute('data-state', cell.state);
                        }
                        if (cell.flag && node.flags.includes(cell.flag)) {
                            el.setAttribute('data-' + cell.flag, '');
                        }
                        parent.appendChild(el);
                        nodes.push(el);
                        parent = el;
                    }
                    const el = nodes[nodes.length - 1];
                    if (cell.glyph) el.textContent = cell.glyph;

                    // The backdrop, composited top-down through the whole chain
                    // rather than stopping at the nearest opaque fill: daisyUI's
                    // `color-mix(... transparent)` surfaces are translucent, so
                    // what is underneath them still shows through.
                    let bg = bodyBg;
                    let group = 1;
                    let bgLabel = 'base-100';
                    for (const ancestor of nodes.slice(0, -1)) {
                        const acs = getComputedStyle(ancestor);
                        const opacity = num(acs.opacity);
                        group *= opacity;
                        if (!hasInk(acs.backgroundColor) || opacity <= 0) continue;
                        bg = blend(resolve(acs.backgroundColor, bg), bg, opacity);
                        bgLabel = `${ancestor.getAttribute('data-part')}:${acs.backgroundColor}`;
                    }

                    const cs = getComputedStyle(el);
                    const selfOpacity = num(cs.opacity) * group;
                    /**
                     * The element's own fill becomes the backdrop for anything
                     * it draws on top of itself — and it is needed twice, at two
                     * different points in the compositing order.
                     *
                     * `opacity` makes the element a GROUP: its fill, its glyph
                     * and its pseudos composite against each other first, and
                     * only the finished group is faded. So a mark drawn on the
                     * element meets `localBg`, the fill NOT yet faded; what the
                     * reader compares it against is `ownBg`, the same fill after
                     * the fade. Using the faded one for both would dilute the
                     * mark a second time against a backdrop that is already
                     * diluted — see the ratio computation below, which applies
                     * the group fade exactly once, to mark and backdrop alike.
                     *
                     * The two are equal whenever the group is opaque, which is
                     * every cell this audit ASSERTS: only `disabled` fades a
                     * chain, and disabled cells are measured and reported, never
                     * asserted.
                     *
                     * `background-clip: text` is excluded because such a fill
                     * paints inside the glyph, not behind it — it is not a
                     * backdrop for anything.
                     */
                    const localBg = hasInk(cs.backgroundColor) && !clipsText(cs)
                        ? resolve(cs.backgroundColor, bg)
                        : bg;
                    const ownBg = blend(localBg, bg, selfOpacity);

                    /**
                     * Every layer that could carry the mark. A shape is a
                     * `background-color` (clip-path or border-radius only change
                     * its outline, not what is measured) or a `border-color`; a
                     * tick drawn as a glyph — by the recipe via `content`, or by
                     * zero as default children — is a `color`.
                     *
                     * `alpha` is the layer's OWN transparency — a pseudo at
                     * `opacity: 0.55` really is 45% backdrop — and it is applied
                     * inside the group, against `inside`. The group's own
                     * `opacity` is applied afterwards, once, by the ratio
                     * computation. `over` is what the reader sees beside the
                     * mark and is what the ratio is against.
                     *
                     * A glyph is only a carrier when it can print: a design
                     * system that draws its own geometry retires zero's fallback
                     * symbol with `font-size: 0` (basic, brutalist, carbon) or a
                     * transparent fill colour (HeroUI, and Material's half), and
                     * counting a symbol that prints nothing would read as a
                     * 1:1 failure on the very cells the geometry got right.
                     */
                    const carriers: { carrier: string; ink: string; alpha: number; inside: RGB; over: RGB }[] = [];
                    const prints = (s: CSSStyleDeclaration): boolean => parseFloat(s.fontSize) > 0;
                    if (rendered(cs)) {
                        // The element's own fill and stroke are drawn ON the
                        // ancestor backdrop, so that is both what they composite
                        // against and what they are read against.
                        if (hasInk(cs.backgroundColor) && !clipsText(cs)) {
                            carriers.push({ carrier: 'background', ink: cs.backgroundColor, alpha: 1, inside: bg, over: bg });
                        }
                        const stroke = borderInk(cs);
                        if (stroke) carriers.push({ carrier: 'border', ink: stroke, alpha: 1, inside: bg, over: bg });
                        if (el.textContent && prints(cs)) {
                            const ink = glyphInk(cs);
                            if (hasInk(ink)) {
                                carriers.push({ carrier: 'color', ink, alpha: 1, inside: localBg, over: ownBg });
                            } else if (clipsText(cs)) {
                                for (const stop of imageInks(cs.backgroundImage)) {
                                    if (hasInk(stop)) carriers.push({ carrier: 'color(clipped)', ink: stop, alpha: 1, inside: localBg, over: ownBg });
                                }
                            }
                        }
                        for (const pseudo of ['::before', '::after']) {
                            const ps = getComputedStyle(el, pseudo);
                            if (ps.content === 'none' || !rendered(ps)) continue;
                            const alpha = num(ps.opacity);
                            if (hasInk(ps.backgroundColor)) {
                                carriers.push({ carrier: `background${pseudo}`, ink: ps.backgroundColor, alpha, inside: localBg, over: ownBg });
                            }
                            const pseudoStroke = borderInk(ps);
                            if (pseudoStroke) {
                                carriers.push({ carrier: `border${pseudo}`, ink: pseudoStroke, alpha, inside: localBg, over: ownBg });
                            }
                            // A quoted, non-empty `content` is a drawn glyph;
                            // `content: ""` is a box, and has no `color` to read.
                            if (/^(["'])(?:.|\n)+\1$/.test(ps.content) && prints(ps) && hasInk(glyphInk(ps))) {
                                carriers.push({ carrier: `color${pseudo}`, ink: glyphInk(ps), alpha, inside: localBg, over: ownBg });
                            }
                        }
                    }

                    const measured = carriers
                        .filter((c) => c.alpha * selfOpacity > 0)
                        .map((c) => {
                            // Inside the group: the layer over what it is drawn
                            // on, at its own transparency (`resolve` composites
                            // the ink's own alpha channel; `blend` the layer's).
                            const inGroup = blend(resolve(c.ink, c.inside), c.inside, c.alpha);
                            // Then the group is faded, once — and `over` was
                            // faded by the same factor, so both sides of the
                            // comparison lose the same light.
                            return {
                                ...c,
                                ratio: contrast(blend(inGroup, bg, selfOpacity), c.over),
                                // The mark against what it is drawn on, before
                                // the group fade — the recipe's own choice, and
                                // what `DISABLED_FLOOR` answers to.
                                inGroup: contrast(inGroup, c.inside),
                            };
                        })
                        // The mark is visible if ANY of its layers is: a recipe
                        // that draws the tick on a pseudo still leaves the host
                        // element's own (absent) fill measurable.
                        .sort((a, b) => b.ratio - a.ratio);
                    const best = measured[0];

                    out.push({
                        key: cell.key,
                        scope: cell.scope,
                        part: cell.part,
                        carrier: best?.carrier ?? 'none',
                        ink: best?.ink ?? 'none',
                        bg: bgLabel,
                        ratio: best ? Math.round(best.ratio * 100) / 100 : 0,
                        inGroup: best ? Math.round(best.inGroup * 100) / 100 : 0,
                        disabled: cell.flag === 'disabled',
                        unpainted: !best,
                    });
                    nodes[0].remove();
                }
                return out;
            }, { cells: indicatorCells.map((c) => ({ ...c, key: cellKey(ds, theme.name, c) })) });

            // Intentionally unpainted states (unchecked → `scale(0)`, no
            // `content`, transparent fill) are not a contrast problem; they are
            // the state working. A part that paints in NO state is a different
            // bug class — a missing mark, #226's business — so it is annotated,
            // never asserted here.
            const painted = readings.filter((r) => !r.unpainted);
            const paintedParts = new Set(painted.map((r) => `${r.scope}/${r.part}`));
            for (const spec of INDICATORS) {
                if (paintedParts.has(`${spec.scope}/${spec.part}`)) continue;
                testInfo.annotations.push({
                    type: 'indicator-never-painted',
                    description: `${ds}/${theme.name}/${spec.scope}/${spec.part} — no state paints anything`,
                });
            }

            // Same record the text matrix keeps, in the indicator's vocabulary.
            for (const s of painted.filter((r) => INTENDED_LOW_CONTRAST.has(r.key))) {
                testInfo.annotations.push({
                    type: 'indicator-contrast-suppressed',
                    description: `${s.key} → ${s.ratio}:1 (${s.carrier} ${s.ink} on ${s.bg}) — held out by INTENDED_LOW_CONTRAST`,
                });
            }

            const measurable = painted.filter((r) => !INTENDED_LOW_CONTRAST.has(r.key));
            const failures = measurable.filter((r) => !r.disabled && r.ratio < FLOOR);
            const warnings = measurable.filter((r) => !r.disabled && r.ratio >= FLOOR && r.ratio < AA);
            // The same lower floor the text matrix gives `disabled` — a
            // disabled tick recedes with its control, but a tick nobody can
            // find is not a state, it is a missing mark.
            const disabled = measurable.filter((r) => r.disabled);
            const dimmedOut = disabled.filter((r) => r.inGroup < DISABLED_FLOOR);

            for (const w of warnings) {
                testInfo.annotations.push({ type: 'indicator-contrast-warning', description: `${w.key} → ${w.ratio}:1 (${w.carrier} ${w.ink} on ${w.bg})` });
            }
            // Same band, same reasoning as the text matrix's.
            for (const d of disabled.filter((r) => r.inGroup < FLOOR)) {
                testInfo.annotations.push({
                    type: 'indicator-disabled-contrast',
                    description: `${d.key} → ${d.inGroup}:1 before the state's fade, ${d.ratio}:1 as seen (${d.carrier} ${d.ink} on ${d.bg})`,
                });
            }

            expect.soft(
                failures.map((f) => `${f.key} → ${f.ratio}:1 (${f.carrier} ${f.ink} on ${f.bg})`),
                `indicator paint below ${FLOOR}:1 — a mark that is painted has to be visible against what it is painted on`,
            ).toEqual([]);
            expect.soft(
                dimmedOut.map((f) => `${f.key} → ${f.inGroup}:1 (${f.carrier} ${f.ink} on ${f.bg})`),
                `disabled indicator paint below ${DISABLED_FLOOR}:1 before the state's own fade — dimming is the state, drawing a mark nobody could have found is not`,
            ).toEqual([]);
            expect.soft(staleEntries(readings, (r) => !r.unpainted), STALE_MESSAGE).toEqual([]);

            // ── Parity: the static matrix against these readings ──
            const statics = (await staticMatrix(ds)).get(theme.name);
            expect(statics, `the static matrix has no theme "${theme.name}" for ${ds}`).toBeDefined();
            const check = parity('indicator', statics!, readings.map((r) => ({
                key: r.key, ratio: r.ratio, inGroup: r.inGroup, disabled: r.disabled, gone: r.unpainted, ink: `${r.carrier} ${r.ink}`, bg: r.bg,
            })));
            testInfo.annotations.push({
                type: 'static-parity',
                description: `${ds}/${theme.name}: ${check.claimed} indicator cells claimed by the static matrix, `
                    + `${check.disagreements.length} disagreements, ${check.nearFloor.length} straddling a floor within tolerance`,
            });
            for (const n of check.nearFloor) testInfo.annotations.push({ type: 'static-parity-near-floor', description: n });
            expect.soft(
                check.disagreements,
                `indicator cells where the static contrast matrix and the browser disagree — the browser is the ground truth; make the static side report unmeasured for the construct it misread, never bend the floor`,
            ).toEqual([]);
            expect(check.claimed, 'the static matrix claims no indicator cells at all').toBeGreaterThan(0);
        });
    }
}
