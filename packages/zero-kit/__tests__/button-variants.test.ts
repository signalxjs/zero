/**
 * The variant axes, compiled.
 *
 * `color` × `variant` is the combination that multiplies if you let it: eight
 * roles by four fills is thirty-two rule sets before sizes. Both shipped
 * design systems route the two through a pair of component tokens instead, so
 * the axes compose. These tests pin that, because the naive form is the
 * obvious thing to write and it is only obviously wrong at scale.
 */
import { describe, it, expect } from 'vitest';
import { compileDesignSystem } from '@sigx/zero-kit';
import type { ManifestComponent } from '@sigx/zero-kit';
import { anatomies } from '@sigx/zero/anatomy';
import { designSystem as basicDS } from '@sigx/zero-basic';
import { designSystem as daisyDS } from '@sigx/zero-daisyui';

const manifest = {
    components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[],
};

const compiled = {
    basic: compileDesignSystem(basicDS, manifest),
    daisyui: compileDesignSystem(daisyDS, manifest),
};

describe.each(['basic', 'daisyui'] as const)('%s button', (name) => {
    const css = compiled[name].componentCss.button!;

    it('styles all three axes', () => {
        expect(css).toContain('[data-color="success"]');
        expect(css).toContain('[data-variant="outline"]');
        expect(css).toContain('[data-size="xl"]');
    });

    it('routes colour through an accent pair rather than per-fill rules', () => {
        // A colour rule sets tokens only — it never mentions `background`,
        // because which property the accent lands on is the fill's business.
        const success = css.slice(css.indexOf('[data-color="success"]'));
        const rule = success.slice(0, success.indexOf('}'));
        expect(rule).toContain('--btn-accent: var(--color-success)');
        expect(rule).not.toContain('background:');
    });

    it('reads the accent in the fill rules', () => {
        const solid = css.slice(css.indexOf('[data-variant="solid"]'));
        expect(solid.slice(0, solid.indexOf('}'))).toContain('var(--btn-accent)');
    });

    it('emits one rule per colour, not one per colour × fill', () => {
        // The point of the indirection: adding a ninth role costs one rule.
        const colourRules = css.match(/\[data-color="[a-z]+"\] \{/g) ?? [];
        const fills = new Set((css.match(/\[data-variant="([a-z]+)"\]/g) ?? []));
        expect(colourRules.length).toBe(8);
        expect(fills.size).toBeGreaterThanOrEqual(4);
        // The property directly: no rule narrows on both axes at once. That
        // is what a multiplied matrix looks like, and what the token
        // indirection exists to avoid — asserted instead of a rule count,
        // which any unrelated selector would perturb.
        const selectors = css.match(/^\s*\[data-scope="button"\][^{]*/gm) ?? [];
        const multiplied = selectors.filter((sel) => sel.includes('data-color') && sel.includes('data-variant'));
        expect(multiplied).toEqual([]);
    });

    it('applies CSS-only defaults with no attributes present', () => {
        expect(css).toContain(':not([data-variant])');
        expect(css).toContain(':not([data-size])');
    });

    it('styles focus-visible, since a button is the keyboard target', () => {
        expect(css).toContain('[data-focus-visible]');
    });
});

describe('the button anatomy', () => {
    it('is a single part on a real button element', () => {
        const button = manifest.components.find((c) => c.scope === 'button')!;
        expect(button.parts.map((p) => p.name)).toEqual(['root']);
        expect(button.parts[0]!.element).toBe('button');
    });

    it('declares no machine states', () => {
        // A button has nothing to be open or checked about. Held press is
        // `:active` (a pseudo-class) plus the `pressed` / `press-animating`
        // press-feedback flags — flags, not states, because they compose.
        const button = manifest.components.find((c) => c.scope === 'button')!;
        expect(button.parts[0]!.states ?? []).toEqual([]);
        expect(button.parts[0]!.flags).toEqual(['disabled', 'focus-visible', 'pressed', 'press-animating']);
    });
});
