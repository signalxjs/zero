/**
 * The static contrast matrix's cascade model (#403, slice C): computed
 * colours from parsed rules, in CSS order, with every place a static reader
 * cannot answer surfacing as `Unmeasured` rather than as a default.
 */
import { describe, it, expect } from 'vitest';
import { parseRules } from '../src/audit/css-rules.js';
import type { StyleNode } from '../src/audit/contrast/cascade.js';
import {
    Unmeasured, background, borderInk, clipCollapsed, collapsed, colorOf, computeChain, opacity,
} from '../src/audit/contrast/cascade.js';
import type { ThemeEnv } from '../src/audit/contrast/theme-env.js';
import { hex, resolveOver } from '../src/audit/contrast/color.js';
import { evaluateMedia, REFERENCE_MEDIA } from '../src/audit/contrast/cascade.js';

const env: ThemeEnv = {
    name: 't',
    colorScheme: 'light',
    colors: { 'base-100': '#ffffff', 'base-content': '#111111', primary: '#0000ff', 'primary-content': '#ffffff' },
    props: {
        '--color-base-100': '#ffffff', '--color-base-content': '#111111',
        '--color-primary': '#0000ff', '--color-primary-content': '#ffffff',
        '--disabled-opacity': '0.4', '--space-md': '1rem', '--ink': 'var(--color-primary)',
    },
};

const chain = (...parts: Array<[string, Record<string, string>]>): StyleNode[] => {
    const nodes: StyleNode[] = [];
    for (const [part, extra] of parts) {
        const parent = nodes[nodes.length - 1];
        if (parent) parent.hasElementChildren = true;
        nodes.push({
            scope: 'x', part, element: 'div', hasElementChildren: false,
            attrs: new Map([['data-scope', 'x'], ['data-part', part], ...Object.entries(extra)]),
            ...(parent ? { parent } : {}),
        });
    }
    return nodes;
};

const css = (text: string) => parseRules(`@layer zero.recipes {\n${text}\n}`);
const rgb = (c: { rgb: [number, number, number]; alpha: number }) => hex(resolveOver(c, [255, 255, 255]));

describe('cascade order', () => {
    it('later source wins at equal specificity; higher specificity wins regardless of order', () => {
        const rules = css(`
            [data-scope="x"][data-part="a"][data-state="on"] { color: red; }
            [data-scope="x"][data-part="a"] { color: blue; }
            [data-scope="x"][data-part="a"] { color: green; }
        `);
        const [off] = computeChain(chain(['a', {}]), rules, env);
        expect(rgb(colorOf(off!, 'self', env))).toBe('#008000');
        const [on] = computeChain(chain(['a', { 'data-state': 'on' }]), rules, env);
        expect(rgb(colorOf(on!, 'self', env))).toBe('#ff0000');
    });

    it('!important beats specificity', () => {
        const rules = css(`
            [data-scope="x"][data-part="a"] { color: red !important; }
            [data-scope="x"][data-part="a"][data-state="on"] { color: blue; }
        `);
        const [on] = computeChain(chain(['a', { 'data-state': 'on' }]), rules, env);
        expect(rgb(colorOf(on!, 'self', env))).toBe('#ff0000');
    });

    it('excludes conditional at-rules and keeps @layer / @scope', () => {
        const rules = parseRules(`
            @layer zero.recipes {
                [data-scope="x"][data-part="a"] { color: blue; }
                @media (prefers-color-scheme: dark) { [data-scope="x"][data-part="a"] { color: red; } }
                @scope ([data-scope="x"][data-part="root"][data-color="primary"]) to ([data-scope="x"][data-part="root"]) {
                    [data-scope="x"][data-part="a"] { color: green; }
                }
            }
        `);
        const plain = computeChain(chain(['root', {}], ['a', {}]), rules, env);
        expect(rgb(colorOf(plain[1]!, 'self', env))).toBe('#0000ff');
        const scoped = computeChain(chain(['root', { 'data-color': 'primary' }], ['a', {}]), rules, env);
        expect(rgb(colorOf(scoped[1]!, 'self', env))).toBe('#008000');
    });
});

describe('values', () => {
    it('resolves var() through the node, its ancestors and the theme, with fallbacks', () => {
        const rules = css(`
            [data-scope="x"][data-part="root"] { --accent: var(--color-primary); }
            [data-scope="x"][data-part="a"] { color: var(--accent); background: var(--nope, var(--color-base-content)); }
        `);
        const [, a] = computeChain(chain(['root', {}], ['a', {}]), rules, env);
        expect(rgb(colorOf(a!, 'self', env))).toBe('#0000ff');
        expect(rgb(background(a!, 'self', env).color)).toBe('#111111');
        // A theme value that is itself a var() chain resolves too.
        const [b] = computeChain(chain(['a', {}]), css('[data-scope="x"][data-part="a"] { color: var(--ink); }'), env);
        expect(rgb(colorOf(b!, 'self', env))).toBe('#0000ff');
    });

    it('a custom property resolves at the declaring element and inherits resolved', () => {
        const rules = css(`
            [data-scope="x"][data-part="root"] { --tone: var(--color-primary); }
            [data-scope="x"][data-part="a"] { --color-primary: red; color: var(--tone); }
        `);
        const [, a] = computeChain(chain(['root', {}], ['a', {}]), rules, env);
        // `--tone` was computed on root against root's `--color-primary`.
        expect(rgb(colorOf(a!, 'self', env))).toBe('#0000ff');
    });

    it('currentColor is the computed color; color inherits down the chain to base-content', () => {
        const rules = css(`
            [data-scope="x"][data-part="root"] { color: var(--color-primary); }
            [data-scope="x"][data-part="a"] { border: 2px solid currentColor; }
        `);
        const [, a] = computeChain(chain(['root', {}], ['a', {}]), rules, env);
        expect(rgb(colorOf(a!, 'self', env))).toBe('#0000ff');
        expect(rgb(borderInk(a!, 'self', env)!)).toBe('#0000ff');
        const [lone] = computeChain(chain(['a', {}]), [], env);
        expect(rgb(colorOf(lone!, 'self', env))).toBe('#111111');
    });

    it('bakes colour functions per theme — color-mix with transparent keeps its lightness', () => {
        const rules = css('[data-scope="x"][data-part="a"] { color: color-mix(in oklch, var(--color-base-content) 50%, transparent); }');
        const [a] = computeChain(chain(['a', {}]), rules, env);
        const c = colorOf(a!, 'self', env);
        expect(c.alpha).toBeCloseTo(0.5, 2);
        // Premultiplied: the RGB stays #111111, only alpha drops.
        expect(c.rgb.map(Math.round)).toEqual([17, 17, 17]);
    });

    it('reads the background shorthand and longhands by whichever came last', () => {
        const rules = css(`
            [data-scope="x"][data-part="a"] { background-color: red; background: blue; }
            [data-scope="x"][data-part="b"] { background: red; background-color: blue; }
            [data-scope="x"][data-part="c"] { background: none, var(--noise); --noise: none; }
        `);
        const [a] = computeChain(chain(['a', {}]), rules, env);
        expect(rgb(background(a!, 'self', env).color)).toBe('#0000ff');
        const [b] = computeChain(chain(['b', {}]), rules, env);
        expect(rgb(background(b!, 'self', env).color)).toBe('#0000ff');
        const [c] = computeChain(chain(['c', {}]), rules, env);
        expect(background(c!, 'self', env).image).toBeUndefined();
    });

    it('reads borders through physical, logical and multi-value spellings, widest painted side wins', () => {
        const rules = css(`
            [data-scope="x"][data-part="a"] { border: 1px solid red; border-inline-start: 3px solid blue; }
            [data-scope="x"][data-part="b"] { border-width: 1px 2px; border-style: solid; border-color: red green; }
            [data-scope="x"][data-part="c"] { border: 1px solid red; border-style: none; }
        `);
        const [a] = computeChain(chain(['a', {}]), rules, env);
        expect(rgb(borderInk(a!, 'self', env)!)).toBe('#0000ff');
        const [b] = computeChain(chain(['b', {}]), rules, env);
        expect(rgb(borderInk(b!, 'self', env)!)).toBe('#008000');
        const [c] = computeChain(chain(['c', {}]), rules, env);
        expect(borderInk(c!, 'self', env)).toBeUndefined();
    });

    it('opacity reads tokens and percentages', () => {
        const rules = css('[data-scope="x"][data-part="a"][data-disabled] { opacity: var(--disabled-opacity); } [data-scope="x"][data-part="b"] { opacity: 50%; }');
        const [a] = computeChain(chain(['a', { 'data-disabled': '' }]), rules, env);
        expect(opacity(a!, 'self', env)).toBe(0.4);
        const [b] = computeChain(chain(['b', {}]), rules, env);
        expect(opacity(b!, 'self', env)).toBe(0.5);
    });
});

describe('collapsed geometry', () => {
    it('a zero-determinant transform, a zero scale axis, an empty clip-path', () => {
        const rules = css(`
            [data-scope="x"][data-part="a"] { transform: translateX(calc(1 * 2rem)) scale(0); }
            [data-scope="x"][data-part="b"] { scale: 0 1; }
            [data-scope="x"][data-part="c"] { clip-path: inset(0 100% 0 0); }
            [data-scope="x"][data-part="d"] { transform: translateY(-50%) rotate(45deg); }
        `);
        for (const [part, want] of [['a', true], ['b', true], ['c', true], ['d', false]] as const) {
            const [n] = computeChain(chain([part, {}]), rules, env);
            expect(collapsed(n!, 'self', env), part).toBe(want);
        }
    });

    it('clipCollapsed reads the shipped clip shapes', () => {
        expect(clipCollapsed('polygon(0 0, 0 0, 0 0)')).toBe(true);
        expect(clipCollapsed('polygon(15.1% 41.3%, 1% 55%, 37.6% 92.8%, 99% 19.8%, 83.9% 7.2%, 36.6% 63.5%)')).toBe(false);
        expect(clipCollapsed('inset(0 50% 0 50%)')).toBe(true);
        expect(clipCollapsed('circle(0)')).toBe(true);
        expect(clipCollapsed('none')).toBe(false);
    });

    it('a transform it cannot reduce is unknown-geometry', () => {
        const [n] = computeChain(chain(['a', {}]), css('[data-scope="x"][data-part="a"] { transform: matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1); }'), env);
        expect(() => collapsed(n!, 'self', env)).toThrow(Unmeasured);
        try { collapsed(n!, 'self', env); } catch (e) { expect((e as Unmeasured).reason).toBe('unknown-geometry'); }
    });
});

describe('what stops a reading', () => {
    const reasonOf = (fn: () => unknown): string => {
        try { fn(); } catch (e) { if (e instanceof Unmeasured) return e.reason; throw e; }
        return 'measured';
    };

    it('an unresolvable var() with no fallback', () => {
        const [a] = computeChain(chain(['a', {}]), css('[data-scope="x"][data-part="a"] { color: var(--nope); }'), env);
        expect(reasonOf(() => colorOf(a!, 'self', env))).toBe('unresolved-var');
    });

    it('a runtime-published property with no fallback', () => {
        const [a] = computeChain(chain(['a', {}]), css('[data-scope="x"][data-part="a"] { color: var(--press-x); }'), env);
        expect(reasonOf(() => colorOf(a!, 'self', env))).toBe('runtime-property');
    });

    it('a value culori cannot evaluate', () => {
        const [a] = computeChain(chain(['a', {}]), css('[data-scope="x"][data-part="a"] { color: oklch(calc(1rem) 0 0); }'), env);
        expect(reasonOf(() => colorOf(a!, 'self', env))).toBe('unparseable-color');
    });

    it('a rule the matcher cannot evaluate taints the properties it declares — never a silent skip', () => {
        const rules = css(`
            [data-scope="x"][data-part="a"] { color: blue; }
            [data-scope="x"][data-part="a"]:nth-child(2n) { color: red; }
        `);
        const [a] = computeChain(chain(['a', {}]), rules, env);
        expect(reasonOf(() => colorOf(a!, 'self', env))).toBe('unsupported-selector');
        // …but a property the unknown rule does not touch still reads.
        expect(rgb(background(a!, 'self', env).color)).toBe('#ffffff');
    });

    it('a taint on a custom property propagates to whatever reads it', () => {
        const rules = css(`
            [data-scope="x"][data-part="a"] { --ink: red; color: var(--ink); }
            [data-scope="x"][data-part="a"]:nth-child(2n) { --ink: blue; }
        `);
        const [a] = computeChain(chain(['a', {}]), rules, env);
        expect(reasonOf(() => colorOf(a!, 'self', env))).toBe('unsupported-selector');
    });

    it('a raw-css selector is raw-css', () => {
        const [a] = computeChain(chain(['a', {}]), css('[data-scope="x"][data-part="a"] { color: blue; } & .x { color: red; }'), env);
        expect(reasonOf(() => colorOf(a!, 'self', env))).toBe('raw-css');
    });
});

describe('evaluateMedia — the reference page', () => {
    it('is the browser matrix\'s page: a 1280×720 desktop with a fine pointer that hovers', () => {
        expect(REFERENCE_MEDIA.width).toBe(1280);
        expect(REFERENCE_MEDIA.discrete['hover']).toBe('hover');
        expect(REFERENCE_MEDIA.discrete['prefers-color-scheme']).toBe('light');
    });

    it.each([
        ['@media (min-width: 640px)', 'yes'],
        ['@media (min-width: 40rem)', 'yes'],
        ['@media (min-width: 1281px)', 'no'],
        ['@media (max-width: 600px)', 'no'],
        ['@media (width >= 600px)', 'yes'],
        ['@media (600px <= width <= 900px)', 'no'],
        ['@media (hover: none)', 'no'],
        ['@media (hover: hover) and (pointer: fine)', 'yes'],
        ['@media (prefers-reduced-motion: reduce)', 'no'],
        ['@media (prefers-color-scheme: dark)', 'no'],
        ['@media (forced-colors: active)', 'no'],
        ['@media print', 'no'],
        ['@media screen and (min-width: 1px)', 'yes'],
        ['@media not print', 'yes'],
        ['@media not all and (min-width: 2000px)', 'yes'],
        ['@media (max-width: 600px), (min-width: 1000px)', 'yes'],
        ['@media (min-width: 50vw)', 'unknown'],
        ['@media (color-gamut: p3)', 'unknown'],
        ['@media (orientation: landscape)', 'yes'],
        ['@media', 'yes'],
    ] as const)('%s → %s', (query, verdict) => {
        expect(evaluateMedia(query)).toBe(verdict);
    });
});

// ── What the browser parity gate found (#403, slice D) ─────────────────────

const chainOf = (element: string, part: string, rulesText: string, envOverride: Partial<ThemeEnv> = {}) => {
    const node: StyleNode = {
        scope: 'x', part, element, hasElementChildren: false,
        attrs: new Map([['data-scope', 'x'], ['data-part', part]]),
    };
    const e = { ...env, ...envOverride };
    return computeChain([node], css(rulesText), e)[0]!;
};

describe('border widths the browser draws (parity gate)', () => {
    it('folds a calc() width, nested and in rem, instead of reading it as zero', () => {
        // The spinner's ring and the carousel dot are `calc(var(--border) * 2)`
        // strokes; the status dot's is `calc(calc(0.25rem * 2.5) / 2)`. Every
        // one read as "no width" and the mark as unpainted, while the browser
        // painted it at 6:1.
        const a = chainOf('div', 'a', `[data-scope="x"][data-part="a"] { border: calc(1px * 2) solid red; }`);
        expect(rgb(borderInk(a, 'self', env)!)).toBe('#ff0000');
        const b = chainOf('div', 'b', `[data-scope="x"][data-part="b"] { border: calc(calc(0.25rem * 3) / 2) solid blue; }`);
        expect(rgb(borderInk(b, 'self', env)!)).toBe('#0000ff');
    });

    it('a width it cannot evaluate is unmeasured, never "no border"', () => {
        const a = chainOf('div', 'a', `[data-scope="x"][data-part="a"] { border-width: max(1px, 0.5%); border-style: solid; border-color: red; }`);
        expect(() => borderInk(a, 'self', env)).toThrow(Unmeasured);
        try { borderInk(a, 'self', env); } catch (e) { expect((e as Unmeasured).reason).toBe('unknown-geometry'); }
    });
});

describe('the user agent stylesheet (parity gate)', () => {
    it('a real <button> that no recipe colours renders buttontext, not its parent\'s ink', () => {
        // steps/item is a `<button>`; the browser chain builds a real one and
        // measured 20:1 (black on the page) where the static reader inherited
        // base-content and said 14.9:1.
        const light = chainOf('button', 'a', ``);
        expect(rgb(colorOf(light, 'self', env))).toBe('#000000');
        expect(rgb(background(light, 'self', env).color)).toBe('#efefef');
        expect(rgb(borderInk(light, 'self', env)!)).toBe('#000000');
        const dark = chainOf('button', 'a', ``, { colorScheme: 'dark' });
        expect(rgb(colorOf(dark, 'self', { ...env, colorScheme: 'dark' }))).toBe('#ffffff');
    });

    it('a recipe declaration beats the UA default, shorthand included', () => {
        const a = chainOf('button', 'a', `[data-scope="x"][data-part="a"] { color: var(--color-primary); background: transparent; border: none; }`);
        expect(rgb(colorOf(a, 'self', env))).toBe('#0000ff');
        expect(background(a, 'self', env).color.alpha).toBe(0);
        expect(borderInk(a, 'self', env)).toBeUndefined();
    });

    it('an anchor is linktext; a div still inherits', () => {
        expect(rgb(colorOf(chainOf('a', 'a', ``), 'self', env))).toBe('#0000ee');
        expect(rgb(colorOf(chainOf('div', 'a', ``), 'self', env))).toBe('#111111');
    });
});
