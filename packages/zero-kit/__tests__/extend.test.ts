/**
 * `extendRecipe` / `extendDesignSystem` — deriving a design system from
 * another (#60).
 *
 * The fixture is the shape andtii/agentic hand-rolled as `withOverride`: a
 * "control-room" system derived from `@sigx/zero-daisyui` — one theme of its
 * own, a handful of `--ag-*` custom tokens, and patches to daisy's button,
 * switch, toggle-group, tabs and dialog. Three claims are pinned against it:
 *
 * 1. **One recipe per scope.** The derivation compiles (a second recipe for a
 *    scope is a hard compile error) and validates with no errors.
 * 2. **Identity.** A derivation that changes nothing compiles daisy's
 *    stylesheet byte for byte — the helper adds no CSS of its own.
 * 3. **The base is never mutated.** daisy's recipes are module-level
 *    exports every other consumer shares.
 */
import { describe, expect, it } from 'vitest';
import { anatomies } from '@sigx/zero/anatomy';
import {
    compileDesignSystem,
    extendDesignSystem,
    extendRecipe,
    layoutCss,
    layoutRecipes,
    validateDesignSystem,
} from '@sigx/zero-kit';
import type { DesignSystemInput, ManifestComponent, RecipeInput, ThemeInput, TokensInput } from '@sigx/zero-kit';
import { designSystem as daisy } from '@sigx/zero-daisyui';

const manifest = {
    components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[],
};

const recipeOf = (ds: DesignSystemInput, scope: string): RecipeInput =>
    ds.recipes.find((r) => r.component === scope)!;

describe('extendRecipe — the merge rule', () => {
    const base: RecipeInput = {
        component: 'button',
        tokens: { '--btn-fill': 'red', '--btn-ink': 'white' },
        parts: {
            root: {
                base: { padding: '1rem', color: 'var(--btn-ink)', opacity: '0.8' },
                states: { hover: { filter: 'brightness(0.9)' }, disabled: { opacity: '0.5' } },
                selectors: { '&::before': { content: '""' }, '& + &': { marginInlineStart: '1px' } },
                at: { md: { base: { padding: '2rem' } } },
            },
            label: { base: { fontWeight: '600' } },
        },
        variants: { size: { sm: { root: { base: { padding: '0.5rem' } } }, lg: { root: { base: { padding: '2rem' } } } } },
        modifiers: { block: { root: { base: { inlineSize: '100%' } } } },
        compoundVariants: [
            { match: { color: 'primary', variant: 'solid' }, parts: { root: { base: { background: 'blue' } } } },
            { match: { color: 'error', variant: 'solid' }, parts: { root: { base: { background: 'red' } } } },
        ],
        defaultVariants: { size: 'md', variant: 'solid' },
        keyframes: { spin: 'to { rotate: 1turn }' },
        css: '/* base */',
        skipStates: { label: ['disabled', 'hover'] },
        targets: { lynx: { parts: { root: { base: { padding: '16px' } } } } },
    };

    it('merges objects per key, replaces scalars and arrays, and deletes on null', () => {
        const out = extendRecipe(base, {
            tokens: { '--btn-fill': 'green', '--btn-ink': null },
            parts: {
                root: {
                    base: { padding: '12px', opacity: null },
                    states: { hover: { filter: 'none' }, disabled: null, 'focus-visible': { outline: '2px solid' } },
                    selectors: { '& + &': null },
                    at: { md: { base: { padding: '24px' } } },
                },
                label: null,
            },
            variants: { size: { sm: { root: { base: { padding: '6px' } } }, lg: null } },
            modifiers: { block: null, wide: { root: { base: { inlineSize: '20rem' } } } },
            defaultVariants: { size: 'sm', variant: null },
            keyframes: { spin: null, pop: 'from { scale: 0.9 }' },
            skipStates: { label: ['disabled'] },
        });
        expect(out.tokens).toEqual({ '--btn-fill': 'green' });
        expect(out.parts).toEqual({
            root: {
                base: { padding: '12px', color: 'var(--btn-ink)' },
                states: { hover: { filter: 'none' }, 'focus-visible': { outline: '2px solid' } },
                selectors: { '&::before': { content: '""' } },
                at: { md: { base: { padding: '24px' } } },
            },
        });
        expect(out.variants).toEqual({ size: { sm: { root: { base: { padding: '6px' } } } } });
        expect(out.modifiers).toEqual({ wide: { root: { base: { inlineSize: '20rem' } } } });
        expect(out.defaultVariants).toEqual({ size: 'sm' });
        expect(out.keyframes).toEqual({ pop: 'from { scale: 0.9 }' });
        // Arrays replace — the patch states the part's whole skip list.
        expect(out.skipStates).toEqual({ label: ['disabled'] });
    });

    it('addresses compoundVariants by match: equal matches merge, others append, emptied ones drop', () => {
        const out = extendRecipe(base, {
            compoundVariants: [
                // Same match, keys in another order — still the same address.
                { match: { variant: 'solid', color: 'primary' }, parts: { root: { base: { borderColor: 'navy' } } } },
                { match: { color: 'error', variant: 'solid' }, parts: { root: null } },
                { match: { color: 'neutral', variant: 'solid' }, parts: { root: { states: { hover: { filter: 'none' } } } } },
            ],
        });
        expect(out.compoundVariants).toEqual([
            { match: { color: 'primary', variant: 'solid' }, parts: { root: { base: { background: 'blue', borderColor: 'navy' } } } },
            { match: { color: 'neutral', variant: 'solid' }, parts: { root: { states: { hover: { filter: 'none' } } } } },
        ]);
    });

    it('concatenates css, and null drops the base hatch', () => {
        expect(extendRecipe(base, { css: '/* mine */' }).css).toBe('/* base */\n/* mine */');
        expect(extendRecipe(base, { css: null })).not.toHaveProperty('css');
    });

    it('patches targets with the same rule', () => {
        const out = extendRecipe(base, {
            targets: { lynx: { parts: { root: { base: { margin: '4px' } } } }, web: { css: '/* web */' } },
        });
        expect(out.targets).toEqual({
            lynx: { parts: { root: { base: { padding: '16px', margin: '4px' } } } },
            web: { css: '/* web */' },
        });
        expect(extendRecipe(base, { targets: { lynx: null } })).not.toHaveProperty('targets');
    });

    it('never mutates the base, and shares only what the patch left alone', () => {
        const before = JSON.stringify(base);
        const out = extendRecipe(base, { parts: { root: { base: { padding: '0' } } } });
        expect(JSON.stringify(base)).toBe(before);
        expect(out.parts.root).not.toBe(base.parts.root);
        expect(out.parts.label).toBe(base.parts.label);
    });

    it('refuses a patch naming another scope', () => {
        expect(() => extendRecipe(base, { component: 'badge' })).toThrow(/"badge" cannot apply to the "button" recipe/);
    });
});

describe('extendDesignSystem — a control-room system derived from zero-daisyui', () => {
    const dark = daisy.tokens.themes['dark'] as ThemeInput;
    const controlRoom: ThemeInput = {
        ...dark,
        pair: undefined,
        colors: {
            ...dark.colors,
            'base-100': '#0D100F',
            'base-200': '#131716',
            'base-300': '#1A1F1E',
            'base-content': '#E7ECE9',
            primary: '#C9F26C',
            'primary-content': '#10140A',
        },
        custom: { ...dark.custom, depth: '0', 'ag-line': '#252B29', 'ag-line-strong': '#343C39' },
    };
    const ring = { outline: '2px solid var(--color-primary)', outlineOffset: '2px' };
    const before = JSON.stringify(daisy);

    const derived = extendDesignSystem(daisy, {
        name: 'control-room',
        tokens: {
            custom: {
                'ag-line': { description: 'Card borders, row dividers.', syntax: '<color>' },
                'ag-line-strong': { description: 'Input and button borders.', syntax: '<color>' },
            },
            system: { radius: { field: '6px' }, border: '1px' },
            // Dark only: every daisy theme goes, one of our own comes in.
            themes: {
                ...Object.fromEntries(Object.keys(daisy.tokens.themes).map((name) => [name, null])),
                'control-room': controlRoom,
            },
            defaultLight: 'control-room',
            defaultDark: 'control-room',
        },
        recipes: {
            button: {
                parts: { root: { base: { boxShadow: 'none', height: '36px' }, states: { 'focus-visible': ring } } },
                variants: { size: { md: { root: { base: { padding: '0 var(--space-lg)' } } } } },
                compoundVariants: [{
                    match: { color: 'neutral', variant: 'solid' },
                    parts: { root: { base: { borderColor: 'var(--ag-line-strong)' } } },
                }],
            },
            switch: {
                parts: { control: { base: { boxShadow: 'none', borderColor: 'var(--ag-line-strong)' }, states: { 'focus-visible': ring } } },
            },
            // Undo daisy's join seams and its on+hover filter rather than
            // countering them with a second declaration.
            'toggle-group': {
                parts: {
                    item: {
                        selectors: {
                            '&[data-state="on"]:hover': { filter: null },
                            '&[data-orientation="horizontal"] + &': null,
                            '&[data-orientation="vertical"] + &': null,
                        },
                    },
                },
            },
            tabs: {
                compoundVariants: [{
                    match: { variant: 'box', color: 'primary' },
                    parts: { tab: { states: { active: { boxShadow: 'none' } } } },
                }],
            },
            dialog: { parts: { popup: { base: { maxWidth: '520px', border: 'var(--border) solid var(--ag-line-strong)' } } } },
        },
    });

    it('leaves zero-daisyui untouched', () => {
        expect(JSON.stringify(daisy)).toBe(before);
    });

    it('carries one recipe per scope — every scope daisy styles, no more', () => {
        const scopes = derived.recipes.map((r) => r.component);
        expect(new Set(scopes).size).toBe(scopes.length);
        expect(scopes).toEqual(daisy.recipes.map((r) => r.component));
    });

    it('validates with no errors and compiles', () => {
        const result = validateDesignSystem(derived, manifest);
        expect(result.errors.map((e) => `${e.where}: ${e.message}`)).toEqual([]);
        expect(() => compileDesignSystem(derived, manifest)).not.toThrow();
    });

    it('applies the patches where they were addressed', () => {
        const compiled = compileDesignSystem(derived, manifest);
        expect(compiled.componentCss['button']).toContain('height: 36px');
        expect(compiled.componentCss['toggle-group']).not.toContain('[data-orientation="horizontal"] +');
        expect(compiled.tokensCss).toContain('--ag-line-strong');
        expect(compiled.themes.map((t) => t.name)).toEqual(['control-room']);

        const tabs = recipeOf(derived, 'tabs');
        const baseTabs = recipeOf(daisy, 'tabs');
        // Merged into daisy's box×primary compound, not appended beside it.
        expect(tabs.compoundVariants).toHaveLength(baseTabs.compoundVariants!.length);
        const boxPrimary = tabs.compoundVariants!.find((c) => c.match['variant'] === 'box' && c.match['color'] === 'primary')!;
        expect(boxPrimary.parts['tab']!.states!['active']).toMatchObject({ background: 'var(--color-primary)', boxShadow: 'none' });

        // A compound daisy's button has no address for is appended.
        const button = recipeOf(derived, 'button');
        expect(button.compoundVariants!.at(-1)!.match).toEqual({ color: 'neutral', variant: 'solid' });
    });

    it('carries the base api unless told otherwise', () => {
        expect(derived.api).toBe(daisy.api);
        expect(extendDesignSystem(daisy, { name: 'x', api: null })).not.toHaveProperty('api');
        const patched = extendDesignSystem(daisy, { name: 'x', api: { modifiers: { zebra: null } } });
        expect(Object.keys(patched.api!.modifiers!)).not.toContain('zebra');
        expect(Object.keys(patched.api!.modifiers!)).toContain('wide');
    });
});

describe('extendDesignSystem — identity and the layout tier', () => {
    it('a derivation that changes nothing compiles daisy byte for byte', () => {
        const same = extendDesignSystem(daisy, { name: daisy.name });
        expect(compileDesignSystem(same, manifest).indexCss).toBe(compileDesignSystem(daisy, manifest).indexCss);
    });

    it('regenerates an unmodified layout tier from the derived tokens', () => {
        const derived = extendDesignSystem(daisy, { name: 'wide', tokens: { breakpoints: { md: '50rem' } } });
        const tokens = derived.tokens as TokensInput;
        expect(tokens.breakpoints).toEqual({ sm: '40rem', md: '50rem', lg: '64rem' });
        expect(derived.css).toContain(layoutCss(tokens));
        expect(derived.css).not.toContain(layoutCss(daisy.tokens as TokensInput));
        for (const fresh of layoutRecipes(tokens)) expect(recipeOf(derived, fresh.component)).toEqual(fresh);
    });

    it('keeps a layout recipe the base customised', () => {
        const stack = { ...recipeOf(daisy, 'stack'), css: '/* customised */' };
        const base = { ...daisy, recipes: daisy.recipes.map((r) => (r.component === 'stack' ? stack : r)) };
        const derived = extendDesignSystem(base, { name: 'x', tokens: { breakpoints: { md: '50rem' } } });
        expect(recipeOf(derived, 'stack')).toBe(stack);
    });
});

describe('extendDesignSystem — refusals', () => {
    it('refuses a patch for a scope the base does not style', () => {
        expect(() => extendDesignSystem(daisy, { name: 'x', recipes: { buton: {} } }))
            .toThrow(/"daisyui" has no recipe for "buton" to extend — a new scope goes in addRecipes/);
    });

    it('refuses to add a second recipe for a styled scope', () => {
        expect(() => extendDesignSystem(daisy, { name: 'x', addRecipes: [{ component: 'button', parts: {} }] }))
            .toThrow(/"daisyui" already styles it — patch it through recipes/);
    });

    it('lets a dropped scope be re-added whole', () => {
        const button: RecipeInput = { component: 'button', parts: { root: { base: { color: 'red' } } } };
        const derived = extendDesignSystem(daisy, { name: 'x', recipes: { button: null }, addRecipes: [button] });
        expect(derived.recipes.filter((r) => r.component === 'button')).toEqual([button]);
    });

    it('refuses to patch a scope the base styles twice', () => {
        const base = { ...daisy, recipes: [...daisy.recipes, { component: 'badge', parts: {} }] };
        expect(() => extendDesignSystem(base, { name: 'x', recipes: { badge: {} } }))
            .toThrow(/styles "badge" with 2 recipes/);
    });
});
