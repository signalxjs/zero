/**
 * A selector matcher for the grammar the kit itself emits — and only that.
 *
 * The static contrast matrix has to answer "does this rule apply to this
 * node in this state", and it has to be HONEST about the cases it cannot
 * answer. So every match is one of three verdicts: `yes`, `no`, or
 * `unknown`. `unknown` is not an error and not a guess: a rule the matcher
 * cannot evaluate that declares a property the matrix reads taints the
 * cell, and the cell is reported as `unmeasured:unsupported-selector`
 * rather than measured with the rule silently dropped.
 *
 * What is evaluated:
 *
 * - attribute presence and equality (`[data-part="x"]`, `[data-disabled]`),
 *   the whole of the emitted grammar's state/flag/axis vocabulary;
 * - `:not()`, `:is()` and `:where()` over selector lists (three-valued);
 * - `::before` / `::after` as the rule's subject pseudo-element; any other
 *   pseudo-element (`::backdrop`, `::placeholder`, `::-webkit-*`) makes the
 *   rule NOT APPLICABLE to what the matrix reads — it styles a box the
 *   matrix never measures, so it is skipped rather than marked unknown;
 * - the interaction pseudo-classes (`:hover`, `:active`, `:focus*`) as
 *   `no` — the resting render, the same coverage the browser matrix has;
 * - `:dir(rtl)` / `[dir="rtl"]` as `no` and `:dir(ltr)` as `yes` — an
 *   unattributed probe is left-to-right;
 * - the native proxies zero's runtime also carries (`[open]`, `:open`,
 *   `:popover-open`, `:checked`, `:indeterminate`) as `yes` exactly when the
 *   node's `data-state` is the state they proxy, and `:disabled` as the
 *   `data-disabled` flag;
 * - `:first-child` / `:last-child` / `:only-child` and the `-of-type` twins
 *   as `yes`: every node of a probe chain is its parent's only child;
 * - `:empty` as `no` (the measured node carries text; ancestors carry a
 *   child) and `:modal` as `no` (nothing in a probe is shown modally);
 * - descendant and child combinators along the chain.
 *
 * Everything else is `unknown`: sibling combinators, `:has()` on a node that
 * has children, `:nth-*()`,
 * `:placeholder-shown`, form-state pseudo-classes, attribute operators other
 * than `=`, and any selector the tokenizer cannot read at all (a raw `css`
 * block written with `&` nesting is `raw-css`).
 */

export type Match = 'yes' | 'no' | 'unknown';

/** What a rule's subject compound hangs off — `::before`/`::after` are measured; anything else is not. */
export type SubjectPseudo = '::before' | '::after' | 'other';

/** A node of a probe chain: the element, its attributes, and its parent. */
export interface MatchNode {
    element: string;
    attrs: ReadonlyMap<string, string>;
    parent?: MatchNode;
    /** Whether any element (not text) is a child — a probe's inner node has none, an ancestor has one. */
    hasElementChildren: boolean;
}

/** `(ids, classes/attributes/pseudo-classes, elements/pseudo-elements)` */
export type Specificity = readonly [number, number, number];

interface Attr { name: string; op?: string; value?: string }
interface Pseudo { name: string; arg?: string }
interface Compound { tag?: string; ids: number; classes: number; attrs: Attr[]; pseudos: Pseudo[] }
interface Complex { compounds: Compound[]; combinators: string[]; pseudoElement?: SubjectPseudo }

export interface ParsedSelector {
    list: Complex[];
    /** The pseudo-element the whole rule addresses, when every member agrees. */
    pseudoElement?: SubjectPseudo;
    /** Set when the text could not be read as a selector at all. */
    unreadable?: 'raw-css';
}

const IDENT = /[A-Za-z0-9_-]/;

/** Index just past the `)` matching the `(` at `open`, honouring quotes. */
function balancedParen(text: string, open: number): number {
    let depth = 0;
    for (let i = open; i < text.length; i++) {
        const ch = text[i];
        if (ch === '"' || ch === "'") {
            for (i++; i < text.length && text[i] !== ch; i++) if (text[i] === '\\') i++;
            continue;
        }
        if (ch === '(') depth++;
        else if (ch === ')' && --depth === 0) return i + 1;
    }
    return -1;
}

const emptyCompound = (): Compound => ({ ids: 0, classes: 0, attrs: [], pseudos: [] });

/** Split on top-level commas, honouring parens and quotes. */
function splitList(text: string): string[] {
    const out: string[] = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '"' || ch === "'") {
            for (i++; i < text.length && text[i] !== ch; i++) if (text[i] === '\\') i++;
            continue;
        }
        if (ch === '(' || ch === '[') depth++;
        else if (ch === ')' || ch === ']') depth--;
        else if (ch === ',' && depth === 0) {
            out.push(text.slice(start, i));
            start = i + 1;
        }
    }
    out.push(text.slice(start));
    return out.map((s) => s.trim()).filter(Boolean);
}

function parseComplex(text: string): Complex | 'raw-css' {
    const compounds: Compound[] = [];
    const combinators: string[] = [];
    let current = emptyCompound();
    let pending: string | undefined; // a combinator awaiting its right-hand compound
    let pseudoElement: SubjectPseudo | undefined;
    let started = false;

    const closeCompound = (combinator: string): void => {
        compounds.push(current);
        combinators.push(combinator);
        current = emptyCompound();
        started = false;
    };

    for (let i = 0; i < text.length;) {
        const ch = text[i]!;
        if (/\s/.test(ch)) {
            // Whitespace is a descendant combinator unless a symbolic one follows.
            let j = i;
            while (j < text.length && /\s/.test(text[j]!)) j++;
            if (j >= text.length) break;
            const next = text[j]!;
            if (next === '>' || next === '+' || next === '~') { i = j; continue; }
            if (started) { pending = ' '; }
            i = j;
            continue;
        }
        if (ch === '>' || ch === '+' || ch === '~') {
            if (!started) return 'raw-css';
            pending = ch;
            i++;
            while (i < text.length && /\s/.test(text[i]!)) i++;
            continue;
        }
        if (pending !== undefined) {
            closeCompound(pending);
            pending = undefined;
        }
        if (pseudoElement !== undefined) return 'raw-css'; // nothing may follow a pseudo-element
        started = true;
        if (ch === '[') {
            const end = ((): number => {
                for (let j = i + 1; j < text.length; j++) {
                    const c = text[j];
                    if (c === '"' || c === "'") { for (j++; j < text.length && text[j] !== c; j++) if (text[j] === '\\') j++; continue; }
                    if (c === ']') return j;
                }
                return -1;
            })();
            if (end === -1) return 'raw-css';
            const body = text.slice(i + 1, end).trim();
            const m = /^([A-Za-z_:][\w:.-]*)\s*(?:([~|^$*]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\s\]]+)))?(?:\s+[is])?$/.exec(body);
            if (!m) return 'raw-css';
            current.attrs.push({ name: m[1]!.toLowerCase(), ...(m[2] ? { op: m[2], value: m[3] ?? m[4] ?? m[5] ?? '' } : {}) });
            i = end + 1;
            continue;
        }
        if (ch === ':') {
            if (text[i + 1] === ':') {
                let j = i + 2;
                while (j < text.length && (IDENT.test(text[j]!))) j++;
                const name = text.slice(i, j).toLowerCase();
                if (text[j] === '(') {
                    const end = balancedParen(text, j);
                    if (end === -1) return 'raw-css';
                    j = end;
                }
                pseudoElement = name === '::before' || name === '::after' ? name : 'other';
                i = j;
                continue;
            }
            let j = i + 1;
            while (j < text.length && IDENT.test(text[j]!)) j++;
            const name = text.slice(i + 1, j).toLowerCase();
            if (!name) return 'raw-css';
            let arg: string | undefined;
            if (text[j] === '(') {
                const end = balancedParen(text, j);
                if (end === -1) return 'raw-css';
                arg = text.slice(j + 1, end - 1).trim();
                j = end;
            }
            // CSS2 single-colon spellings of the tree-abiding pseudo-elements.
            if ((name === 'before' || name === 'after') && arg === undefined) {
                pseudoElement = `::${name}`;
            } else {
                current.pseudos.push(arg === undefined ? { name } : { name, arg });
            }
            i = j;
            continue;
        }
        if (ch === '.' || ch === '#') {
            let j = i + 1;
            while (j < text.length && IDENT.test(text[j]!)) j++;
            if (j === i + 1) return 'raw-css';
            if (ch === '.') current.classes++; else current.ids++;
            i = j;
            continue;
        }
        if (ch === '*') { current.tag = '*'; i++; continue; }
        if (IDENT.test(ch)) {
            let j = i;
            while (j < text.length && IDENT.test(text[j]!)) j++;
            current.tag = text.slice(i, j).toLowerCase();
            i = j;
            continue;
        }
        return 'raw-css';
    }
    if (!started || pending !== undefined) return 'raw-css';
    compounds.push(current);
    return { compounds, combinators, ...(pseudoElement ? { pseudoElement } : {}) };
}

const cache = new Map<string, ParsedSelector>();

export function parseSelector(text: string): ParsedSelector {
    const hit = cache.get(text);
    if (hit) return hit;
    const members = splitList(text).map(parseComplex);
    let parsed: ParsedSelector;
    if (members.length === 0 || members.some((m) => m === 'raw-css')) {
        parsed = { list: [], unreadable: 'raw-css' };
    } else {
        const list = members as Complex[];
        const pseudos = new Set(list.map((m) => m.pseudoElement ?? ''));
        // A list mixing `::after` with a plain subject styles two different
        // boxes; the rule is read per member below, so only a unanimous
        // pseudo-element is lifted to the rule.
        parsed = { list, ...(pseudos.size === 1 && list[0]!.pseudoElement ? { pseudoElement: list[0]!.pseudoElement } : {}) };
    }
    cache.set(text, parsed);
    return parsed;
}

// ── Matching ────────────────────────────────────────────────────────────────

const all = (results: Match[]): Match =>
    results.includes('no') ? 'no' : results.includes('unknown') ? 'unknown' : 'yes';
const any = (results: Match[]): Match =>
    results.includes('yes') ? 'yes' : results.includes('unknown') ? 'unknown' : 'no';
const not = (m: Match): Match => (m === 'yes' ? 'no' : m === 'no' ? 'yes' : 'unknown');

/** The `data-state` value a native proxy reads. */
const PROXIED_STATE: Record<string, string> = {
    open: 'open', 'popover-open': 'open', checked: 'checked', indeterminate: 'indeterminate',
};

const ALWAYS_NO = new Set([
    'hover', 'active', 'focus', 'focus-visible', 'focus-within', 'visited', 'link', 'any-link', 'target',
    'empty', 'modal', 'root', 'scope', 'fullscreen', 'picture-in-picture',
]);
const ALWAYS_YES = new Set(['first-child', 'last-child', 'only-child', 'first-of-type', 'last-of-type', 'only-of-type']);

function matchPseudo(p: Pseudo, node: MatchNode): { match: Match; specificity: Specificity } {
    const zero: Specificity = [0, 0, 0];
    const one: Specificity = [0, 1, 0];
    switch (p.name) {
        case 'not': {
            const inner = matchList(p.arg ?? '', node);
            return { match: not(inner.match), specificity: inner.specificity };
        }
        case 'is': {
            const inner = matchList(p.arg ?? '', node);
            return { match: inner.match, specificity: inner.specificity };
        }
        case 'where': {
            const inner = matchList(p.arg ?? '', node);
            return { match: inner.match, specificity: zero };
        }
        case 'dir':
            return { match: (p.arg ?? '').trim().toLowerCase() === 'rtl' ? 'no' : (p.arg ?? '').trim().toLowerCase() === 'ltr' ? 'yes' : 'unknown', specificity: one };
        case 'disabled':
            return { match: node.attrs.has('data-disabled') ? 'yes' : 'no', specificity: one };
        case 'has':
            // Every relative selector needs a descendant or sibling to exist;
            // a node with no element children has none — `:not(:has(> *))`
            // is how the rating recipes draw the default star. With children
            // the question needs a real tree, so it stays unknown.
            return { match: node.hasElementChildren ? 'unknown' : 'no', specificity: one };
        default:
            break;
    }
    if (p.name in PROXIED_STATE) return { match: node.attrs.get('data-state') === PROXIED_STATE[p.name] ? 'yes' : 'no', specificity: one };
    if (ALWAYS_NO.has(p.name)) return { match: 'no', specificity: one };
    if (ALWAYS_YES.has(p.name)) return { match: 'yes', specificity: one };
    return { match: 'unknown', specificity: one };
}

function matchCompound(c: Compound, node: MatchNode): { match: Match; specificity: Specificity } {
    const results: Match[] = [];
    let [a, b, d] = [c.ids, c.classes, 0];
    if (c.tag && c.tag !== '*') {
        results.push(c.tag === node.element.toLowerCase() ? 'yes' : 'no');
        d += 1;
    }
    // A class or id can never match a probe node (they carry attributes only).
    if (c.ids > 0 || c.classes > 0) results.push('no');
    for (const attr of c.attrs) {
        b += 1;
        const present = node.attrs.has(attr.name);
        if (attr.op === undefined) { results.push(present ? 'yes' : 'no'); continue; }
        if (attr.op === '=') { results.push(present && node.attrs.get(attr.name) === attr.value ? 'yes' : 'no'); continue; }
        results.push(present ? 'unknown' : 'no');
    }
    for (const p of c.pseudos) {
        const r = matchPseudo(p, node);
        results.push(r.match);
        a += r.specificity[0]; b += r.specificity[1]; d += r.specificity[2];
    }
    return { match: all(results), specificity: [a, b, d] };
}

function matchComplex(sel: Complex, node: MatchNode): { match: Match; specificity: Specificity } {
    let [a, b, d] = [0, 0, 0];
    for (const c of sel.compounds) {
        // Specificity is a property of the selector, not of the match — every
        // compound counts whether or not the chain reaches it.
        const s = matchCompound(c, node).specificity;
        a += s[0]; b += s[1]; d += s[2];
    }
    if (sel.pseudoElement) d += 1;
    const specificity: Specificity = [a, b, d];

    // Right to left: the subject compound against the node, then walk the
    // combinators up the chain.
    const step = (index: number, at: MatchNode | undefined): Match => {
        if (!at) return 'no';
        const own = matchCompound(sel.compounds[index]!, at).match;
        if (own === 'no' || index === 0) return own;
        const combinator = sel.combinators[index - 1]!;
        let rest: Match;
        if (combinator === '>') {
            rest = step(index - 1, at.parent);
        } else if (combinator === ' ') {
            const tries: Match[] = [];
            for (let p = at.parent; p; p = p.parent) {
                const r = step(index - 1, p);
                if (r === 'yes') { tries.push('yes'); break; }
                tries.push(r);
            }
            rest = any(tries);
        } else {
            rest = 'unknown';
        }
        return all([own, rest]);
    };
    return { match: step(sel.compounds.length - 1, node), specificity };
}

function matchList(text: string, node: MatchNode): { match: Match; specificity: Specificity } {
    const parsed = parseSelector(text);
    if (parsed.unreadable) return { match: 'unknown', specificity: [0, 0, 0] };
    const results = parsed.list.map((m) => matchComplex(m, node));
    const match = any(results.map((r) => r.match));
    // A list's specificity is that of its most specific MATCHING member; an
    // unmatched list contributes its most specific member (what `:not()` and
    // `:is()` take), which is the spec's rule for the forgiving lists too.
    const pool = match === 'yes' ? results.filter((r) => r.match === 'yes') : results;
    const specificity = pool.reduce<Specificity>((best, r) => (compareSpecificity(r.specificity, best) > 0 ? r.specificity : best), [0, 0, 0]);
    return { match, specificity };
}

export function compareSpecificity(x: Specificity, y: Specificity): number {
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}

/**
 * Does `sel` select `node`? For a list, each member is tried and the
 * member's own pseudo-element decides which box the match is about, so the
 * caller gets the verdict for the box it asked for.
 */
export function matchSelector(
    sel: ParsedSelector,
    node: MatchNode,
    box: SubjectPseudo | undefined,
): { match: Match; specificity: Specificity } {
    if (sel.unreadable) return { match: 'unknown', specificity: [0, 0, 0] };
    const members = sel.list.filter((m) => (m.pseudoElement ?? undefined) === box);
    if (members.length === 0) return { match: 'no', specificity: [0, 0, 0] };
    const results = members.map((m) => matchComplex(m, node));
    const match = any(results.map((r) => r.match));
    const pool = match === 'yes' ? results.filter((r) => r.match === 'yes') : results;
    const specificity = pool.reduce<Specificity>((best, r) => (compareSpecificity(r.specificity, best) > 0 ? r.specificity : best), [0, 0, 0]);
    return { match, specificity };
}

/**
 * `@scope (START) to (END)`: the rule applies to a node that has an
 * ancestor-or-self matching START with no node between them (the subject
 * included) matching END — the kit's donut, where the axis-carrying carrier
 * is the root and a nested same-scope carrier is the lower boundary.
 */
export function matchScopePrelude(prelude: string, node: MatchNode): Match {
    const m = /^@scope\s*\((.*)\)\s*to\s*\((.*)\)\s*$/s.exec(prelude.trim()) ?? /^@scope\s*\((.*)\)\s*$/s.exec(prelude.trim());
    if (!m) return 'unknown';
    const start = parseSelector(m[1]!);
    const end = m[2] !== undefined ? parseSelector(m[2]) : undefined;
    const tries: Match[] = [];
    for (let root: MatchNode | undefined = node; root; root = root.parent) {
        const asRoot = matchSelector(start, root, undefined).match;
        if (asRoot === 'no') continue;
        // Below the root, a limit element excludes itself and its subtree.
        const limits: Match[] = [];
        if (end) {
            for (let below: MatchNode | undefined = node; below && below !== root; below = below.parent) {
                limits.push(matchSelector(end, below, undefined).match);
            }
        }
        const excluded = any(limits);
        tries.push(all([asRoot, not(excluded)]));
        if (tries[tries.length - 1] === 'yes') break;
    }
    return any(tries);
}
