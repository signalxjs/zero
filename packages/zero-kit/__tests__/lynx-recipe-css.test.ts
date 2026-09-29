/**
 * The lynx recipe emitter (#351): class-grammar projection of the recipe
 * surface, one test per capability verdict, plus the structural gate over
 * whole compiled recipes — flat compounds only, nothing lynx cannot parse.
 */
import { describe, expect, it } from 'vitest';
import { anatomies, defineAnatomy } from '@sigx/zero/anatomy';
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

    it('a re-carried axis (zero#94) needs nothing new: the push-down compound already serves it', () => {
        // The runtime stamps the NEAREST provider's value, and a re-carrying
        // part is one — so one flat rule per value, whichever element
        // supplied it, and none of the web's extra own-value rules.
        const timeline = anatomies.timeline.toJSON() as ManifestComponent;
        const { css } = compile({
            component: 'timeline',
            parts: {},
            variants: { color: { error: { marker: { base: { '--timeline-accent': 'red' } } } } },
        }, timeline);
        expect(css.match(/\.zx-timeline__marker\.zx-a-color-error \{/g)).toHaveLength(1);
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

    it('translates flag/state attribute compounds against the anatomy (zero#326)', () => {
        const { css, report } = compile({
            component: 'button',
            parts: {
                root: {
                    selectors: {
                        '&[data-pressed]:not([data-disabled])': { transform: 'scale(0.97)' },
                        '&[data-disabled]': { opacity: '0.5' },
                        '&[data-state="checked"]': { color: 'red' },
                        '&[data-open]': { color: 'blue' },
                        '&[data-pressed]:not([data-selected])': { color: 'green' },
                        '&:not([data-disabled])': { color: 'teal' },
                    },
                },
            },
        });
        // The press rule loses its disabled negation: lynx never stamps
        // `pressed` on a disabled part.
        expect(css).toContain('.zx-button__root.zx-f-pressed {');
        expect(css).toContain('.zx-button__root.zx-f-disabled {');
        expect(css).not.toContain(':not');
        // Undeclared state/flag, unexplained negation, negation-only: dropped.
        const dropped = report.dropped.map((f) => f.what);
        expect(dropped).toContain('selectors["&[data-state="checked"]"]');
        expect(dropped).toContain('selectors["&[data-open]"]');
        expect(dropped).toContain('selectors["&[data-pressed]:not([data-selected])"]');
        expect(dropped).toContain('selectors["&:not([data-disabled])"]');
        expectFlatCompounds(css);
    });

    it('projects a domain flag onto its flag class, keyed and as an attribute compound (#457)', () => {
        const row = defineAnatomy('acme-row', {
            'root': { element: 'div', flags: ['selected'], domainFlags: ['unread'] },
        }).toJSON() as ManifestComponent;
        const { css, report } = compile({
            component: 'acme-row',
            parts: {
                root: {
                    states: { 'x-unread': { fontWeight: '600' } },
                    selectors: {
                        '&[data-x-unread][data-selected]': { color: 'blue' },
                        '&[data-x-nope]': { color: 'red' },
                    },
                },
            },
        }, row);
        expect(css).toContain('.zx-acme-row__root.zx-f-x-unread {');
        expect(css).toContain('.zx-acme-row__root.zx-f-x-unread.zx-f-selected {');
        expect(report.dropped.map((f) => f.what)).toContain('selectors["&[data-x-nope]"]');
        expect(() => compile({ component: 'acme-row', parts: { root: { states: { unread: { color: 'red' } } } } }, row))
            .toThrow(/unknown state "unread" \(known: selected, x-unread,/);
        expectFlatCompounds(css);
    });

    it('translates machine-state and multi-attribute compounds', () => {
        const { css } = compile({
            component: 'tabs',
            parts: {
                tab: {
                    selectors: {
                        '&[data-state="active"]': { color: 'red' },
                        '&[data-orientation="vertical"][data-state="active"]': { color: 'blue' },
                    },
                },
            },
        }, tabs);
        expect(css).toContain('.zx-tabs__tab.zx-s-active {');
        expect(css).toContain('.zx-tabs__tab.zx-o-vertical.zx-s-active {');
        expectFlatCompounds(css);
    });

    it('ships the daisy button press rule on lynx', () => {
        const { componentCss } = compileDesignSystemLynx(daisyDS as never, { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] });
        expect(componentCss.button).toMatch(/\.zx-button__root\.zx-f-pressed[.a-z0-9-]* \{/);
    });

    // Lynx stores a var()-bearing declaration under its own property id and
    // expands it after the cascade, in style-map insertion order — so a
    // var-bearing shorthand beats a static longhand of the same edge whatever
    // the specificity (signalxjs/lynx#1161 closed spinner ring, #1162 disabled
    // outline keeping its ink border). The daisy button spells every such
    // edge as longhands, and is content-sized like daisy's btn (#1165).
    describe('daisy button on lynx (signalxjs/lynx#1161, #1162, #1165)', () => {
        const { componentCss } = compileDesignSystemLynx(daisyDS as never, { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] });
        const rules = (css: string) => [...css.matchAll(/^([^\n{@]+) \{\n([\s\S]*?)\n\}/gm)]
            .map(([, selector, body]) => ({ selector: selector!.trim(), decls: body!.split('\n').map((d) => d.trim().replace(/;$/, '')) }));
        const button = rules(componentCss.button ?? '');
        // A selector can own several rules (the token block, then the paint): read them all.
        const decls = (selector: string) => button.filter((r) => r.selector === selector).flatMap((r) => r.decls);

        it('ships no var()-bearing border or padding shorthand', () => {
            const shorthand = /^(border|border-color|border-width|border-style|padding)\s*:.*var\(/;
            const offenders = button.flatMap((r) => r.decls.filter((d) => shorthand.test(d)).map((d) => `${r.selector} { ${d} }`));
            expect(offenders).toEqual([]);
        });

        it('keeps the spinner arc open: only the top edge is transparent', () => {
            const spinner = decls('.zx-button__spinner');
            expect(spinner).toContain('border-top-color: transparent');
            for (const side of ['right', 'bottom', 'left']) expect(spinner).toContain(`border-${side}-color: var(--btn-ink)`);
            const solid = decls('.zx-button__spinner.zx-a-variant-solid');
            for (const side of ['right', 'bottom', 'left']) expect(solid).toContain(`border-${side}-color: var(--btn-on-accent)`);
            expect(solid.some((d) => d.startsWith('border-top-color') || d.startsWith('border-color'))).toBe(false);
        });

        it('draws the outline/dash ink edge as longhands the disabled rule overrides', () => {
            for (const variant of ['outline', 'dash']) {
                const base = decls(`.zx-button__root.zx-a-variant-${variant}`);
                for (const side of ['top', 'right', 'bottom', 'left']) expect(base).toContain(`border-${side}-color: var(--btn-ink)`);
                expect(decls(`.zx-button__root.zx-a-variant-${variant}.zx-f-disabled`)).toContain('border-color: transparent');
            }
        });

        it('sizes the root to its content and never squeezes it', () => {
            const root = decls('.zx-button__root');
            expect(root).toEqual(expect.arrayContaining(['width: max-content', 'flex-shrink: 0', 'flex-wrap: nowrap']));
            // The icon chips give the width back to aspect-ratio; block/wide restate it physically.
            expect(decls('.zx-button__root.zx-m-square')).toContain('width: auto');
            expect(decls('.zx-button__root.zx-m-circle')).toContain('width: auto');
            expect(decls('.zx-button__root.zx-m-block')).toContain('width: 100%');
            expect(decls('.zx-button__root.zx-m-wide')).toEqual(expect.arrayContaining(['width: 100%', 'max-width: 256px']));
            for (const scope of ['dialog', 'popover']) {
                const trigger = rules(componentCss[scope] ?? '').filter((r) => r.selector === `.zx-${scope}__trigger`).flatMap((r) => r.decls);
                expect(trigger).toEqual(expect.arrayContaining(['width: max-content', 'flex-shrink: 0', 'flex-wrap: nowrap']));
            }
        });
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

    it('drops SVG data-URI images — iOS cannot decode them', () => {
        // Measured (signalxjs/lynx#1215, iOS 26 simulator): daisy's
        // --fx-noise tile reached SDWebImage, which failed to decode it and
        // raised a level-error image failure — the dev red screen on every
        // checkbox and radio section.
        const { css, report } = compile({
            component: 'button',
            parts: {
                root: {
                    base: {
                        color: '#111111',
                        backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\'/%3E")',
                        background: 'url(data:image/SVG+XML,%3Csvg/%3E) no-repeat',
                    },
                },
            },
            keyframes: { shimmer: 'from { background-image: url(\'data:image/svg+xml,%3Csvg/%3E\'); } to { opacity: 1; }' },
        });
        expect(css).not.toMatch(/data:image/i);
        expect(css).toContain('color: #111111;');
        expect(report.dropped.filter((f) => f.detail.includes('signalxjs/lynx#1215'))).toHaveLength(3);
        expect(report.dropped.some((f) => f.what === 'keyframes shimmer')).toBe(true);
        // A raster data URI decodes and is left alone.
        const png = compile({
            component: 'button',
            parts: { root: { base: { backgroundImage: 'url("data:image/png,%89PNG")' } } },
        });
        expect(png.css).toContain('data:image/png');
    });

    it('drops every read of a token refused as an SVG image', () => {
        const report = emptyReport();
        const css = compileLynxRecipeCss({
            component: 'button',
            // CSS function names are case-insensitive: `VAR()` is the same read.
            parts: { root: { base: { backgroundImage: 'none, var(--fx-noise)', background: 'VAR(--fx-noise)', backgroundSize: 'auto' } } },
        }, button, report, [], new Set(['--fx-noise']));
        expect(css).not.toContain('--fx-noise');
        expect(report.dropped.filter((f) => f.detail.includes('reads --fx-noise'))).toHaveLength(2);
        expect(css).toContain('background-size: auto;');
        expect(report.dropped.some((f) => f.what.includes('var(--fx-noise)') && f.detail.includes('reads --fx-noise'))).toBe(true);
        const kfReport = emptyReport();
        compileLynxRecipeCss({
            component: 'button',
            parts: { root: { base: { animation: 'grain 1s' } } },
            keyframes: { grain: 'from { background-image: var(--fx-noise); } to { opacity: 1; }' },
        }, button, kfReport, [], new Set(['--fx-noise']));
        expect(kfReport.dropped.some((f) => f.what === 'keyframes grain' && f.detail.includes('reads --fx-noise'))).toBe(true);
    });

    it('drops clip-path — lynx does not apply it', () => {
        // Measured (signalxjs/lynx#1216, iOS 26 simulator): daisy's
        // polygon-cut checkbox tick drew as the unclipped rotated square.
        const { css, report } = compile({
            component: 'button',
            parts: { root: { base: { clipPath: 'polygon(0 0, 100% 0, 50% 100%)', opacity: '1' } } },
            keyframes: { wipe: 'from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0); }' },
        });
        expect(css).not.toContain('clip-path');
        expect(css).toContain('opacity: 1;');
        expect(report.dropped.filter((f) => f.detail.includes('signalxjs/lynx#1216'))).toHaveLength(2);
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

    it('rewrites the logical sizing properties to width/height — lynx ignores them', () => {
        // Measured (signalxjs/lynx#1250): lynx ignores block-size/inline-size
        // and their min-/max- variants — daisy's divider, whose thickness is
        // only block-size/inline-size, drew no rule at all. Lynx has no
        // writing modes, so block-size IS height and inline-size IS width.
        const { css, report } = compile({
            component: 'button',
            parts: {
                root: {
                    base: {
                        blockSize: 'var(--border)',
                        inlineSize: '100%',
                        minBlockSize: '2px',
                        maxInlineSize: '20rem',
                        'min-inline-size': '1px',
                        'max-block-size': 'calc(var(--border) * 3)',
                    },
                    states: { disabled: { inlineSize: '4px' } },
                },
            },
            css: '.x { block-size: 1px; --divider-inline-size: 2px; }\n.y { content: "a; inline-size: 1px"; background: url(data:text/plain,;block-size:1px); }',
            keyframes: { grow: 'from { inline-size: 0; } to { inline-size: 100%; }' },
        });
        expect(css.replace(/^\.y \{.*$/m, '')).not.toMatch(/(?:^|[\s{;])(?:min-|max-)?(?:block|inline)-size\s*:/im);
        expect(css).toContain('height: var(--border);');
        expect(css).toContain('width: 100%;');
        expect(css).toContain('min-height: 2px;');
        expect(css).toContain('max-width: 320px;');
        expect(css).toContain('min-width: 1px;');
        expect(css).toContain('max-height: calc(var(--border) * 3);');
        expect(css).toMatch(/\.zx-button__root\.zx-f-disabled \{\s*width: 4px;/);
        // Raw lynx css and keyframes bodies get the same rewrite; a custom
        // property that merely ends in the name is left alone.
        expect(css).toContain('.x { height: 1px; --divider-inline-size: 2px; }');
        // Quoted strings and url() are opaque, as for the rem rewrite.
        expect(css).toContain('.y { content: "a; inline-size: 1px"; background: url(data:text/plain,;block-size:1px); }');
        expect(css).toContain('from { width: 0; } to { width: 100%; }');
        expect(report.dropped).toHaveLength(0);
        expect(report.translated.filter((f) => f.detail.includes('signalxjs/lynx#1250'))).toHaveLength(9);
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
        // Lynx ignores the logical sizing properties (measured,
        // signalxjs/lynx#1250 — the daisy divider drew no rule); the emitter
        // rewrites them to width/height, so nothing may ship them.
        /(?:^|[\s{;])(?:min-|max-)?(?:block|inline)-size\s*:/im,
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
        // The underline is drawn on the indicator part (lynx-zero positions
        // it over the active tab) and consumes the named ink…
        expect(css).toMatch(/\.zx-tabs__indicator\.zx-a-variant-border \{[^}]*display: flex;[^}]*border-bottom-color: var\(--tab-active-ink\);/);
        // …no tab draws a border of its own any more…
        expect(css).not.toMatch(/\.zx-tabs__tab[^{]*\{[^}]*border-bottom/);
        // …the un-attributed default is base-content, the shared active ink…
        expect(css).toMatch(/\.zx-tabs__indicator \{[^}]*--tab-active-ink: var\(--color-base-content\);/);
        // …and a color-attributed indicator's ink is a concrete per-theme
        // literal (host + two classes, so it beats the one-class default),
        // equal to the very hex the active tab's `color:` bakes to in the
        // same theme.
        const ink = css.match(/\.zx-root \.zx-tabs__indicator\.zx-a-color-primary \{\n\s+--tab-active-ink: (#[0-9a-f]{6,8});/)?.[1];
        const activeColor = css.match(/\.zx-root \.zx-tabs__tab\.zx-a-color-primary\.zx-s-active \{\n\s+color: (#[0-9a-f]{6,8});/)?.[1];
        expect(ink).toBeDefined();
        expect(ink).toBe(activeColor);
    });

    // signalxjs/lynx#1145: lynx has no grid and no logical sizes, so the
    // timeline item fell back to the default layout and the marker (sized
    // only by inline-size/block-size) stretched into a pill.
    it('zero-daisyui timeline: flex items and a physically sized marker', () => {
        const { componentCss } = compileDesignSystemLynx(daisyDS as never, { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] });
        const css = componentCss['timeline']!;
        expect(css).toMatch(/\.zx-timeline__item \{[^}]*display: flex;[^}]*flex-wrap: wrap;/);
        expect(css).not.toMatch(/\.zx-timeline__item \{[^}]*display: grid/);
        // The size chain is inlined (lynx drops var() over a calc-holding
        // property) into width/height, per size too.
        expect(css).toMatch(/\.zx-timeline__marker \{[^}]*width: calc\(var\(--size-selector\) \* 3\);[^}]*height: calc\(var\(--size-selector\) \* 3\);[^}]*flex-shrink: 0;/);
        expect(css).toMatch(/\.zx-timeline__marker\.zx-a-size-xl \{[^}]*width: calc\(var\(--size-selector\) \* 4\);/);
        // The vertical connector is a left border under the marker's centre.
        expect(css).toMatch(/\.zx-timeline__connector\.zx-o-vertical \{[^}]*flex-basis: 100%;[^}]*border-left-width: var\(--border\);[^}]*margin-left: calc\(/);
    });

    // signalxjs/lynx#1166/#1168: the select's popup renders in lynx's
    // overlay outlet, outside the root — so it restates the root's accent
    // per colour step — and the width bounds sit on the root the
    // clear-trigger is positioned against, with the trigger filling it.
    it('zero-daisyui select: root carries the width, the portalled popup restates the accent', () => {
        const { componentCss } = compileDesignSystemLynx(daisyDS as never, { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] });
        const css = componentCss['select']!;
        // Order-agnostic: collect every declaration a selector's blocks carry.
        const decls = (selector: string): string[] => [...css.matchAll(new RegExp(`(?:^|\\n)${selector.replace(/[.]/g, '\\.')} \\{([^}]*)\\}`, 'g'))]
            .flatMap((m) => m[1]!.split(';').map((d) => d.trim()).filter(Boolean));
        const root = decls('.zx-select__root');
        expect(root).toEqual(expect.arrayContaining(['width: 320px', 'max-width: 100%', 'min-width: 48px']));
        const trigger = decls('.zx-select__trigger');
        expect(trigger).toContain('width: 100%');
        expect(trigger).not.toContain('width: 320px');
        expect(decls('.zx-select__popup')).toContain('--select-accent: var(--color-primary)');
        expect(decls('.zx-select__popup.zx-a-color-secondary')).toContain('--select-accent: var(--color-secondary)');
        expect(decls('.zx-select__popup.zx-a-color-error')).toContain('--select-accent: var(--color-error)');
    });

    it('zero-daisyui tabs/accordion: the held part takes daisy\'s hover style', () => {
        const { componentCss } = compileDesignSystemLynx(daisyDS as never, { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] });
        expect(componentCss['tabs']).toMatch(/\.zx-tabs__tab\.zx-f-pressed \{\n\s+color: var\(--color-base-content\);/);
        expect(componentCss['accordion']).toMatch(/\.zx-accordion__trigger\.zx-f-pressed \{\n\s+background: var\(--color-base-200\);/);
    });

    // The checkbox tick and the radio ring/dot were the other three
    // currentColor spends reaching the lynx artifact — all invisible on
    // device for the same reason, and the unchecked rings' color-mix-over-
    // currentColor border fallbacks dropped the whole border besides. Their
    // lynx sections restate all of it with the named accents the web
    // spellings resolve to.
    // The tick is the classic two-border check on a rotated box, and the
    // dash a filled bar centred on the cross axis — neither needs the
    // clip-path lynx does not apply (signalxjs/lynx#1216, #1217).
    it('zero-daisyui checkbox: the tick and the dash are drawn without clip-path', () => {
        const { componentCss } = compileDesignSystemLynx(daisyDS as never, { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] });
        const checkbox = componentCss['checkbox']!;
        const block = (selector: string) => new RegExp(`${selector.replace(/\./g, '\\.')} \\{([^}]*)\\}`).exec(checkbox)?.[1] ?? '';
        const tick = block('.zx-checkbox__indicator');
        expect(tick).toContain('width: 50%;');
        expect(tick).toContain('margin-left: 20%;');
        expect(tick).toContain('border-top-width: 0;');
        expect(tick).toContain('border-left-width: 0;');
        expect(tick).toMatch(/border-right-width: calc\(/);
        expect(tick).toMatch(/border-bottom-width: calc\(/);
        expect(tick).toContain('transform-origin: 60% 50%;');
        expect(tick).toContain('transform: rotate(45deg);');
        const dash = block('.zx-checkbox__indicator.zx-s-indeterminate');
        expect(dash).toContain('width: 60%;');
        expect(dash).toContain('height: 20%;');
        expect(dash).toContain('align-self: center;');
        expect(dash).toContain('border-right-width: 0;');
        expect(dash).toContain('transform: rotate(0deg);');
        // The dash follows every size axis rule, so its zeroed borders win.
        expect(checkbox.lastIndexOf('.zx-checkbox__indicator.zx-a-size-xl {')).toBeLessThan(checkbox.indexOf('.zx-checkbox__indicator.zx-s-indeterminate {'));
    });

    it('zero-daisyui checkbox/radio: marks and rings spend named accents, not currentColor', () => {
        const { componentCss } = compileDesignSystemLynx(daisyDS as never, { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] });
        const checkbox = componentCss['checkbox']!;
        expect(checkbox).not.toMatch(/currentcolor/i);
        expect(checkbox).toMatch(/\.zx-checkbox__indicator \{[^}]*border-color: var\(--checkbox-on-accent\);/);
        expect(checkbox).toMatch(/\.zx-checkbox__indicator\.zx-s-indeterminate \{[^}]*background-color: var\(--checkbox-on-accent\);/);
        expect(checkbox).toMatch(/\.zx-checkbox__control \{[^}]*border: var\(--border\) solid var\(--checkbox-accent\);/);
        const radio = componentCss['radio-group']!;
        expect(radio).not.toMatch(/currentcolor/i);
        // No noise tile and no clip-path reach either artifact
        // (signalxjs/lynx#1215, #1216).
        for (const css of [checkbox, radio]) {
            expect(css).not.toMatch(/fx-noise|data:image|clip-path/);
        }
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
        // …the fill is the web's 90/10 deepened accent, baked per theme
        // (lynx#1144) and rebound per colour step and under `invalid`…
        expect(css).toMatch(/\.zx-root \.zx-slider__root \{\s*--slider-fill: #[0-9a-f]{6};/);
        expect(css).toMatch(/\.zx-root \.zx-slider__root\.zx-a-color-secondary \{\s*--slider-fill: #[0-9a-f]{6};/);
        expect(css).toMatch(/\.zx-root \.zx-slider__control\.zx-f-invalid \{\s*--slider-fill: #[0-9a-f]{6};/);
        const range = css.match(/\.zx-slider__range \{[^}]*\}/)?.[0];
        expect(range).toBeDefined();
        expect(range).toContain('background: var(--slider-fill);');
        // …the knob is daisy's real range-thumb look — a base-100 knob
        // ringed by the fill — with daisy's `--range-p` border width
        // stated as its literal value, 0.25rem (4px once rem is rewritten
        // at 16px, signalxjs/lynx#1183)…
        const thumb = css.match(/\.zx-slider__thumb \{[^}]*\}/)?.[0];
        expect(thumb).toBeDefined();
        expect(thumb).toContain('background: var(--color-base-100);');
        expect(thumb).toContain('border: 4px solid var(--slider-fill);');
        // …the knob centers PHYSICALLY: the web spelling
        // (`inset-block-start`/`translate`/`margin-inline-start`) resolves
        // on iOS but not on Android (signalxjs/lynx#1084 — the thumb sat
        // visibly off-center there), so the lynx section restates it as
        // top/transform/margin-left, proven on both platforms…
        expect(thumb).toContain('top: 50%;');
        expect(thumb).toContain('transform: translateY(-50%);');
        expect(thumb).toContain('margin-left: calc((var(--size-selector) * 6) / -2);');
        // …and neither part's paint rides on accent-color (a native-input
        // mechanism lynx has no renderer for).
        expect(range).not.toContain('accent-color');
        expect(thumb).not.toContain('accent-color');
    });

    // The web draws the divider's rule as ::before/::after segments (#356),
    // which lynx drops: 0.8.0's lynx divider painted no line and, with
    // `--divider-thickness` read only there, lost its size ramp (#375).
    // The thickness is authored as block-size/inline-size, which lynx ignores
    // — the emitter ships it as height/width (signalxjs/lynx#1250).
    it('zero-daisyui divider: the root is the line on lynx, and the size ramp thickens it', () => {
        const { componentCss } = compileDesignSystemLynx(daisyDS as never, { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] });
        const css = componentCss['divider']!;
        expect(css).not.toContain('::');
        expect(css).toMatch(/\.zx-divider__root \{[^}]*background: var\(--divider-ink\);/);
        expect(css).toMatch(/\.zx-divider__root\.zx-o-horizontal \{[^}]*height: var\(--border\);/);
        expect(css).toMatch(/\.zx-divider__root\.zx-o-vertical \{[^}]*width: var\(--border\);/);
        expect(css).toMatch(/\.zx-divider__root\.zx-o-horizontal\.zx-a-size-xl \{[^}]*height: calc\(var\(--border\) \* 3\);/);
        expect(css).toMatch(/\.zx-divider__root\.zx-o-vertical\.zx-a-size-lg \{[^}]*width: calc\(var\(--border\) \* 2\);/);
    });

    it('zero-daisyui slider: the mark is its own tick on lynx, and vertical turns the channel upright', () => {
        const { componentCss } = compileDesignSystemLynx(daisyDS as never, { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] });
        const css = componentCss['slider']!;
        // The web's `::before` tick has no lynx projection — the mark box
        // itself is the 2px rule across the channel (lynx#1144).
        const mark = css.match(/\.zx-slider__mark \{[^}]*\}/)?.[0];
        expect(mark).toBeDefined();
        expect(mark).toContain('width: 2px;');
        expect(mark).toContain('height: calc(var(--size-selector) * 3);');
        expect(mark).toContain('margin-left: -1px;');
        expect(mark).toContain('padding-top: 0;');
        expect(mark).toContain('background-color: var(--color-base-content);');
        expect(css).not.toContain('::before');
        // Vertical, in class grammar: the control is a thumb-wide column,
        // the track fills it, the tick lies across it — each re-sized per
        // step with the calc chains inlined.
        expect(css).toMatch(/\.zx-slider__control\.zx-o-vertical \{[^}]*height: calc\(var\(--size-selector\) \* 40\);/);
        expect(css).toMatch(/\.zx-slider__track\.zx-o-vertical \{[^}]*width: calc\(var\(--size-selector\) \* 3\);[^}]*margin-top: 0;/);
        expect(css).toMatch(/\.zx-slider__track\.zx-o-vertical\.zx-a-size-xl \{\s*width: calc\(var\(--size-selector\) \* 4\);/);
        expect(css).toMatch(/\.zx-slider__mark\.zx-o-vertical \{[^}]*height: 2px;/);
        // No logical spelling reaches the vertical rules either (lynx#1084).
        expect(css).not.toMatch(/inset-|margin-block|margin-inline|padding-block|padding-inline/);
    });

    // Lynx's `outline` ignores `border-radius` and it has no `outline-offset`
    // at all, so daisy's ring painted as a square box flush on every rounded
    // part (signalxjs/lynx#1163). The lynx sections restate it as spread
    // box-shadows — the gap in the part's surface, then the ink — which
    // follow the radius. The accordion trigger fills a clipping card, so its
    // ring is inset (signalxjs/lynx#1164).
    describe('zero-daisyui focus-visible rings on lynx', () => {
        const PILOT = ['button', 'switch', 'slider', 'toast', 'tabs', 'accordion', 'dialog', 'popover', 'select'];
        const lynxCss = () => compileDesignSystemLynx(daisyDS as never, { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] }).componentCss;
        // The slider's value bubble (#490) mirrors its thumb's focus to SHOW
        // itself — it draws no ring (the thumb wears it), so it is no ring
        // rule to hold to the restatement.
        const focusRules = (css: string) => [...css.matchAll(/^(\.[^\n{]*\.zx-f-focus-visible) \{([^}]*)\}/gm)]
            .map((m) => ({ selector: m[1]!, body: m[2]! }))
            .filter(({ selector }) => !selector.startsWith('.zx-slider__thumb-value'));
        const RING = /box-shadow: 0 0 0 2px var\(--[a-z0-9-]+\), 0 0 0 4px var\(--[a-z0-9-]+\)/;

        it('no pilot scope paints an outline ring', () => {
            const css = lynxCss();
            for (const scope of PILOT) {
                const rules = focusRules(css[scope]!);
                expect(rules.length, scope).toBeGreaterThan(0);
                for (const { selector, body } of rules) {
                    expect(body, selector).toContain('outline: none;');
                    expect(body, selector).not.toMatch(/outline: \d/);
                }
            }
        });

        it('each ring is a gap shadow then the ink, in the part\'s own ink', () => {
            const css = lynxCss();
            const ring = (scope: string, selector: string) =>
                focusRules(css[scope]!).find((r) => r.selector === selector)?.body;
            expect(ring('button', '.zx-button__root.zx-f-focus-visible')).toContain('box-shadow: 0 0 0 2px var(--color-base-100), 0 0 0 4px var(--btn-ink);');
            expect(ring('switch', '.zx-switch__control.zx-f-focus-visible')).toContain('box-shadow: 0 0 0 2px var(--color-base-100), 0 0 0 4px var(--switch-accent), 0 1px var(--depth-shade) inset;');
            // The thumb keeps its depth relief under the ring.
            expect(ring('slider', '.zx-slider__thumb.zx-f-focus-visible')).toMatch(/box-shadow: 0 0 0 2px var\(--color-base-100\), 0 0 0 4px var\(--slider-accent\), 0 -1px var\(--depth-shade\) inset/);
            // Toast parts sit on the card: the gap is its fill.
            expect(ring('toast', '.zx-toast__action.zx-f-focus-visible')).toContain('0 0 0 2px var(--toast-bg), 0 0 0 4px var(--color-base-content)');
            expect(ring('toast', '.zx-toast__close.zx-f-focus-visible')).toContain('0 0 0 2px var(--toast-bg)');
            for (const [scope, selector] of [
                ['tabs', '.zx-tabs__tab.zx-f-focus-visible'],
                ['dialog', '.zx-dialog__trigger.zx-f-focus-visible'],
                ['dialog', '.zx-dialog__close.zx-f-focus-visible'],
                ['dialog', '.zx-dialog__cancel.zx-f-focus-visible'],
                ['popover', '.zx-popover__trigger.zx-f-focus-visible'],
                ['popover', '.zx-popover__close.zx-f-focus-visible'],
                ['select', '.zx-select__trigger.zx-f-focus-visible'],
            ] as const) {
                expect(ring(scope, selector), selector).toMatch(RING);
            }
        });

        it('the slider thumb alone carries the ring; the composed control does not', () => {
            const css = lynxCss()['slider']!;
            const control = focusRules(css).find((r) => r.selector === '.zx-slider__control.zx-f-focus-visible')!.body;
            expect(control).toContain('outline: none;');
            expect(control).not.toContain('box-shadow');
        });

        it('the accordion trigger ring is inset, rounded to the card', () => {
            const body = focusRules(lynxCss()['accordion']!).find((r) => r.selector === '.zx-accordion__trigger.zx-f-focus-visible')!.body;
            expect(body).toContain('box-shadow: inset 0 0 0 2px var(--color-base-content);');
            expect(body).toContain('border-radius: calc(var(--radius-box) - var(--border));');
        });

        // signalxjs/lynx#1184: the clear-trigger is a 1.5rem (24px on lynx) chip beside the
        // chevron's 1em box at every size — not a full-height box at the md
        // offset whose outer ring covered the ▾ at lg/xl.
        it('the select clear-trigger is a chip beside the chevron, ringed inside', () => {
            const css = lynxCss()['select']!;
            const decls = (selector: string) => [...css.matchAll(/^([^\n{@]+) \{\n([\s\S]*?)\n\}/gm)]
                .filter(([, sel]) => sel!.trim() === selector)
                .flatMap(([, , body]) => body!.split('\n').map((d) => d.trim().replace(/;$/, '')));
            const ring = focusRules(css).find((r) => r.selector === '.zx-select__clear-trigger.zx-f-focus-visible')!.body;
            expect(ring).toContain('box-shadow: inset 0 0 0 2px var(--color-base-content);');
            const base = decls('.zx-select__clear-trigger');
            expect(base).toEqual(expect.arrayContaining(['width: 24px', 'height: 24px', 'box-sizing: border-box']));
            expect(base.some((d) => d.startsWith('bottom:'))).toBe(false);
            expect(decls('.zx-select__indicator')).toEqual(expect.arrayContaining(['width: 1em', 'text-align: right']));
            const steps = { xs: [8, 2, 'xs'], sm: [10, 3, 'sm'], md: [12, 4, 'sm'], lg: [14, 5, 'md'], xl: [16, 6, 'lg'] } as const;
            for (const [size, [field, pad, text]] of Object.entries(steps)) {
                const trigger = decls(`.zx-select__trigger.zx-a-size-${size}`);
                // The offset reads the same padding and font step the trigger sets.
                expect(trigger).toEqual(expect.arrayContaining([
                    `height: calc(var(--size-field) * ${field})`,
                    `padding-right: calc(var(--size-field) * ${pad})`,
                    `font-size: var(--text-${text})`,
                ]));
                expect(decls(`.zx-select__clear-trigger.zx-a-size-${size}`), size).toEqual([
                    `top: calc(var(--size-field) * ${field / 2} - 12px)`,
                    `right: calc(var(--border) + var(--size-field) * ${pad} + var(--text-${text}) + var(--space-xs))`,
                ]);
            }
        });

        // signalxjs/lynx#1191 via zero#387: the web made room for the chip with
        // `:has(> clear-trigger)`, which the class grammar cannot express, so
        // at lg/xl the value ran under the chip. The `clearable` flag the
        // runtime stamps carries it: the chevron's margin is the chip plus
        // the one `--space-xs` it sits short of the chevron — size-free, as
        // the chip is placed beside the chevron at every size — and the
        // value clips with an ellipsis instead of running on.
        it('a clearable select reserves the chip beside the chevron, and the value gives way', () => {
            const css = lynxCss()['select']!;
            const decls = (selector: string) => [...css.matchAll(/^([^\n{@]+) \{\n([\s\S]*?)\n\}/gm)]
                .filter(([, sel]) => sel!.trim() === selector)
                .flatMap(([, , body]) => body!.split('\n').map((d) => d.trim().replace(/;$/, '')));
            expect(decls('.zx-select__indicator.zx-f-clearable')).toEqual(['margin-left: calc(24px + var(--space-xs))']);
            expect(css).not.toContain(':has(');
            expect(decls('.zx-select__value')).toEqual(expect.arrayContaining([
                'flex-shrink: 1', 'min-width: 0', 'overflow: hidden', 'white-space: nowrap', 'text-overflow: ellipsis',
            ]));
        });

        it('the ring outlasts every later box-shadow rule at equal or lower specificity', () => {
            const css = lynxCss();
            // A variant/modifier that zeroes or sets the part's box-shadow
            // after the ring would erase it: each restates the ring at one
            // class more, emitted after the rule it has to beat.
            const after = (scope: string, beaten: string, ring: string) => {
                const text = css[scope]!;
                const at = text.indexOf(`${beaten} {`);
                const ringAt = text.indexOf(`${ring} {`);
                expect(at, beaten).toBeGreaterThan(-1);
                expect(ringAt, ring).toBeGreaterThan(at);
                expect(focusRules(text).find((r) => r.selector === ring)!.body).toMatch(RING);
            };
            after('button', '.zx-button__root.zx-a-variant-link', '.zx-button__root.zx-a-variant-link.zx-f-focus-visible');
            after('button', '.zx-button__root.zx-m-active', '.zx-button__root.zx-m-active.zx-f-focus-visible');
            after('tabs', '.zx-tabs__tab.zx-a-variant-box.zx-s-active', '.zx-tabs__tab.zx-a-variant-box.zx-f-focus-visible');
            expect(focusRules(css['tabs']!).find((r) => r.selector === '.zx-tabs__tab.zx-a-variant-box.zx-f-focus-visible')!.body)
                .toContain('0 0 0 2px var(--color-base-200)');
        });
    });

    describe('zero-daisyui toggle-group and textarea on lynx (signalxjs/lynx#1218, #1219, #1220, #1230)', () => {
        const lynxCss = () => compileDesignSystemLynx(daisyDS as never, { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] }).componentCss;
        const body = (css: string, selector: string): string | undefined => {
            const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Every rule with exactly this selector, joined (a part's token
            // block and its base are two rules).
            const bodies = [...css.matchAll(new RegExp(`^${escaped} \\{([^}]*)\\}`, 'gm'))].map((m) => m[1]!);
            return bodies.length > 0 ? bodies.join('\n') : undefined;
        };

        it('the toggle-group frame keeps all four edges', () => {
            const css = lynxCss()['toggle-group']!;
            const root = body(css, '.zx-toggle-group__root')!;
            for (const side of ['top', 'right', 'bottom', 'left']) {
                expect(root, side).toContain(`border-${side}-width: var(--border);`);
            }
            // No orientation rule gives an edge up any more.
            expect(body(css, '.zx-toggle-group__root.zx-o-horizontal') ?? '').not.toMatch(/border-left-width/);
            expect(body(css, '.zx-toggle-group__root.zx-o-vertical') ?? '').not.toMatch(/border-top-width/);
        });

        it('the end items carry the join\'s outer corners and the first drops its seam', () => {
            const css = lynxCss()['toggle-group']!;
            const inner = 'calc(var(--radius-field) - var(--border))';
            const firstH = body(css, '.zx-toggle-group__item.zx-m-first.zx-o-horizontal')!;
            expect(firstH).toContain('border-left-width: calc(var(--border) * 0);');
            expect(firstH).toContain(`border-top-left-radius: ${inner};`);
            expect(firstH).toContain(`border-bottom-left-radius: ${inner};`);
            const firstV = body(css, '.zx-toggle-group__item.zx-m-first.zx-o-vertical')!;
            expect(firstV).toContain('border-top-width: calc(var(--border) * 0);');
            expect(firstV).toContain(`border-top-left-radius: ${inner};`);
            expect(firstV).toContain(`border-top-right-radius: ${inner};`);
            const lastH = body(css, '.zx-toggle-group__item.zx-m-last.zx-o-horizontal')!;
            expect(lastH).toContain(`border-top-right-radius: ${inner};`);
            expect(lastH).toContain(`border-bottom-right-radius: ${inner};`);
            const lastV = body(css, '.zx-toggle-group__item.zx-m-last.zx-o-vertical')!;
            expect(lastV).toContain(`border-bottom-left-radius: ${inner};`);
            expect(lastV).toContain(`border-bottom-right-radius: ${inner};`);
            // The end rules come after the seams they override.
            expect(css.indexOf('.zx-toggle-group__item.zx-m-first.zx-o-horizontal {'))
                .toBeGreaterThan(css.indexOf('.zx-toggle-group__item.zx-o-horizontal {'));
        });

        it('the textarea floor is one flat calc per size', () => {
            const css = lynxCss()['textarea']!;
            expect(css).not.toMatch(/calc\(calc\(/);
            expect(body(css, '.zx-textarea__textarea')).toContain('min-height: calc(var(--size-field) * 24);');
            for (const [size, n] of [['xs', 16], ['sm', 20], ['lg', 28], ['xl', 32]] as const) {
                expect(body(css, `.zx-textarea__textarea.zx-a-size-${size}`), size).toContain(`min-height: calc(var(--size-field) * ${n});`);
            }
        });

        it('the textarea ring is one outset ring plus two insets, and their order cannot break it', () => {
            const css = lynxCss()['textarea']!;
            const ring = body(css, '.zx-textarea__textarea.zx-f-focus-visible')!;
            expect(ring).toContain('outline: none;');
            expect(ring).toContain('border-color: var(--color-base-100);');
            // The 1px base-100 inset is the gap on Android, which paints
            // insets over the border (signalxjs/lynx#1230). It sits above the edge.
            expect(ring).toContain('box-shadow: 0 0 0 2px var(--textarea-accent), inset 0 0 0 1px var(--color-base-100), inset 0 0 0 2px var(--textarea-edge);');
            expect(body(css, '.zx-textarea__textarea')).toContain('--textarea-edge: var(--color-base-300);');
            expect(body(css, '.zx-textarea__textarea.zx-f-invalid')).toContain('--textarea-edge: var(--color-error);');
        });
    });

    describe('zero-daisyui divider, stats and empty-state on lynx (signalxjs/lynx#1236)', () => {
        const lynxCss = () => compileDesignSystemLynx(daisyDS as never, { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] }).componentCss;
        const body = (css: string, selector: string): string | undefined => {
            const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const bodies = [...css.matchAll(new RegExp(`^${escaped} \\{([^}]*)\\}`, 'gm'))].map((m) => m[1]!);
            return bodies.length > 0 ? bodies.join('\n') : undefined;
        };

        it('divider: the label inset is physical and flush on its placed side, block-wise when vertical', () => {
            const css = lynxCss()['divider']!;
            expect(css).not.toMatch(/padding-inline/);
            const label = body(css, '.zx-divider__label')!;
            expect(label).toContain('padding-left: var(--space-md);');
            expect(label).toContain('padding-right: var(--space-md);');
            expect(body(css, '.zx-divider__label.zx-p-start')).toContain('padding-left: calc(var(--space-md) * 0);');
            expect(body(css, '.zx-divider__label.zx-p-end')).toContain('padding-right: calc(var(--space-md) * 0);');
            const vertical = body(css, '.zx-divider__label.zx-o-vertical')!;
            expect(vertical).toContain('padding-top: var(--space-sm);');
            expect(vertical).toContain('padding-left: calc(var(--space-md) * 0);');
            expect(body(css, '.zx-divider__label.zx-o-vertical.zx-p-start')).toContain('padding-top: calc(var(--space-sm) * 0);');
            expect(body(css, '.zx-divider__label.zx-o-vertical.zx-p-end')).toContain('padding-bottom: calc(var(--space-sm) * 0);');
        });

        it('divider: a labelled root stops being the line, and its segments grow; both after the thickness ramp', () => {
            const css = lynxCss()['divider']!;
            expect(body(css, '.zx-divider__root')).toContain('--divider-fit: auto;');
            expect(body(css, '.zx-divider__root.zx-m-labelled')).toContain('--divider-ink: transparent;');
            const labelled = body(css, '.zx-divider__root.zx-m-labelled.zx-o-horizontal')!;
            expect(labelled).toContain('flex-direction: row;');
            expect(labelled).toContain('height: var(--divider-fit);');
            expect(body(css, '.zx-divider__root.zx-m-labelled.zx-o-vertical')).toContain('width: var(--divider-fit);');
            expect(body(css, '.zx-divider__root.zx-m-segment')).toContain('flex: 1 1 0;');
            // Same specificity as the size ramp's thickness: source order decides.
            expect(css.indexOf('.zx-divider__root.zx-m-labelled.zx-o-horizontal {'))
                .toBeGreaterThan(css.indexOf('.zx-divider__root.zx-o-horizontal.zx-a-size-xl {'));
        });

        it('stats: flex items (no grid), the figure pinned to the end edge, seams off the first item', () => {
            const css = lynxCss()['stats']!;
            expect(body(css, '.zx-stats__root')).toContain('flex-direction: row;');
            const item = body(css, '.zx-stats__item')!;
            expect(item).toContain('display: flex;');
            expect(item).not.toContain('display: grid;');
            expect(item).toContain('flex-direction: column;');
            expect(item).toContain('padding-right: var(--space-xl);');
            const figure = body(css, '.zx-stats__figure')!;
            expect(figure).toContain('position: absolute;');
            expect(figure).toContain('right: var(--space-xl);');
            expect(body(css, '.zx-stats__item.zx-o-horizontal')).toContain('border-left-width: var(--border);');
            expect(body(css, '.zx-stats__item.zx-o-vertical')).toContain('border-top-width: var(--border);');
            expect(body(css, '.zx-stats__item.zx-m-first.zx-o-horizontal')).toContain('border-left-width: calc(var(--border) * 0);');
            expect(body(css, '.zx-stats__item.zx-m-first.zx-o-vertical')).toContain('border-top-width: calc(var(--border) * 0);');
            // rem is written out at 16px (signalxjs/lynx#1183).
            expect(body(css, '.zx-stats__item.zx-m-figure')).toContain('padding-right: calc(var(--space-xl) + var(--space-md) + 32px);');
        });

        it('empty-state: physical margins, and the text parts carry their own ink and centring', () => {
            const css = lynxCss()['empty-state']!;
            expect(css).not.toMatch(/margin-block/);
            expect(body(css, '.zx-empty-state__icon')).toContain('margin-bottom: var(--space-xs);');
            const actions = body(css, '.zx-empty-state__actions')!;
            expect(actions).toContain('margin-top: var(--space-sm);');
            expect(actions).toContain('flex-direction: row;');
            const title = body(css, '.zx-empty-state__title')!;
            expect(title).toContain('color: var(--color-base-content);');
            expect(title).toContain('text-align: center;');
            expect(body(css, '.zx-empty-state__description')).toContain('text-align: center;');
        });

        it('divider: the rule thickness ships as physical width/height (signalxjs/lynx#1250)', () => {
            const css = lynxCss()['divider']!;
            expect(css).not.toMatch(/(?:^|[\s{;])(?:min-|max-)?(?:block|inline)-size\s*:/m);
            const horizontal = body(css, '.zx-divider__root.zx-o-horizontal')!;
            expect(horizontal).toContain('width: 100%;');
            expect(horizontal).toContain('height: var(--border);');
            expect(body(css, '.zx-divider__root.zx-o-horizontal.zx-a-size-lg')).toContain('height: calc(var(--border) * 2);');
            expect(body(css, '.zx-divider__root.zx-o-vertical')).toContain('width: var(--border);');
            // A segment is a root: it keeps the line's thickness and grows along it.
            expect(body(css, '.zx-divider__root.zx-m-segment.zx-o-horizontal')).toContain('min-width: 0;');
            expect(body(css, '.zx-divider__root.zx-m-segment.zx-o-vertical')).toContain('min-height: 0;');
        });
    });

    describe('zero-daisyui alert close and kbd on lynx (signalxjs/lynx#1253, #1254)', () => {
        const lynxCss = () => compileDesignSystemLynx(daisyDS as never, { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] }).componentCss;
        const body = (css: string, selector: string): string | undefined => {
            const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const bodies = [...css.matchAll(new RegExp(`^${escaped} \\{([^}]*)\\}`, 'gm'))].map((m) => m[1]!);
            return bodies.length > 0 ? bodies.join('\n') : undefined;
        };

        it('alert: the close is a square chip with its glyph centred, not a tall pill', () => {
            const close = body(lynxCss()['alert']!, '.zx-alert__close')!;
            expect(close).toContain('width: calc(var(--text-md) + var(--space-2xs) * 2);');
            expect(close).toContain('height: calc(var(--text-md) + var(--space-2xs) * 2);');
            expect(close).toContain('display: flex;');
            expect(close).toContain('align-items: center;');
            expect(close).toContain('justify-content: center;');
            // The lynx padding replaces the shared 2xs padding, so the box is the size.
            expect(close).toContain('padding: 0;');
            expect(close).not.toContain('padding: var(--space-2xs);');
        });

        it('kbd: the cap is set in a monospace face, as the web UA sheet does', () => {
            expect(body(lynxCss()['kbd']!, '.zx-kbd__root')).toContain('font-family: Menlo, monospace;');
        });
    });

    describe('zero-daisyui navbar on lynx: no section squeezes a word (signalxjs/lynx#1274)', () => {
        const lynxCss = () => compileDesignSystemLynx(daisyDS as never, { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] }).componentCss;
        const body = (css: string, selector: string): string => {
            const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return [...css.matchAll(new RegExp(`^${escaped} \\{([^}]*)\\}`, 'gm'))].map((m) => m[1]!).join('\n');
        };
        /** The declarations of `prop` in rule order: the last one wins the cascade. */
        const last = (decls: string, prop: string): string | undefined =>
            [...decls.matchAll(new RegExp(`^\\s*${prop}: ([^;]+);`, 'gm'))].map((m) => m[1]!).at(-1);

        it('start and end grow from their content and never shrink; the centre never shrinks', () => {
            const css = lynxCss()['navbar']!;
            for (const part of ['start', 'end']) {
                const decls = body(css, `.zx-navbar__${part}`);
                // The shared `flex: 1 1 0%` still ships (grow 1); the lynx
                // longhands come after it and win.
                const shorthand = decls.indexOf('flex: 1 1 0%;');
                expect(shorthand).toBeGreaterThanOrEqual(0);
                expect(shorthand).toBeLessThan(decls.indexOf('flex-basis: auto;'));
                expect(last(decls, 'flex-basis')).toBe('auto');
                expect(last(decls, 'flex-shrink')).toBe('0');
                expect(decls).toContain('display: flex;');
                expect(decls).toContain('flex-direction: row;');
            }
            expect(last(body(css, '.zx-navbar__center'), 'flex-shrink')).toBe('0');
        });
    });

    describe('zero-daisyui tree-view, file-upload and table rows on lynx (signalxjs/lynx#1292, #1294, #1299)', () => {
        let compiled: Record<string, string> | undefined;
        const lynxCss = (): Record<string, string> => (compiled ??= compileDesignSystemLynx(daisyDS as never, {
            components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[],
        }).componentCss);
        const body = (css: string, selector: string): string => {
            const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return [...css.matchAll(new RegExp(`^${escaped} \\{([^}]*)\\}`, 'gm'))].map((m) => m[1]!).join('\n');
        };
        const last = (decls: string, prop: string): string | undefined =>
            [...decls.matchAll(new RegExp(`^\\s*${prop}: ([^;]+);`, 'gm'))].map((m) => m[1]!).at(-1);

        it('tree rows never transition color, so a live selection re-inks the label', () => {
            const css = lynxCss()['tree-view']!;
            for (const part of ['item', 'branch-trigger']) {
                const decls = body(css, `.zx-tree-view__${part}`);
                expect(last(decls, 'transition')).toBe('background var(--duration-fast) var(--ease-standard)');
                expect(decls).not.toMatch(/transition:[^;]*\bcolor\b/);
                // The selected ink itself still ships.
                expect(last(body(css, `.zx-tree-view__${part}.zx-f-selected`), 'color')).toBe('var(--tree-on-accent)');
            }
        });

        it('a file-upload item row shrinks only its name', () => {
            const css = lynxCss()['file-upload']!;
            expect(last(body(css, '.zx-file-upload__item-size'), 'flex-shrink')).toBe('0');
            expect(last(body(css, '.zx-file-upload__item-remove'), 'flex-shrink')).toBe('0');
            const name = body(css, '.zx-file-upload__item-name');
            expect(name).toContain('flex: 1 1 auto;');
            expect(last(name, 'min-width')).toBe('0');
        });

        it('the table sort mark never takes its width out of the header label', () => {
            const css = lynxCss()['table']!;
            expect(last(body(css, '.zx-table__sort-indicator'), 'flex-shrink')).toBe('0');
        });
    });

    describe('zero-daisyui combobox on lynx (signalxjs/lynx#1278, #503)', () => {
        // Compiled once for the block: every test reads the same stylesheet.
        let compiled: string | undefined;
        const comboboxCss = (): string => (compiled ??= compileDesignSystemLynx(daisyDS as never, {
            components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[],
        }).componentCss['combobox']!);
        const body = (css: string, selector: string): string | undefined => {
            const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const bodies = [...css.matchAll(new RegExp(`^${escaped} \\{([^}]*)\\}`, 'gm'))].map((m) => m[1]!);
            return bodies.length > 0 ? bodies.join('\n') : undefined;
        };

        it('the field is bounded like select, and the native input carries its own ink and placeholder', () => {
            const css = comboboxCss();
            const root = body(css, '.zx-combobox__root')!;
            expect(root).toContain('width: 320px;');
            expect(root).toContain('max-width: 100%;');
            const control = body(css, '.zx-combobox__control')!;
            expect(control).toContain('min-width: 48px;');
            expect(control).not.toContain('min-width: 208px;');
            const input = body(css, '.zx-combobox__input')!;
            expect(input).toContain('color: var(--color-base-content);');
            expect(input).not.toContain('color: inherit;');
            expect(body(css, '.zx-root .zx-combobox__input')).toMatch(/-x-placeholder-color: #[0-9a-f]{8};/);
        });

        it('rings are box-shadows, the remove button\'s drawn inside the chip', () => {
            const css = comboboxCss();
            for (const selector of ['.zx-combobox__control.zx-f-focus-visible', '.zx-combobox__tag.zx-f-focus-visible']) {
                const ring = body(css, selector)!;
                expect(ring, selector).toContain('outline: none;');
                expect(ring, selector).toContain('box-shadow: 0 0 0 2px var(--color-base-100), 0 0 0 4px var(--color-base-content);');
            }
            expect(body(css, '.zx-combobox__tag-remove.zx-f-focus-visible')).toContain('box-shadow: inset 0 0 0 2px var(--color-base-content);');
        });

        it('the glyph buttons are centred in explicit ink; held answers stand in for hover', () => {
            const css = comboboxCss();
            for (const part of ['trigger', 'clear-trigger', 'tag-remove']) {
                const rule = body(css, `.zx-combobox__${part}`)!;
                expect(rule, part).toContain('color: var(--color-base-content);');
                expect(rule, part).not.toContain('color: inherit;');
            }
            for (const part of ['trigger', 'clear-trigger']) {
                const rule = body(css, `.zx-combobox__${part}`)!;
                expect(rule, part).toContain('display: flex;');
                expect(rule, part).toContain('align-items: center;');
            }
            expect(body(css, '.zx-combobox__trigger.zx-f-pressed')).toContain('opacity: 1;');
            expect(body(css, '.zx-combobox__item.zx-f-pressed')).toContain('background: var(--color-base-200);');
        });

        it('the portalled popup restates the accent, per colour', () => {
            const css = comboboxCss();
            expect(body(css, '.zx-combobox__popup')).toContain('--combobox-accent: var(--color-primary);');
            expect(body(css, '.zx-combobox__popup.zx-a-color-secondary')).toContain('--combobox-accent: var(--color-secondary);');
            expect(body(css, '.zx-combobox__item.zx-f-selected')).toContain('color: var(--combobox-accent);');
        });
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
