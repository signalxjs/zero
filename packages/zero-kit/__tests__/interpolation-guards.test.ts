/**
 * Interpolation guards on the recipe compiler's remaining verbatim sites
 * (issue #318). `assertAxisToken` guards axis names/values and
 * `PSEUDO_ELEMENT_PATTERN` guards pseudo projections; before these guards the
 * other sites — declaration property names, declaration values, keyframes
 * names, `selectors` keys — were written into the stylesheet verbatim, so a
 * brace or semicolon in any of them emitted rules the recipe never declared.
 *
 * Each `it` seeds the documented incident input and expects the hard error.
 * Written red-first: every input below compiled clean before the guard.
 */
import { describe, expect, it } from 'vitest';
import { anatomies } from '@sigx/zero/anatomy';
import type { ManifestComponent, RecipeInput } from '@sigx/zero-kit';
import { compileRecipeCss } from '@sigx/zero-kit';

const button = anatomies.button.toJSON() as ManifestComponent;

const compile = (recipe: Partial<RecipeInput>): string =>
    compileRecipeCss({ component: 'button', parts: {}, ...recipe } as RecipeInput, button);

describe('declaration property names', () => {
    it('rejects a property name carrying a brace/semicolon (selector injection)', () => {
        expect(() => compile({
            parts: { root: { base: { 'x;} [data-scope]{color': 'red' } } },
        })).toThrow(/not a CSS property name/);
    });

    it('rejects a property name with spaces', () => {
        expect(() => compile({
            parts: { root: { base: { 'not a prop': 'red' } } },
        })).toThrow(/not a CSS property name/);
    });

    it('guards component tokens through the same door', () => {
        expect(() => compile({
            tokens: { 'x;} html{background': 'red' },
        })).toThrow(/not a CSS property name/);
    });

    it('accepts camelCase, kebab-case, vendor prefixes and custom properties', () => {
        const css = compile({
            parts: {
                root: {
                    base: {
                        paddingInlineStart: '1rem',
                        'border-radius': '0.5rem',
                        WebkitLineClamp: '2',
                        '--button-accent': 'var(--color-primary)',
                    },
                },
            },
        });
        expect(css).toContain('padding-inline-start: 1rem;');
        expect(css).toContain('-webkit-line-clamp: 2;');
        expect(css).toContain('--button-accent: var(--color-primary);');
    });
});

describe('declaration values', () => {
    it('rejects a value that closes the block and opens another rule', () => {
        expect(() => compile({
            parts: { root: { base: { color: 'red; } [data-part="label"] { color: blue' } } },
        })).toThrow(/cannot hold a brace, semicolon or newline/);
    });

    it('rejects braces and newlines independently of semicolons', () => {
        for (const value of ['red }', '{ color: red', 'red\ncolor: blue']) {
            expect(() => compile({
                parts: { root: { base: { color: value } } },
            }), JSON.stringify(value)).toThrow(/cannot hold a brace, semicolon or newline/);
        }
    });

    it('accepts functional values, quotes and commas', () => {
        const css = compile({
            parts: {
                root: {
                    base: {
                        boxShadow: '0 0 0 1px oklch(50% 0.1 260), 0 2px 8px oklch(0% 0 0 / 0.2)',
                        content: '"→"',
                        fontFamily: "'Inter', ui-sans-serif, system-ui",
                    },
                },
            },
        });
        expect(css).toContain('content: "→";');
    });
});

describe('keyframes names', () => {
    it('rejects a name that escapes into a selector', () => {
        expect(() => compile({
            parts: { root: { base: { color: 'red' } } },
            keyframes: { 'spin { } :root { --x: 1 } @keyframes y': 'to { rotate: 1turn; }' },
        })).toThrow(/not a CSS identifier/);
    });

    it('rejects a CSS-wide keyword as a name', () => {
        expect(() => compile({
            parts: { root: { base: { color: 'red' } } },
            keyframes: { none: 'to { rotate: 1turn; }' },
        })).toThrow(/CSS keyword/);
    });

    it('accepts the identifier grammar the shipped design systems use', () => {
        const css = compile({
            parts: { root: { base: { color: 'red' } } },
            keyframes: { 'zero-basic-spin': 'to { rotate: 1turn; }', fadeIn: 'to { opacity: 1; }' },
        });
        expect(css).toContain('@keyframes zero-basic-spin {');
        expect(css).toContain('@keyframes fadeIn {');
    });
});

describe('selectors keys', () => {
    it('rejects a nested selector that closes the rule it sits in', () => {
        expect(() => compile({
            parts: { root: { selectors: { '& svg { } [data-scope="dialog"] { color: red } &': { color: 'red' } } } },
        })).toThrow(/cannot hold a brace, semicolon or newline/);
    });

    it('rejects semicolons and newlines in a selector key', () => {
        for (const selector of ['& svg;', '& svg\n{']) {
            expect(() => compile({
                parts: { root: { selectors: { [selector]: { color: 'red' } } } },
            }), JSON.stringify(selector)).toThrow(/cannot hold a brace, semicolon or newline/);
        }
    });

    it('accepts real nested selectors, with and without &', () => {
        const css = compile({
            parts: {
                root: {
                    selectors: {
                        '& > svg': { flexShrink: '0' },
                        '&:hover::after': { opacity: '1' },
                        '[data-part="label"]': { fontWeight: 'var(--weight-medium)' },
                    },
                },
            },
        });
        expect(css).toContain('[data-scope="button"][data-part="root"] > svg {');
    });
});
