/**
 * The layout pack — what every design system gets for its layout tier.
 *
 * The pack exists so the tier cannot drift between skins: `gap="md"` has to
 * mean the `md` rung of `--space-*` in all six, or a page laid out against
 * one falls apart under the next. So the assertions here are mostly about
 * SAMENESS across skins, and about the two places the output legitimately
 * differs — the ramp a skin declares, and the breakpoints it names.
 */
import { describe, expect, it } from 'vitest';
import { LAYOUT_SCOPES, axisRoles, layoutCss, layoutRecipes, layoutScopes, resolveRoles } from '@sigx/zero-kit';
import type { TokensInput } from '@sigx/zero-kit';
import { designSystem as basicDS } from '@sigx/zero-basic';
import { designSystem as daisyDS } from '@sigx/zero-daisyui';
import { designSystem as materialDS } from '@sigx/zero-material';
import { designSystem as brutalistDS } from '@sigx/zero-brutalist';
import { designSystem as herouiDS } from '@sigx/zero-heroui';
import { designSystem as carbonDS } from '@sigx/zero-carbon';

const SKINS = [
    ['basic', basicDS], ['daisyui', daisyDS], ['material', materialDS],
    ['brutalist', brutalistDS], ['heroui', herouiDS], ['carbon', carbonDS],
] as const;

describe('layoutRecipes', () => {
    it('emits exactly the declared layout scopes', () => {
        expect(layoutRecipes(basicDS.tokens as TokensInput).map((r) => r.component).sort())
            .toEqual([...LAYOUT_SCOPES].sort());
    });

    it('is identical for every design system, except where colour is', () => {
        // The GEOMETRY recipes read nothing from the tokens — only the table
        // does. That is what keeps `gap="md"` meaning the same thing
        // everywhere; if a skin could change those rules, the tier would be
        // six tiers.
        //
        // Box is the exception and has to be: it paints, so its colour blocks
        // come from the skin's own declared roles. Asserted as an exception
        // rather than by loosening the invariant, so a geometry recipe that
        // started varying would still fail here.
        const geometry = (ds: (typeof SKINS)[number][1]) =>
            JSON.stringify(layoutRecipes(ds.tokens as TokensInput).filter((r) => r.component !== 'box'));
        const reference = geometry(SKINS[0]![1]);
        for (const [name, ds] of SKINS) expect(geometry(ds), name).toBe(reference);

        // And box varies exactly with the roles, never otherwise.
        for (const [name, ds] of SKINS) {
            const box = layoutRecipes(ds.tokens as TokensInput).find((r) => r.component === 'box')!;
            expect(Object.keys(box.variants?.color ?? {}), name)
                .toEqual(axisRoles((ds.tokens as TokensInput).roles ?? {}));
        }
    });

    it('declares a default for every property it consumes', () => {
        // The anti-inheritance rule, and the reason lynx renders a sane
        // baseline: a `var(--l-*)` with nothing declaring it would inherit a
        // parent layout part's value on the web and dangle on lynx.
        for (const recipe of layoutRecipes(basicDS.tokens as TokensInput)) {
            const declared = new Set(Object.keys(recipe.tokens ?? {}));
            for (const [partName, styles] of Object.entries(recipe.parts)) {
                for (const [prop, value] of Object.entries(styles.base ?? {})) {
                    if (prop.startsWith('--')) declared.add(prop);
                    for (const [, ref] of String(value).matchAll(/var\((--l-[a-z-]+)\)/g)) {
                        expect(declared.has(ref!), `${recipe.component}.${partName}: ${prop} reads ${ref}`).toBe(true);
                    }
                }
            }
        }
    });
});

describe('layoutCss', () => {
    const table = (ds: (typeof SKINS)[number][1]) => layoutCss(ds.tokens as TokensInput);

    it('maps each spacing rung to the design system\'s own token', () => {
        const css = table(basicDS);
        expect(css).toContain('[data-scope][data-part][data-l-gap="md"] {\n    --l-gap: var(--space-md);\n}');
        // `none` is the one rung that is a literal rather than a token —
        // `--space-none` would be a worse thing to have than the zero.
        expect(css).toContain('[data-scope][data-part][data-l-gap="none"] {\n    --l-gap: 0;\n}');
    });

    it('out-specifies the component-token block it has to override', () => {
        // (0,3,0) vs the carrier's (0,2,0). Written as a rule rather than
        // left to source order, because both are custom properties and the
        // failure would be silent: the default would simply keep winning.
        for (const line of table(basicDS).split('\n')) {
            if (!line.includes('[data-l-')) continue;
            expect(line, line).toMatch(/^\s*\[data-scope\]\[data-part\]\[data-l-/);
        }
    });

    it('emits a rung only when the design system declares it', () => {
        const sparse = {
            ...(basicDS.tokens as TokensInput),
            system: { ...(basicDS.tokens as TokensInput).system, spacing: { md: '1rem' } },
        } as TokensInput;
        const css = layoutCss(sparse);
        expect(css).toContain('data-l-gap="md"');
        // An undeclared rung emits NOTHING rather than substituting a
        // neighbour: quietly using a different step would make two design
        // systems disagree about what the same prop means.
        expect(css).not.toContain('data-l-gap="2xl"');
        expect(css).toContain('data-l-gap="none"');
    });

    it('computes the counted attributes rather than tabling them', () => {
        const css = table(basicDS);
        // `minmax(0, 1fr)` rather than a bare `1fr`: a track's implicit
        // minimum is `auto`, which refuses to shrink below its content —
        // the usual reason a grid with long content overflows.
        expect(css).toContain('--l-cols: repeat(3, minmax(0, 1fr));');
        expect(css).toContain('--l-span: span 4;');
        expect(css).toContain('--l-span: 1 / -1;');
        // `min(100%, …)` so a track wider than the viewport does not
        // overflow it — auto-fit would otherwise honour the minimum.
        expect(css).toContain('--l-cols: repeat(auto-fit, minmax(min(100%, var(--l-track)), 1fr));');
    });

    it('centres one axis without collapsing the other', () => {
        // `place-items` takes block then inline, so a Center told to centre
        // inline must pin the block axis to `stretch` rather than leave it
        // centred — otherwise `axis="inline"` would also shrink the child.
        const css = table(basicDS);
        expect(css).toContain('--l-axis: center;');
        expect(css).toContain('--l-axis: stretch center;');
        expect(css).toContain('--l-axis: center stretch;');
    });

    it('emits one media block per declared breakpoint, in ascending order', () => {
        const css = table(basicDS);
        const widths = [...css.matchAll(/@media \(min-width: ([^)]+)\)/g)].map((m) => m[1]!);
        expect(widths).toEqual(Object.values((basicDS.tokens as TokensInput).breakpoints ?? {}));
        // Ascending is a correctness property, not tidiness: the blocks sit
        // in one layer at one specificity, so the later rule wins and a
        // descending emission would make the wider breakpoint lose.
        expect(widths).toEqual([...widths].sort((a, b) => parseFloat(a) - parseFloat(b)));
    });

    it('varies only the attributes the vocabulary marks responsive', () => {
        const css = table(basicDS);
        expect(css).toContain('data-l-md-gap=');
        expect(css).toContain('data-l-md-align=');
        // `wrap` and `grow` describe what a box IS rather than how much room
        // it takes, and every responsive attribute multiplies the emitted
        // CSS by the number of breakpoints.
        expect(css).not.toContain('data-l-md-wrap=');
        expect(css).not.toContain('data-l-md-grow=');
    });

    it('emits nothing responsive for a design system with no breakpoints', () => {
        const noBreakpoints = { ...(basicDS.tokens as TokensInput), breakpoints: undefined } as TokensInput;
        const css = layoutCss(noBreakpoints);
        expect(css).not.toContain('@media');
        expect(css).toContain('data-l-gap="md"');
    });
});

describe('the box recipe', () => {
    const box = (ds: (typeof SKINS)[number][1]) =>
        layoutRecipes(ds.tokens as TokensInput).find((r) => r.component === 'box')!;

    it('tints with the SOFT role, and inks with the role itself', () => {
        // A panel is a large area of colour, and a large area of
        // `--color-error` is a warning label rather than a container. `-soft`
        // is the tint the token contract derives against base-100 for exactly
        // this; its readable ink is then the role, not `-content`, which is
        // the ink for the solid fill.
        const colors = box(basicDS).variants!['color']!;
        expect(colors['error']!['root']!.base).toEqual({
            '--box-surface': 'var(--color-error-soft)',
            '--box-ink': 'var(--color-error)',
        });
    });

    it('rebinds two tokens rather than restating the surface per role', () => {
        // zero-basic Button's shape: N roles cost N rules, not N x every
        // property the surface sets.
        const base = box(basicDS).parts['root']!.base!;
        expect(base['background']).toBe('var(--box-surface)');
        expect(base['color']).toBe('var(--box-ink)');
        // `flow-root`, so a child's margin cannot collapse out through the
        // padding — the classic reason a padded box loses its top padding.
        expect(base['display']).toBe('flow-root');
    });

    it('treats an OMITTED roles declaration as the recommended eight', () => {
        // The declaration grammar distinguishes absence from empty: omitted
        // means "I didn't say" and resolves to the recommended vocabulary,
        // where `{}` means "there isn't one". Collapsing them would hand a
        // design system that relies on the default a colourless Box, and
        // nothing else would have complained.
        const omitted = { ...(basicDS.tokens as TokensInput), roles: undefined } as TokensInput;
        const colors = layoutRecipes(omitted).find((r) => r.component === 'box')!.variants?.['color'];
        expect(Object.keys(colors ?? {})).toEqual(axisRoles(resolveRoles(undefined)));
        expect(Object.keys(colors ?? {}).length).toBeGreaterThan(0);
    });

    it('wires no colour at all for a design system that declares no roles', () => {
        // heroui and carbon have `roles: {}`. An empty `variants.color` block
        // would be dead CSS and an axis the register types as `never` for a
        // reason nobody could read; omitting it is the honest shape.
        expect(box(herouiDS).variants).toBeUndefined();
        expect(box(carbonDS).variants).toBeUndefined();
    });
});

describe('the measure ramp', () => {
    it('resolves each rung through the design system\'s own --measure-* token', () => {
        const css = layoutCss(basicDS.tokens as TokensInput);
        expect(css).toContain('[data-scope][data-part][data-l-measure="lg"] {\n    --l-measure: var(--measure-lg);\n}');
        expect(css).toContain('--l-measure: var(--measure-prose);');
    });

    it('spells `full` as `none`, not 100%', () => {
        // A container told not to bound its width should have NO maximum;
        // `100%` would still bound it to the parent.
        expect(layoutCss(basicDS.tokens as TokensInput))
            .toContain('[data-scope][data-part][data-l-measure="full"] {\n    --l-measure: none;\n}');
    });

    it('every shipped design system declares its own page widths', () => {
        // The whole reason `measure` is a token category rather than a pack
        // default: how wide a page runs is identity, and six skins should
        // disagree about it. A shared default would have made every skin's
        // pages the same width — the leak the layout tier exists to close.
        const md = SKINS.map(([name, ds]) => [name, (ds.tokens as TokensInput).system?.measure?.['md']] as const);
        for (const [name, value] of md) expect(value, name).toBeTruthy();
        expect(new Set(md.map(([, v]) => v)).size).toBeGreaterThan(1);
    });

    it('falls back to the recommended rungs when a skin declares none', () => {
        // Absence is never an error for a category — `css/base.css` ships
        // fallbacks, so a design system that declares no measures still gets
        // a working Container rather than an unbounded one.
        const bare = {
            ...(basicDS.tokens as TokensInput),
            system: { ...(basicDS.tokens as TokensInput).system, measure: undefined },
        } as TokensInput;
        expect(layoutCss(bare)).toContain('--l-measure: var(--measure-lg);');
    });
});

describe('layoutScopes', () => {
    it('declares the geometry scopes out of every axis, and Box out of all but colour', () => {
        // Not decoration: `axis-coverage` walks every scope that HAS a
        // recipe, so without this each layout scope raises findings per skin.
        // The geometry scopes wire nothing — `data-color` on them would paint
        // nothing. Box paints, so its colour is real; its SIZE is its padding
        // and `pad` already says that.
        for (const scope of LAYOUT_SCOPES) {
            expect(layoutScopes[scope], scope).toEqual(scope === 'box'
                ? { sizes: [], variants: [] }
                : { colors: [], sizes: [], variants: [] });
        }
        expect(layoutScopes['box']).not.toHaveProperty('colors');
    });

    it('has a null prototype, like every scope-keyed map in the kit', () => {
        // A scope name is kebab-case and lowercase, so `toString` cannot
        // collide — but `constructor` can, and on a plain object that lookup
        // returns something inherited and truthy.
        expect(Object.getPrototypeOf(layoutScopes)).toBeNull();
        expect((layoutScopes as Record<string, unknown>)['constructor']).toBeUndefined();
    });

    it('is adopted by every shipped design system', () => {
        for (const [name, ds] of SKINS) {
            for (const scope of LAYOUT_SCOPES) {
                expect((ds.tokens as TokensInput).scopes?.[scope], `${name}.${scope}`)
                    .toEqual(layoutScopes[scope]);
            }
        }
    });

    it('is adopted alongside the recipes and the table, in every skin', () => {
        // The three edits are one adoption; a skin with the recipes but not
        // the table would render every layout prop as its default.
        for (const [name, ds] of SKINS) {
            const components = ds.recipes.map((r) => r.component);
            for (const scope of LAYOUT_SCOPES) expect(components, name).toContain(scope);
            expect((ds.css ?? []).join('\n'), name).toContain('[data-l-gap="md"]');
        }
    });
});
