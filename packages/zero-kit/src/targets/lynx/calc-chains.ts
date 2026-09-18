/**
 * Compile-time inlining of calc-holding custom-property chains (#382).
 *
 * Measured on device (signalxjs/lynx#1075, iOS 18.3): lynx DROPS any
 * declaration consuming `var(--x)` — bare, with a fallback, or nested inside
 * a `calc()` — whenever `--x`'s value itself contains `calc()`. Direct
 * `calc(var())` in a declaration works, plain var→var chains work, and
 * descendant-from-host selectors work; only the indirection THROUGH a
 * calc-holding property fails. daisy's whole size system is built exactly
 * that way (`--switch-size: calc(var(--size-selector) * 6)` on the carrier,
 * `height: var(--switch-size)` on a part), so shipping the chain verbatim
 * renders zero-sized components with no diagnostic anywhere.
 *
 * The fix is substitution: within one compiled recipe (one scope), every
 * custom property whose definition — directly or through a var chain — holds
 * a `calc()` is inlined into its consumers at compile time, and the now-inert
 * definitions are dropped. Where a size ramp redefines the property per axis
 * compound on the carrier (`.zx-switch__root.zx-a-size-xs { --switch-size: … }`),
 * the consumer is re-emitted per variant ON THE CONSUMING PART under the same
 * compound (`.zx-switch__control.zx-a-size-xs { height: … }`) — legal because
 * the axis push-down contract stamps axis/modifier classes on every part, so
 * the compound always matches, and class-count specificity keeps the variant
 * rule winning over the base one exactly as the definition did.
 *
 * Plain-valued definitions (theme-baked per-theme values under `.zx-root`
 * hosts, `var(--color-*)` accents, literal sizes) are proven working on
 * device and are left exactly as they are — only calc-holding chains move.
 *
 * A chain the substitution cannot resolve statically is REFUSED with a build
 * error naming the property and scope, never shipped silently: a definition
 * under a theme host or state/flag class (no static value per consumer), a
 * cyclic chain, or a calc-holding property consumed from raw lynx css or
 * keyframes (which this pass does not rewrite). Chains that cross scope
 * boundaries (a calc-holding TOKEN consumed by a recipe) are caught by
 * `assertNoCalcVarChains` over the whole stylesheet in `compile.ts`.
 */
import type { LynxCapabilityReport } from './capabilities.js';

/** The axis/modifier vocabulary of one recipe — what a compound may stamp. */
export interface ChainVocabulary {
    axes: readonly string[];
    modifiers: readonly string[];
}

/** A parsed compound signature: concrete axis values plus presence modifiers. */
interface Signature {
    axes: ReadonlyMap<string, string>;
    mods: ReadonlySet<string>;
}

const sigKey = (sig: Signature): string =>
    [...[...sig.axes].map(([a, v]) => `a:${a}=${v}`).sort(), ...[...sig.mods].map((m) => `m:${m}`).sort()].join(' ');

const sigSize = (sig: Signature): number => sig.axes.size + sig.mods.size;

/** No axis named by both carries different values. */
function compatible(a: Signature, b: Signature): boolean {
    for (const [axis, value] of a.axes) {
        const other = b.axes.get(axis);
        if (other !== undefined && other !== value) return false;
    }
    return true;
}

/** Every constraint of `part` also holds in `whole`. */
function subset(part: Signature, whole: Signature): boolean {
    for (const [axis, value] of part.axes) {
        if (whole.axes.get(axis) !== value) return false;
    }
    for (const mod of part.mods) {
        if (!whole.mods.has(mod)) return false;
    }
    return true;
}

function union(a: Signature, b: Signature): Signature {
    return {
        axes: new Map([...a.axes, ...b.axes]),
        mods: new Set([...a.mods, ...b.mods]),
    };
}

/** The grammar classes `whole` adds over `base`, as selector text. */
function extraClasses(whole: Signature, base: Signature): string {
    const parts: string[] = [];
    for (const [axis, value] of [...whole.axes].sort(([a], [b]) => a.localeCompare(b))) {
        if (base.axes.get(axis) !== value) parts.push(`.zx-a-${axis}-${value}`);
    }
    for (const mod of [...whole.mods].sort()) {
        if (!base.mods.has(mod)) parts.push(`.zx-m-${mod}`);
    }
    return parts.join('');
}

interface Decl {
    prop: string;
    value: string;
}

interface ParsedRule {
    /** Selector text, verbatim. */
    selector: string;
    /** Everything before the part compound (theme hosts), '' for most rules. */
    prefix: string;
    /** The part compound's grammar signature (axis/modifier classes only). */
    sig: Signature;
    /** Whether the part compound parsed cleanly into part + axis/mod classes ONLY. */
    pure: boolean;
    decls: Decl[];
}

const DECL_LINE = /^\s*([^:\s][^:]*):\s*(.*);$/;

/** `--x` read through `var(`, name captured. */
const VAR_REF = /var\(\s*(--[A-Za-z0-9_-]+)/g;

/** Index just past the `)` matching the `(` at `open`, or -1. */
function balancedEnd(text: string, open: number): number {
    let depth = 0;
    for (let i = open; i < text.length; i++) {
        if (text[i] === '(') depth++;
        else if (text[i] === ')' && --depth === 0) return i + 1;
    }
    return -1;
}

/**
 * Parse one emitted rule string (`selector {\n    prop: value;\n…\n}`) back
 * into structure. The input is machine-generated by this same target —
 * `declBlock` with four-space indentation — so the shape is total; anything
 * else returns null and the caller treats the rule as opaque.
 */
function parseRule(rule: string, scope: string, vocab: ChainVocabulary): ParsedRule | null {
    const open = rule.indexOf(' {\n');
    if (open === -1 || !rule.endsWith('\n}')) return null;
    const selector = rule.slice(0, open);
    const body = rule.slice(open + 3, rule.length - 2);
    const decls: Decl[] = [];
    for (const line of body.split('\n')) {
        const m = DECL_LINE.exec(line);
        if (!m) return null;
        decls.push({ prop: m[1]!.trim(), value: m[2]! });
    }
    const segments = selector.split(/\s+/);
    const partCompound = segments[segments.length - 1]!;
    const prefix = segments.slice(0, -1).join(' ');
    const classes = partCompound.split('.').filter(Boolean);
    if (!classes[0]?.startsWith(`zx-${scope}__`)) return null;
    const axes = new Map<string, string>();
    const mods = new Set<string>();
    let pure = true;
    for (const cls of classes.slice(1)) {
        if (cls.startsWith('zx-a-')) {
            // Axis and value may both contain hyphens; the recipe's own axis
            // vocabulary disambiguates. The emitter minted these classes from
            // that same vocabulary, so exactly one axis matches.
            const owners = vocab.axes.filter((a) => cls.startsWith(`zx-a-${a}-`));
            if (owners.length === 1) {
                axes.set(owners[0]!, cls.slice(`zx-a-${owners[0]!}-`.length));
                continue;
            }
            pure = false;
            continue;
        }
        if (cls.startsWith('zx-m-')) {
            mods.add(cls.slice(5));
            continue;
        }
        // States, flags, orientation/placement, anything else: legal on a
        // CONSUMER (the compound is simply extended), disqualifying for a
        // calc-holding DEFINITION (no static value per consumer).
        pure = false;
    }
    return { selector, prefix, sig: { axes, mods }, pure, decls };
}

interface Definition {
    sig: Signature;
    value: string;
    /** Statically resolvable: no theme prefix, part + axis/mod classes only. */
    resolvable: boolean;
    selector: string;
    ruleIndex: number;
    declIndex: number;
}

interface ResolvedDef {
    sig: Signature;
    value: string;
}

/**
 * Inline every calc-holding custom-property chain in one compiled recipe's
 * rules, per the module doc above. Returns the rewritten rule list; pushes a
 * `translated` report entry per inlined property; throws (refuses) on any
 * chain it cannot resolve statically. `externalCss` is the recipe's raw lynx
 * css and keyframes bodies — not rewritten, only scanned so a consumer hiding
 * there refuses instead of dangling.
 */
export function inlineCalcChains(
    scope: string,
    rules: readonly string[],
    vocab: ChainVocabulary,
    report: LynxCapabilityReport,
    externalCss = '',
): string[] {
    const where = `lynx recipe for "${scope}"`;
    const parsed = rules.map((rule) => parseRule(rule, scope, vocab));

    // 1. Every custom-property definition in the scope's emitted rules.
    const definitions = new Map<string, Definition[]>();
    parsed.forEach((rule, ruleIndex) => {
        if (!rule) return;
        rule.decls.forEach((decl, declIndex) => {
            if (!decl.prop.startsWith('--')) return;
            const list = definitions.get(decl.prop) ?? [];
            list.push({
                sig: rule.sig,
                value: decl.value,
                resolvable: rule.prefix === '' && rule.pure,
                selector: rule.selector,
                ruleIndex,
                declIndex,
            });
            definitions.set(decl.prop, list);
        });
    });

    const refsIn = (value: string): string[] =>
        [...new Set([...value.matchAll(VAR_REF)].map((m) => m[1]!))].filter((name) => definitions.has(name));

    // 2. Calc-holding, transitively: a property holds calc() if any of its own
    // definitions does, or if one chains (through plain var refs) to a
    // property that does. Plain chains to plain values stay untouched.
    const holding = new Map<string, boolean>();
    const isCalcHolding = (prop: string, seen: ReadonlySet<string> = new Set()): boolean => {
        const memo = holding.get(prop);
        if (memo !== undefined) return memo;
        if (seen.has(prop)) return false;
        const next = new Set(seen).add(prop);
        const defs = definitions.get(prop) ?? [];
        const holds = defs.some((d) => /calc\(/i.test(d.value))
            || defs.some((d) => refsIn(d.value).some((r) => isCalcHolding(r, next)));
        holding.set(prop, holds);
        return holds;
    };
    const calcHolding = new Set([...definitions.keys()].filter((p) => isCalcHolding(p)));
    if (calcHolding.size === 0) return [...rules];

    // Refusals that need no resolution: a calc-holding definition the pass
    // cannot place (theme host prefix, state/flag compound, opaque rule), and
    // a consumer in text this pass does not rewrite.
    for (const prop of calcHolding) {
        const bad = definitions.get(prop)!.find((d) => !d.resolvable);
        if (bad) {
            throw new Error(
                `[zero-kit] ${where}: custom property "${prop}" holds a calc() value but is defined under `
                + `"${bad.selector}", which the calc-chain inliner cannot resolve statically — on lynx a declaration `
                + `consuming var(${prop}) is dropped whenever the property's value contains calc() `
                + '(signalxjs/lynx#1075), so the chain must be inlined at compile time, and only base or '
                + 'axis/modifier-compound definitions have one static value per consumer. Define it as a plain '
                + 'value there, or move the consuming declarations under the same selector',
            );
        }
    }
    for (const prop of calcHolding) {
        if (new RegExp(`var\\(\\s*${prop}(?![A-Za-z0-9_-])`).test(externalCss)) {
            throw new Error(
                `[zero-kit] ${where}: the recipe's raw lynx css or keyframes consume var(${prop}), whose `
                + 'definition holds a calc() value — on lynx that declaration is dropped on device '
                + '(signalxjs/lynx#1075), and the calc-chain inliner rewrites only structured recipe '
                + 'declarations. Inline the value by hand where it is consumed',
            );
        }
    }
    const opaqueRules = rules.filter((_, i) => !parsed[i]);
    for (const prop of calcHolding) {
        const pattern = new RegExp(`var\\(\\s*${prop}(?![A-Za-z0-9_-])`);
        const hit = opaqueRules.find((r) => pattern.test(r));
        if (hit) {
            throw new Error(
                `[zero-kit] ${where}: a rule the calc-chain inliner cannot parse consumes var(${prop}), whose `
                + `definition holds a calc() value — refusing to ship a chain lynx drops on device `
                + `(signalxjs/lynx#1075). Rule: ${hit.split('\n')[0] ?? ''}`,
            );
        }
    }

    // 3. Resolve definitions: a definition may itself consume calc-holding
    // properties (`--switch-p: calc(var(--switch-size) * 0.125)`), splitting
    // it per that property's compounds.
    const resolved = new Map<string, ResolvedDef[]>();
    const resolving = new Set<string>();
    const resolveProp = (prop: string): ResolvedDef[] => {
        const memo = resolved.get(prop);
        if (memo) return memo;
        if (resolving.has(prop)) {
            throw new Error(
                `[zero-kit] ${where}: custom property "${prop}" holds a calc() value and its definition chain `
                + 'is cyclic — nothing static to inline (signalxjs/lynx#1075 makes shipping the chain a silent '
                + 'no-render on device)',
            );
        }
        resolving.add(prop);
        const out: ResolvedDef[] = [];
        const seen = new Map<string, string>();
        for (const def of definitions.get(prop)!) {
            for (const expanded of expandValue(def.value, def.sig, `definition of "${prop}"`)) {
                const key = sigKey(expanded.sig);
                const clash = seen.get(key);
                if (clash !== undefined && clash !== expanded.value) {
                    throw new Error(
                        `[zero-kit] ${where}: custom property "${prop}" holds a calc() value and is defined twice `
                        + `under the same compound ("${sigKey(expanded.sig) || 'base'}") with different values — `
                        + 'the inliner cannot know which one a consumer resolves to',
                    );
                }
                seen.set(key, expanded.value);
                if (clash === undefined) out.push(expanded);
            }
        }
        resolving.delete(prop);
        resolved.set(prop, out);
        return out;
    };

    /**
     * Substitute one property's resolved value into `value`, every occurrence,
     * parenthesized when the site sits inside a calc() so operator precedence
     * survives (`calc(EXPR)` definitions shed their wrapper to `(EXPR)`).
     */
    const substitute = (value: string, prop: string, defValue: string): string => {
        const calcSpans: Array<[number, number]> = [];
        for (const m of value.matchAll(/calc\(/gi)) {
            const end = balancedEnd(value, m.index + m[0].length - 1);
            if (end !== -1) calcSpans.push([m.index + m[0].length - 1, end]);
        }
        const sites: number[] = [];
        for (const m of value.matchAll(VAR_REF)) {
            if (m[1] === prop) sites.push(m.index);
        }
        let out = value;
        for (const site of sites.reverse()) {
            const open = out.indexOf('(', site);
            const end = balancedEnd(out, open);
            if (end === -1) continue;
            const insideCalc = calcSpans.some(([o, e]) => site > o && site < e);
            const trimmed = defValue.trim();
            let replacement = trimmed;
            if (insideCalc) {
                replacement = /^calc\(/i.test(trimmed) && balancedEnd(trimmed, 4) === trimmed.length
                    ? `(${trimmed.slice(5, -1)})`
                    : `(${trimmed})`;
            }
            out = out.slice(0, site) + replacement + out.slice(end);
        }
        return out;
    };

    /**
     * Expand one declaration value against the compounds its calc-holding
     * references vary over: one (signature, substituted value) per reachable
     * compound, base first. Values equal to the base emission are elided —
     * the base rule already covers them at lower specificity.
     */
    function expandValue(value: string, baseSig: Signature, what: string): ResolvedDef[] {
        const consumed = refsIn(value).filter((p) => calcHolding.has(p));
        if (consumed.length === 0) return [{ sig: baseSig, value }];
        const byProp = new Map(consumed.map((p) => [p, resolveProp(p)]));

        // Target compounds: the consumer's own, extended by every compatible
        // definition compound, closed under union (cross-axis definitions
        // need the product compound to stay faithful to the cascade).
        const targets = new Map<string, Signature>([[sigKey(baseSig), baseSig]]);
        for (const defs of byProp.values()) {
            for (const def of defs) {
                if (compatible(baseSig, def.sig)) {
                    const t = union(baseSig, def.sig);
                    targets.set(sigKey(t), t);
                }
            }
        }
        for (let grew = true; grew;) {
            grew = false;
            const list = [...targets.values()];
            for (const a of list) {
                for (const b of list) {
                    if (!compatible(a, b)) continue;
                    const t = union(a, b);
                    const key = sigKey(t);
                    if (!targets.has(key)) {
                        targets.set(key, t);
                        grew = true;
                        if (targets.size > 256) {
                            throw new Error(
                                `[zero-kit] ${where}: inlining ${what} fans out over more than 256 axis compounds — `
                                + 'refusing; restate the value per compound in the recipe instead',
                            );
                        }
                    }
                }
            }
        }

        const out: ResolvedDef[] = [];
        let baseValue: string | undefined;
        for (const target of targets.values()) {
            let substituted = value;
            let complete = true;
            for (const [prop, defs] of byProp) {
                const matching = defs.filter((d) => subset(d.sig, target));
                if (matching.length === 0) {
                    complete = false;
                    break;
                }
                const best = matching.reduce((a, b) => (sigSize(b.sig) > sigSize(a.sig) ? b : a));
                const ties = matching.filter((d) => sigSize(d.sig) === sigSize(best.sig));
                if (ties.some((d) => sigKey(d.sig) !== sigKey(best.sig))) {
                    throw new Error(
                        `[zero-kit] ${where}: custom property "${prop}" has two definitions equally specific under `
                        + `the "${sigKey(target) || 'base'}" compound — the inliner cannot know which one wins`,
                    );
                }
                substituted = substitute(substituted, prop, best.value);
            }
            if (!complete) continue;
            const isBase = sigKey(target) === sigKey(baseSig);
            if (isBase) baseValue = substituted;
            else if (substituted === baseValue) continue;
            out.push({ sig: target, value: substituted });
        }
        if (out.length === 0) {
            throw new Error(
                `[zero-kit] ${where}: ${what} consumes ${consumed.map((p) => `var(${p})`).join(', ')}, whose `
                + 'calc-holding definitions resolve under no compound reachable from this rule — nothing static '
                + 'to inline (signalxjs/lynx#1075 makes shipping the chain a silent no-render on device)',
            );
        }
        return out;
    }

    // 4. Rewrite consumers rule by rule, dropping the now-inert definitions.
    const consumerCounts = new Map<string, number>();
    const out: string[] = [];
    parsed.forEach((rule, ruleIndex) => {
        if (!rule) {
            out.push(rules[ruleIndex]!);
            return;
        }
        const baseDecls: Decl[] = [];
        // Variant emissions, keyed by compound, in first-encounter order.
        const variants = new Map<string, { sig: Signature; decls: Decl[] }>();
        for (const decl of rule.decls) {
            if (decl.prop.startsWith('--') && calcHolding.has(decl.prop)) continue; // inert definition
            const consumed = refsIn(decl.value).filter((p) => calcHolding.has(p));
            if (consumed.length === 0) {
                baseDecls.push(decl);
                continue;
            }
            for (const p of consumed) consumerCounts.set(p, (consumerCounts.get(p) ?? 0) + 1);
            for (const expanded of expandValue(decl.value, rule.sig, `"${decl.prop}: ${decl.value}"`)) {
                if (sigKey(expanded.sig) === sigKey(rule.sig)) {
                    baseDecls.push({ prop: decl.prop, value: expanded.value });
                    continue;
                }
                const key = sigKey(expanded.sig);
                const bucket = variants.get(key) ?? { sig: expanded.sig, decls: [] };
                bucket.decls.push({ prop: decl.prop, value: expanded.value });
                variants.set(key, bucket);
            }
        }
        const print = (selector: string, decls: Decl[]): void => {
            out.push(`${selector} {\n${decls.map((d) => `    ${d.prop}: ${d.value};`).join('\n')}\n}`);
        };
        if (baseDecls.length > 0) print(rule.selector, baseDecls);
        for (const { sig, decls } of variants.values()) {
            print(`${rule.selector}${extraClasses(sig, rule.sig)}`, decls);
        }
    });

    for (const prop of [...calcHolding].sort()) {
        const compounds = resolved.get(prop)?.length ?? definitions.get(prop)!.length;
        report.translated.push({
            where,
            what: prop,
            detail: `calc-holding custom-property chain inlined: value substituted into `
                + `${consumerCounts.get(prop) ?? 0} consumer declaration(s) across ${compounds} compound(s) and `
                + 'the definition dropped — lynx drops any declaration consuming var() of a property whose value '
                + 'holds calc() (measured, signalxjs/lynx#1075)',
        });
    }
    return out;
}
