/**
 * `PartStyles.at` — conditional styles in the recipe compiler.
 *
 * Ordering is load-bearing here, not cosmetic: an at-rule adds NO specificity,
 * so a conditional rule only beats the flat rule it refines by coming later in
 * the stylesheet. Most of these tests assert positions, not just presence.
 */
import { describe, it, expect } from 'vitest';
import { compileRecipeCss, validateDesignSystem } from '@sigx/zero-kit';
import type { DesignSystemInput, ManifestComponent, RecipeInput } from '@sigx/zero-kit';
import { anatomies } from '@sigx/zero/anatomy';

const manifest = {
    components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[],
};
const tabs = manifest.components.find((c) => c.scope === 'tabs')!;
const breakpoints = { sm: '640px', md: '768px', lg: '1024px' };

const compile = (recipe: RecipeInput, ctx = { breakpoints }) =>
    compileRecipeCss(recipe, tabs, ctx);

describe('condition keys', () => {
    it('resolves a declared breakpoint to a min-width query', () => {
        const css = compile({
            component: 'tabs',
            parts: { tab: { at: { md: { base: { padding: '1rem' } } } } },
        });
        expect(css).toContain('@media (min-width: 768px)');
        expect(css).toContain('[data-scope="tabs"][data-part="tab"]');
    });

    it.each([
        ['reduced-motion', '@media (prefers-reduced-motion: reduce)'],
        ['hover-none', '@media (hover: none)'],
        ['prefers-dark', '@media (prefers-color-scheme: dark)'],
        ['forced-colors', '@media (forced-colors: active)'],
        ['print', '@media print'],
    ])('resolves the built-in %s', (key, prelude) => {
        const css = compile({
            component: 'tabs',
            parts: { tab: { at: { [key]: { base: { color: 'red' } } } } },
        });
        expect(css).toContain(prelude);
    });

    /*
     * `print` is a preference-tier condition, like `forced-colors`: it refines
     * the flat rules and must not be overwritten by a wider viewport. Naming it
     * is only worth anything if it lands where the raw prelude used to — the
     * design systems' drawn indicators depend on the print fallback beating
     * the flat state rule it replaces.
     */
    it('sorts print with the other preference queries — after flat rules, before breakpoints', () => {
        const css = compile({
            component: 'tabs',
            parts: {
                tab: {
                    base: { background: 'red' },
                    at: {
                        print: { base: { background: 'transparent' } },
                        lg: { base: { padding: '2rem' } },
                    },
                },
            },
        });
        expect(css.indexOf('background: red')).toBeLessThan(css.indexOf('@media print'));
        expect(css.indexOf('@media print')).toBeLessThan(css.indexOf('@media (min-width: 1024px)'));
    });

    it('passes an @-prefixed key through verbatim', () => {
        const css = compile({
            component: 'tabs',
            parts: {
                tab: {
                    at: {
                        '@container (min-width: 20rem)': { base: { padding: '2rem' } },
                        '@supports (interpolate-size: allow-keywords)': { base: { height: 'auto' } },
                        '@starting-style': { base: { opacity: '0' } },
                    },
                },
            },
        });
        expect(css).toContain('@container (min-width: 20rem) {');
        expect(css).toContain('@supports (interpolate-size: allow-keywords) {');
        expect(css).toContain('@starting-style {');
    });

    it('rejects an unknown key, naming what was available', () => {
        expect(() => compile({
            component: 'tabs',
            parts: { tab: { at: { tablet: { base: { color: 'red' } } } } },
        })).toThrow(/unknown condition "tablet"[\s\S]*sm, md, lg[\s\S]*reduced-motion/);
    });

    it('says so when no breakpoints are declared at all', () => {
        expect(() => compileRecipeCss(
            { component: 'tabs', parts: { tab: { at: { md: { base: { color: 'red' } } } } } },
            tabs,
            {},
        )).toThrow(/declare them in tokens\.breakpoints/);
    });
});

describe('emission order', () => {
    const css = compile({
        component: 'tabs',
        parts: {
            tab: {
                base: { padding: '0.5rem' },
                at: {
                    // Deliberately authored out of order — emission must not
                    // follow the order these were written in.
                    lg: { base: { padding: '2rem' } },
                    'reduced-motion': { base: { transition: 'none' } },
                    sm: { base: { padding: '1rem' } },
                    '@supports (display: grid)': { base: { display: 'grid' } },
                },
            },
        },
    });
    const at = (needle: string) => css.indexOf(needle);

    it('puts every conditional rule after every flat rule', () => {
        expect(at('padding: 0.5rem')).toBeLessThan(at('@supports'));
        expect(at('padding: 0.5rem')).toBeLessThan(at('@media'));
    });

    it('orders breakpoints ascending regardless of authoring order', () => {
        expect(at('@media (min-width: 640px)')).toBeLessThan(at('@media (min-width: 1024px)'));
    });

    it('puts feature queries before breakpoints and reduced-motion last', () => {
        expect(at('@supports')).toBeLessThan(at('@media (min-width: 640px)'));
        expect(at('@media (prefers-reduced-motion: reduce)')).toBeGreaterThan(
            at('@media (min-width: 1024px)'),
        );
    });
});

describe('composition', () => {
    it('merges the same condition across different parts into one block', () => {
        const css = compile({
            component: 'tabs',
            parts: {
                list: { at: { md: { base: { gap: '1rem' } } } },
                tab: { at: { md: { base: { padding: '1rem' } } } },
            },
        });
        expect(css.match(/@media \(min-width: 768px\)/g)).toHaveLength(1);
        expect(css).toContain('gap: 1rem;');
        expect(css).toContain('padding: 1rem;');
    });

    it('nests at-rules when `at` is nested', () => {
        const css = compile({
            component: 'tabs',
            parts: {
                tab: { at: { md: { at: { 'reduced-motion': { base: { transition: 'none' } } } } } },
            },
        });
        const outer = css.indexOf('@media (min-width: 768px)');
        const inner = css.indexOf('@media (prefers-reduced-motion: reduce)');
        expect(outer).toBeGreaterThan(-1);
        expect(inner).toBeGreaterThan(outer);
        expect(css.indexOf('transition: none')).toBeGreaterThan(inner);
    });

    it('applies to states and nested selectors, not just base', () => {
        const css = compile({
            component: 'tabs',
            parts: {
                tab: {
                    at: {
                        md: {
                            states: { active: { fontWeight: '700' } },
                            selectors: { '&::after': { content: '""' } },
                        },
                    },
                },
            },
        });
        const media = css.slice(css.indexOf('@media (min-width: 768px)'));
        expect(media).toContain('[data-state="active"]');
        expect(media).toContain('::after');
    });

    it('gives responsive variants for free', () => {
        // `variants` values are PartStyles, so `at` works there with no
        // separate mechanism — the reason it was designed as one field.
        const css = compile({
            component: 'tabs',
            parts: {},
            variants: {
                size: { lg: { tab: { base: { fontSize: '1rem' }, at: { md: { base: { fontSize: '2rem' } } } } } },
            },
        });
        // `tab` sits below the carrier, so the axis attribute lives on the
        // enclosing `@scope` donut and the breakpoint nests inside it (#317).
        const donut = css.slice(css.indexOf('@scope ([data-scope="tabs"][data-part="root"][data-size="lg"])'));
        expect(donut).toContain('@media (min-width: 768px)');
        expect(donut.slice(donut.indexOf('@media'))).toContain('font-size: 2rem;');
    });
});

describe('RecipeInput.css', () => {
    it('appends raw CSS inside the layer, after everything else', () => {
        const css = compile({
            component: 'tabs',
            parts: { tab: { base: { color: 'red' }, at: { md: { base: { color: 'blue' } } } } },
            css: '.legacy-thing { color: green; }',
        });
        expect(css.indexOf('.legacy-thing')).toBeGreaterThan(css.indexOf('@media'));
        expect(css.slice(css.indexOf('.legacy-thing'))).toContain('}\n'); // still inside the layer
        expect(css).toContain('@layer zero.recipes {');
    });
});

/** A minimal valid design system carrying only the breakpoints under test. */
const dsWith = (bp: Record<string, string>): DesignSystemInput => ({
    name: 'probe',
    recipes: [],
    tokens: {
        roles: { primary: {} },
        breakpoints: bp,
        defaultLight: 'l',
        themes: {
            l: {
                colorScheme: 'light',
                colors: {
                    'base-100': 'oklch(100% 0 0)',
                    'base-200': 'oklch(96% 0 0)',
                    'base-300': 'oklch(92% 0 0)',
                    'base-content': 'oklch(20% 0 0)',
                    primary: 'oklch(50% 0.2 260)',
                    'primary-content': 'oklch(98% 0.01 260)',
                },
            },
        },
    } as DesignSystemInput['tokens'],
});

const errors = (bp: Record<string, string>) =>
    validateDesignSystem(dsWith(bp), manifest).errors.map((e) => e.message);

describe('breakpoint declarations', () => {
    it('accepts an ascending mobile-first list', () => {
        expect(errors(breakpoints)).toEqual([]);
    });

    it('rejects a descending list', () => {
        // Declaration order is emission order, so largest-first would make the
        // wider breakpoint lose to the narrower one.
        expect(errors({ lg: '1024px', sm: '640px' })).toContainEqual(
            expect.stringContaining('mobile-first, ascending'),
        );
    });

    it('rejects a name that collides with a built-in condition', () => {
        expect(errors({ 'reduced-motion': '640px' })).toContainEqual(
            expect.stringContaining('collides with the built-in'),
        );
    });

    it('rejects a breakpoint named `base`', () => {
        // `base` is the key a responsive layout prop uses for its unqualified
        // value — `gap={{ base: 'md' }}` renders `data-l-gap`, never
        // `data-l-base-gap` — so a breakpoint of this name could never be
        // reached. Same class of collision as the built-in conditions above.
        expect(errors({ base: '640px' })).toContainEqual(
            expect.stringContaining('could never be reached'),
        );
    });

    it('rejects a value that is not a length', () => {
        expect(errors({ sm: 'wide' })).toContainEqual(
            expect.stringContaining('is not a px/rem/em length'),
        );
    });
});

describe('breakpoint units', () => {
    it('rejects a mixed-unit list', () => {
        // `30rem` is 480px at the default root size, so this reads as
        // ascending numerically (30 < 400) while actually inverting. The
        // comparison is only sound within one unit.
        expect(errors({ sm: '30rem', md: '400px' })).toContainEqual(
            expect.stringContaining('use one unit throughout'),
        );
    });

    it('accepts an all-rem list', () => {
        expect(errors({ sm: '40rem', md: '48rem', lg: '64rem' })).toEqual([]);
    });
});

describe('prelude collisions', () => {
    it('rejects a raw prelude that duplicates a declared breakpoint', () => {
        // Both resolve to `@media (min-width: 640px)` but sort in different
        // tiers, so the merged block's emission order would depend on which
        // part happened to be visited first. Ambiguity, not a preference.
        expect(() => compile({
            component: 'tabs',
            parts: {
                list: { at: { sm: { base: { gap: '1rem' } } } },
                tab: { at: { '@media (min-width: 640px)': { base: { padding: '1rem' } } } },
            },
        })).toThrow(/both resolve to "@media \(min-width: 640px\)"/);
    });

    it('still merges the same raw prelude used by different parts', () => {
        // The ordinal has to be stable across parts for this to hold — a
        // per-part counter would have split these into two blocks.
        const css = compile({
            component: 'tabs',
            parts: {
                list: { at: { '@supports (display: grid)': { base: { display: 'grid' } } } },
                tab: { at: { '@supports (display: grid)': { base: { placeSelf: 'center' } } } },
            },
        });
        expect(css.match(/@supports \(display: grid\)/g)).toHaveLength(1);
        expect(css).toContain('display: grid;');
        expect(css).toContain('place-self: center;');
    });

    it('keeps raw-prelude ordering stable when parts use different sets', () => {
        const css = compile({
            component: 'tabs',
            parts: {
                list: { at: { '@supports (a: b)': { base: { gap: '1rem' } }, '@supports (c: d)': { base: { gap: '2rem' } } } },
                tab: { at: { '@supports (c: d)': { base: { padding: '1rem' } } } },
            },
        });
        expect(css.match(/@supports \(c: d\)/g)).toHaveLength(1);
    });
});

describe('inherited object keys', () => {
    it('rejects a condition named after an Object.prototype member', () => {
        // `'toString' in breakpoints` is true for a plain object, so this
        // resolved to Object.prototype.toString and emitted
        // `@media (min-width: function toString() { [native code] })`.
        expect(() => compile({
            component: 'tabs',
            parts: { tab: { at: { toString: { base: { color: 'red' } } } } },
        })).toThrow(/unknown condition "toString"/);
        expect(() => compile({
            component: 'tabs',
            parts: { tab: { at: { constructor: { base: { color: 'red' } } } } },
        })).toThrow(/unknown condition "constructor"/);
    });
});
