/**
 * The cell product — WHICH (part, state, flag, axis, chain) combinations the
 * contrast matrices measure. A port of the collection half of
 * `examples/playground/e2e/contrast-audit.spec.ts`, kept function-for-function
 * so that the browser spec can import these instead of carrying a copy: one
 * cell product, one `cellKey`, and the parity gate (slice D) compares
 * readings by that key.
 *
 * Every docblock below is the spec's own reasoning, because the reasoning is
 * what a reader of this file needs: why `size` is not in the product, why
 * chained cells take resting combos only, why the axis attributes go on the
 * chain ROOT and never on the measured element.
 */
import type { ManifestComponent, ManifestPart } from '../../contract.js';
import { carrierPart } from '../../contract.js';

/** One renderable attribute combination for a part. */
export interface Combo { state?: string; flag?: string }

/** Every state, every flag, every state × flag pair — plus the bare part. */
export function combosFor(part: ManifestPart): Combo[] {
    const states = part.states ?? [];
    // `press-animating` is a one-shot animation frame, not a resting style.
    const flags = (part.flags ?? []).filter((f) => f !== 'press-animating');
    const combos: Combo[] = [{}];
    for (const state of states) combos.push({ state });
    for (const flag of flags) combos.push({ flag });
    for (const state of states) for (const flag of flags) combos.push({ state, flag });
    return combos;
}

/**
 * Chained axis cells are bounded to the RESTING combos — `{}` plus each state,
 * without the state × flag pairs the carrier's own probe keeps.
 *
 * The pairs re-measure a colour the singles already produced, and the product
 * is not small: select alone is 4 variants × 8 roles × ~18 combos × 3 text
 * parts ≈ 1,728 cells per (design system, theme). The role dimension is
 * deliberately NOT the one cut instead — the daisyUI #210 finding was
 * per-role (`neutral` at 1.12:1 where `primary` passed), so collapsing roles
 * would drop exactly the bug this matrix exists to catch.
 */
export function restingCombos(part: ManifestPart): Combo[] {
    return [{}, ...(part.states ?? []).map((state) => ({ state }))];
}

/** One node of a rendered chain — enough to rebuild it, in a page or in a model. */
export interface NodeSpec {
    part: string;
    element: string;
    states: readonly string[];
    flags: readonly string[];
    /** A `part=state` pin — the state this ancestor is held in. */
    pin?: string;
}

export interface Cell {
    scope: string;
    part: string;
    state?: string;
    flag?: string;
    /** Axis attributes to set on the chain root — `variant: 'danger'` → `data-variant="danger"`. */
    axes?: Record<string, string>;
    /** Presence-only modifiers to set on the chain root — `pending` → `data-mod-pending`. */
    mods?: string[];
    /**
     * Declared ancestor chain, outermost first, this part last (#297). Present
     * for a text part below its scope's carrier and for every indicator: the
     * axis attributes go on `chain[0]`, which is where the compiler anchors
     * the selector.
     */
    chain?: NodeSpec[];
}

/** An indicator cell always has a chain (possibly empty of ancestors) and may render a glyph. */
export interface IndicatorCell extends Cell {
    chain: NodeSpec[];
    glyph?: string;
}

/** Axis values and modifiers, in a stable spelling — part of a cell's identity. */
export const axisTag = (c: Cell): string => [
    ...Object.entries(c.axes ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`),
    ...(c.mods ?? []).map((m) => `+${m}`),
].join(',') || '-';

/** `ds/theme/scope/part/state/flag/axes` — seven segments, all vocabulary. */
export const cellKey = (ds: string, theme: string, c: Cell): string =>
    [ds, theme, c.scope, c.part, c.state ?? '-', c.flag ?? '-', axisTag(c)].join('/');

/**
 * A declared ancestor chain, resolved against the anatomy — outermost first,
 * the measured part last. Shared by the indicator matrix and the axis
 * matrix's tree-derived chains (#297, #317).
 *
 * The two throw-on-typo checks are the point of resolving it here rather
 * than trusting the string: a part the anatomy does not declare throws, and
 * the `=state` pin is rejected unless that part really has that state. A
 * renamed part or a dropped state becomes a loud failure at collection time
 * instead of a chain that silently measures the wrong node.
 */
export function chainFor(component: ManifestComponent, path: readonly string[]): NodeSpec[] {
    return path.map((entry) => {
        const [name, pin] = entry.split('=') as [string, string | undefined];
        const part = component.parts.find((p) => p.name === name);
        if (!part) throw new Error(`[zero-kit] anatomy declares no ${component.scope}/${name}`);
        if (pin && !part.states?.includes(pin)) throw new Error(`[zero-kit] ${component.scope}/${name} has no state "${pin}"`);
        return {
            part: name,
            element: part.element ?? 'div',
            states: part.states ?? [],
            flags: part.flags ?? [],
            ...(pin ? { pin } : {}),
        };
    });
}

/**
 * The text cells — every text-bearing part of every given component, in
 * every renderable combination. Text-bearing per the anatomy's own hint:
 * checking the `color` of a part that never renders text is noise, not
 * coverage.
 *
 * A part BELOW its scope's carrier is measured through the chain the part
 * tree derives (`derivedChainAncestors`), the same way the axis cells are.
 * The browser spec measured every text part as a one-element probe on the
 * app surface, and a probe has a blind spot the static reader made visible:
 * a recipe's component tokens (`--accordion-accent`, `--tabs-accent`) are
 * declared on the CARRIER, so a lone `trigger` reads `var(--accordion-accent)`
 * as nothing — the browser silently falls back to the inherited colour and
 * calls it a pass, the static reader reports `unresolved-var`. Neither is a
 * measurement of the design system. Inside its chain the part reads what it
 * really reads. A part with no path to the carrier (menu's popup, a
 * top-layer sibling of the trigger) stays a probe — nothing above it exists
 * to inherit from in the real DOM either.
 */
export function textCells(components: readonly ManifestComponent[]): Cell[] {
    return components.flatMap((component) => {
        const carrier = carrierPart(component);
        return component.parts
            .filter((part) => part.tokens?.includes('text'))
            .flatMap((part) => {
                const ancestors = part.name === carrier ? undefined : derivedChainAncestors(component, part);
                const chain = ancestors?.length ? chainFor(component, [...ancestors, part.name]) : undefined;
                return combosFor(part).map((combo) => ({
                    scope: component.scope, part: part.name, ...combo, ...(chain ? { chain } : {}),
                }));
            });
    });
}

// ── The axis surface (#207) ─────────────────────────────────────────────────

/** One scope's wired axis vocabulary — `CompiledComponentAxes` and the DS manifest's entry both fit. */
export interface WiredAxes {
    color?: readonly string[];
    variant?: readonly string[];
    axes?: Record<string, readonly string[]>;
    mods?: readonly string[];
}

/** Which axes of a scope can carry colour — see `axisCellsFor`. */
export function colourBearingAxes(wired: WiredAxes): Record<string, readonly string[]> {
    const fused: Record<string, readonly string[]> = {};
    if (wired.variant?.length) fused.variant = wired.variant;
    // A design system may also declare a custom axis of its own. None of the
    // six does today — carbon's `kind` is the vendor SPELLING of `variant`,
    // restored at the prop boundary by the generated `./components` module and
    // never an attribute — but the manifest has the field, so this reads it.
    for (const [axis, values] of Object.entries(wired.axes ?? {})) {
        if (values.length) fused[axis] = values;
    }
    return fused;
}

/**
 * Text-bearing parts that sit BELOW their scope's carrier are reached through
 * the chain the component really renders (#297). The one-element probe can
 * only put `data-variant` on the carrier, because that is where the compiler
 * anchors it: the emitted rule is scoped to `[data-part="root"][data-variant="x"]`.
 * A scope whose text lives below the carrier therefore has no measurable
 * colour at all until the ancestor is there to select on — which is why every
 * chain's FIRST node is the carrier, and why the axis attributes go on it.
 *
 * DERIVED from the anatomy's part tree (`PartSpec.parent`, #317), never
 * hand-maintained. Every ancestor that declares an `open` state is PINNED
 * open: a chain exists to measure a part while it is ON SCREEN, and for a
 * popup ancestor the pin is the difference between measuring and not — a
 * closed popup is `visibility: hidden`, which inherits.
 *
 * `undefined` means the tree declares no path from the carrier down to the
 * part — the browser spec's `axis coverage` guard turns that into a named
 * failure instead of letting the cells vanish.
 */
export function derivedChainAncestors(component: ManifestComponent, part: ManifestPart): string[] | undefined {
    const carrier = carrierPart(component);
    const byName = new Map(component.parts.map((p) => [p.name, p]));
    const ancestors: string[] = [];
    let cursor: ManifestPart | undefined = part;
    while (cursor && cursor.name !== carrier) {
        const parent: ManifestPart | undefined = cursor.parent === undefined ? undefined : byName.get(cursor.parent);
        if (!parent) return undefined;
        ancestors.unshift(parent.states?.includes('open') ? `${parent.name}=open` : parent.name);
        cursor = parent;
    }
    return cursor ? ancestors : undefined;
}

/**
 * The axis cells for one design system: every wired value of every
 * colour-bearing axis, crossed with each declared modifier and with the
 * carrier part's own state/flag combos.
 *
 * **Why the gate is `variant`, and not `color`.** In basic/daisyUI/material/
 * brutalist, `variant` and `color` are orthogonal and `color` alone selects
 * role tokens whose pairing the token validator already checks. In HeroUI
 * and carbon there IS no colour axis (`roles: {}`) — colour is fused INTO the
 * variant, so `danger`, `danger-soft` and `danger-ghost` are the only place a
 * destructive colour exists at all, and until `data-variant` is set this
 * matrix measures a stylesheet nobody ships. So the scopes that wire a
 * variant are exactly the scopes whose colour the cascade decides rather than
 * the token file, and there `color` joins the product — a raw role token used
 * as INK on a base surface is the daisyUI #210 bug, and it is per-role.
 *
 * **Why `size` is not in the product.** It moves padding and font-size, and
 * the floors do not vary with type size. It would triple the cell count to
 * re-measure the same colours.
 *
 * **Why modifiers are taken one at a time** rather than as a power set: a
 * modifier is presence-only and the recipes wire each one independently, so
 * the pairs measure nothing the singles do not. The one that matters is
 * HeroUI's `pending`, which is `opacity: 0.7` on the root — a group fade that
 * changes every ratio underneath it.
 */
export function axisCellsFor(
    components: Record<string, WiredAxes>,
    anatomy: readonly ManifestComponent[],
): Cell[] {
    const out: Cell[] = [];
    for (const [scope, wired] of Object.entries(components)) {
        const fused = colourBearingAxes(wired);
        if (Object.keys(fused).length === 0) continue;
        if (wired.color?.length) fused.color = wired.color;

        const component = anatomy.find((c) => c.scope === scope);
        if (!component) continue;
        const carrier = component.parts.find((p) => p.name === carrierPart(component))!;

        let axisCombos: Record<string, string>[] = [{}];
        for (const [axis, values] of Object.entries(fused)) {
            axisCombos = axisCombos.flatMap((base) => values.map((v) => ({ ...base, [axis]: v })));
        }
        const modSets: string[][] = [[], ...(wired.mods ?? []).map((m) => [m])];

        // Two shapes, one product: a carrier that renders text is measured by
        // the one-element probe; text BELOW the carrier through the chain the
        // part tree derives, with the axis attributes on the chain's root.
        const targets: Array<{ part: ManifestPart; chain?: NodeSpec[] }> = [];
        if (carrier.tokens?.includes('text')) targets.push({ part: carrier });
        for (const part of component.parts) {
            if (part.name === carrier.name || !part.tokens?.includes('text')) continue;
            const ancestors = derivedChainAncestors(component, part);
            if (!ancestors) continue;
            targets.push({ part, chain: chainFor(component, [...ancestors, part.name]) });
        }

        for (const axes of axisCombos) {
            for (const mods of modSets) {
                for (const target of targets) {
                    const combos = target.chain ? restingCombos(target.part) : combosFor(target.part);
                    for (const combo of combos) {
                        out.push({
                            scope,
                            part: target.part.name,
                            ...combo,
                            axes,
                            ...(mods.length > 0 ? { mods } : {}),
                            ...(target.chain ? { chain: target.chain } : {}),
                        });
                    }
                }
            }
        }
    }
    return out;
}

/**
 * A hard ceiling on the chained product, tripped rather than silently applied.
 *
 * A cap nobody sees reads as "covered everything" when it did not, so the
 * count is reported on every run and the audit throws when the next scope
 * pushes it over. Raise it deliberately (`AuditOptions.axisCellBudget`), with
 * the wall-clock cost in hand — the number is per (design system, theme),
 * which is where the multiplication that matters happens.
 */
export const AXIS_CELL_BUDGET = 2500;
