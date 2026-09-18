/**
 * The static contrast matrix — the browser contrast audit
 * (`examples/playground/e2e/contrast-audit.spec.ts`), computed from the
 * compiled CSS instead of from a page.
 *
 * Same two matrices, same cell product, same colour math, same floors:
 *
 * 1. **text legibility** — every text-bearing part of every styled scope, in
 *    every renderable state combination, plus the design system's own axis
 *    surface (every wired value of every colour-bearing axis, through the
 *    chains the part tree derives), the computed text colour against the
 *    effective background;
 * 2. **indicator paint** (#228) — the parts whose whole job is paint (the
 *    tick, the dot, the thumb, the range, the chevrons, the star), each
 *    measured inside its real ancestor chain, the mark's best carrier
 *    against what it is drawn on.
 *
 * What is different is the honesty contract. A browser always produces a
 * pixel; a static reader sometimes cannot, and the failure mode to avoid is
 * a cell that quietly reads as a pass because a rule was skipped or a value
 * defaulted. So every cell carries a verdict, and `unmeasured` — with one of
 * a closed set of reasons — is a first-class verdict that the rules report
 * as information and never as a pass. The browser matrix stays the ground
 * truth; the parity gate (slice D) holds this one to it on every cell it
 * claims.
 */
import type { ManifestComponent } from '../../contract.js';
import type { AuditContext } from '../context.js';
import { styledScopes } from '../context.js';
import type { CssRule } from '../css-rules.js';
import type { Box, ComputedNode, StyleNode, UnmeasuredReason } from './cascade.js';
import {
    Unmeasured, assertNoFilter, background, borderInk, clipsText, collapsed, colorOf, computeChain, content,
    display, evaluateColor, fontSizePositive, glyphInk, opacity, resolved, visibility,
} from './cascade.js';
import type { ParsedColor, RGB } from './color.js';
import { blend, contrast, hasInk, hex, parseColor, resolveOver, round2 } from './color.js';
import type { Cell, IndicatorCell, NodeSpec, WiredAxes } from './cells.js';
import { AXIS_CELL_BUDGET, axisCellsFor, cellKey, indicatorCellsFor, textCells } from './cells-index.js';
import type { ThemeEnv } from './theme-env.js';
import { themeEnvironments } from './theme-env.js';

/**
 * The floors. `FLOOR` is WCAG's non-text/large-text minimum and what every
 * asserting cell answers to; `AA` is the body-text target, warned about
 * rather than failed. `DISABLED_FLOOR` is the state's own lower bar, measured
 * on the IN-GROUP ratio: every design system dims a disabled control with one
 * uniform `opacity`, which is the state working — what IS a recipe decision
 * is the colour pair chosen underneath, and a `disabled` label painted
 * `base-300` on `base-200` is 1.05:1 before any fade (#207).
 */
export const FLOOR = 3;
export const AA = 4.5;
export const DISABLED_FLOOR = 2;

export type ContrastVerdict = 'pass' | 'warn' | 'fail' | 'disabled-fail' | 'unrendered' | 'unpainted' | 'unmeasured';

export interface ContrastCell {
    /** `ds/theme/scope/part/state/flag/axes` — the same key the browser matrix reports. */
    key: string;
    scope: string;
    part: string;
    state?: string;
    flag?: string;
    axes?: Record<string, string>;
    mods?: string[];
    matrix: 'text' | 'indicator';
    verdict: ContrastVerdict;
    /** What the reader sees — the group fade applied to ink and backdrop alike. */
    ratio?: number;
    /** The pair the recipe chose, before the group fade — what `DISABLED_FLOOR` answers to. */
    inGroup?: number;
    ink?: string;
    bg?: string;
    /** Which layer carried an indicator's paint: `background`, `border`, `color`, `background::after`, … */
    carrier?: string;
    /** Why the cell could not be measured. */
    reason?: UnmeasuredReason;
    /** What, specifically — the property, variable or selector that stopped the reading. */
    detail?: string;
}

export interface ContrastMatrix {
    themes: Array<{ name: string; cells: ContrastCell[] }>;
}

export interface ContrastOptions {
    /** Measure only these themes; default every declared theme. */
    themes?: readonly string[];
    /** The chained-cell ceiling per (design system, theme); default `AXIS_CELL_BUDGET`. */
    axisCellBudget?: number;
}

const attrsOf = (scope: string, part: string): Map<string, string> => new Map([['data-scope', scope], ['data-part', part]]);

/** Build the chain the browser probe would build for a text cell. */
function textChain(cell: Cell): StyleNode[] {
    const chain = cell.chain ?? [];
    const nodes: StyleNode[] = [];
    if (chain.length > 0) {
        for (const n of chain) {
            const attrs = attrsOf(cell.scope, n.part);
            if (n.pin) attrs.set('data-state', n.pin);
            const parent = nodes[nodes.length - 1];
            if (parent) parent.hasElementChildren = true;
            nodes.push({ scope: cell.scope, part: n.part, element: n.element === 'input' ? 'div' : n.element, attrs, hasElementChildren: false, ...(parent ? { parent } : {}) });
        }
    } else {
        nodes.push({ scope: cell.scope, part: cell.part, element: 'div', attrs: attrsOf(cell.scope, cell.part), hasElementChildren: false });
    }
    const root = nodes[0]!;
    const el = nodes[nodes.length - 1]!;
    const attrs = el.attrs as Map<string, string>;
    if (cell.state) attrs.set('data-state', cell.state);
    if (cell.flag) attrs.set(`data-${cell.flag}`, '');
    // The axis surface goes on the CHAIN ROOT, never on the probe: the compiler
    // emits `[data-part="root"][data-variant="x"] …`, so putting it on the
    // measured element would select a rule that does not exist (#297).
    for (const [axis, value] of Object.entries(cell.axes ?? {})) (root.attrs as Map<string, string>).set(`data-${axis}`, value);
    for (const mod of cell.mods ?? []) (root.attrs as Map<string, string>).set(`data-mod-${mod}`, '');
    el.text = 'Sample';
    return nodes;
}

/** Build the real chain for an indicator cell — each node carrying the state/flag it declares. */
function indicatorChain(cell: IndicatorCell): StyleNode[] {
    const nodes: StyleNode[] = [];
    for (const n of cell.chain) {
        const attrs = attrsOf(cell.scope, n.part);
        if (n.pin) attrs.set('data-state', n.pin);
        else if (cell.state && n.states.includes(cell.state)) attrs.set('data-state', cell.state);
        if (cell.flag && n.flags.includes(cell.flag)) attrs.set(`data-${cell.flag}`, '');
        const parent = nodes[nodes.length - 1];
        if (parent) parent.hasElementChildren = true;
        nodes.push({ scope: cell.scope, part: n.part, element: n.element, attrs, hasElementChildren: false, ...(parent ? { parent } : {}) });
    }
    if (cell.glyph) nodes[nodes.length - 1]!.text = cell.glyph;
    return nodes;
}

const surfaceOf = (env: ThemeEnv): RGB => {
    const base = env.colors['base-100'];
    const parsed = base ? parseColor(base) : null;
    return parsed ? resolveOver(parsed, [255, 255, 255]) : [255, 255, 255];
};

const isRendered = (c: ComputedNode, box: Box, env: ThemeEnv): boolean =>
    display(c, box, env) !== 'none' && visibility(c, box, env) !== 'hidden' && opacity(c, box, env) > 0 && !collapsed(c, box, env);

interface TextReading { ratio: number; inGroup: number; ink: string; bg: string; unrendered: boolean }

function measureText(cell: Cell, rules: readonly CssRule[], env: ThemeEnv): TextReading {
    const nodes = textChain(cell);
    const computed = computeChain(nodes, rules, env);
    const el = computed[computed.length - 1]!;
    const bodyBg = surfaceOf(env);
    for (const c of computed) assertNoFilter(c, 'self', env);
    // Effective background: the part's own paint over what is behind it —
    // for a chained cell the nearest painted ancestor rather than the page.
    let behind = bodyBg;
    let bgLabel = cell.chain ? 'inherit(ancestor)' : 'inherit(base-100)';
    for (let node = el.parent; node; node = node.parent) {
        const b = background(node, 'self', env);
        if (b.image !== undefined) throw new Unmeasured('gradient-or-image', `${node.node.part}: ${b.image}`);
        if (hasInk(b.color)) { behind = resolveOver(b.color, bodyBg); break; }
    }
    const own = background(el, 'self', env);
    if (own.image !== undefined && !clipsText(el, 'self', env)) throw new Unmeasured('gradient-or-image', own.image);
    const bg = hasInk(own.color) ? resolveOver(own.color, behind) : behind;
    if (hasInk(own.color)) bgLabel = hex(bg);
    const ink = resolveOver(colorOf(el, 'self', env), bg);
    // `opacity` makes the element a GROUP: fill and text composite against
    // each other first, and only the finished group is faded over the page —
    // so the fade is applied once, to ink and backdrop alike.
    const op = opacity(el, 'self', env);
    const seenInk = blend(ink, behind, op);
    const seenBg = blend(bg, behind, op);
    return {
        ratio: round2(contrast(seenInk, seenBg)),
        inGroup: round2(contrast(ink, bg)),
        ink: hex(ink),
        bg: bgLabel,
        unrendered: display(el, 'self', env) === 'none' || visibility(el, 'self', env) === 'hidden' || op <= 0,
    };
}

interface IndicatorReading { ratio: number; inGroup: number; ink: string; bg: string; carrier: string; unpainted: boolean }

/** The colours a `background-image` paints with, for a background CLIPPED TO TEXT. */
function imageInks(c: ComputedNode, box: Box, image: string, env: ThemeEnv): ParsedColor[] {
    const text = resolved(c, box, image, env);
    const stops = text.match(/(?:rgba?|hsla?|oklch|oklab|lab|lch|color|color-mix|light-dark)\((?:[^()]|\([^()]*\))*\)|#[0-9a-f]{3,8}\b|\btransparent\b/gi) ?? [];
    return stops.map((stop) => evaluateColor(c, box, stop, env, () => colorOf(c, box, env)));
}

function measureIndicator(cell: IndicatorCell, rules: readonly CssRule[], env: ThemeEnv): IndicatorReading {
    const nodes = indicatorChain(cell);
    const computed = computeChain(nodes, rules, env);
    const el = computed[computed.length - 1]!;
    const bodyBg = surfaceOf(env);
    for (const c of computed) assertNoFilter(c, 'self', env);

    // The backdrop, composited top-down through the whole chain rather than
    // stopping at the nearest opaque fill: translucent surfaces let what is
    // underneath them show through.
    let bg = bodyBg;
    let group = 1;
    let bgLabel = 'base-100';
    for (const ancestor of computed.slice(0, -1)) {
        const op = opacity(ancestor, 'self', env);
        group *= op;
        const b = background(ancestor, 'self', env);
        if (b.image !== undefined) throw new Unmeasured('gradient-or-image', `${ancestor.node.part}: ${b.image}`);
        if (!hasInk(b.color) || op <= 0) continue;
        bg = blend(resolveOver(b.color, bg), bg, op);
        bgLabel = `${ancestor.node.part}:${hex(bg)}`;
    }

    const selfOpacity = opacity(el, 'self', env) * group;
    const ownBackground = background(el, 'self', env);
    const textClipped = clipsText(el, 'self', env);
    if (ownBackground.image !== undefined && !textClipped) throw new Unmeasured('gradient-or-image', ownBackground.image);
    // The element's own fill is the backdrop for anything drawn on top of
    // itself — needed twice: `localBg` NOT yet faded for the mark to meet,
    // `ownBg` after the fade for the reader to compare against.
    const localBg = hasInk(ownBackground.color) && !textClipped ? resolveOver(ownBackground.color, bg) : bg;
    const ownBg = blend(localBg, bg, selfOpacity);

    const carriers: Array<{ carrier: string; ink: ParsedColor; alpha: number; inside: RGB; over: RGB }> = [];
    if (isRendered(el, 'self', env)) {
        if (hasInk(ownBackground.color) && !textClipped) {
            carriers.push({ carrier: 'background', ink: ownBackground.color, alpha: 1, inside: bg, over: bg });
        }
        const stroke = borderInk(el, 'self', env);
        if (stroke) carriers.push({ carrier: 'border', ink: stroke, alpha: 1, inside: bg, over: bg });
        if (el.node.text && fontSizePositive(el, 'self', env)) {
            const ink = glyphInk(el, 'self', env);
            if (hasInk(ink)) {
                carriers.push({ carrier: 'color', ink, alpha: 1, inside: localBg, over: ownBg });
            } else if (textClipped && ownBackground.image !== undefined) {
                for (const stop of imageInks(el, 'self', ownBackground.image, env)) {
                    if (hasInk(stop)) carriers.push({ carrier: 'color(clipped)', ink: stop, alpha: 1, inside: localBg, over: ownBg });
                }
            }
        }
        for (const pseudo of ['::before', '::after'] as const) {
            const text = content(el, pseudo, env);
            if (text === 'none' || !isRendered(el, pseudo, env)) continue;
            const alpha = opacity(el, pseudo, env);
            const pb = background(el, pseudo, env);
            if (pb.image !== undefined && !clipsText(el, pseudo, env)) throw new Unmeasured('gradient-or-image', `${pseudo}: ${pb.image}`);
            if (hasInk(pb.color)) carriers.push({ carrier: `background${pseudo}`, ink: pb.color, alpha, inside: localBg, over: ownBg });
            const pseudoStroke = borderInk(el, pseudo, env);
            if (pseudoStroke) carriers.push({ carrier: `border${pseudo}`, ink: pseudoStroke, alpha, inside: localBg, over: ownBg });
            // A quoted, non-empty `content` is a drawn glyph; `content: ""` is
            // a box, and has no `color` to read.
            if (/^(["'])(?:.|\n)+\1$/.test(text) && fontSizePositive(el, pseudo, env)) {
                const ink = glyphInk(el, pseudo, env);
                if (hasInk(ink)) carriers.push({ carrier: `color${pseudo}`, ink, alpha, inside: localBg, over: ownBg });
            }
        }
    }

    const measured = carriers
        .filter((c) => c.alpha * selfOpacity > 0)
        .map((c) => {
            const inGroup = blend(resolveOver(c.ink, c.inside), c.inside, c.alpha);
            return {
                ...c,
                ratio: contrast(blend(inGroup, bg, selfOpacity), c.over),
                inGroup: contrast(inGroup, c.inside),
            };
        })
        .sort((a, b) => b.ratio - a.ratio);
    const best = measured[0];
    return {
        carrier: best?.carrier ?? 'none',
        ink: best ? hex(resolveOver(best.ink, best.inside)) : 'none',
        bg: bgLabel,
        ratio: best ? round2(best.ratio) : 0,
        inGroup: best ? round2(best.inGroup) : 0,
        unpainted: !best,
    };
}

const verdictFor = (ratio: number, inGroup: number, disabled: boolean): ContrastVerdict => {
    if (disabled) return inGroup < DISABLED_FLOOR ? 'disabled-fail' : 'pass';
    return ratio < FLOOR ? 'fail' : ratio < AA ? 'warn' : 'pass';
};

const identity = (cell: Cell): Pick<ContrastCell, 'scope' | 'part' | 'state' | 'flag' | 'axes' | 'mods'> => ({
    scope: cell.scope,
    part: cell.part,
    ...(cell.state ? { state: cell.state } : {}),
    ...(cell.flag ? { flag: cell.flag } : {}),
    ...(cell.axes && Object.keys(cell.axes).length > 0 ? { axes: cell.axes } : {}),
    ...(cell.mods?.length ? { mods: cell.mods } : {}),
});

/** The one place a measurement's failure becomes a verdict rather than a crash. */
function measure<R>(fn: () => R): R | { reason: UnmeasuredReason; detail?: string } {
    try {
        return fn();
    } catch (error) {
        if (error instanceof Unmeasured) return { reason: error.reason, ...(error.detail ? { detail: error.detail } : {}) };
        throw error;
    }
}

/** The cells one design system measures, per theme — the whole static matrix. */
export function buildContrastMatrix(ctx: AuditContext, options: ContrastOptions = {}): ContrastMatrix {
    const styled = styledScopes(ctx);
    const components: ManifestComponent[] = styled.map((s) => s.component);
    const wired: Record<string, WiredAxes> = {};
    for (const { scope } of styled) {
        const axes = ctx.compiled.components[scope];
        if (axes) wired[scope] = axes;
    }
    const text: Cell[] = [...textCells(components), ...axisCellsFor(wired, ctx.manifest.components)];
    const budget = options.axisCellBudget ?? AXIS_CELL_BUDGET;
    const chained = text.filter((c) => c.chain).length;
    if (chained > budget) {
        throw new Error(
            `[zero-kit] the contrast matrix's chained axis cells (${chained}) exceed the budget (${budget}) — `
            + `raise AuditOptions.axisCellBudget deliberately, with the wall-clock cost in hand`,
        );
    }
    const indicators = indicatorCellsFor(components);

    const envs = themeEnvironments(ctx.ds).filter((env) => !options.themes || options.themes.includes(env.name));
    const rulesOf = (scope: string): readonly CssRule[] => ctx.cssRules.get(scope) ?? [];

    return {
        themes: envs.map((env) => {
            const cells: ContrastCell[] = [];
            for (const cell of text) {
                const key = cellKey(ctx.name, env.name, cell);
                const r = measure(() => measureText(cell, rulesOf(cell.scope), env));
                if ('reason' in r) { cells.push({ key, ...identity(cell), matrix: 'text', verdict: 'unmeasured', reason: r.reason, ...(r.detail ? { detail: r.detail } : {}) }); continue; }
                if (r.unrendered) { cells.push({ key, ...identity(cell), matrix: 'text', verdict: 'unrendered' }); continue; }
                cells.push({
                    key, ...identity(cell), matrix: 'text',
                    verdict: verdictFor(r.ratio, r.inGroup, cell.flag === 'disabled'),
                    ratio: r.ratio, inGroup: r.inGroup, ink: r.ink, bg: r.bg,
                });
            }
            for (const cell of indicators) {
                const key = cellKey(ctx.name, env.name, cell);
                const r = measure(() => measureIndicator(cell, rulesOf(cell.scope), env));
                if ('reason' in r) { cells.push({ key, ...identity(cell), matrix: 'indicator', verdict: 'unmeasured', reason: r.reason, ...(r.detail ? { detail: r.detail } : {}) }); continue; }
                if (r.unpainted) { cells.push({ key, ...identity(cell), matrix: 'indicator', verdict: 'unpainted', bg: r.bg }); continue; }
                cells.push({
                    key, ...identity(cell), matrix: 'indicator',
                    verdict: verdictFor(r.ratio, r.inGroup, cell.flag === 'disabled'),
                    ratio: r.ratio, inGroup: r.inGroup, ink: r.ink, bg: r.bg, carrier: r.carrier,
                });
            }
            return { name: env.name, cells };
        }),
    };
}

export type { NodeSpec };
