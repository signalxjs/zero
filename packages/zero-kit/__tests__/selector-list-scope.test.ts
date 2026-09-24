/**
 * A `selectors` key that is a selector LIST (issue #181). The compiler used to
 * treat the key as one selector: a whole-string `&` substitution, or a
 * `${self} ` prefix when the key held no `&`. For a list that scopes only the
 * first item — `'svg, path'` emitted `[scope] svg, path`, and `'&:hover, svg'`
 * emitted `[scope]:hover, svg` — so the unscoped items became global rules in
 * the recipes layer. Every item of the list must be scoped on its own, and the
 * split must happen on top-level commas only: a comma inside `:not(…)`, an
 * attribute selector or a quoted string belongs to that item.
 *
 * Written red-first: the list cases below compiled with global items on main.
 */
import { describe, expect, it } from 'vitest';
import { anatomies } from '@sigx/zero/anatomy';
import type { ManifestComponent, RecipeInput } from '@sigx/zero-kit';
import { compileRecipeCss } from '@sigx/zero-kit';

const button = anatomies.button.toJSON() as ManifestComponent;
const ROOT = '[data-scope="button"][data-part="root"]';

const compile = (selectors: Record<string, Record<string, string>>): string =>
    compileRecipeCss({ component: 'button', parts: { root: { selectors } } } as RecipeInput, button);

/** The selector prelude of every emitted rule whose block declares `decl`. */
function preludesFor(css: string, decl: string): string[] {
    const out: string[] = [];
    for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        if (match[2]!.includes(decl)) out.push(match[1]!.trim());
    }
    return out;
}

/** Split a prelude into its list items (the test inputs hold no nested commas outside parens/quotes). */
function items(prelude: string): string[] {
    const out: string[] = [];
    let depth = 0;
    let quote = '';
    let start = 0;
    for (let i = 0; i < prelude.length; i++) {
        const ch = prelude[i]!;
        if (quote) { if (ch === quote) quote = ''; continue; }
        if (ch === '"' || ch === "'") quote = ch;
        else if (ch === '(' || ch === '[') depth++;
        else if (ch === ')' || ch === ']') depth--;
        else if (ch === ',' && depth === 0) { out.push(prelude.slice(start, i).trim()); start = i + 1; }
    }
    out.push(prelude.slice(start).trim());
    return out;
}

describe('selectors keys that are selector lists', () => {
    it('scopes every item of a list with no &', () => {
        const [prelude] = preludesFor(compile({ 'svg, path': { fill: 'red' } }), 'fill: red');
        expect(items(prelude!)).toEqual([`${ROOT} svg`, `${ROOT} path`]);
    });

    it('scopes an item without & in a list whose other item has one', () => {
        const [prelude] = preludesFor(compile({ '&:hover, svg': { color: 'blue' } }), 'color: blue');
        expect(items(prelude!)).toEqual([`${ROOT}:hover`, `${ROOT} svg`]);
    });

    it('leaves no item of any list unscoped', () => {
        const css = compile({
            'svg, path': { fill: 'red' },
            '&:hover, svg': { color: 'blue' },
            'svg,&:focus-visible ,  > .icon': { outline: 'none' },
        });
        for (const decl of ['fill: red', 'color: blue', 'outline: none']) {
            for (const prelude of preludesFor(css, decl)) {
                for (const item of items(prelude)) expect(item.startsWith(ROOT), `${decl}: ${item}`).toBe(true);
            }
        }
    });

    it('splits on top-level commas only', () => {
        const css = compile({
            '&:not([data-disabled], [data-invalid])': { color: 'green' },
            '[aria-label="a, b"], svg': { color: 'purple' },
            ':is(svg, path)': { color: 'orange' },
        });
        expect(preludesFor(css, 'color: green')).toEqual([`${ROOT}:not([data-disabled], [data-invalid])`]);
        expect(items(preludesFor(css, 'color: purple')[0]!)).toEqual([
            `${ROOT} [aria-label="a, b"]`,
            `${ROOT} svg`,
        ]);
        expect(preludesFor(css, 'color: orange')).toEqual([`${ROOT} :is(svg, path)`]);
    });

    it('keeps a list whose every item carries & byte-identical', () => {
        const css = compile({ '&:hover, &:focus-visible': { color: 'teal' } });
        expect(preludesFor(css, 'color: teal')).toEqual([`${ROOT}:hover, ${ROOT}:focus-visible`]);
    });

    it('rejects an empty list item', () => {
        expect(() => compile({ 'svg, , path': { fill: 'red' } })).toThrow(/empty item/);
        expect(() => compile({ '&:hover,': { fill: 'red' } })).toThrow(/empty item/);
    });

    it('splits past a backslash escape and a comment instead of swallowing the rest of the list', () => {
        const css = compile({
            '.a\\(b, path': { fill: 'red' },
            '.a\\"b, path': { fill: 'blue' },
            "svg /* it's */, path": { fill: 'green' },
        });
        expect(preludesFor(css, 'fill: red')[0]!.split(',').map((s) => s.trim())).toEqual([`${ROOT} .a\\(b`, `${ROOT} path`]);
        expect(preludesFor(css, 'fill: blue')[0]!.split(',').map((s) => s.trim())).toEqual([
            `${ROOT} .a\\"b`,
            `${ROOT} path`,
        ]);
        expect(preludesFor(css, 'fill: green')[0]!.split(',').map((s) => s.trim())).toEqual([
            `${ROOT} svg /* it's */`,
            `${ROOT} path`,
        ]);
    });

    it('rejects a key it cannot balance rather than returning it as one item', () => {
        expect(() => compile({ ':is(svg, path': { fill: 'red' } })).toThrow(/unclosed/);
        expect(() => compile({ 'svg), path': { fill: 'red' } })).toThrow(/closes nothing/);
        expect(() => compile({ ':is(svg], path': { fill: 'red' } })).toThrow(/closes nothing/);
        expect(() => compile({ '[title="x], path': { fill: 'red' } })).toThrow(/unterminated " string/);
        expect(() => compile({ 'svg /* x, path': { fill: 'red' } })).toThrow(/unterminated comment/);
    });

    it('never substitutes an & that is text — in a string, a comment or escaped', () => {
        const css = compile({
            '[title="x & y"], svg': { color: 'red' },
            'svg /* & */': { color: 'blue' },
            '.a\\&b': { color: 'green' },
        });
        expect(items(preludesFor(css, 'color: red')[0]!)).toEqual([`${ROOT} [title="x & y"]`, `${ROOT} svg`]);
        expect(preludesFor(css, 'color: blue')).toEqual([`${ROOT} svg /* & */`]);
        expect(preludesFor(css, 'color: green')).toEqual([`${ROOT} .a\\&b`]);
    });

    it('rejects an & that sits only inside a nested list, whose siblings it would not scope', () => {
        expect(() => compile({ ':is(&:hover, svg)': { color: 'red' } })).toThrow(/nested selector list/);
        expect(() => compile({ 'svg, :where(&.a, .b) path': { color: 'red' } })).toThrow(/nested selector list/);
    });

    it('accepts an & inside a single-argument function, or beside a top-level &', () => {
        const css = compile({
            ':where(.dark &)': { color: 'red' },
            '&:not(&.a, .b)': { color: 'blue' },
        });
        expect(preludesFor(css, 'color: red')).toEqual([`:where(.dark ${ROOT})`]);
        expect(preludesFor(css, 'color: blue')).toEqual([`${ROOT}:not(${ROOT}.a, .b)`]);
    });
});
