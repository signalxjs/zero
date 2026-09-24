/**
 * The indicator matrix's selection (#228) — which parts are MARKS, and the
 * facts each one needs to be measured the way a reader sees it.
 *
 * Declared, not listed: since #31 a part says it is paint in its own anatomy
 * (`PartSpec.paint` in `@sigx/zero`, emitted into `manifest.json` as
 * `paint: true` or `{ glyph?, only?, host? }`). The hand table that lived
 * here — the `INDICATORS` rows with their `glyph`/`only` facts, the hand
 * opt-ins for the marks the naming pattern cannot see (the rating star, the
 * spinner, the timeline marker, …) and the empty `NOT_RENDERED_ON_WEB` — is
 * gone, so an ecosystem component declares its own indicator and the audit
 * measures it like one of zero's.
 *
 * The naming pattern survives as a GUARD, not a selector: a part whose name
 * comes from the anatomy's closed paint-only vocabulary — `indicator`,
 * `<thing>-indicator`, `thumb`, `range` — with no `text` hint and no
 * `paint` is a mark the audit would silently skip (`uncoveredPaintParts`).
 *
 * The rule sketched in #228 — "tokens include `color` but not `text`, and 2+
 * `data-state` values" — was tried first and rejected: it drags in a dozen
 * SURFACES (dialog/popup, menu/popup, collapsible/root, …) which legitimately
 * paint the same base surface the page paints — measured as "ink" those read
 * ~1:1 and would fail for being correct.
 *
 * The ancestor chains are DERIVED from the anatomy's part tree
 * (`PartSpec.parent`, #317). A popup ancestor is pinned open — a closed popup
 * is `visibility: hidden`, which inherits, so a `✓` inside a default-state
 * popup would measure as "not painted" and the cell would silently vanish. A
 * trigger with an `open` state is NOT pinned: the resting trigger is the one
 * a reader sees. A mark whose `parent` names only the containing part (menu's
 * `item-indicator`: the popup) declares `paint.host` — the row it is
 * measured on — and the chain runs through the host instead.
 */
import type { ManifestComponent, ManifestPart } from '../../contract.js';
import { isPopupPart } from '../rules/state-legibility.js';
import type { IndicatorCell, WiredAxes } from './cells.js';
import { chainFor, combosFor } from './cells.js';

export const PAINT_ONLY_PART = /^(?:.*-)?(?:indicator|thumb|range)$/;

/**
 * One declared paint part, resolved — what the matrix measures. `glyph`,
 * `only` and `host` are the part's `paint` facts (see `ManifestPaint`).
 */
export interface IndicatorSpec {
    scope: string;
    part: string;
    glyph?: string;
    only?: string;
    host?: string;
}

/** Every part the anatomy declares as paint, in manifest order. */
export function paintSpecs(anatomy: readonly ManifestComponent[]): IndicatorSpec[] {
    return anatomy.flatMap((component) => component.parts.flatMap((part): IndicatorSpec[] => {
        if (part.paint === undefined) return [];
        const facts = part.paint === true ? {} : part.paint;
        return [{
            scope: component.scope,
            part: part.name,
            ...(facts.glyph !== undefined ? { glyph: facts.glyph } : {}),
            ...(facts.only !== undefined ? { only: facts.only } : {}),
            ...(facts.host !== undefined ? { host: facts.host } : {}),
        }];
    }));
}

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

/**
 * The chain each declared paint part resolves to — derived from the part
 * tree, through `paint.host` when the mark declares one.
 */
export function indicatorChains(anatomy: readonly ManifestComponent[]): Array<{ spec: IndicatorSpec; ancestors: string[] }> {
    return paintSpecs(anatomy).map((spec) => {
        const component = anatomy.find((c) => c.scope === spec.scope)!;
        const part = component.parts.find((p) => p.name === spec.part)!;
        if (spec.host === undefined) return { spec, ancestors: indicatorAncestors(component, part) };
        const host = component.parts.find((p) => p.name === spec.host);
        if (!host) throw new Error(`[zero-kit] ${spec.scope}/${spec.part} declares paint.host "${spec.host}", which the anatomy does not declare`);
        return { spec, ancestors: [...indicatorAncestors(component, host), host.name] };
    });
}

/**
 * Parts the paint-only naming pattern picks that do not declare `paint` —
 * the browser spec's `indicator coverage` guard, as a function. Non-empty
 * means a mark shipped without the declaration, and the matrix skips it:
 * declare `paint` on the part in its `anatomy.ts`.
 */
export function uncoveredPaintParts(anatomy: readonly ManifestComponent[]): string[] {
    return anatomy.flatMap((component) => component.parts
        .filter((part) => part.paint === undefined && !part.tokens?.includes('text') && PAINT_ONLY_PART.test(part.name))
        .map((part) => `${component.scope}/${part.name}`));
}

/**
 * The indicator cells for the given components.
 *
 * With `wired` — one design system's harvested axes — a mark that sits on or
 * inside a part RE-CARRYING a colour-bearing axis (#94, the anatomy's
 * `carries`: timeline's marker takes `color`) is also measured once per wired
 * value, with the attribute on that part itself (`axisHost`). That is the
 * only place the part's own value exists: an unvaried reading measures the
 * root's colour, and a root-anchored one never sees the per-item override.
 */
export function indicatorCells(anatomy: readonly ManifestComponent[], wired?: Record<string, WiredAxes>): IndicatorCell[] {
    return [...plainIndicatorCells(anatomy), ...(wired ? carriedIndicatorCells(anatomy, wired) : [])];
}

/** The re-carried colour cells — see `indicatorCells`. */
function carriedIndicatorCells(anatomy: readonly ManifestComponent[], wired: Record<string, WiredAxes>): IndicatorCell[] {
    return plainIndicatorCells(anatomy).flatMap((cell) => {
        const axes = wired[cell.scope];
        if (!axes) return [];
        const out: IndicatorCell[] = [];
        for (const axis of ['color', 'variant'] as const) {
            const values = axes[axis] ?? [];
            if (values.length === 0 || !cell.chain.some((node) => node.carries?.includes(axis))) continue;
            for (const value of values) out.push({ ...cell, axes: { [axis]: value } });
        }
        return out;
    });
}

function plainIndicatorCells(anatomy: readonly ManifestComponent[]): IndicatorCell[] {
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
