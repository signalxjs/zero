/**
 * The lynx recipe emitter (#351): class-grammar projection of the recipe
 * surface, one test per capability verdict, plus the structural gate over
 * whole compiled recipes — flat compounds only, nothing lynx cannot parse.
 */
import { describe, expect, it } from 'vitest';
import { anatomies } from '@sigx/zero/anatomy';
import type { ManifestComponent } from '@sigx/zero-kit';
import { assertNoCalcVarChains, assertNoDanglingVars, compileDesignSystemLynx, compileLynxRecipeCss, emptyReport } from '../src/targets/lynx/index.js';
import { designSystem as basicDS } from '@sigx/zero-basic';
import { designSystem as daisyDS } from '@sigx/zero-daisyui';
import type { RecipeInput } from '../src/recipes.js';

const button = anatomies.button.toJSON() as ManifestComponent;
const tabs = anatomies.tabs.toJSON() as ManifestComponent;
const dialog = anatomies.dialog.toJSON() as ManifestComponent;
const toast = anatomies.toast.toJSON() as ManifestComponent;

const compile = (recipe: RecipeInput, component: ManifestComponent = button) => {
    const report = emptyReport();
    const css = compileLynxRecipeCss(recipe, component, report);
    return { css, report };
};

/** Selector lines must be flat class compounds — no combinators of any kind. */
function expectFlatCompounds(css: string): void {
    for (const line of css.split('\n')) {
        if (!line.endsWith('{') || line.startsWith('@keyframes')) continue;
        expect(line.trim()).toMatch(/^(\.[A-Za-z0-9_-]+)+ \{$/);
    }
}

describe('compileLynxRecipeCss', () => {
    it('projects parts, machine states and flags onto the grammar', () => {
        const { css } = compile({
            component: 'tabs',
            parts: {
                tab: {
                    base: { padding: '4px' },
                    states: { active: { color: 'red' }, disabled: { opacity: '0.5' } },
                },
            },
        }, tabs);
        expect(css).toContain('.zx-tabs__tab {');
        expect(css).toContain('.zx-tabs__tab.zx-s-active {');
        expect(css).toContain('.zx-tabs__tab.zx-f-disabled {');
        expectFlatCompounds(css);
    });

    it('translates interaction states to runtime-stamped flag classes and drops hover', () => {
        const { css, report } = compile({
            component: 'button',
            parts: {
                root: {
                    states: {
                        'focus-visible': { outline: '1px solid black' },
                        active: { transform: 'scale(0.97)' },
                        hover: { background: 'blue' },
                    },
                },
            },
        });
        expect(css).toContain('.zx-button__root.zx-f-focus-visible {');
        expect(css).toContain('.zx-button__root.zx-f-pressed {');
        expect(css).not.toContain('hover');
        expect(report.dropped.some((f) => f.what === 'states.hover')).toBe(true);
    });

    it('emits axis rules as flat compounds on the styled part — no donuts, no default twins', () => {
        const { css } = compile({
            component: 'tabs',
            parts: {},
            defaultVariants: { size: 'md' },
            variants: {
                size: {
                    md: { tab: { base: { fontSize: 'var(--text-sm)' } } },
                    xs: { tab: { base: { fontSize: 'var(--text-xs)' } } },
                },
            },
        }, tabs);
        // The non-carrier part gets the axis class ON ITSELF (push-down).
        expect(css).toContain('.zx-tabs__tab.zx-a-size-xs {');
        expect(css).toContain('.zx-tabs__tab.zx-a-size-md {');
        expect(css).not.toContain(':not');
        expect(css).not.toContain('@scope');
        expectFlatCompounds(css);
    });

    it('compound variants are longer compounds; modifiers use zx-m-*', () => {
        const { css } = compile({
            component: 'button',
            parts: {},
            modifiers: { block: { root: { base: { width: '100%' } } } },
            compoundVariants: [{
                match: { color: 'primary', block: true },
                parts: { root: { base: { border: '1px solid black' } } },
            }],
        });
        expect(css).toContain('.zx-button__root.zx-m-block {');
        expect(css).toContain('.zx-button__root.zx-a-color-primary.zx-m-block {');
        expectFlatCompounds(css);
    });

    it('styles a pseudo part as its own real part class', () => {
        const { css } = compile({
            component: 'dialog',
            parts: { backdrop: { base: { background: 'rgba(0, 0, 0, 0.4)' } } },
        }, dialog);
        expect(css).toContain('.zx-dialog__backdrop {');
        expect(css).not.toContain('::backdrop');
    });

    it('translates the contract attribute selectors and drops the rest', () => {
        const { css, report } = compile({
            component: 'toast',
            parts: {
                viewport: {
                    selectors: {
                        '&[data-placement="top-end"]': { top: '0' },
                        '&:first-child': { margin: '0' },
                    },
                },
            },
        }, toast);
        expect(css).toContain('.zx-toast__viewport.zx-p-top-end {');
        expect(css).not.toContain('first-child');
        expect(report.dropped.some((f) => f.what.includes(':first-child'))).toBe(true);
    });

    it('projects layout attribute selectors onto the class grammar', () => {
        // The branch exists so the `zx-l-` grammar is not dead code: without
        // it every layout rule would be dropped and the layout tier would
        // render completely unstyled on this target.
        const { css, report } = compile({
            component: 'button',
            parts: {
                root: {
                    selectors: {
                        '&[data-l-gap="md"]': { gap: '8px' },
                        '&[data-l-cols="12"]': { width: '100%' },
                        '&[data-l-gap-x="2xs"]': { columnGap: '2px' },
                    },
                },
            },
        });
        expect(css).toContain('.zx-button__root.zx-l-gap-md {');
        expect(css).toContain('.zx-button__root.zx-l-cols-12 {');
        expect(css).toContain('.zx-button__root.zx-l-gap-x-2xs {');
        expect(report.dropped).toHaveLength(0);
        expectFlatCompounds(css);
    });

    it('drops a per-breakpoint layout selector, saying why', () => {
        // A responsive value has no class form on a target with no media
        // queries. It should read as "responsive is runtime JS here", not as
        // "unknown selector" — the reader has to know which of the two it is.
        const { css, report } = compile({
            component: 'button',
            parts: { root: { selectors: { '&[data-l-md-gap="lg"]': { gap: '12px' } } } },
        });
        expect(css).not.toContain('zx-l-');
        expect(report.dropped.some((f) => f.detail.includes('runtime JS on lynx'))).toBe(true);
    });

    it('reports a digit-leading breakpoint as responsive, not as an unknown selector', () => {
        // A design system may name a breakpoint `2xl` — token keys may lead
        // with a digit (`--text-2xl`). The rule is dropped either way, but
        // the author has to be told WHICH reason, or they go looking for a
        // spelling mistake in a selector that was correct.
        const { report } = compile({
            component: 'button',
            parts: { root: { selectors: { '&[data-l-2xl-gap="lg"]': { gap: '24px' } } } },
        });
        expect(report.dropped.some((f) => f.detail.includes('runtime JS on lynx'))).toBe(true);
        expect(report.dropped.some((f) => f.detail.includes('not expressible'))).toBe(false);
    });

    it('drops an unknown name under the layout prefix rather than minting a class', () => {
        const { css, report } = compile({
            component: 'button',
            parts: { root: { selectors: { '&[data-l-gutter="md"]': { gap: '8px' } } } },
        });
        expect(css).not.toContain('zx-l-gutter');
        expect(report.dropped.some((f) => f.detail.includes('not a declared layout attribute'))).toBe(true);
    });

    it('drops conditions with a report entry', () => {
        const { css, report } = compile({
            component: 'button',
            parts: { root: { at: { 'reduced-motion': { base: { transition: 'none' } } } } },
        });
        expect(css).not.toContain('@media');
        expect(report.dropped.some((f) => f.what === 'at["reduced-motion"]')).toBe(true);
    });

    it('expands the flex shorthand and keeps calc-over-var', () => {
        const { css, report } = compile({
            component: 'button',
            parts: {
                root: {
                    base: { flex: '1', width: 'calc(var(--size-field) * 10)' },
                },
            },
        });
        expect(css).toContain('flex-grow: 1;');
        expect(css).toContain('flex-shrink: 1;');
        expect(css).toContain('flex-basis: 0%;');
        expect(css).not.toContain('flex: 1');
        // `calc()` over `var()` was dropped for a whole release on the
        // grounds that it was "unproven on lynx". It was then measured
        // working on device (signalxjs/lynx#1029, iPhone 16 Pro / iOS 18.3),
        // and the drop was costing 216 declarations in zero-daisyui alone —
        // daisy's entire size system is `calc(var(--size-*) * n)`.
        expect(css).toContain('width: calc(var(--size-field) * 10);');
        expect(report.dropped.some((f) => f.what.includes('calc(var(--size-field)'))).toBe(false);
    });

    it('drops min()/max()/clamp() rather than emitting a declaration lynx ignores', () => {
        const { css, report } = compile({
            component: 'button',
            parts: {
                root: {
                    base: {
                        // Both shapes daisy's switch uses, measured failing on
                        // device (signalxjs/lynx#1066): bare, and inside calc().
                        width: 'min(var(--size-field), 10rem)',
                        borderRadius: 'calc(var(--radius-field) + min(var(--border), 2px))',
                        // `max()` and `clamp()` are the same spec feature.
                        height: 'max(1rem, 2rem)',
                        padding: 'clamp(1px, 2px, 3px)',
                    },
                },
            },
        });
        expect(css).not.toContain('min(');
        expect(css).not.toContain('max(');
        expect(css).not.toContain('clamp(');
        expect(report.dropped.filter((f) => f.detail.includes('min()/max()/clamp()'))).toHaveLength(4);
        // A plain calc() over var() is untouched — only the comparison
        // functions are refused.
        const plain = compile({
            component: 'button',
            parts: { root: { base: { width: 'calc(var(--size-field) * 4)' } } },
        });
        expect(plain.css).toContain('calc(var(--size-field) * 4)');
    });

    it('drops any declaration valued with currentColor — it never resolves on device', () => {
        // Measured on both platforms (signalxjs/lynx#1079, 0.2.0-beta.4):
        // a currentColor-valued declaration ships and silently paints
        // nothing — the daisy tabs underline was transparent everywhere.
        const { css, report } = compile({
            component: 'tabs',
            parts: {
                tab: {
                    base: { borderBottom: '3px solid transparent' },
                    states: {
                        // Bare, and spelled with CSS's case-insensitivity.
                        active: { borderBottomColor: 'currentColor', backgroundColor: 'CurrentColor' },
                    },
                },
            },
        }, tabs);
        expect(css).not.toMatch(/currentcolor/i);
        // The rest of the block still emits — the drop is per declaration.
        expect(css).toContain('border-bottom: 3px solid transparent;');
        expect(report.dropped.filter((f) => f.detail.includes('currentColor never resolves'))).toHaveLength(2);
        // A keyframes body painting with it is the same silent no-paint.
        const kf = compile({
            component: 'button',
            parts: { root: { base: { animation: 'pulse 1s' } } },
            keyframes: { pulse: 'from { background-color: currentColor; } to { background-color: #ffffff; }' },
        });
        expect(kf.css).not.toMatch(/currentcolor/i);
        expect(kf.report.dropped.some((f) => f.what === 'keyframes pulse' && f.detail.includes('currentColor'))).toBe(true);
    });

    it('drops logical inset/margin/padding spellings — they resolve on iOS but not on Android', () => {
        // Measured (signalxjs/lynx#1084, four-bar probe): every logical
        // spelling lays out on iOS and is ignored on Android — the daisy
        // slider thumb sat off-center there. Cross-platform-asymmetric is
        // treated as unsupported; the recipe's lynx section restates the
        // geometry physically.
        const { css, report } = compile({
            component: 'button',
            parts: {
                root: {
                    base: {
                        insetBlockStart: '50%',
                        insetInlineEnd: '0',
                        marginBlock: '4px',
                        marginInlineStart: '-8px',
                        paddingBlockEnd: '2px',
                        paddingInline: '12px',
                        // The physical spellings pass untouched.
                        top: '50%',
                        marginLeft: '-8px',
                        paddingRight: '12px',
                    },
                },
            },
        });
        expect(css).not.toMatch(/(?:^|[\s{;])(?:inset|margin|padding)-(?:block|inline)/im);
        expect(css).toContain('top: 50%;');
        expect(css).toContain('margin-left: -8px;');
        expect(css).toContain('padding-right: 12px;');
        expect(report.dropped.filter((f) => f.detail.includes('signalxjs/lynx#1084'))).toHaveLength(6);
    });

    it('drops the standalone translate/rotate/scale properties but keeps transform functions', () => {
        // Same #1084 verdict: the standalone transform properties resolve on
        // iOS only; `transform`'s functions are proven on both platforms.
        const { css, report } = compile({
            component: 'button',
            parts: {
                root: {
                    base: {
                        translate: '0 -50%',
                        rotate: '45deg',
                        scale: '1.1',
                        transform: 'translateY(-50%) rotate(45deg) scale(1.1)',
                    },
                },
            },
        });
        expect(css).not.toMatch(/(?:^|[\s{;])(?:translate|rotate|scale)\s*:/im);
        expect(css).toContain('transform: translateY(-50%) rotate(45deg) scale(1.1);');
        expect(report.dropped.filter((f) => f.detail.includes('signalxjs/lynx#1084'))).toHaveLength(3);
        // A keyframes body animating one of them is the same one-platform
        // animation — dropped whole; targets.lynx.keyframes replaces it
        // (keyframes merge per name).
        const kf = compile({
            component: 'button',
            parts: { root: { base: { animation: 'sweep 1s' } } },
            keyframes: { sweep: 'from { margin-inline-start: -40%; } to { margin-inline-start: 100%; }' },
        });
        expect(kf.css).not.toContain('margin-inline-start');
        expect(kf.report.dropped.some((f) => f.what === 'keyframes sweep' && f.detail.includes('signalxjs/lynx#1084'))).toBe(true);
    });

    it('bakes literal color functions, and drops theme-var-dependent ones with no themes to bake against', () => {
        const { css, report } = compile({
            component: 'button',
            parts: {
                root: {
                    base: {
                        boxShadow: '0 1px 2px oklch(25% 0.02 260 / 0.05)',
                        background: 'color-mix(in oklab, var(--color-primary) 12%, white)',
                    },
                },
            },
        });
        expect(css).toMatch(/box-shadow: 0 1px 2px #[0-9a-f]{8};/);
        expect(css).not.toContain('color-mix');
        expect(report.dropped.some((f) => f.what.startsWith('background:'))).toBe(true);
    });

    it('restates a theme-var-dependent declaration once per theme, baked', () => {
        const report = emptyReport();
        const css = compileLynxRecipeCss(
            {
                component: 'button',
                parts: {
                    root: {
                        base: { background: 'color-mix(in oklab, var(--color-primary) 50%, white)' },
                    },
                },
            },
            button,
            report,
            [
                { name: 'light', colorScheme: 'light', isDefault: true, colors: { primary: '#000000' } },
                { name: 'dark', colorScheme: 'dark', isDefault: false, colors: { primary: '#ff0000' } },
            ],
        );
        // The default theme rides `.zx-root` alone so an app that never
        // selects a theme still paints; a named theme is one class more
        // specific, so selecting it wins.
        expect(css).toMatch(/\.zx-root \.zx-button__root \{\n\s+background: #[0-9a-f]{6};/);
        expect(css).toMatch(/\.zx-root\.zx-theme-dark \.zx-button__root \{\n\s+background: #[0-9a-f]{6};/);
        // Baked, not deferred: two different primaries give two different results.
        const baked = [...css.matchAll(/background: (#[0-9a-f]{6});/g)].map((m) => m[1]);
        expect(new Set(baked).size).toBe(2);
        expect(css).not.toContain('color-mix');
        expect(report.dropped.some((f) => f.what.startsWith('background:'))).toBe(false);
    });

    it('drops what no theme can resolve: currentColor and recipe-local properties', () => {
        const themes = [{ name: 'light', colorScheme: 'light' as const, isDefault: true, colors: { primary: '#000000' } }];
        const report = emptyReport();
        const css = compileLynxRecipeCss(
            {
                component: 'button',
                parts: {
                    root: {
                        base: {
                            boxShadow: '0 1px color-mix(in oklab, currentColor 10%, #0000)',
                            borderColor: 'color-mix(in oklab, var(--btn-accent) 50%, white)',
                        },
                    },
                },
            },
            button,
            report,
            themes,
        );
        // Neither can bake — `currentColor` is a runtime value and
        // `--btn-accent` is recipe-local, so it has no per-theme literal.
        // Dropped rather than thrown: legible degradation, not an author error.
        expect(css).not.toContain('box-shadow');
        expect(css).not.toContain('border-color');
        expect(report.dropped.some((f) => f.detail.includes('currentColor'))).toBe(true);
        expect(report.dropped.some((f) => f.detail.includes('--btn-accent'))).toBe(true);
    });

    it('rewrites display: inline-flex to flex — lynx has no inline formatting context', () => {
        const { css, report } = compile({
            component: 'button',
            parts: { root: { base: { display: 'inline-flex', alignItems: 'center' } } },
        });
        // Measured (signalxjs/lynx#1075): `inline-flex` does not resolve and
        // the view keeps the broken default linear layout — the daisy tabs
        // list stacked vertically because of it.
        expect(css).toContain('display: flex;');
        expect(css).not.toContain('inline-flex');
        expect(report.translated.some((f) => f.what === 'display: inline-flex')).toBe(true);
        // The raw lynx css hatch gets the same mechanical fix — it is
        // otherwise appended verbatim, and inline-flex would still ship.
        const raw = compile({
            component: 'button',
            parts: {},
            css: '.zx-button__root.zx-m-pill { display: inline-flex; gap: 4px; }',
        });
        expect(raw.css).toContain('display: flex; gap: 4px;');
        expect(raw.css).not.toContain('inline-flex');
        expect(raw.report.translated.some((f) => f.where.includes('raw stylesheet escape hatch') && f.what === 'display: inline-flex')).toBe(true);
    });

    // The calc-chain inliner (#382), measured on device (signalxjs/lynx#1075):
    // lynx drops any declaration consuming var(--x) — bare, with a fallback,
    // or nested inside a calc() — whenever --x's value contains calc().
    describe('calc-holding custom-property chains', () => {
        it('inlines a chain across parts, per axis compound, and drops the inert definitions', () => {
            const { css, report } = compile({
                component: 'tabs',
                parts: {
                    root: { base: { '--t-size': 'calc(var(--size-selector) * 2)' } },
                    tab: { base: { height: 'var(--t-size)', padding: 'calc(var(--t-size) / 2)' } },
                },
                variants: {
                    size: {
                        sm: { root: { base: { '--t-size': 'var(--size-selector)' } } },
                        lg: { root: { base: { '--t-size': 'calc(var(--size-selector) * 3)' } } },
                    },
                },
            }, tabs);
            // The consumer is restated on the CONSUMING part under the same
            // axis compound the definition varied over — the push-down
            // contract stamps axis classes on every part, so it matches, and
            // class-count specificity keeps the ramp winning over the base.
            expect(css).toContain('height: calc(var(--size-selector) * 2);');
            expect(css).toContain('padding: calc((var(--size-selector) * 2) / 2);');
            expect(css).toMatch(/\.zx-tabs__tab\.zx-a-size-sm \{\n\s+height: var\(--size-selector\);\n\s+padding: calc\(\(var\(--size-selector\)\) \/ 2\);/);
            expect(css).toMatch(/\.zx-tabs__tab\.zx-a-size-lg \{\n\s+height: calc\(var\(--size-selector\) \* 3\);/);
            // The chain itself is gone — definitions and consumptions alike.
            expect(css).not.toContain('--t-size');
            expect(report.translated.some((f) => f.what === '--t-size' && f.detail.includes('inlined'))).toBe(true);
            expectFlatCompounds(css);
        });

        it('resolves a definition that itself chains through another calc-holding property', () => {
            const { css } = compile({
                component: 'tabs',
                parts: {
                    root: { base: { '--t-size': 'calc(var(--size-selector) * 4)', '--t-pad': 'calc(var(--t-size) * 0.25)' } },
                    tab: { base: { padding: 'var(--t-pad)' } },
                },
                variants: { size: { xs: { root: { base: { '--t-size': 'calc(var(--size-selector) * 2)' } } } } },
            }, tabs);
            expect(css).toContain('padding: calc((var(--size-selector) * 4) * 0.25);');
            expect(css).toMatch(/\.zx-tabs__tab\.zx-a-size-xs \{\n\s+padding: calc\(\(var\(--size-selector\) \* 2\) \* 0\.25\);/);
            expect(css).not.toContain('--t-pad');
            expect(css).not.toContain('--t-size');
        });

        it('refuses a chain it cannot resolve statically: a calc-holding definition under a state', () => {
            expect(() => compile({
                component: 'tabs',
                parts: {
                    tab: {
                        base: { height: 'var(--t-size)' },
                        states: { active: { '--t-size': 'calc(var(--size-selector) * 2)' } },
                    },
                },
            }, tabs)).toThrow(/--t-size.*calc\(\).*cannot resolve statically/s);
        });

        it('refuses a calc-holding property consumed from raw lynx css or keyframes', () => {
            expect(() => compile({
                component: 'tabs',
                parts: { root: { base: { '--t-size': 'calc(var(--size-selector) * 2)', height: 'var(--t-size)' } } },
                css: '.zx-tabs__list { height: var(--t-size); }',
            }, tabs)).toThrow(/raw lynx css or keyframes consume var\(--t-size\)/);
        });

        it('leaves plain var chains and theme-baked plain definitions untouched', () => {
            const { css, report } = compile({
                component: 'tabs',
                parts: {
                    root: { base: { '--t-accent': 'var(--color-primary)' } },
                    tab: { base: { color: 'var(--t-accent)', width: 'calc(var(--size-field) * 10)' } },
                },
            }, tabs);
            // Plain var→var chains and direct calc(var()) are both proven on
            // device (signalxjs/lynx#1075) — only calc-HOLDING chains move.
            expect(css).toContain('--t-accent: var(--color-primary);');
            expect(css).toContain('color: var(--t-accent);');
            expect(css).toContain('width: calc(var(--size-field) * 10);');
            expect(report.translated.some((f) => f.what === '--t-accent')).toBe(false);
        });
    });

    it('rejects web-runtime property references', () => {
        expect(() => compile({
            component: 'button',
            parts: { root: { base: { backgroundPosition: 'var(--press-x) var(--press-y)' } } },
        })).toThrow(/web-runtime-published property/);
    });

    it('appends a lynx-authored css hatch verbatim (shared css never reaches this emitter)', () => {
        // By contract the resolver withholds SHARED css from the lynx view
        // (the compile records the drop); a css that arrives here came from
        // targets.lynx.css and is lynx-authored by construction.
        const { css } = compile({
            component: 'button',
            parts: {},
            css: '.zx-button__root.zx-m-glow { border-color: #ff00ff; }',
        });
        expect(css).toContain('.zx-button__root.zx-m-glow { border-color: #ff00ff; }');
    });

    it('emits keyframes and errors on unknown parts/states like the web emitter', () => {
        const { css } = compile({
            component: 'button',
            parts: { root: { base: { animation: 'spin 1s linear infinite' } } },
            keyframes: { spin: 'from { transform: rotate(0deg); } to { transform: rotate(360deg); }' },
        });
        expect(css).toContain('@keyframes spin {');
        expect(() => compile({ component: 'button', parts: { nope: { base: { color: 'red' } } } }))
            .toThrow(/unknown part "nope"/);
        expect(() => compile({ component: 'button', parts: { root: { states: { sideways: { color: 'red' } } } } }))
            .toThrow(/unknown state "sideways"/);
    });
});

describe('whole-skin lynx output is structurally lynx-safe', () => {
    // The compile-time analogue of the on-device css-engine probe, over the
    // ENTIRE emitted stylesheet of both opted-in skins: nothing the lynx
    // engine cannot parse may appear, and every selector is either a flat
    // class compound or a theme host followed by one (the per-theme
    // restatements; the axis push-down contract has no other combinators).
    //
    // `calc(var(*))` is deliberately NOT forbidden — measured working on
    // device, see the recipe test above.
    const FORBIDDEN = [
        /@layer/, /@property/, /@starting-style/, /@media/, /@supports/, /@scope/,
        /light-dark\(/, /oklch\(/, /oklab\(/, /color-mix\(/, /\bmin\(/, /\bmax\(/, /clamp\(/,
        /:root/, /\[data-/, /::/, /:hover/, /:focus/, /:active/, /:not\(/,
        // No inline formatting context on lynx — the emitter rewrites
        // inline-flex to flex (#382). (`grid`/`inline-grid` are equally
        // unsupported but have no mechanical rewrite; daisy's toast still
        // ships grid properties, so they cannot be forbidden here yet.)
        /display:\s*inline-flex/,
        // currentColor never resolves on lynx — measured on device on BOTH
        // platforms (signalxjs/lynx#1079): the declaration ships and
        // silently paints nothing (the daisy tabs underline, checkbox tick
        // and radio dot were all invisible because of it). The emitter drops
        // it with a report entry; nothing may ship it.
        /currentcolor/i,
        // Logical inset/margin/padding spellings and the standalone
        // translate/rotate/scale properties resolve on iOS but NOT on
        // Android (measured, signalxjs/lynx#1084 — the daisy slider thumb
        // sat off-center there). Cross-platform-asymmetric is treated as
        // unsupported: the emitter refuses them, the recipes' lynx sections
        // restate the geometry physically, and nothing may ship them.
        // Anchored so a custom property (`--tw-translate: …`) cannot trip
        // the gate.
        /(?:^|[\s{;])(?:inset|margin|padding)-(?:block|inline)/im,
        /(?:^|[\s{;])(?:translate|rotate|scale)\s*:/im,
    ] as const;
    it.each([
        ['zero-basic', basicDS],
        ['zero-daisyui', daisyDS],
    ])('%s', (_name, ds) => {
        const { indexCss } = compileDesignSystemLynx(ds as never, { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] });
        for (const pattern of FORBIDDEN) {
            expect(indexCss, String(pattern)).not.toMatch(pattern);
        }
        const COMPOUND = '(\\.[A-Za-z0-9_-]+)+';
        const SELECTOR = new RegExp(`^(${COMPOUND} )?${COMPOUND} \\{$`);
        for (const line of indexCss.split('\n')) {
            if (!line.endsWith('{') || line.startsWith('@keyframes') || line.trim().endsWith('% {') || ['from {', 'to {'].includes(line.trim())) continue;
            expect(line.trim(), line).toMatch(SELECTOR);
        }
    });

    // The guard that would have caught signalxjs/lynx#1029: 24 custom
    // properties used and never defined, reaching 295 of 1043 rules. On lynx
    // an unresolvable var() does not fall back — the element paints nothing.
    it.each([
        ['zero-basic', basicDS],
        ['zero-daisyui', daisyDS],
    ])('%s defines every custom property it reads', (name, ds) => {
        const { indexCss } = compileDesignSystemLynx(ds as never, { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] });
        expect(() => assertNoDanglingVars(name, indexCss)).not.toThrow();
    });

    // The daisy switch is the component signalxjs/lynx#1066 was measured on:
    // its web spelling is an inline-grid track with a min()-clamped radius,
    // neither of which lynx's engine resolves — the drop left the switch with
    // no width, radius or ink at all, rendering as bare text beside its
    // label. The recipe's `targets.lynx` section restates the track/thumb
    // with flex + calc() and slides the knob with `translateX`; this pins
    // that the replacement actually lands in the compiled artifact.
    it('zero-daisyui switch: the lynx section replaces grid/min() with flex + calc()', () => {
        const { componentCss } = compileDesignSystemLynx(daisyDS as never, { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] });
        const css = componentCss['switch']!;
        // None of the refused/unresolvable constructs survive… (the grid
        // pattern names the LAYOUT constructs — display values and grid-*
        // properties — so an unrelated future token merely containing the
        // substring "grid" cannot trip it)
        expect(css).not.toMatch(/display:\s*(?:inline-)?grid|grid-template|grid-row|grid-column|place-content/);
        expect(css).not.toMatch(/\bmin\(|\bmax\(|\bclamp\(/);
        expect(css).not.toMatch(/currentcolor/i);
        // …the track is a flexed box with daisy's derived width and the
        // unclamped radius formula, the `--switch-size`/`--switch-p` chain
        // inlined per compound (#382 — lynx drops a declaration consuming a
        // calc-holding property, signalxjs/lynx#1075)…
        expect(css).toContain('.zx-switch__control {');
        expect(css).toContain('display: flex;');
        expect(css).toContain('width: calc(((var(--size-selector) * 6) * 2) - (var(--border) + ((var(--size-selector) * 6) * 0.125)) * 2);');
        expect(css).toContain('border-radius: calc(var(--radius-selector) + ((var(--size-selector) * 6) * 0.125) + var(--border));');
        // …the size ramp is restated on the consuming parts under the same
        // axis compounds the definition varied over…
        expect(css).toMatch(/\.zx-switch__control\.zx-a-size-xs \{\n\s+width: calc\(\(\(var\(--size-selector\) \* 4\) \* 2\)/);
        expect(css).toContain('height: calc(var(--size-selector) * 4);');
        // …and the knob is an explicit calc() square that travels exactly one
        // knob-width when checked.
        expect(css).toContain('.zx-switch__thumb {');
        expect(css).toContain('height: calc((var(--size-selector) * 6) - (var(--border) + ((var(--size-selector) * 6) * 0.125)) * 2);');
        expect(css).toContain(
            'transform: translateX(calc((var(--size-selector) * 6) - (var(--border) + ((var(--size-selector) * 6) * 0.125)) * 2));',
        );
        // The chain itself is gone.
        expect(css).not.toContain('var(--switch-size');
        expect(css).not.toContain('--switch-p');
    });

    // The daisy progress track is the component #382 was measured on: its
    // height was `var(--progress-track-size)` while the property's value held
    // `calc(var(--size-selector) * 2.5)` — a chain lynx drops on device, so
    // the track rendered zero-height. This pins the substituted artifact: a
    // concrete calc() height on the track, base and per-size.
    it('zero-daisyui progress: the track carries a concrete calc() height, base and per-size', () => {
        const { componentCss } = compileDesignSystemLynx(daisyDS as never, { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] });
        const css = componentCss['progress']!;
        expect(css).toMatch(/\.zx-progress__track \{[^}]*height: calc\(var\(--size-selector\) \* 2\.5\);/);
        expect(css).toMatch(/\.zx-progress__track\.zx-a-size-xs \{\n\s+height: var\(--size-selector\);/);
        expect(css).toMatch(/\.zx-progress__track\.zx-a-size-sm \{\n\s+height: calc\(var\(--size-selector\) \* 1\.5\);/);
        expect(css).toMatch(/\.zx-progress__track\.zx-a-size-lg \{\n\s+height: calc\(var\(--size-selector\) \* 3\.5\);/);
        expect(css).toMatch(/\.zx-progress__track\.zx-a-size-xl \{\n\s+height: calc\(var\(--size-selector\) \* 4\.5\);/);
        expect(css).not.toContain('--progress-track-size');
    });

    // The daisy tabs border-flavor underline is the component
    // signalxjs/lynx#1079 was measured on: its active mark was
    // `border-bottom-color: currentColor`, which never resolves on lynx —
    // transparent underline on BOTH platforms. The lynx section now bakes the
    // color axis's active ink into `--tab-active-ink` (per color, per theme —
    // the same literal the active `color:` rules land as) and the underline
    // consumes it as a plain var() chain. This pins the whole mechanism in
    // the compiled artifact.
    it('zero-daisyui tabs: the border underline spends the color axis ink, not currentColor', () => {
        const { componentCss } = compileDesignSystemLynx(daisyDS as never, { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] });
        const css = componentCss['tabs']!;
        expect(css).not.toMatch(/currentcolor/i);
        // The underline consumes the named ink…
        expect(css).toMatch(/\.zx-tabs__tab\.zx-a-variant-border\.zx-s-active \{\n\s+border-bottom-color: var\(--tab-active-ink\);/);
        // …the un-attributed default is base-content, the shared active ink…
        expect(css).toContain('--tab-active-ink: var(--color-base-content);');
        // …and a color-attributed tab's ink is a concrete per-theme literal
        // (host + two classes, so it beats the one-class default), equal to
        // the very hex its active `color:` bakes to in the same theme.
        const ink = css.match(/\.zx-root \.zx-tabs__tab\.zx-a-color-primary \{\n\s+--tab-active-ink: (#[0-9a-f]{6,8});/)?.[1];
        const activeColor = css.match(/\.zx-root \.zx-tabs__tab\.zx-a-color-primary\.zx-s-active \{\n\s+color: (#[0-9a-f]{6,8});/)?.[1];
        expect(ink).toBeDefined();
        expect(ink).toBe(activeColor);
    });

    // The checkbox tick and the radio ring/dot were the other three
    // currentColor spends reaching the lynx artifact — all invisible on
    // device for the same reason, and the unchecked rings' color-mix-over-
    // currentColor border fallbacks dropped the whole border besides. Their
    // lynx sections restate all of it with the named accents the web
    // spellings resolve to.
    it('zero-daisyui checkbox/radio: marks and rings spend named accents, not currentColor', () => {
        const { componentCss } = compileDesignSystemLynx(daisyDS as never, { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] });
        const checkbox = componentCss['checkbox']!;
        expect(checkbox).not.toMatch(/currentcolor/i);
        expect(checkbox).toMatch(/\.zx-checkbox__indicator \{[^}]*background-color: var\(--checkbox-on-accent\);/);
        expect(checkbox).toMatch(/\.zx-checkbox__control \{[^}]*border: var\(--border\) solid var\(--checkbox-accent\);/);
        const radio = componentCss['radio-group']!;
        expect(radio).not.toMatch(/currentcolor/i);
        expect(radio).toMatch(/\.zx-radio-group__item-control \{[^}]*border: var\(--border\) solid var\(--radio-accent\);/);
        expect(radio).toMatch(/\.zx-radio-group__item-control\.zx-s-checked \{[^}]*border-color: var\(--radio-accent\);/);
        expect(radio).toMatch(/\.zx-radio-group__item-indicator\.zx-s-checked \{[^}]*background-color: var\(--radio-accent\);/);
    });
});

describe('assertNoCalcVarChains', () => {
    // The whole-stylesheet backstop for chains the per-recipe inliner cannot
    // see: a calc-holding TOKEN consumed by a recipe, or a chain minted in
    // raw lynx css (#382, signalxjs/lynx#1075).
    it('rejects a var() consumption of a calc-holding property, and names it', () => {
        expect(() => assertNoCalcVarChains('ds', '.a { --x: calc(var(--s) * 2); }\n.b { height: var(--x); }'))
            .toThrow(/consumes 1 custom property whose definition holds\s+calc\(\): --x/);
    });

    it('accepts plain var chains and direct calc(var())', () => {
        expect(() => assertNoCalcVarChains('ds', '.a { --x: var(--s); }\n.b { height: var(--x); width: calc(var(--s) * 2); }'))
            .not.toThrow();
    });

    it('accepts a calc-holding property nothing consumes', () => {
        expect(() => assertNoCalcVarChains('ds', '.a { --x: calc(var(--s) * 2); }')).not.toThrow();
    });

    // The daisy slider's accent reached the web screen twice — `accent-color`
    // on the native control and `color-mix()` on the composed range/thumb —
    // and lynx renders neither spelling, so both the fill and the knob
    // shipped with no paint at all: grey track, invisible range, invisible
    // thumb (measured on device, signalxjs/lynx#1075). The recipe's
    // `targets.lynx` section restates the paint as plain var() chains — the
    // accent on the fill, daisy's real base-100-knob-with-accent-ring on the
    // thumb — and this pins that both land in the compiled artifact, with the
    // range and thumb owning their paint outright (no accent-color ride, no
    // color-mix survivor).
    it('zero-daisyui slider: the lynx section paints the range and thumb without accent-color', () => {
        const { componentCss } = compileDesignSystemLynx(daisyDS as never, { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] });
        const css = componentCss['slider']!;
        // No unresolvable paint survives anywhere in the skin…
        expect(css).not.toMatch(/color-mix\(/);
        // …the fill is the plain accent chain…
        const range = css.match(/\.zx-slider__range \{[^}]*\}/)?.[0];
        expect(range).toBeDefined();
        expect(range).toContain('background: var(--slider-accent);');
        // …the knob is daisy's real range-thumb look — a base-100 knob
        // ringed by the accent — with daisy's `--range-p` border width
        // stated as its literal value, 0.25rem…
        const thumb = css.match(/\.zx-slider__thumb \{[^}]*\}/)?.[0];
        expect(thumb).toBeDefined();
        expect(thumb).toContain('background: var(--color-base-100);');
        expect(thumb).toContain('border: 0.25rem solid var(--slider-accent);');
        // …the knob centers PHYSICALLY: the web spelling
        // (`inset-block-start`/`translate`/`margin-inline-start`) resolves
        // on iOS but not on Android (signalxjs/lynx#1084 — the thumb sat
        // visibly off-center there), so the lynx section restates it as
        // top/transform/margin-left, proven on both platforms…
        expect(thumb).toContain('top: 50%;');
        expect(thumb).toContain('transform: translateY(-50%);');
        expect(thumb).toContain('margin-left: calc(var(--size-selector) * -2.5);');
        // …and neither part's paint rides on accent-color (a native-input
        // mechanism lynx has no renderer for).
        expect(range).not.toContain('accent-color');
        expect(thumb).not.toContain('accent-color');
    });
});

describe('assertNoDanglingVars', () => {
    it('accepts a property the stylesheet defines, anywhere in it', () => {
        expect(() => assertNoDanglingVars('ds', '.a { --x: 1px; }\n.b { width: var(--x); }')).not.toThrow();
    });

    it('rejects one nothing defines, and names it', () => {
        expect(() => assertNoDanglingVars('ds', '.b { width: var(--gone); }'))
            .toThrow(/reads 1 custom property that nothing defines: --gone/);
    });

    it('accepts a reference that carries its own fallback', () => {
        expect(() => assertNoDanglingVars('ds', '.b { width: var(--maybe, 8px); }')).not.toThrow();
    });

    it('still checks what a fallback itself reads', () => {
        // The whole point of scanning fallbacks rather than blanking them: the
        // outer reference is excused, the inner one is not.
        expect(() => assertNoDanglingVars('ds', '.b { width: var(--maybe, var(--gone)); }'))
            .toThrow(/--gone/);
        expect(() => assertNoDanglingVars('ds', '.b { color: var(--maybe, color-mix(in oklab, var(--gone), white)); }'))
            .toThrow(/--gone/);
        expect(() => assertNoDanglingVars('ds', '.a { --x: red; }\n.b { color: var(--maybe, var(--x)); }'))
            .not.toThrow();
    });
});
