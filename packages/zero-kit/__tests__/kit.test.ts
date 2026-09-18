import { describe, it, expect } from 'vitest';
import {
    buildDsManifest,
    compileDesignSystem,
    compileRecipeCss,
    compileTokensCss,
    defineTokens,
    validateDesignSystem,
} from '@sigx/zero-kit';
import type { ManifestComponent, TokensInput, RecipeInput, DesignSystemInput } from '@sigx/zero-kit';
import { anatomies } from '@sigx/zero/anatomy';
import { tokens as basicTokens } from '@sigx/zero-basic';
import { designSystem as basicDS } from '@sigx/zero-basic';
import { designSystem as daisyDS } from '@sigx/zero-daisyui';

const manifest = { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] };
const tabsComponent = manifest.components.find((c) => c.scope === 'tabs')!;

describe('compileTokensCss', () => {
    const css = compileTokensCss(basicTokens);

    it('refuses a theme name that would break out of its selector', () => {
        // `[data-theme="<name>"]` is an injection surface exactly like the
        // axis values: a quote in the name closes the attribute and the rest
        // is read as CSS.
        expect(() => compileTokensCss({
            ...basicTokens,
            themes: {
                ...basicTokens.themes,
                'x"] [data-part="popup': { colorScheme: 'light', colors: { ...Object.values(basicTokens.themes)[0]!.colors } },
            },
        })).toThrow(/kebab-case identifier/);
    });

    it('emits the tokens layer with :root light-dark pairs', () => {
        expect(css).toContain('@layer zero.tokens');
        expect(css).toContain('color-scheme: light dark;');
        expect(css).toMatch(/--color-primary: light-dark\(/);
    });

    it('derives soft tints live via color-mix', () => {
        expect(css).toMatch(/--color-primary-soft: color-mix\(in oklab, var\(--color-primary\) \d+%, var\(--color-base-100\)\)/);
    });

    it('emits defaults at zero specificity and themes above them', () => {
        // Defaults are :where(:root) (specificity 0); an explicit theme
        // ([data-theme] = 0,1,0) must beat them so toggling actually applies.
        expect(css).toContain(':where(:root)');
        expect(css).toContain('[data-theme="basic"]');
        expect(css).toContain('[data-theme="basic-dark"]');
        expect(css).not.toContain(':where([data-theme');
    });
});

describe('compileRecipeCss', () => {
    it('resolves machine states, flags and interaction states', () => {
        const recipe: RecipeInput = {
            component: 'tabs',
            parts: {
                tab: {
                    base: { color: 'red' },
                    states: {
                        active: { fontWeight: '700' },
                        disabled: { opacity: '0.4' },
                        hover: { color: 'blue' },
                    },
                },
            },
        };
        const css = compileRecipeCss(recipe, tabsComponent);
        expect(css).toContain('[data-scope="tabs"][data-part="tab"] {');
        expect(css).toContain('[data-scope="tabs"][data-part="tab"][data-state="active"]');
        expect(css).toContain('[data-scope="tabs"][data-part="tab"][data-disabled]');
        expect(css).toContain('[data-scope="tabs"][data-part="tab"]:hover:not([data-disabled])');
        expect(css).toContain('font-weight: 700;');
    });

    it('refuses a variant name or value that would break out of its selector', () => {
        // Axis vocabularies are open, so "open" has to stop at what survives
        // being written into `[data-<axis>="<value>"]`. Unguarded, this value
        // closed the attribute early and emitted a SECOND selector —
        // `[data-part="panel"] [data-scope="tabs"][data-part="tab"]` — styling
        // every tab inside any panel. `validateRecipes` reports it as a
        // collected error; compileRecipeCss is public API and can be called
        // without validating, so it refuses outright.
        const injected = 'x"], [data-part="panel';
        expect(() => compileRecipeCss({
            component: 'tabs',
            parts: { tab: { base: { padding: '1rem' } } },
            variants: { size: { [injected]: { tab: { base: { color: 'red' } } } } },
        }, tabsComponent)).toThrow(/not a valid axis value/);

        expect(() => compileRecipeCss({
            component: 'tabs',
            parts: { tab: { base: { padding: '1rem' } } },
            variants: { [injected]: { a: { tab: { base: { color: 'red' } } } } },
        }, tabsComponent)).toThrow(/not a kebab-case identifier/);

        expect(() => compileRecipeCss({
            component: 'tabs',
            parts: { tab: { base: { padding: '1rem' } } },
            compoundVariants: [{ match: { size: injected }, parts: { tab: { base: { color: 'red' } } } }],
        }, tabsComponent)).toThrow(/not a valid axis value/);
    });

    it('still accepts every spelling the shipped design systems use', () => {
        // The guard must not be stricter than real vocabulary: `2xl` starts
        // with a digit and `base-100` is hyphenated-numeric, and both are
        // legitimate axis values.
        const css = compileRecipeCss({
            component: 'tabs',
            parts: { tab: { base: { padding: '1rem' } } },
            variants: {
                size: { '2xl': { tab: { base: { padding: '2rem' } } } },
                color: { 'base-100': { tab: { base: { color: 'red' } } } },
            },
        }, tabsComponent);
        expect(css).toContain('[data-size="2xl"]');
        expect(css).toContain('[data-color="base-100"]');
    });

    it('rejects unknown parts and states', () => {
        expect(() => compileRecipeCss({ component: 'tabs', parts: { nope: { base: { color: 'red' } } } }, tabsComponent))
            .toThrow(/unknown part "nope"/);
        expect(() => compileRecipeCss(
            { component: 'tabs', parts: { tab: { states: { levitating: { color: 'red' } } } } },
            tabsComponent,
        )).toThrow(/unknown state "levitating"/);
    });

    it('variant values target the carrier part and reach inner parts through the donut', () => {
        const switchComponent = manifest.components.find((c) => c.scope === 'switch')!;
        const recipe: RecipeInput = {
            component: 'switch',
            parts: {},
            variants: {
                color: { success: { control: { states: { checked: { background: 'green' } } } } },
            },
            defaultVariants: { color: 'success' },
        };
        const css = compileRecipeCss(recipe, switchComponent);
        const carrier = '[data-scope="switch"][data-part="root"]';
        expect(css).toContain(`@scope (${carrier}[data-color="success"]) to (${carrier}) {`);
        expect(css).toContain('[data-scope="switch"][data-part="control"][data-state="checked"]');
        expect(css).toContain(`@scope (${carrier}:not([data-color])) to (${carrier}) {`);
    });

    it('bounds non-carrier axis rules so a nested same-scope instance resolves by proximity', () => {
        // The card-in-card leak (#317 item 2). A descendant-anchored axis rule
        // — `[root][data-variant="tinted"] [title]` — is an UNBOUNDED
        // descendant selector: put one card inside another and the outer
        // card's variant styles the inner card's title too, with source order
        // (not proximity) deciding which variant wins. The rule has to stop at
        // the nested instance's own root, which is what an `@scope … to …`
        // donut says: the outer carrier is the scoping root, any nested
        // same-scope carrier is the lower boundary, and CSS proximity then
        // resolves between two instances' own rules.
        const cardComponent = manifest.components.find((c) => c.scope === 'card')!;
        const css = compileRecipeCss({
            component: 'card',
            parts: {},
            variants: {
                variant: { tinted: { title: { base: { color: 'purple' } } } },
            },
        }, cardComponent);

        const carrier = '[data-scope="card"][data-part="root"]';
        expect(css).toContain(`@scope (${carrier}[data-variant="tinted"]) to (${carrier}) {`);
        expect(css).toContain('[data-scope="card"][data-part="title"] {');
        // The unbounded form must be GONE — its presence is the leak.
        expect(css).not.toContain(`${carrier}[data-variant="tinted"] [data-scope="card"][data-part="title"]`);
    });

    it('bounds modifier and compound rules on non-carrier parts the same way', () => {
        const cardComponent = manifest.components.find((c) => c.scope === 'card')!;
        const carrier = '[data-scope="card"][data-part="root"]';
        const css = compileRecipeCss({
            component: 'card',
            parts: {},
            variants: { variant: { tinted: { body: { base: { background: 'lavender' } } } } },
            modifiers: { flush: { body: { base: { padding: '0' } } } },
            compoundVariants: [{
                match: { variant: 'tinted', flush: true },
                parts: { body: { base: { border: 'none' } } },
            }],
            defaultVariants: { variant: 'tinted' },
        }, cardComponent);
        expect(css).toContain(`@scope (${carrier}[data-mod-flush]) to (${carrier}) {`);
        expect(css).toContain(`@scope (${carrier}[data-variant="tinted"][data-mod-flush]) to (${carrier}) {`);
        // The CSS-only default keeps working under the donut.
        expect(css).toContain(`@scope (${carrier}:not([data-variant])) to (${carrier}) {`);
        expect(css).not.toMatch(/\[data-part="root"]\[data-[^\]]*\] \[data-scope="card"]/);
    });

    it('emits modifiers as presence-only attributes', () => {
        // An axis answers "which one" and carries a value; a modifier answers
        // "is it on" and carries none — so the selector has no `="…"` to
        // compare against. daisyUI's `btn-block` is the shape being encoded.
        const buttonComponent = manifest.components.find((c) => c.scope === 'button')!;
        const css = compileRecipeCss({
            component: 'button',
            parts: {},
            modifiers: { block: { root: { base: { width: '100%' } } } },
        }, buttonComponent);
        expect(css).toContain('[data-scope="button"][data-part="root"][data-mod-block] {');
        expect(css).not.toContain('data-mod-block="');
    });

    it('lets a modifier participate in a compound match', () => {
        // The flag-in-a-compound case the axis grammar could not express:
        // `match: { variant: 'solid', block: true }`.
        const buttonComponent = manifest.components.find((c) => c.scope === 'button')!;
        const css = compileRecipeCss({
            component: 'button',
            parts: {},
            variants: { variant: { solid: { root: { base: { background: 'blue' } } } } },
            modifiers: { block: { root: { base: { width: '100%' } } } },
            compoundVariants: [{
                match: { variant: 'solid', block: true },
                parts: { root: { base: { borderRadius: '0' } } },
            }],
        }, buttonComponent);
        expect(css).toContain('[data-variant="solid"][data-mod-block]');
    });

    it('compound matches survive a defaulted axis being absent', () => {
        // `defaultVariants` makes an attribute optional, so a compound naming a
        // defaulted value has to match the ABSENT attribute too. Without the
        // cross product `<Button color="primary">` — which carries no
        // `data-variant` at all — misses the compound entirely, and nothing
        // reports it.
        const buttonComponent = manifest.components.find((c) => c.scope === 'button')!;
        const recipe: RecipeInput = {
            component: 'button',
            parts: {},
            variants: {
                variant: { solid: { root: { base: { background: 'blue' } } } },
                color: { primary: { root: { base: { color: 'white' } } } },
            },
            defaultVariants: { variant: 'solid' },
            compoundVariants: [{
                match: { variant: 'solid', color: 'primary' },
                parts: { root: { base: { boxShadow: 'none' } } },
            }],
        };
        const css = compileRecipeCss(recipe, buttonComponent);
        expect(css).toContain('[data-variant="solid"][data-color="primary"]');
        expect(css).toContain(':not([data-variant])[data-color="primary"]');
    });

    it('crosses every defaulted axis in a compound match', () => {
        // Two defaulted axes → four rules, because either attribute may be
        // absent independently.
        const buttonComponent = manifest.components.find((c) => c.scope === 'button')!;
        const recipe: RecipeInput = {
            component: 'button',
            parts: {},
            variants: {
                variant: { solid: { root: { base: { background: 'blue' } } } },
                size: { md: { root: { base: { padding: '1rem' } } } },
            },
            defaultVariants: { variant: 'solid', size: 'md' },
            compoundVariants: [{
                match: { variant: 'solid', size: 'md' },
                parts: { root: { base: { boxShadow: 'none' } } },
            }],
        };
        const css = compileRecipeCss(recipe, buttonComponent);
        for (const variant of ['[data-variant="solid"]', ':not([data-variant])']) {
            for (const size of ['[data-size="md"]', ':not([data-size])']) {
                expect(css).toContain(`${variant}${size}`);
            }
        }
    });

    it('projects pseudo parts onto their host, pseudo-element last', () => {
        // Dialog's backdrop renders no element on the web — the anatomy
        // declares it `pseudo: { of: 'popup', selector: '::backdrop' }` and
        // the compiler attaches states to the HOST, then the pseudo-element:
        // an attribute can only narrow the element it sits on.
        const dialogComponent = manifest.components.find((c) => c.scope === 'dialog')!;
        const recipe: RecipeInput = {
            component: 'dialog',
            parts: {
                backdrop: {
                    base: { background: 'rgb(0 0 0 / 0.4)' },
                    states: { open: { opacity: '1' }, closed: {} },
                },
            },
        };
        const css = compileRecipeCss(recipe, dialogComponent);
        expect(css).toContain('[data-scope="dialog"][data-part="popup"]::backdrop {');
        expect(css).toContain('[data-scope="dialog"][data-part="popup"][data-state="open"]::backdrop {');
        // The part's own name never reaches a selector — nothing renders it.
        expect(css).not.toContain('[data-part="backdrop"]');
    });

    it('rejects a malformed pseudo projection like unknown parts and states', () => {
        const styled = { component: 'demo', parts: { ghost: { base: { color: 'red' } } } };
        const demo = (pseudo: { of: string; selector: string }): ManifestComponent => ({
            scope: 'demo',
            parts: [
                { name: 'root', element: 'div', selectors: {} },
                { name: 'ghost', element: 'div', selectors: {}, pseudo },
            ],
        });
        // A missing host would silently emit selectors matching nothing.
        expect(() => compileRecipeCss(styled, demo({ of: 'nope', selector: '::backdrop' })))
            .toThrow(/unknown part "nope"/);
        // A non-pseudo suffix is written into a selector verbatim — injection.
        expect(() => compileRecipeCss(styled, demo({ of: 'root', selector: ', [data-part="x"]' })))
            .toThrow(/not a pseudo-element/);
    });
});

describe('the shipped design systems', () => {
    it.each([
        // The theme list is asserted by name: daisyui is the N-theme proof
        // (#132) and must keep all five; the others stay a pair.
        ['basic', basicDS, ['basic', 'basic-dark']],
        ['daisyui', daisyDS, ['light', 'dark', 'dim', 'nord', 'sunset']],
    ] as const)('%s validates cleanly and compiles', (_name, ds, themeNames) => {
        const result = validateDesignSystem(ds, manifest);
        expect(result.errors).toEqual([]);
        const compiled = compileDesignSystem(ds, manifest);
        expect(Object.keys(compiled.componentCss).sort()).toEqual([
            'accordion', 'alert', 'avatar', 'badge', 'box', 'breadcrumbs', 'button', 'card', 'carousel', 'center', 'chat', 'checkbox', 'collapsible',
            'combobox', 'container', 'countdown', 'dialog', 'diff', 'divider', 'drawer', 'field', 'file-upload', 'grid', 'indicator', 'input', 'join', 'kbd', 'menu',
            'navbar', 'number-input', 'pagination', 'popover', 'progress', 'radial-progress', 'radio-group',
            'rating-group', 'select', 'skeleton', 'slider', 'spacer',
            'spinner', 'stack', 'stats', 'status', 'steps', 'swap', 'switch', 'table', 'tabs',
            'textarea', 'timeline', 'toast', 'toggle', 'toggle-group', 'tooltip', 'tree-view',
        ]);
        expect(compiled.indexCss).toContain('@layer zero.tokens');
        expect(compiled.themes.map((t) => t.name)).toEqual([...themeNames]);
    });

    it('validation catches missing tokens and bad contrast', () => {
        const broken: DesignSystemInput = {
            name: 'broken',
            tokens: {
                defaultLight: 'x',
                themes: {
                    x: {
                        colorScheme: 'light',
                        colors: {
                            // deliberately incomplete + low contrast
                            'base-100': 'white',
                            'base-content': 'oklch(95% 0 0)',
                            primary: '#888888',
                            'primary-content': '#999999',
                        } as never,
                    },
                },
            },
            recipes: [],
        };
        const result = validateDesignSystem(broken, manifest);
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.message.includes('missing color token'))).toBe(true);
        expect(result.errors.some((e) => e.message.includes('contrast'))).toBe(true);
    });
});

describe('extensible color roles', () => {
    const brandTokens = defineTokens({
        roles: {
            brand: { description: 'the product color' },
            danger: {},
            surface: { content: false, soft: false },
        },
        custom: { 'glass-blur': { description: 'backdrop blur radius', syntax: '<length>' } },
        breakpoints: { sm: '640px', md: '768px' },
        themes: {
            day: {
                colorScheme: 'light',
                colors: {
                    'base-100': 'oklch(100% 0 0)',
                    'base-200': 'oklch(96% 0 0)',
                    'base-300': 'oklch(92% 0 0)',
                    'base-content': 'oklch(22% 0.01 285)',
                    brand: 'oklch(45% 0.2 300)',
                    'brand-content': 'oklch(97% 0.01 300)',
                    danger: 'oklch(50% 0.19 27)',
                    'danger-content': 'oklch(97% 0.012 27)',
                    surface: 'oklch(98% 0.002 285)',
                },
                custom: { 'glass-blur': '12px' },
            },
        },
        defaultLight: 'day',
    });
    const brandDS: DesignSystemInput<NonNullable<typeof brandTokens.roles>> = {
        name: 'brand',
        tokens: brandTokens,
        recipes: [],
    };

    it('emits declared roles, respecting content/soft opt-outs', () => {
        const css = compileTokensCss(brandTokens);
        expect(css).toContain('--color-brand: oklch(45% 0.2 300);');
        expect(css).toContain('--color-brand-content:');
        expect(css).toMatch(/--color-brand-soft: color-mix\(in oklab, var\(--color-brand\)/);
        expect(css).toContain('--color-surface: oklch(98% 0.002 285);');
        expect(css).not.toContain('--color-surface-content');
        expect(css).not.toContain('--color-surface-soft');
    });

    it('registers declared roles and typed custom tokens via @property', () => {
        const css = compileTokensCss(brandTokens);
        expect(css).toContain("@property --color-brand { syntax: '<color>'; inherits: true; initial-value: oklch(45% 0.2 300); }");
        expect(css).toContain("@property --glass-blur { syntax: '<length>'; inherits: true; initial-value: 12px; }");
    });

    it('emits declared custom token values per theme', () => {
        const css = compileTokensCss(brandTokens);
        expect(css).toContain('--glass-blur: 12px;');
    });

    it('validates cleanly and derives swatch/manifest metadata from the declaration', () => {
        const result = validateDesignSystem(brandDS, manifest);
        expect(result.errors).toEqual([]);
        const compiled = compileDesignSystem(brandDS, manifest);
        expect(Object.keys(compiled.tokens.roles)).toEqual(['brand', 'danger', 'surface']);
        expect(compiled.tokens.breakpoints).toEqual({ sm: '640px', md: '768px' });
        expect(compiled.tokens.custom['glass-blur']?.syntax).toBe('<length>');
        expect(Object.keys(compiled.themes[0]!.swatch)).toEqual(['brand', 'danger', 'surface', 'base-100', 'base-content']);
    });

    it('errors when a theme omits a declared role or defines an undeclared one', () => {
        const missing = structuredClone(brandTokens);
        delete (missing.themes.day!.colors as unknown as Record<string, string>)['danger'];
        (missing.themes.day!.colors as unknown as Record<string, string>)['mystery'] = '#123456';
        const result = validateDesignSystem({ name: 'x', tokens: missing, recipes: [] }, manifest);
        expect(result.errors.some((e) => e.message.includes('missing color token "danger"'))).toBe(true);
        expect(result.errors.some((e) => e.message.includes('"mystery" is not in the declared vocabulary'))).toBe(true);
    });

    it('matches custom-token spellings with and without the -- prefix', () => {
        const mixed = defineTokens({
            roles: { brand: {} },
            custom: { '--glass-blur': { syntax: '<length>' } },
            themes: {
                day: {
                    colorScheme: 'light',
                    colors: {
                        'base-100': 'white', 'base-200': 'white', 'base-300': 'white', 'base-content': 'black',
                        brand: 'black', 'brand-content': 'white',
                    },
                    custom: { 'glass-blur': '8px' },
                },
            },
            defaultLight: 'day',
        });
        const result = validateDesignSystem({ name: 'x', tokens: mixed, recipes: [] }, manifest);
        expect(result.errors).toEqual([]);
        expect(compileTokensCss(mixed)).toContain("@property --glass-blur { syntax: '<length>'; inherits: true; initial-value: 8px; }");
    });

    it('rejects role names that collide with CSS keywords or base surfaces', () => {
        const bad = defineTokens({
            roles: { transparent: {}, 'base-500': {} },
            themes: {
                day: {
                    colorScheme: 'light',
                    colors: {
                        'base-100': 'white', 'base-200': 'white', 'base-300': 'white', 'base-content': 'black',
                        transparent: 'white', 'transparent-content': 'black',
                        'base-500': 'white', 'base-500-content': 'black',
                    },
                },
            },
            defaultLight: 'day',
        });
        const result = validateDesignSystem({ name: 'x', tokens: bad, recipes: [] }, manifest);
        expect(result.errors.some((e) => e.message.includes('"transparent" is a CSS keyword'))).toBe(true);
        expect(result.errors.some((e) => e.message.includes('"base-500" uses the reserved base-* namespace'))).toBe(true);
    });

    it('rejects two roles that derive the same colour property', () => {
        // `danger` derives `--color-danger-soft`; a role literally NAMED
        // `danger-soft` emits the same property. Both land in the same block,
        // the later wins, and nothing said so. `danger-soft` is a real HeroUI
        // v3 variant name, so this is a collision someone will actually write.
        const clashing = defineTokens({
            roles: { danger: {}, 'danger-soft': {} },
            themes: {
                day: {
                    colorScheme: 'light',
                    colors: {
                        'base-100': 'white', 'base-200': 'white', 'base-300': 'white', 'base-content': 'black',
                        danger: 'red', 'danger-content': 'white',
                        'danger-soft': 'pink', 'danger-soft-content': 'black',
                    },
                },
            },
            defaultLight: 'day',
        });
        const result = validateDesignSystem({ name: 'x', tokens: clashing, recipes: [] }, manifest);
        expect(result.errors.some((e) => e.message.includes('both emit --color-danger-soft'))).toBe(true);
    });

    it('lets a role opt out of -soft and free the derived name', () => {
        // The collision is a consequence of what each role DERIVES, so
        // `soft: false` on `danger` legitimately leaves `--color-danger-soft`
        // for a role of that name. The rule must not flag it.
        const fine = defineTokens({
            roles: { danger: { soft: false }, 'danger-soft': {} },
            themes: {
                day: {
                    colorScheme: 'light',
                    colors: {
                        'base-100': 'white', 'base-200': 'white', 'base-300': 'white', 'base-content': 'black',
                        danger: 'red', 'danger-content': 'white',
                        'danger-soft': 'pink', 'danger-soft-content': 'black',
                    },
                },
            },
            defaultLight: 'day',
        });
        const result = validateDesignSystem({ name: 'x', tokens: fine, recipes: [] }, manifest);
        expect(result.errors.some((e) => e.message.includes('both emit'))).toBe(false);
    });

    it('a design system with no size axis says so in its manifest', () => {
        // Before this, `sizes: []` was an error and an omitted ramp was
        // silently replaced, so EVERY compiled manifest advertised xs–xl —
        // including for a design system that has no size axis at all. The
        // manifest is what the docs site and the generation skill read.
        const noSizes = defineTokens({
            roles: { primary: {} },
            sizes: [],
            themes: {
                day: {
                    colorScheme: 'light',
                    colors: {
                        'base-100': 'white', 'base-200': 'white', 'base-300': 'white', 'base-content': 'black',
                        primary: 'blue', 'primary-content': 'white',
                    },
                },
            },
            defaultLight: 'day',
        });
        const compiled = compileDesignSystem({ name: 'no-sizes', tokens: noSizes, recipes: [] }, manifest);
        expect(compiled.tokens.sizes).toEqual([]);
    });

    it('a design system with no variant axis says so in its manifest, apart from one that never said', () => {
        // `variants` has no recommended ramp to resolve, so both an omitted
        // and an empty declaration compile to `[]` — `variantsDeclared` is
        // what keeps "there isn't one" apart from "I didn't say" (#200/#295).
        const base = {
            roles: { primary: {} },
            themes: {
                day: {
                    colorScheme: 'light' as const,
                    colors: {
                        'base-100': 'white', 'base-200': 'white', 'base-300': 'white', 'base-content': 'black',
                        primary: 'blue', 'primary-content': 'white',
                    },
                },
            },
            defaultLight: 'day',
        };
        const silent = compileDesignSystem({ name: 'silent', tokens: defineTokens(base), recipes: [] }, manifest);
        const declined = compileDesignSystem({ name: 'declined', tokens: defineTokens({ ...base, variants: [] }), recipes: [] }, manifest);
        expect(silent.tokens.variants).toEqual([]);
        expect(declined.tokens.variants).toEqual([]);
        expect(silent.tokens.variantsDeclared).toBe(false);
        expect(declined.tokens.variantsDeclared).toBe(true);
        expect(buildDsManifest(silent).tokens.variantsDeclared).toBe(false);
        expect(buildDsManifest(declined).tokens.variantsDeclared).toBe(true);
    });

    it('errors when a declared custom token has no theme value', () => {
        const missing = structuredClone(brandTokens);
        delete missing.themes.day!.custom!['glass-blur'];
        const result = validateDesignSystem({ name: 'x', tokens: missing, recipes: [] }, manifest);
        expect(result.errors.some((e) => e.message.includes('missing value for declared custom token "glass-blur"'))).toBe(true);
    });
});
