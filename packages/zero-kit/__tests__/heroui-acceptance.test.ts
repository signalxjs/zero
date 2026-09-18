/**
 * `zero-heroui` is the acceptance test for NON-ORTHOGONAL axis surfaces and
 * presence-only modifiers (docs/architecture.md, "Thesis and shape") — the
 * counterpart to what
 * `zero-material` does for extensible vocabularies.
 *
 * The claim under test: the contract can express a design system that shares
 * none of the four in-repo skins' axis assumptions. HeroUI v3 removed `color`
 * outright and fused colour into `variant`, so `primary` and `danger-soft` are
 * variants; it kept a three-step size ramp where every other package here
 * takes the recommended five; and it has two presence-only booleans.
 *
 * Every assertion below is something the other four design systems cannot
 * demonstrate, because they are all colour × treatment with an `xs`–`xl` ramp.
 */
import { describe, it, expect } from 'vitest';
import { compileDesignSystem, compileRegisterDts, validateDesignSystem } from '@sigx/zero-kit';
import type { ManifestComponent } from '@sigx/zero-kit';
import { anatomies } from '@sigx/zero/anatomy';
import { designSystem as herouiDS } from '@sigx/zero-heroui';
import { designSystem as basicDS } from '@sigx/zero-basic';

const manifest = {
    components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[],
};

const compiled = compileDesignSystem(herouiDS, manifest);
const dts = compileRegisterDts(compiled);

describe('a design system with no colour axis', () => {
    it('validates clean', () => {
        const result = validateDesignSystem(herouiDS, manifest);
        expect(result.errors).toEqual([]);
    });

    it('declares no roles, so no --color-<role> is emitted', () => {
        expect(compiled.tokens.roles).toEqual({});
        // Every `--color-*` the stylesheet defines, not a spot-check of a few
        // role names someone might have minted: the claim is that NO role
        // token exists, so the assertion has to be over the whole set.
        const emitted = new Set(
            [...compiled.tokensCss.matchAll(/^\s*(--color-[\w-]+)\s*:/gm)].map((m) => m[1]!),
        );
        expect([...emitted].sort()).toEqual([
            '--color-base-100', '--color-base-200', '--color-base-300', '--color-base-content',
        ]);
    });

    it('types every component colour as never', () => {
        for (const axes of Object.values(compiled.components)) expect(axes.color).toEqual([]);
        expect(dts).toContain('color: never;');
    });

    it('says WHY colour is never — no axis, rather than an unwired one', () => {
        // The distinction is the whole diagnostic: "no recipe wires it" sends
        // an author looking for a recipe bug that does not exist here. It has
        // to be per AXIS, not per file: `variant` IS declared by this design
        // system, so an unwired one on tabs genuinely is a recipe gap and must
        // still say so.
        const lines = dts.split('\n');
        const reasonFor = (axis: string) => lines
            .map((line, i) => (new RegExp(`^\\s*${axis}: never;$`).test(line) ? lines[i - 1]! : null))
            .filter((doc): doc is string => doc !== null);

        const colourReasons = reasonFor('color');
        expect(colourReasons.length).toBeGreaterThan(0);
        // Two honest spellings, and the diagnostic is that NEITHER is the
        // recipe-gap one. Most scopes get "at all", because heroui declares
        // `roles: {}`; the layout scopes get the narrower "for <scope>",
        // because they additionally declare `colors: []` — a Stack is
        // geometry, so its colour would be `never` even on a skin that has
        // a colour axis. Asserting only the DS-wide spelling would force the
        // less precise message on them.
        for (const doc of colourReasons) {
            expect(doc).not.toContain('no heroui recipe wires it');
            expect(doc).toMatch(/declares no color axis (at all|for [\w-]+)/);
        }
        expect(colourReasons.some((d) => d.includes('declares no color axis at all'))).toBe(true);
        expect(colourReasons.some((d) => d.includes('declares no color axis for stack'))).toBe(true);

        // `variant` IS declared by this design system, so an unwired one on a
        // scope that could carry it genuinely is a recipe gap and must still
        // say so. Asserted on a named scope rather than over all of them,
        // because the layout scopes declare `variants: []` and so answer the
        // per-scope way — which is the correct answer for them, not a
        // regression in this diagnostic.
        const reasonLineFor = (axis: string, scope: string) => {
            const at = lines.findIndex((l) => l.includes(`${scope} —`));
            expect(at, `${scope} block`).toBeGreaterThan(-1);
            const idx = lines.findIndex((l, i) => i > at && new RegExp(`^\\s*${axis}: never;$`).test(l));
            return idx === -1 ? '' : lines[idx - 1]!;
        };
        expect(reasonLineFor('variant', 'tabs')).toContain('no heroui recipe wires it');
        expect(reasonLineFor('variant', 'stack')).toContain('declares no variant axis for stack');
    });

    it('degrades the theme swatch to the base pair rather than failing', () => {
        // `defaultSwatch([])` has no roles to sample, so it falls back to the
        // base pair. A theme picker still has something to show.
        for (const theme of compiled.themes) {
            expect(Object.keys(theme.swatch)).toEqual(['base-100', 'base-content']);
        }
    });
});

describe('a fused variant vocabulary', () => {
    it('is emphatically not the other four systems\' solid|outline|soft|ghost', () => {
        const basic = compileDesignSystem(basicDS, manifest);
        expect(basic.tokens.variants).toEqual(['solid', 'outline', 'soft', 'ghost']);
        expect(compiled.tokens.variants).toEqual(
            ['primary', 'secondary', 'tertiary', 'outline', 'ghost', 'danger', 'danger-soft'],
        );
        // Two names overlap; the vocabularies are still different sets, which
        // is the point — the four-name set is convention, not contract.
        expect(compiled.tokens.variants).not.toEqual(basic.tokens.variants);
    });

    it('folds colour INTO a variant member', () => {
        // `danger-soft` is one member carrying both a colour and a treatment.
        // Under a colour × fill model this would be `color="danger"
        // variant="soft"`; here there is no colour prop to pass.
        expect(compiled.components['button']!.variant).toContain('danger-soft');
        expect(compiled.componentCss['button']).toContain('[data-variant="danger-soft"]');
        expect(dts).toContain("variant: 'primary' | 'secondary' | 'tertiary' | 'outline' | 'ghost' | 'danger' | 'danger-soft';");
    });
});

describe('a declared size ramp that is not the recommended one', () => {
    it('is three steps, and closed', () => {
        expect(compiled.tokens.sizes).toEqual(['sm', 'md', 'lg']);
        expect(dts).toContain("size: 'sm' | 'md' | 'lg';");
    });

    it('emits no rule for md, because md IS the base', () => {
        expect(compiled.componentCss['button']).toContain('[data-size="sm"]');
        expect(compiled.componentCss['button']).not.toContain('[data-size="md"]');
    });
});

describe('presence-only modifiers', () => {
    it('emits valueless attributes', () => {
        const css = compiled.componentCss['button']!;
        expect(css).toContain('[data-mod-icon-only]');
        expect(css).toContain('[data-mod-pending]');
        expect(css).not.toContain('data-mod-icon-only="');
    });

    it('types them as booleans keyed by name', () => {
        expect(compiled.components['button']!.mods.sort()).toEqual(['icon-only', 'pending']);
        expect(dts).toContain("mods: { 'icon-only': boolean; 'pending': boolean };");
    });

    it('lets a modifier join a compound match', () => {
        // The flag-in-a-compound case the axis grammar could not express, and
        // the first use of it by any design system.
        expect(compiled.componentCss['button']).toContain('[data-variant="danger"][data-mod-icon-only]');
    });
});
