/**
 * `RecipeInput.composes` — a recipe styling a declared nested scope in
 * context (#63).
 *
 * The need came from andtii/agentic: a composer resizes its embedded button,
 * an approval card sizes the buttons in its footer. With no sanctioned route
 * those rules went to the raw `css` hatch and to unlayered app CSS, spelled as
 * hand-written cross-scope selectors nothing checked. `composes` is the same
 * selector, generated, and held to the manifest: the nested scope, the host
 * part it sits in, and every part and state it styles must be declared.
 */
import { describe, expect, it } from 'vitest';
import { anatomies } from '@sigx/zero/anatomy';
import { compileDesignSystem, compileRecipeCss, extendDesignSystem, fitRecipesToVocabulary, validateDesignSystem } from '@sigx/zero-kit';
import type { ManifestComponent, RecipeInput, TokensInput } from '@sigx/zero-kit';
import { designSystem as basic } from '@sigx/zero-basic';
import { compileLynxRecipeCss, emptyReport } from '../src/targets/lynx/index.js';

const manifest = { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] };
const components = new Map(manifest.components.map((c) => [c.scope, c]));
const card = components.get('card')!;
const breakpoints = { sm: '640px', md: '768px' };

const compile = (composes: RecipeInput['composes']) =>
    compileRecipeCss({ component: 'card', parts: {}, composes }, card, { breakpoints, components });

describe('the emitted selector', () => {
    it('nests the part under the host carrier by default', () => {
        const css = compile({ button: { parts: { root: { base: { minBlockSize: '2rem' } } } } });
        expect(css).toContain('[data-scope="card"][data-part="root"] [data-scope="button"][data-part="root"] {');
    });

    it('nests under the named host part with `within`', () => {
        const css = compile({ button: { within: 'footer', parts: { root: { base: { flex: '1' } } } } });
        expect(css).toContain('[data-scope="card"][data-part="footer"] [data-scope="button"][data-part="root"] {');
    });

    it("resolves states through the NESTED part's anatomy, and composes with `at`", () => {
        const css = compile({
            button: {
                parts: {
                    root: {
                        states: { disabled: { opacity: '0.5' }, hover: { filter: 'none' } },
                        at: { 'below-md': { base: { inlineSize: '100%' } } },
                    },
                },
            },
        });
        expect(css).toContain('[data-scope="card"][data-part="root"] [data-scope="button"][data-part="root"][data-disabled] {');
        expect(css).toMatch(/\[data-scope="button"\]\[data-part="root"\]:hover/);
        expect(css).toMatch(/@media \(width < 768px\) \{\s*\[data-scope="card"\]\[data-part="root"\] \[data-scope="button"\]\[data-part="root"\] \{/);
    });
});

describe('held to the manifest', () => {
    it.each([
        ['an undeclared scope', { 'acme-thing': { parts: { root: {} } } }, /"acme-thing" is not a component the manifest declares/],
        ['the host itself', { card: { parts: { root: {} } } }, /a component cannot compose itself/],
        ['a host part that does not exist', { button: { within: 'actions', parts: { root: {} } } }, /within "actions" is not a part of "card"/],
        ['a nested part that does not exist', { button: { parts: { icon: {} } } }, /"icon" is not a part of "button"/],
    ])('refuses %s', (_label, composes, message) => {
        expect(() => compile(composes as RecipeInput['composes'])).toThrow(message);
    });

    it('refuses a state the nested part does not carry', () => {
        expect(() => compile({ button: { parts: { root: { states: { open: { color: 'red' } } } } } }))
            .toThrow(/unknown state "open"/);
    });

    it('needs the manifest to resolve against', () => {
        expect(() => compileRecipeCss(
            { component: 'card', parts: {}, composes: { button: { parts: { root: {} } } } },
            card,
        )).toThrow(/composes needs the manifest/);
    });
});

describe('through a design system', () => {
    const withComposition = (composes: RecipeInput['composes']) =>
        extendDesignSystem(basic, { name: 'basic', recipes: { card: { composes } } });

    it('compiles into the host scope\'s own stylesheet', () => {
        const compiled = compileDesignSystem(
            withComposition({ button: { within: 'footer', parts: { root: { base: { flex: '1' } } } } }),
            manifest,
        );
        expect(compiled.componentCss['card']).toContain('[data-scope="card"][data-part="footer"] [data-scope="button"][data-part="root"]');
        expect(compiled.componentCss['button']).not.toContain('data-scope="card"');
    });

    it('reports a manifest violation as a validation error, not a throw', () => {
        const result = validateDesignSystem(withComposition({ button: { parts: { icon: {} } } }), manifest);
        expect(result.errors.map((e) => e.message)).toContainEqual(expect.stringMatching(/"icon" is not a part of "button"/));
    });

    it('checks the content like any other declaration', () => {
        const result = validateDesignSystem(
            withComposition({ button: { parts: { root: { base: { color: 'var(--color-brnad)' } } } } }),
            manifest,
        );
        expect(result.errors.map((e) => `${e.where}: ${e.message}`).join('\n')).toMatch(/composes\.button\.parts\.root\.base[\s\S]*--color-brnad/);
    });
});

describe('beyond the web target', () => {
    it('is dropped on lynx, with a report entry naming it', () => {
        const report = emptyReport();
        const css = compileLynxRecipeCss(
            { component: 'card', parts: { root: { base: { padding: '1rem' } } }, composes: { button: { parts: { root: { base: { flex: '1' } } } } } },
            card,
            report,
        );
        expect(css).not.toContain('button');
        expect(report.dropped).toContainEqual(expect.objectContaining({ what: 'composes["button"]' }));
    });

    it('is fitted like any other declaration', () => {
        const tokens: TokensInput = {
            roles: {},
            themes: { l: { colorScheme: 'light', colors: { 'base-100': 'white', 'base-200': 'white', 'base-300': 'white', 'base-content': 'black' } } },
            defaultLight: 'l',
        };
        const [fitted] = fitRecipesToVocabulary(
            [{ component: 'card', parts: {}, composes: { button: { parts: { root: { base: { color: 'var(--color-primary)' } } } } } }],
            tokens,
        );
        expect(JSON.stringify(fitted!.composes)).not.toContain('--color-primary');
    });
});

// ── #91: borrowing the nested recipe's own axis values, and compositions
//    conditioned on the host's axes ─────────────────────────────────────────

const basicRecipes = new Map(basic.recipes.map((r) => [r.component, r]));
const borrow = (recipe: Omit<RecipeInput, 'component' | 'parts'> & { parts?: RecipeInput['parts'] }) =>
    compileRecipeCss({ component: 'card', parts: {}, ...recipe }, card, { breakpoints, components, recipes: basicRecipes });
const cardFooter = '[data-scope="card"][data-part="footer"]';
const buttonRoot = '[data-scope="button"][data-part="root"]';

describe('borrowing a nested scope\'s axis value (#91)', () => {
    it('re-emits the nested recipe\'s value rules in context, guarded so an explicit prop wins', () => {
        const css = borrow({ composes: { button: { within: 'footer', axes: { size: 'sm' } } } });
        // The guard carries no specificity: (0,4,0), the unconditioned
        // composes rule's own rank.
        expect(css).toContain(`${cardFooter} ${buttonRoot}:not(:where([data-size])) {\n        padding: var(--space-xs) var(--space-sm);`);
        expect(css).not.toContain('[data-size="sm"]');
    });

    it('emits borrowed rules BEFORE the entry\'s explicit parts, so the explicit style wins a tie', () => {
        const css = borrow({ composes: { button: { within: 'footer', axes: { size: 'sm' }, parts: { root: { base: { padding: '0' } } } } } });
        expect(css.indexOf(':not(:where([data-size]))')).toBeLessThan(css.indexOf(`${cardFooter} ${buttonRoot} {`));
    });

    it('reaches a non-carrier nested part through the nested donut, rooted on the guarded carrier', () => {
        const css = borrow({ composes: { tabs: { within: 'body', axes: { size: 'lg' } } } });
        const tabsRoot = '[data-scope="tabs"][data-part="root"]';
        expect(css).toContain(`@scope ([data-scope="card"][data-part="body"] ${tabsRoot}:not(:where([data-size]))) to (${tabsRoot}) {`);
        // `:scope` lifts it one step above the nested recipe's own donut rules.
        expect(css).toContain(':scope [data-scope="tabs"][data-part="tab"] {');
    });

    it('copies the compounds that match the borrowed value, and keeps their other conditions', () => {
        const recipes = new Map(basicRecipes);
        recipes.set('button', {
            component: 'button',
            parts: {},
            variants: { size: { sm: {}, md: {} }, variant: { solid: {}, ghost: {} } },
            compoundVariants: [
                { match: { size: 'sm', variant: 'ghost' }, parts: { root: { base: { outline: 'none' } } } },
                { match: { size: 'md', variant: 'ghost' }, parts: { root: { base: { outline: '1px solid' } } } },
            ],
            defaultVariants: { variant: 'solid' },
        });
        const css = compileRecipeCss(
            { component: 'card', parts: {}, composes: { button: { axes: { size: 'sm' } } } },
            card,
            { components, recipes },
        );
        expect(css).toContain(`[data-scope="card"][data-part="root"] ${buttonRoot}:not(:where([data-size]))[data-variant="ghost"] {\n        outline: none;`);
        expect(css).not.toContain('1px solid');
    });

    it('keeps a re-carrying nested part\'s own value (#94): the guard is repeated on it', () => {
        const css = compileRecipeCss(
            { component: 'card', parts: {}, composes: { timeline: { within: 'body', axes: { color: 'error' } } } },
            card,
            { components, recipes: basicRecipes },
        );
        expect(css).toContain(':scope [data-scope="timeline"][data-part="marker"]:not(:where([data-color])) {');
    });

    it.each([
        ['a value the nested recipe does not wire', { button: { axes: { size: 'huge' } } }, /borrows size "huge", which the "button" recipe does not wire \(wires: xs, sm, md, lg, xl\)/],
        ['an entry that composes nothing', { button: { within: 'footer' } }, /composes nothing/],
    ])('refuses %s', (_label, composes, message) => {
        expect(() => borrow({ composes: composes as RecipeInput['composes'] })).toThrow(message);
    });

    it('refuses to borrow from a scope the design system has no recipe for, and needs the recipes at all', () => {
        expect(() => compileRecipeCss(
            { component: 'card', parts: {}, composes: { button: { axes: { size: 'sm' } } } },
            card,
            { components, recipes: new Map() },
        )).toThrow(/"button" has no recipe in this design system/);
        expect(() => compileRecipeCss(
            { component: 'card', parts: {}, composes: { button: { axes: { size: 'sm' } } } },
            card,
            { components },
        )).toThrow(/borrowing axis values needs the design system's recipes/);
    });

    it('reads the nested recipe as the design system has it, whatever the list order', () => {
        const patched = extendDesignSystem(basic, {
            name: 'basic',
            recipes: {
                card: { composes: { button: { within: 'footer', axes: { size: 'sm' } } } },
                button: { variants: { size: { sm: { root: { base: { padding: '0.1rem' } } } } } },
            },
        });
        const cardFirst = { ...patched, recipes: [...patched.recipes].sort((a) => (a.component === 'card' ? -1 : 1)) };
        for (const ds of [patched, cardFirst]) {
            expect(compileDesignSystem(ds, manifest).componentCss['card'])
                .toContain(`${cardFooter} ${buttonRoot}:not(:where([data-size])) {\n        padding: 0.1rem;`);
        }
    });
});

describe('a composition conditioned on the host\'s axes (#91)', () => {
    const hostRoot = '[data-scope="card"][data-part="root"]';

    it('lives in a donut on the host carrier, written from :scope', () => {
        const css = borrow({
            compoundVariants: [{
                match: { size: 'sm' },
                parts: {},
                composes: { button: { within: 'footer', axes: { size: 'xs' }, parts: { root: { base: { flex: '1' } } } } },
            }],
        });
        expect(css).toContain(`@scope (${hostRoot}[data-size="sm"]) to (${hostRoot}) {`);
        expect(css).toContain(`:scope ${cardFooter} ${buttonRoot}:not(:where([data-size])) {`);
        expect(css).toContain(`:scope ${cardFooter} ${buttonRoot} {\n            flex: 1;`);
    });

    it('compounds the :scope with the carrier when the context IS the carrier, so it still outranks the unconditioned rule', () => {
        const css = borrow({
            compoundVariants: [{ match: { size: 'sm' }, parts: {}, composes: { button: { parts: { root: { base: { flex: '1' } } } } } }],
        });
        expect(css).toContain(`:scope${hostRoot} ${buttonRoot} {`);
    });

    it('follows the match grammar: defaulted axes and modifiers', () => {
        const css = borrow({
            variants: { size: { sm: {}, md: {} } },
            defaultVariants: { size: 'md' },
            compoundVariants: [{ match: { size: 'md', flush: true }, parts: {}, composes: { button: { axes: { size: 'sm' } } } }],
        });
        expect(css).toContain(`@scope (${hostRoot}[data-size="md"][data-mod-flush]) to (${hostRoot}) {`);
        expect(css).toContain(`@scope (${hostRoot}:not([data-size])[data-mod-flush]) to (${hostRoot}) {`);
    });

    it('nests the nested scope\'s donut inside the host\'s for a non-carrier part', () => {
        const css = borrow({
            compoundVariants: [{ match: { size: 'sm' }, parts: {}, composes: { tabs: { within: 'body', axes: { size: 'xs' } } } }],
        });
        expect(css).toMatch(/@scope \(\[data-scope="card"\]\[data-part="root"\]\[data-size="sm"\]\) to \([^)]*\) \{\s*@scope \(:scope \[data-scope="card"\]\[data-part="body"\] \[data-scope="tabs"\]\[data-part="root"\]:not\(:where\(\[data-size\]\)\)\)/);
    });

    it('is checked, fitted, extended and dropped on lynx like the top-level form', () => {
        const entry = { match: { size: 'sm' }, parts: {}, composes: { button: { parts: { icon: {} } } } };
        expect(() => borrow({ compoundVariants: [entry] })).toThrow(/"icon" is not a part of "button"/);

        const extended = extendDesignSystem(basic, {
            name: 'basic',
            recipes: { card: { compoundVariants: [{ match: { size: 'sm' }, composes: { button: { axes: { size: 'xs' } } } }] } },
        });
        const cardRecipe = extended.recipes.find((r) => r.component === 'card')!;
        expect(cardRecipe.compoundVariants?.find((c) => c.match.size === 'sm')?.composes).toEqual({ button: { axes: { size: 'xs' } } });
        const result = validateDesignSystem(extended, manifest);
        expect(result.errors).toEqual([]);

        const report = emptyReport();
        compileLynxRecipeCss({ component: 'card', parts: {}, compoundVariants: [{ match: { size: 'sm' }, parts: {}, composes: { button: { axes: { size: 'xs' } } } }] }, card, report);
        expect(report.dropped).toContainEqual(expect.objectContaining({ what: 'compoundVariants[0].composes["button"]' }));
    });

    it('drops a borrowed value the vocabulary does not admit, and an entry left composing nothing', () => {
        const tokens: TokensInput = {
            roles: {},
            sizes: ['sm', 'md'],
            themes: { l: { colorScheme: 'light', colors: { 'base-100': 'white', 'base-200': 'white', 'base-300': 'white', 'base-content': 'black' } } },
            defaultLight: 'l',
        };
        const [fitted] = fitRecipesToVocabulary([{
            component: 'card',
            parts: {},
            composes: { button: { axes: { size: 'xs' } }, tabs: { axes: { size: 'sm' } } },
            compoundVariants: [{ match: { size: 'sm' }, parts: {}, composes: { button: { axes: { size: 'xs' }, parts: { root: { base: { flex: '1' } } } } } }],
        }], tokens);
        expect(fitted!.composes).toEqual({ tabs: { axes: { size: 'sm' } } });
        expect(fitted!.compoundVariants![0]!.composes).toEqual({ button: { parts: { root: { base: { flex: '1' } } } } });
    });
});
