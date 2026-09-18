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
