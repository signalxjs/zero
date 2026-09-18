/**
 * A computed-style model for one probe chain — what `getComputedStyle`
 * hands the browser matrix, rebuilt from the compiled CSS for the handful
 * of properties the two contrast matrices read.
 *
 * The model is deliberately narrow and deliberately honest. Narrow: it
 * resolves colour, background, borders, opacity, visibility, the geometry
 * that can collapse a mark (`clip-path`, `transform`, `scale`), the text
 * fill and clip, `content` on pseudo-elements, and every custom property —
 * nothing else, because nothing else changes a contrast reading. Honest:
 * every place a static reader could be WRONG rather than merely incomplete
 * throws `Unmeasured` with a closed reason, and the matrix reports that cell
 * as unmeasured instead of reporting a number it cannot stand behind. A rule
 * the selector matcher could not evaluate taints the properties it
 * declares; a `var()` nothing defines has no value; a gradient is paint the
 * model cannot see the extent of; a `filter` changes light after the fact.
 *
 * Cascade order is the CSS one, restricted to what the kit emits: every
 * recipe rule lives in `@layer zero.recipes`, so specificity then source
 * order decide, `!important` above both. `@layer` is structure and `@scope`
 * is a WHERE, evaluated against the chain. A conditional at-rule is
 * evaluated the way the browser matrix's page would: `@media` against a
 * fixed REFERENCE ENVIRONMENT (`REFERENCE_MEDIA` — a 1280×720 desktop
 * viewport with a fine pointer that hovers, light scheme, no preference
 * flags; the Playwright "Desktop Chrome" device the e2e measures in), so a
 * `min-width` breakpoint the page meets applies and a `hover: none` or
 * `forced-colors` block does not; `@starting-style` is the entry frame and
 * never the resting render. `@supports`, `@container` and any other
 * condition the model cannot decide taint the properties they declare
 * (`conditional-rule`) — skipping them would let a colour set only under
 * `@supports` read as the unconditional one.
 *
 * Inheritance is modelled for the properties that inherit (`color`,
 * `font-size`, `visibility`, custom properties); the chain's top inherits
 * the app surface the browser spec stages — `base-100` under `base-content`.
 */
import { RUNTIME_PROPERTIES } from '../../contract.js';
import { foldConstantCalc, tryBakeColorValue } from '../../resolve/color-bake.js';
import type { CssRule } from '../css-rules.js';
import type { ParsedColor } from './color.js';
import { parseColor } from './color.js';
import type { MatchNode, Specificity, SubjectPseudo } from './selector.js';
import { compareSpecificity, matchScopePrelude, matchSelector, parseSelector } from './selector.js';
import type { ThemeEnv } from './theme-env.js';

export type UnmeasuredReason =
    | 'gradient-or-image'
    | 'unresolved-var'
    | 'runtime-property'
    | 'unsupported-selector'
    | 'unparseable-color'
    | 'currentcolor-cycle'
    | 'filter-or-blend'
    | 'unknown-geometry'
    | 'raw-css'
    | 'conditional-rule';

export const UNMEASURED_REASONS: readonly UnmeasuredReason[] = [
    'gradient-or-image', 'unresolved-var', 'runtime-property', 'unsupported-selector',
    'unparseable-color', 'currentcolor-cycle', 'filter-or-blend', 'unknown-geometry', 'raw-css', 'conditional-rule',
];

/** Thrown from inside a measurement; the matrix turns it into an `unmeasured` cell. */
export class Unmeasured extends Error {
    constructor(public readonly reason: UnmeasuredReason, public readonly detail?: string) {
        super(detail ? `${reason}: ${detail}` : reason);
    }
}

/** A node of a probe chain, as the matrix builds it. */
export interface StyleNode extends MatchNode {
    scope: string;
    part: string;
    parent?: StyleNode;
    /** Text the probe puts in the measured element (`Sample`, a glyph). */
    text?: string;
}

/** `self` is the element; the other two are its tree-abiding pseudo-elements. */
export type Box = 'self' | '::before' | '::after';

interface Declared { value: string; important: boolean; order: number }

interface BoxStyle {
    decls: Map<string, Declared>;
    /** Properties an unevaluable rule declared — reading one is not a measurement. */
    taint: Map<string, UnmeasuredReason>;
    /** Resolved custom properties, inheritance already folded in. */
    custom: Map<string, string>;
}

export interface ComputedNode {
    node: StyleNode;
    boxes: Record<Box, BoxStyle>;
    parent?: ComputedNode;
}

const isStructural = (p: string): boolean => p.startsWith('@layer') || p.startsWith('@scope');
const DEFINITION_AT_RULE = /^@(?:-webkit-)?(?:keyframes|font-face|font-feature-values|font-palette-values|property|counter-style|page|view-transition|position-try)\b/i;

/**
 * The environment a `@media` query is evaluated in — the browser matrix's
 * page. Playwright's "Desktop Chrome" device: a 1280×720 viewport, a fine
 * pointer that hovers, light scheme, no preference flags. The parity gate
 * (#403, slice D) holds the static readings to the browser's, so this table
 * and the e2e project must describe the same page.
 */
export const REFERENCE_MEDIA = {
    width: 1280,
    height: 720,
    type: 'screen',
    discrete: {
        hover: 'hover', 'any-hover': 'hover', pointer: 'fine',
        'prefers-color-scheme': 'light', 'prefers-reduced-motion': 'no-preference',
        'prefers-contrast': 'no-preference', 'forced-colors': 'none', 'prefers-reduced-transparency': 'no-preference',
        orientation: 'landscape', 'display-mode': 'browser', 'inverted-colors': 'none', scripting: 'enabled',
    } as Record<string, string>,
} as const;

type Verdict = 'yes' | 'no' | 'unknown';
const allOf = (v: Verdict[]): Verdict => (v.includes('no') ? 'no' : v.includes('unknown') ? 'unknown' : 'yes');
const anyOf = (v: Verdict[]): Verdict => (v.includes('yes') ? 'yes' : v.includes('unknown') ? 'unknown' : 'no');
const negate = (v: Verdict): Verdict => (v === 'yes' ? 'no' : v === 'no' ? 'yes' : 'unknown');

/** A `<length>` in px for the reference page, or undefined when the unit is not one the page fixes. */
function lengthPx(text: string): number | undefined {
    const m = /^(-?\d*\.?\d+)(px|rem|em)?$/i.exec(text.trim());
    if (!m) return undefined;
    const n = Number(m[1]);
    if (!Number.isFinite(n)) return undefined;
    if (m[2] === undefined) return n === 0 ? 0 : undefined;
    return m[2]!.toLowerCase() === 'px' ? n : n * 16;
}

/**
 * A `<length>` in px on the reference page, `calc()` included — `calc(1px * 2)`
 * after `var(--border)` substituted, `calc(0.5rem + 1px)` — with `rem`/`em`
 * at the page's 16px. `undefined` for anything else (`%`, `min()`, a unit
 * the page does not fix): the caller decides whether that is "unknown".
 */
function lengthValuePx(text: string): number | undefined {
    const direct = lengthPx(text);
    if (direct !== undefined) return direct;
    const t = text.trim().toLowerCase();
    if (!t.startsWith('calc(')) return undefined;
    // Every length inside becomes a px number; a stray unit or function is
    // left in place, which makes the fold refuse and the caller report it.
    let folded = t.replace(/(-?\d*\.?\d+)(px|rem|em)\b/g, (_, n: string, unit: string) => String(unit === 'px' ? Number(n) : Number(n) * 16));
    // Innermost first: the folder takes one paren-free `calc()` at a time,
    // so `calc(calc(0.25rem * 3) / 2)` needs two passes.
    for (let prev = ''; prev !== folded;) { prev = folded; folded = foldConstantCalc(folded); }
    const n = /^(-?\d*\.?\d+)$/.exec(folded.trim());
    return n ? Number(n[1]) : undefined;
}

/** One parenthesised media feature against the reference page. */
function mediaFeature(body: string): Verdict {
    const text = body.trim().toLowerCase();
    const dims: Record<string, number> = { width: REFERENCE_MEDIA.width, height: REFERENCE_MEDIA.height };
    // Range syntax: `(width >= 40rem)`, `(600px <= width)`, `(400px < width < 900px)`.
    const range = /^(?:(\S+)\s*(<=|>=|<|>|=)\s*)?(width|height)(?:\s*(<=|>=|<|>|=)\s*(\S+))?$/.exec(text);
    if (range && (range[1] !== undefined || range[5] !== undefined)) {
        const value = dims[range[3]!]!;
        const tests: Verdict[] = [];
        const cmp = (left: number, op: string, right: number): boolean =>
            op === '<' ? left < right : op === '<=' ? left <= right : op === '>' ? left > right : op === '>=' ? left >= right : left === right;
        if (range[1] !== undefined) { const l = lengthPx(range[1]); tests.push(l === undefined ? 'unknown' : cmp(l, range[2]!, value) ? 'yes' : 'no'); }
        if (range[5] !== undefined) { const r = lengthPx(range[5]); tests.push(r === undefined ? 'unknown' : cmp(value, range[4]!, r) ? 'yes' : 'no'); }
        return allOf(tests);
    }
    const pair = /^([a-z-]+)\s*(?::\s*(.+))?$/.exec(text);
    if (!pair) return 'unknown';
    const [, name, value] = pair;
    const minMax = /^(min|max)-(width|height)$/.exec(name!);
    if (minMax) {
        if (value === undefined) return 'unknown';
        const bound = lengthPx(value);
        if (bound === undefined) return 'unknown';
        const actual = dims[minMax[2]!]!;
        return (minMax[1] === 'min' ? actual >= bound : actual <= bound) ? 'yes' : 'no';
    }
    if (name! in dims) {
        if (value === undefined) return 'yes'; // `(width)` — the page has one
        const exact = lengthPx(value);
        return exact === undefined ? 'unknown' : exact === dims[name!] ? 'yes' : 'no';
    }
    const known = REFERENCE_MEDIA.discrete[name!];
    if (known !== undefined) {
        if (value === undefined) return known === 'none' || known === 'no-preference' ? 'no' : 'yes';
        return value.trim() === known ? 'yes' : 'no';
    }
    return 'unknown';
}

/** Split on a top-level separator (a keyword or a comma), honouring parentheses. */
function splitTop(text: string, sep: RegExp): string[] {
    const out: string[] = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i]!;
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        else if (depth === 0) {
            const m = sep.exec(text.slice(i));
            if (m && m.index === 0) {
                out.push(text.slice(start, i));
                i += m[0].length - 1;
                start = i + 1;
            }
        }
    }
    out.push(text.slice(start));
    return out.map((s) => s.trim()).filter(Boolean);
}

/** Does this `@media` query hold on the reference page? Exported for the tests. */
export function evaluateMedia(prelude: string): Verdict {
    const query = prelude.replace(/^@media\s*/i, '').trim();
    if (!query) return 'yes';
    const alternatives = splitTop(query, /^,/).map((alt) => {
        let text = alt.trim();
        let negated = false;
        if (/^not\s/i.test(text)) { negated = true; text = text.replace(/^not\s+/i, ''); }
        else if (/^only\s/i.test(text)) text = text.replace(/^only\s+/i, '');
        const terms = splitTop(text, /^\band\b/i).map((term): Verdict => {
            const t = term.trim();
            if (/^\(.*\)$/s.test(t)) {
                const inner = t.slice(1, -1).trim();
                if (/^not\s/i.test(inner)) return negate(mediaFeature(inner.replace(/^not\s+/i, '')));
                if (/\bor\b/i.test(inner) && !/^[a-z-]+\s*:/.test(inner)) return anyOf(splitTop(inner, /^\bor\b/i).map((x) => mediaFeature(x.replace(/^\((.*)\)$/s, '$1'))));
                if (/\band\b/i.test(inner) && !/^[a-z-]+\s*:/.test(inner)) return allOf(splitTop(inner, /^\band\b/i).map((x) => mediaFeature(x.replace(/^\((.*)\)$/s, '$1'))));
                return mediaFeature(inner);
            }
            const type = t.toLowerCase();
            if (type === 'all' || type === REFERENCE_MEDIA.type) return 'yes';
            if (type === 'print' || type === 'speech') return 'no';
            return 'unknown';
        });
        const v = allOf(terms);
        return negated ? negate(v) : v;
    });
    return anyOf(alternatives);
}

/**
 * Does a rule's at-rule context hold in the default render of the reference
 * page? `yes` applies the rule; `no` drops it; `unknown` taints what it
 * declares — a conditional the model cannot decide must not read as either.
 */
function conditionVerdict(rule: CssRule): Verdict {
    const verdicts: Verdict[] = [];
    for (const prelude of rule.at) {
        if (isStructural(prelude)) continue;
        // A definition, not a condition: the blocks inside are descriptors
        // or keyframe steps (`0%`, `to`), never style rules for an element.
        if (DEFINITION_AT_RULE.test(prelude)) return 'no';
        if (/^@starting-style/i.test(prelude)) return 'no';
        if (/^@media\b/i.test(prelude)) verdicts.push(evaluateMedia(prelude));
        else verdicts.push('unknown'); // `@supports`, `@container`, anything else
    }
    return allOf(verdicts);
}

const splitDecl = (decl: string): { prop: string; value: string; important: boolean } | undefined => {
    const i = decl.indexOf(':');
    if (i === -1) return undefined;
    const prop = decl.slice(0, i).trim().toLowerCase();
    let value = decl.slice(i + 1).trim();
    let important = false;
    const m = /!\s*important\s*$/i.exec(value);
    if (m) { important = true; value = value.slice(0, m.index).trim(); }
    return { prop, value, important };
};

interface Candidate { rule: CssRule; box: Box; specificity: Specificity; index: number; important: boolean }

/**
 * Compute every node of a chain, top-down, against one scope's rules and
 * one theme's environment.
 */
export function computeChain(nodes: readonly StyleNode[], rules: readonly CssRule[], env: ThemeEnv): ComputedNode[] {
    const out: ComputedNode[] = [];
    let parent: ComputedNode | undefined;
    for (const node of nodes) {
        const computed = computeNode(node, rules, env, parent);
        out.push(computed);
        parent = computed;
    }
    return out;
}

function computeNode(node: StyleNode, rules: readonly CssRule[], env: ThemeEnv, parent: ComputedNode | undefined): ComputedNode {
    const boxes: Record<Box, BoxStyle> = {
        self: { decls: new Map(), taint: new Map(), custom: new Map(parent?.boxes.self.custom) },
        '::before': { decls: new Map(), taint: new Map(), custom: new Map() },
        '::after': { decls: new Map(), taint: new Map(), custom: new Map() },
    };
    // The order index is a property of the whole application — normal
    // declarations first, important ones after, each in cascade order — so
    // a reader comparing "which of `background` and `background-color` was
    // set later" gets the CSS answer.
    const matched: Candidate[] = [];
    rules.forEach((rule, index) => {
        const condition = conditionVerdict(rule);
        if (condition === 'no') return;
        const sel = parseSelector(rule.selector);
        // An unreadable selector may address any box (`& ::after { … }`), so
        // every box it could have styled is tainted for what it declares.
        if (sel.unreadable) { for (const b of ['self', '::before', '::after'] as const) taintAll(boxes[b], rule, 'raw-css'); return; }
        const box: Box | undefined = sel.pseudoElement === 'other' ? undefined
            : sel.pseudoElement === '::before' ? '::before' : sel.pseudoElement === '::after' ? '::after' : 'self';
        if (!box) return; // `::backdrop`, `::placeholder`, `::-webkit-*`: a box the matrix never reads.
        const asBox: SubjectPseudo | undefined = box === 'self' ? undefined : box;
        const r = matchSelector(sel, node, asBox);
        let verdict = r.match;
        for (const prelude of rule.at) {
            if (!prelude.startsWith('@scope')) continue;
            const s = matchScopePrelude(prelude, node);
            if (s === 'no') { verdict = 'no'; break; }
            if (s === 'unknown' && verdict === 'yes') verdict = 'unknown';
        }
        if (verdict === 'no') return;
        if (verdict === 'unknown') { taintAll(boxes[box], rule, 'unsupported-selector'); return; }
        if (condition === 'unknown') { taintAll(boxes[box], rule, 'conditional-rule'); return; }
        const important = rule.decls.some((d) => /!\s*important\s*$/i.test(d));
        matched.push({ rule, box, specificity: r.specificity, index, important: false });
        if (important) matched.push({ rule, box, specificity: r.specificity, index, important: true });
    });
    matched.sort((a, b) => Number(a.important) - Number(b.important) || compareSpecificity(a.specificity, b.specificity) || a.index - b.index);
    let order = 0;
    for (const c of matched) {
        for (const decl of c.rule.decls) {
            const d = splitDecl(decl);
            if (!d || d.important !== c.important) continue;
            boxes[c.box].decls.set(d.prop, { value: d.value, important: d.important, order: order++ });
        }
    }
    // The user agent's own stylesheet, for the elements whose defaults
    // paint: a real `<button>` that no recipe colours renders `buttontext`,
    // not its parent's ink, and the browser probe builds real elements. Seeded
    // BELOW every author declaration (order -1), so `border: none` on the
    // recipe still wins over the UA's 2px outset.
    for (const [prop, value] of Object.entries(uaDefaults(node.element, env.colorScheme))) {
        if (!boxes.self.decls.has(prop)) boxes.self.decls.set(prop, { value, important: false, order: -1 });
    }
    const computed: ComputedNode = { node, boxes, ...(parent ? { parent } : {}) };
    // Custom properties resolve at the declaring element; children inherit
    // the resolved value. A pseudo-element inherits its host's customs.
    resolveCustoms(boxes.self, boxes.self.custom, env);
    for (const box of ['::before', '::after'] as const) {
        boxes[box].custom = new Map(boxes.self.custom);
        resolveCustoms(boxes[box], boxes[box].custom, env);
    }
    return computed;
}

/**
 * What Chromium's UA stylesheet paints on the elements the anatomy uses,
 * per colour scheme — measured on the reference page (#403, slice D):
 * `buttontext`/`buttonface` on a button, `fieldtext`/`field` on the form
 * controls, `linktext` on an anchor, `canvastext`/`canvas` on a dialog, and
 * the borders those elements draw when a recipe leaves them alone. Anything
 * not listed inherits, which is what every other element does.
 */
export function uaDefaults(element: string, scheme: 'light' | 'dark'): Record<string, string> {
    const dark = scheme === 'dark';
    switch (element) {
        case 'button':
            return {
                color: dark ? '#ffffff' : '#000000',
                'background-color': dark ? '#6b6b6b' : '#efefef',
                'border-width': '2px', 'border-style': 'outset', 'border-color': dark ? '#ffffff' : '#000000',
            };
        case 'input': case 'textarea': case 'select':
            return {
                color: dark ? '#ffffff' : '#000000',
                'background-color': dark ? '#3b3b3b' : '#ffffff',
                'border-width': '2px', 'border-style': 'inset', 'border-color': dark ? '#858585' : '#767676',
            };
        case 'a':
            return { color: dark ? '#9e9eff' : '#0000ee' };
        case 'dialog':
            return {
                color: dark ? '#ffffff' : '#000000',
                'background-color': dark ? '#121212' : '#ffffff',
                'border-width': '3px', 'border-style': 'solid', 'border-color': dark ? '#ffffff' : '#000000',
            };
        default:
            return {};
    }
}

function taintAll(box: BoxStyle, rule: CssRule, reason: UnmeasuredReason): void {
    for (const decl of rule.decls) {
        const d = splitDecl(decl);
        if (d && !box.taint.has(d.prop)) box.taint.set(d.prop, reason);
    }
}

/** Resolve a box's own `--*` declarations into `into`, cycle-guarded. */
function resolveCustoms(box: BoxStyle, into: Map<string, string>, env: ThemeEnv): void {
    const own = new Map<string, Declared>();
    for (const [prop, d] of box.decls) if (prop.startsWith('--')) own.set(prop, d);
    const resolving = new Set<string>();
    const resolveOne = (prop: string): string | undefined => {
        if (resolving.has(prop)) return undefined; // cycle: invalid at computed-value time
        const raw = own.get(prop);
        if (!raw) return into.get(prop) ?? env.props[prop];
        resolving.add(prop);
        try {
            const value = substituteVars(raw.value, (name) => {
                if (box.taint.has(name)) throw new Unmeasured(box.taint.get(name)!, name);
                return own.has(name) ? resolveOne(name) : (into.get(name) ?? env.props[name]);
            }, env);
            return value;
        } catch (error) {
            if (error instanceof Unmeasured) {
                // Unresolvable at the declaring element: the property is
                // guaranteed-invalid there, so consumers fall to their
                // fallbacks — except when the CAUSE was a taint, which must
                // keep propagating rather than quietly vanish.
                if (error.reason !== 'unresolved-var') box.taint.set(prop, error.reason);
                return undefined;
            }
            throw error;
        } finally {
            resolving.delete(prop);
        }
    };
    for (const prop of own.keys()) {
        const value = resolveOne(prop);
        if (value !== undefined) into.set(prop, value);
        else into.delete(prop);
    }
}

const RUNTIME = new Set<string>(RUNTIME_PROPERTIES);

/** Index just past the `)` matching the `(` at `open`. */
function balancedEnd(text: string, open: number): number {
    let depth = 0;
    for (let i = open; i < text.length; i++) {
        if (text[i] === '(') depth++;
        else if (text[i] === ')' && --depth === 0) return i + 1;
    }
    return -1;
}

/**
 * Substitute every `var()` in `value` through `lookup`, fallbacks honoured,
 * to a fixpoint. A reference nothing defines and nothing falls back from is
 * `unresolved-var`; a reference to a runtime-published property with no
 * fallback is `runtime-property` — the web runtime writes it inline, and no
 * stylesheet can say what.
 */
export function substituteVars(value: string, lookup: (name: string) => string | undefined, env: ThemeEnv, depth = 0): string {
    if (depth > 32) throw new Unmeasured('unresolved-var', 'var() chain deeper than 32');
    let out = value;
    for (let guard = 0; guard < 64; guard++) {
        const at = out.search(/var\(/i);
        if (at === -1) break;
        const open = at + 3;
        const end = balancedEnd(out, open);
        if (end === -1) throw new Unmeasured('unparseable-color', 'unbalanced var()');
        const inner = out.slice(open + 1, end - 1);
        const comma = ((): number => {
            let d = 0;
            for (let i = 0; i < inner.length; i++) {
                if (inner[i] === '(') d++;
                else if (inner[i] === ')') d--;
                else if (inner[i] === ',' && d === 0) return i;
            }
            return -1;
        })();
        const name = (comma === -1 ? inner : inner.slice(0, comma)).trim();
        const fallback = comma === -1 ? undefined : inner.slice(comma + 1).trim();
        let resolved = lookup(name);
        if (resolved === undefined && name in env.props) resolved = env.props[name];
        if (resolved === undefined) {
            if (fallback !== undefined) resolved = fallback;
            else if (RUNTIME.has(name)) throw new Unmeasured('runtime-property', name);
            else throw new Unmeasured('unresolved-var', name);
        }
        // What came back may itself reference properties (an env value, a
        // fallback): resolve it in the same context before splicing.
        resolved = substituteVars(resolved, lookup, env, depth + 1);
        out = out.slice(0, at) + resolved + out.slice(end);
    }
    return out;
}

// ── Readers ─────────────────────────────────────────────────────────────────

/** The raw declaration of `prop` on a box, undefined when unset. Reading a tainted property is not a measurement. */
export function declared(c: ComputedNode, box: Box, prop: string): Declared | undefined {
    const b = c.boxes[box];
    const taint = b.taint.get(prop);
    if (taint) throw new Unmeasured(taint, prop);
    return b.decls.get(prop);
}

/** The most recently declared of several properties that set the same thing. */
function latest(c: ComputedNode, box: Box, props: readonly string[]): { prop: string; value: string } | undefined {
    let best: { prop: string; value: string; order: number } | undefined;
    for (const prop of props) {
        const d = declared(c, box, prop);
        if (d && (!best || d.order > best.order)) best = { prop, value: d.value, order: d.order };
    }
    return best;
}

/** `value` with every `var()` resolved in this box's context. */
export function resolved(c: ComputedNode, box: Box, value: string, env: ThemeEnv): string {
    const b = c.boxes[box];
    return substituteVars(value, (name) => {
        const taint = b.taint.get(name) ?? (box !== 'self' ? c.boxes.self.taint.get(name) : undefined);
        if (taint) throw new Unmeasured(taint, name);
        return b.custom.get(name);
    }, env);
}

const KEYWORDS_UNSET = new Set(['inherit', 'initial', 'unset', 'revert', 'revert-layer']);

/**
 * The computed `color` of a box — inherited when unset, the app surface's
 * `base-content` at the top of the chain.
 */
export function colorOf(c: ComputedNode, box: Box, env: ThemeEnv, depth = 0): ParsedColor {
    if (depth > 8) throw new Unmeasured('currentcolor-cycle');
    const d = declared(c, box, 'color');
    const inherited = (): ParsedColor => {
        if (box !== 'self') return colorOf(c, 'self', env, depth + 1);
        if (c.parent) return colorOf(c.parent, 'self', env, depth + 1);
        const surface = env.colors['base-content'];
        return (surface ? parseColor(surface) : null) ?? { rgb: [0, 0, 0], alpha: 1 };
    };
    if (!d) return inherited();
    const raw = d.value.trim().toLowerCase();
    if (raw === 'currentcolor' || raw === 'inherit' || raw === 'unset') return inherited();
    if (raw === 'initial' || raw === 'revert' || raw === 'revert-layer') return { rgb: [0, 0, 0], alpha: 1 };
    return evaluateColor(c, box, d.value, env, () => inherited(), depth);
}

/** Evaluate any colour value in a box's context: vars, `currentColor`, then the baker. */
export function evaluateColor(
    c: ComputedNode,
    box: Box,
    value: string,
    env: ThemeEnv,
    current: () => ParsedColor,
    depth = 0,
): ParsedColor {
    let text = resolved(c, box, value, env);
    if (/currentcolor/i.test(text)) {
        if (depth > 8) throw new Unmeasured('currentcolor-cycle');
        const cur = current();
        const literal = cur.alpha >= 1
            ? `rgb(${cur.rgb.map((n) => Math.round(n)).join(' ')})`
            : `rgb(${cur.rgb.map((n) => Math.round(n)).join(' ')} / ${cur.alpha})`;
        text = text.replace(/currentcolor/gi, literal);
    }
    const lower = text.trim().toLowerCase();
    if (lower === 'transparent' || lower === 'none') return { rgb: [0, 0, 0], alpha: 0 };
    const baked = tryBakeColorValue(text, env.colors, env.colorScheme);
    if ('unresolved' in baked) throw new Unmeasured(baked.unresolved, text);
    const parsed = parseColor(baked.hex);
    if (!parsed) throw new Unmeasured('unparseable-color', text);
    return parsed;
}

const IMAGE_FN = /\b(?:[a-z-]*gradient|url|image|image-set|paint|element|cross-fade)\(/i;

/** Top-level whitespace split, parens and quotes kept together. */
function tokens(text: string): string[] {
    const out: string[] = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '"' || ch === "'") { for (i++; i < text.length && text[i] !== ch; i++) if (text[i] === '\\') i++; continue; }
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        else if (/\s/.test(ch!) && depth === 0) {
            if (i > start) out.push(text.slice(start, i));
            start = i + 1;
        }
    }
    if (text.length > start) out.push(text.slice(start));
    return out;
}

function topLevelCommas(text: string): string[] {
    const out: string[] = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        else if (ch === ',' && depth === 0) { out.push(text.slice(start, i)); start = i + 1; }
    }
    out.push(text.slice(start));
    return out.map((s) => s.trim());
}

/**
 * The background's colour and image layers, from whichever of
 * `background`, `background-color` and `background-image` was declared
 * last. A shorthand's colour may only sit in its final layer.
 */
export function background(c: ComputedNode, box: Box, env: ThemeEnv): { color: ParsedColor; image: string | undefined } {
    const colorDecl = latest(c, box, ['background', 'background-color']);
    const imageDecl = latest(c, box, ['background', 'background-image']);
    let color: ParsedColor = { rgb: [0, 0, 0], alpha: 0 };
    let image: string | undefined;
    const shorthand = (value: string): { color?: string; image?: string } => {
        const text = resolved(c, box, value, env);
        const layers = topLevelCommas(text);
        const found: { color?: string; image?: string } = {};
        layers.forEach((layer, i) => {
            for (const tok of tokens(layer)) {
                if (IMAGE_FN.test(tok)) { found.image = tok; continue; }
                if (i === layers.length - 1 && /^(?:[a-z-]+\(|#|[a-z]+$)/i.test(tok) && !/^(?:none|repeat|no-repeat|repeat-x|repeat-y|space|round|scroll|fixed|local|border-box|padding-box|content-box|text|top|bottom|left|right|center|auto|cover|contain)$/i.test(tok) && !/^[\d.]+(?:%|px|rem|em)?$/.test(tok)) {
                    found.color = tok;
                }
            }
        });
        return found;
    };
    if (colorDecl) {
        const value = colorDecl.prop === 'background' ? shorthand(colorDecl.value).color : colorDecl.value;
        if (value !== undefined) color = evaluateColor(c, box, value, env, () => colorOf(c, box, env));
    }
    if (imageDecl) {
        const value = imageDecl.prop === 'background' ? shorthand(imageDecl.value).image : resolved(c, box, imageDecl.value, env);
        // A layer list of nothing but `none` (daisyUI's `none, var(--fx-noise)`
        // with the noise off) paints no image.
        if (value !== undefined && !topLevelCommas(value).every((layer) => /^none$/i.test(layer))) image = value;
    }
    return { color, image };
}

const num = (value: string | undefined, fallback: number): number => {
    if (value === undefined) return fallback;
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
};

export function opacity(c: ComputedNode, box: Box, env: ThemeEnv): number {
    const d = declared(c, box, 'opacity');
    if (!d) return 1;
    const text = resolved(c, box, d.value, env).trim();
    if (text.endsWith('%')) return num(text, 100) / 100;
    if (/calc\(|var\(/i.test(text)) throw new Unmeasured('unparseable-color', `opacity: ${text}`);
    return num(text, 1);
}

export function keyword(c: ComputedNode, box: Box, prop: string, env: ThemeEnv, initial: string): string {
    const d = declared(c, box, prop);
    if (!d) return initial;
    return resolved(c, box, d.value, env).trim().toLowerCase();
}

/** `visibility` inherits. */
export function visibility(c: ComputedNode, box: Box, env: ThemeEnv): string {
    const d = declared(c, box, 'visibility');
    if (d) {
        const v = resolved(c, box, d.value, env).trim().toLowerCase();
        if (!KEYWORDS_UNSET.has(v) || v === 'initial') return v === 'initial' ? 'visible' : v;
    }
    if (box !== 'self') return visibility(c, 'self', env);
    return c.parent ? visibility(c.parent, 'self', env) : 'visible';
}

/** `display`, with the element's own default when unset. Only `none` matters. */
export function display(c: ComputedNode, box: Box, env: ThemeEnv): string {
    return keyword(c, box, 'display', env, box === 'self' ? 'block' : 'inline');
}

/**
 * The `font-size` a glyph prints at — positive unless the recipe set it to
 * zero, which is how a drawn mark retires zero's fallback symbol.
 */
export function fontSizePositive(c: ComputedNode, box: Box, env: ThemeEnv): boolean {
    const d = declared(c, box, 'font-size');
    if (!d) return box !== 'self' ? fontSizePositive(c, 'self', env) : c.parent ? fontSizePositive(c.parent, 'self', env) : true;
    const text = resolved(c, box, d.value, env).trim();
    const n = parseFloat(text);
    return !Number.isFinite(n) || n > 0;
}

/** The `content` of a pseudo-element, `none` when it has none. */
export function content(c: ComputedNode, box: Box, env: ThemeEnv): string {
    return keyword(c, box, 'content', env, 'none');
}

export function clipsText(c: ComputedNode, box: Box, env: ThemeEnv): boolean {
    return keyword(c, box, 'background-clip', env, 'border-box') === 'text'
        || keyword(c, box, '-webkit-background-clip', env, 'border-box') === 'text';
}

/** The ink a glyph prints in: `-webkit-text-fill-color` wins over `color` where both are set. */
export function glyphInk(c: ComputedNode, box: Box, env: ThemeEnv): ParsedColor {
    const d = declared(c, box, '-webkit-text-fill-color');
    if (!d) return colorOf(c, box, env);
    const raw = d.value.trim().toLowerCase();
    if (raw === 'currentcolor' || KEYWORDS_UNSET.has(raw)) return colorOf(c, box, env);
    return evaluateColor(c, box, d.value, env, () => colorOf(c, box, env));
}

/** A `filter`, `backdrop-filter` or `mix-blend-mode` changes light after the fact; a static reader stops there. */
export function assertNoFilter(c: ComputedNode, box: Box, env: ThemeEnv): void {
    for (const prop of ['filter', 'backdrop-filter', 'mix-blend-mode']) {
        const d = declared(c, box, prop);
        if (!d) continue;
        const v = resolved(c, box, d.value, env).trim().toLowerCase();
        if (v !== 'none' && v !== 'normal' && !KEYWORDS_UNSET.has(v)) throw new Unmeasured('filter-or-blend', `${prop}: ${v}`);
    }
}

/**
 * Geometry that collapses a mark to nothing — the honest way to tell
 * "unchecked, so there is no dot" from "there is a dot and nobody can see
 * it". Ported from the browser spec: a `transform` whose determinant is
 * zero, a `scale` with a zero axis, a `clip-path` that encloses no area.
 * A transform this model cannot reduce to a determinant is `unknown-geometry`.
 */
export function collapsed(c: ComputedNode, box: Box, env: ThemeEnv): boolean {
    const t = declared(c, box, 'transform');
    if (t) {
        const text = resolved(c, box, t.value, env).trim().toLowerCase();
        if (text !== 'none' && !KEYWORDS_UNSET.has(text)) {
            let det = 1;
            // Functions with balanced arguments — `translateX(calc(a - b))`
            // nests, so a paren-free regex cannot read it.
            const fns: Array<[string, string]> = [];
            let rest = text;
            while (rest.trim()) {
                const m = /^\s*([a-z0-9]+)\(/.exec(rest);
                if (!m) throw new Unmeasured('unknown-geometry', text);
                const open = m[0].length - 1;
                const end = balancedEnd(rest, open);
                if (end === -1) throw new Unmeasured('unknown-geometry', text);
                fns.push([m[1]!, rest.slice(open + 1, end - 1)]);
                rest = rest.slice(end);
            }
            if (fns.length === 0) throw new Unmeasured('unknown-geometry', text);
            for (const [fn, argText] of fns) {
                // A translation, rotation or skew never changes the determinant,
                // whatever its arguments spell (`translateX(calc(…))` is common).
                if (/^(?:translate(?:x|y|z|3d)?|rotate(?:z)?|skew(?:x|y)?)$/.test(fn!)) continue;
                const args = argText!.split(',').map((a) => parseFloat(a.trim()));
                if (args.some((n) => !Number.isFinite(n))) throw new Unmeasured('unknown-geometry', text);
                switch (fn) {
                    case 'scale': det *= args[0]! * (args[1] ?? args[0]!); break;
                    case 'scalex': det *= args[0]!; break;
                    case 'scaley': det *= args[0]!; break;
                    case 'scale3d': det *= args[0]! * args[1]!; break;
                    case 'matrix': det *= args[0]! * args[3]! - args[1]! * args[2]!; break;
                    default: throw new Unmeasured('unknown-geometry', text);
                }
            }
            if (Math.abs(det) < 1e-6) return true;
        }
    }
    const s = declared(c, box, 'scale');
    if (s) {
        const text = resolved(c, box, s.value, env).trim().toLowerCase();
        if (text !== 'none' && !KEYWORDS_UNSET.has(text)) {
            const parts = text.split(/\s+/).map(parseFloat);
            if (parts.some((n) => !Number.isFinite(n))) throw new Unmeasured('unknown-geometry', `scale: ${text}`);
            if (parts.some((n) => n === 0)) return true;
        }
    }
    const clip = declared(c, box, 'clip-path');
    if (clip) return clipCollapsed(resolved(c, box, clip.value, env).trim().toLowerCase());
    return false;
}

/**
 * A `clip-path` that encloses no area — the mark is clipped away, whatever
 * it is painted in. Percentages only, as in the browser spec: a length
 * reads as 0 rather than as "unknown", which can only ever under-report a
 * collapse — never invent one.
 */
export function clipCollapsed(clip: string): boolean {
    if (!clip || clip === 'none') return false;
    if (/^(?:circle|ellipse)\(\s*0(?:px|%)?[\s)]/.test(clip)) return true;
    const inset = /^inset\(([^)]*)\)/.exec(clip);
    if (inset) {
        const sides = inset[1]!.split(/\s+round\s+/)[0]!.trim().split(/\s+/)
            .map((v) => (v.endsWith('%') ? parseFloat(v) : 0));
        const [t = 0, r = t, b = t, l = r] = sides;
        if (t + b >= 100 || l + r >= 100) return true;
    }
    const poly = /^polygon\(([^)]*)\)/.exec(clip);
    if (poly) {
        const points = poly[1]!.replace(/^\s*(?:nonzero|evenodd)\s*,/, '')
            .split(',').map((p) => p.trim().split(/\s+/).map(parseFloat));
        if (points.length >= 3 && points.every((p) => p.length === 2 && p.every(Number.isFinite))) {
            let area = 0;
            for (let i = 0; i < points.length; i++) {
                const [x1, y1] = points[i] as [number, number];
                const [x2, y2] = points[(i + 1) % points.length] as [number, number];
                area += x1 * y2 - x2 * y1;
            }
            if (Math.abs(area) / 2 < 0.5) return true;
        }
    }
    return false;
}

// ── Borders ─────────────────────────────────────────────────────────────────

type Side = 'top' | 'right' | 'bottom' | 'left';
const SIDES: readonly Side[] = ['top', 'right', 'bottom', 'left'];
/** Logical spellings, resolved for the probe's left-to-right, horizontal writing mode. */
const LOGICAL: Record<string, Side> = { 'inline-start': 'left', 'inline-end': 'right', 'block-start': 'top', 'block-end': 'bottom' };
const STYLE_KEYWORDS = new Set(['none', 'hidden', 'dotted', 'dashed', 'solid', 'double', 'groove', 'ridge', 'inset', 'outset']);
const WIDTH_KEYWORDS: Record<string, number> = { thin: 1, medium: 3, thick: 5 };

interface BorderParts { width?: string; style?: string; color?: string }

function splitBorderShorthand(text: string): BorderParts {
    const out: BorderParts = {};
    for (const tok of tokens(text)) {
        const l = tok.toLowerCase();
        if (STYLE_KEYWORDS.has(l)) out.style = l;
        else if (l in WIDTH_KEYWORDS || /^-?[\d.]+(?:px|rem|em|%|vw|vh)?$/.test(l) || l.startsWith('calc(')) out.width = l;
        else out.color = tok;
    }
    return out;
}

/** The value for `side` out of a 1–4 value list. */
function pick4(text: string, side: Side): string {
    const v = tokens(text);
    const [t, r = t, b = t, l = r] = v as [string, string?, string?, string?];
    return { top: t, right: r!, bottom: b!, left: l! }[side];
}
function pick2(text: string, which: 'start' | 'end'): string {
    const v = tokens(text);
    return which === 'start' ? v[0]! : (v[1] ?? v[0]!);
}

/**
 * Which declared properties feed one sub-property of one physical side,
 * and how to extract the value from each. Every spelling the six skins
 * use: the physical and logical shorthands, the per-side longhands, and
 * the multi-value `border-width`/`-style`/`-color` lists.
 */
function borderSubprop(c: ComputedNode, box: Box, env: ThemeEnv, side: Side, sub: 'width' | 'style' | 'color'): string | undefined {
    const logical = (Object.entries(LOGICAL).find(([, s]) => s === side) ?? [])[0]!; // e.g. 'inline-start'
    const axis = logical.split('-')[0]!;        // 'inline' | 'block'
    const which = logical.split('-')[1] as 'start' | 'end';
    const sources: Array<[string, (v: string) => string | undefined]> = [
        ['border', (v) => splitBorderShorthand(v)[sub]],
        [`border-${side}`, (v) => splitBorderShorthand(v)[sub]],
        [`border-${axis}`, (v) => splitBorderShorthand(v)[sub]],
        [`border-${logical}`, (v) => splitBorderShorthand(v)[sub]],
        [`border-${sub}`, (v) => pick4(v, side)],
        [`border-${side}-${sub}`, (v) => v],
        [`border-${axis}-${sub}`, (v) => pick2(v, which)],
        [`border-${logical}-${sub}`, (v) => v],
    ];
    let best: { order: number; value: string | undefined } | undefined;
    for (const [prop, extract] of sources) {
        const d = declared(c, box, prop);
        if (!d || (best && d.order < best.order)) continue;
        best = { order: d.order, value: extract(resolved(c, box, d.value, env)) };
    }
    return best?.value;
}

/**
 * The box's own stroke, if it has one — the widest edge that paints.
 * Counted as a carrier because since #232 the stroke IS the shape for two
 * of the six skins. `box-shadow` is deliberately not counted: a border
 * survives `forced-colors`, a shadow does not.
 */
export function borderInk(c: ComputedNode, box: Box, env: ThemeEnv): ParsedColor | undefined {
    let widest = 0;
    let ink: ParsedColor | undefined;
    for (const side of SIDES) {
        const style = (borderSubprop(c, box, env, side, 'style') ?? 'none').toLowerCase();
        if (style === 'none' || style === 'hidden') continue;
        const widthText = (borderSubprop(c, box, env, side, 'width') ?? 'medium').toLowerCase();
        const width = widthText in WIDTH_KEYWORDS ? WIDTH_KEYWORDS[widthText]! : lengthValuePx(widthText);
        // A width the reader cannot evaluate is not a width of zero: a
        // `calc()` in units it does not fold, a `%`, a `max()` — the border
        // may well paint, so the cell is unmeasured rather than unpainted.
        if (width === undefined) throw new Unmeasured('unknown-geometry', `border-${side}-width: ${widthText}`);
        if (!(width > 0)) continue;
        const colorText = borderSubprop(c, box, env, side, 'color') ?? 'currentcolor';
        const color = evaluateColor(c, box, colorText, env, () => colorOf(c, box, env));
        if (color.alpha <= 0 || width <= widest) continue;
        widest = width;
        ink = color;
    }
    return ink;
}
