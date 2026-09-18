/**
 * The indicator matrix's selection rule and its hand table (#228) — moved
 * here from `examples/playground/e2e/contrast-audit.spec.ts` so the kit and
 * the browser spec measure ONE list of marks.
 *
 * Selection rule — which parts are "indicators", read off the anatomy rather
 * than listed by hand:
 *
 *   a part is an indicator when it declares no `text` token AND its name
 *   comes from the anatomy's closed paint-only vocabulary — `indicator`,
 *   `<thing>-indicator`, `thumb`, `range`.
 *
 * The rule sketched in #228 — "tokens include `color` but not `text`, and 2+
 * `data-state` values" — was tried first and rejected: it drags in a dozen
 * SURFACES (dialog/popup, menu/popup, collapsible/root, …) which legitimately
 * paint the same base surface the page paints — measured as "ink" those read
 * ~1:1 and would fail for being correct — and MISSES select/item-indicator
 * and tree-view/branch-indicator. The parts the vocabulary cannot name (the
 * rating star, the spinner, the timeline marker, the diff handle, the
 * pagination arrows) are opted in by hand below, each with its reason.
 *
 * What changed in the move: the ancestor chains are DERIVED from the anatomy's
 * part tree (`PartSpec.parent`, #317) instead of restated per entry. A popup
 * ancestor is pinned open — a closed popup is `visibility: hidden`, which
 * inherits, so a `✓` inside a default-state popup would measure as "not
 * painted" and the cell would silently vanish. A trigger with an `open` state
 * is NOT pinned: the resting trigger is the one a reader sees. One entry
 * (`menu`) keeps a hand chain, because the anatomy names the containing part
 * (the popup) while the mark sits on a host ROW the tree does not know.
 */
import type { ManifestComponent, ManifestPart } from '../../contract.js';
import { isPopupPart } from '../rules/state-legibility.js';
import type { IndicatorCell } from './cells.js';
import { chainFor, combosFor } from './cells.js';

export const PAINT_ONLY_PART = /^(?:.*-)?(?:indicator|thumb|range)$/;

/**
 * Selected parts the web never renders. Empty since #325 — slider's
 * track/range/thumb used to be the Lynx-only projection, but the composed
 * range slider renders them for real now. Kept for the next
 * platform-divergent part.
 */
export const NOT_RENDERED_ON_WEB: ReadonlySet<string> = new Set<string>([]);

/**
 * `glyph` is the default mark the component itself renders when the app
 * passes no children (`Select.Indicator` → `▾`, item indicators → `✓`,
 * `TreeView.BranchIndicator` → `›`, `RatingGroup.Item` → `★`). The
 * checkbox/radio/switch/progress marks are drawn by the recipe, not by zero,
 * so those parts carry no glyph — as they are on screen.
 *
 * `only` is the flag the part cannot exist WITHOUT — the indicator's own
 * version of an ancestor's `=state` pin. `Select.Item` and `Combobox.Item`
 * mount the `✓` only while selected, and always with `data-selected=""` on it.
 *
 * `ancestors`, when present, REPLACES the derived chain; see the file header.
 */
export interface IndicatorSpec {
    scope: string;
    part: string;
    glyph?: string;
    only?: string;
    ancestors?: readonly string[];
}

export const INDICATORS: readonly IndicatorSpec[] = [
    { scope: 'checkbox', part: 'indicator' },
    { scope: 'radio-group', part: 'item-indicator' },
    { scope: 'switch', part: 'thumb' },
    { scope: 'progress', part: 'range' },
    // The composed range slider's marks (#325) — real web parts, painted on
    // the rail exactly like progress's.
    { scope: 'slider', part: 'range' },
    { scope: 'slider', part: 'thumb' },
    // Menu's checked mark (#325). No glyph: zero renders an empty span and the
    // recipe draws the mark. The anatomy's containing part is the popup; the
    // mark sits on the checkbox-item ROW, and radio-item shares the same row
    // grammar in all six design systems, so one host chain measures both.
    { scope: 'menu', part: 'item-indicator', ancestors: ['popup=open', 'checkbox-item'] },
    { scope: 'select', part: 'indicator', glyph: '▾' },
    { scope: 'select', part: 'item-indicator', glyph: '✓', only: 'selected' },
    { scope: 'combobox', part: 'item-indicator', glyph: '✓', only: 'selected' },
    { scope: 'tree-view', part: 'branch-indicator', glyph: '›' },
    // The one non-`indicator`-named mark; `★` for every state — the recipes
    // differ in `color`, not in the glyph.
    { scope: 'rating-group', part: 'item', glyph: '★' },
    // Spinner (#314): pure paint on the page; an invisible one is a real bug —
    // WCAG 1.4.11's non-text floor is the same 3:1. SKELETON is deliberately
    // NOT here: it is the absence of content, and a placeholder loud enough to
    // clear 3:1 would read as a filled block someone meant.
    { scope: 'spinner', part: 'root' },
    // Status is spinner's static sibling (#334): an empty element whose whole
    // job is paint.
    { scope: 'status', part: 'root' },
    // Timeline's marker (#334): the dot on the axis, named after what it is
    // rather than its job.
    { scope: 'timeline', part: 'marker' },
    // The carousel dot: auto-selected by the paint-only pattern. Both states
    // are measured — an inactive dot a viewer cannot find is a pagination they
    // cannot use.
    { scope: 'carousel', part: 'indicator' },
    // Diff's divider handle: its grab affordance must clear the non-text floor
    // against the root's resting surface.
    { scope: 'diff', part: 'handle' },
    // RadialProgress's ring (#334): painted ON the root as a background-colour
    // ink under conic/annulus masks — background-colour rather than a gradient
    // image precisely so this matrix can read it.
    { scope: 'radial-progress', part: 'root' },
    // Pagination's prev/next triggers (#339): the `‹`/`›` glyph is the only
    // affordance for "there are more pages".
    { scope: 'pagination', part: 'prev-trigger', glyph: '‹' },
    { scope: 'pagination', part: 'next-trigger', glyph: '›' },
];

/**
 * The ancestor chain of a mark, derived from the part tree: every containing
 * part up to the top, outermost first, with popup ancestors pinned open.
 */
export function indicatorAncestors(component: ManifestComponent, part: ManifestPart): string[] {
    const byName = new Map(component.parts.map((p) => [p.name, p]));
    const ancestors: string[] = [];
    let cursor: ManifestPart | undefined = part;
    while (cursor?.parent !== undefined) {
        const parent = byName.get(cursor.parent);
        if (!parent) throw new Error(`[zero-kit] ${component.scope}/${cursor.name} declares parent "${cursor.parent}", which the anatomy does not declare`);
        ancestors.unshift(isPopupPart(parent.name) && parent.states?.includes('open') ? `${parent.name}=open` : parent.name);
        cursor = parent;
    }
    return ancestors;
}

/** The chain each entry resolves to — hand-declared or derived. */
export function indicatorChains(anatomy: readonly ManifestComponent[]): Array<{ spec: IndicatorSpec; ancestors: string[] }> {
    return INDICATORS.flatMap((spec) => {
        const component = anatomy.find((c) => c.scope === spec.scope);
        const part = component?.parts.find((p) => p.name === spec.part);
        // A design system audited against a manifest that lacks the scope
        // (an ecosystem-only manifest, a stripped fixture) simply has no such
        // mark to measure.
        if (!component || !part) return [];
        return [{ spec, ancestors: spec.ancestors ? [...spec.ancestors] : indicatorAncestors(component, part) }];
    });
}

/**
 * Paint-only parts the selection rule picks that no entry covers — the
 * browser spec's `indicator coverage` guard, as a function. Non-empty means a
 * new mark shipped without a chain: add it to `INDICATORS` (or, if the web
 * never renders it, to `NOT_RENDERED_ON_WEB`).
 */
export function uncoveredPaintParts(anatomy: readonly ManifestComponent[]): string[] {
    const covered = new Set(INDICATORS.map((i) => `${i.scope}/${i.part}`));
    return anatomy.flatMap((component) => component.parts
        .filter((part) => !part.tokens?.includes('text') && PAINT_ONLY_PART.test(part.name))
        .map((part) => `${component.scope}/${part.name}`))
        .filter((key) => !NOT_RENDERED_ON_WEB.has(key) && !covered.has(key));
}

/** The indicator cells for the given components. */
export function indicatorCells(anatomy: readonly ManifestComponent[]): IndicatorCell[] {
    return indicatorChains(anatomy).flatMap(({ spec, ancestors }) => {
        const component = anatomy.find((c) => c.scope === spec.scope)!;
        const part = component.parts.find((p) => p.name === spec.part)!;
        if (spec.only && !part.flags?.includes(spec.only)) {
            throw new Error(`[zero-kit] ${spec.scope}/${spec.part} has no flag "${spec.only}"`);
        }
        const chain = chainFor(component, [...ancestors, spec.part]);
        return combosFor(part)
            .filter((combo) => !spec.only || combo.flag === spec.only)
            .map((combo) => ({
                scope: spec.scope,
                part: spec.part,
                ...combo,
                chain,
                ...(spec.glyph ? { glyph: spec.glyph } : {}),
            }));
    });
}
