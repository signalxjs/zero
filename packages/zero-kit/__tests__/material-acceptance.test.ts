/**
 * The acceptance test for extensible token vocabularies.
 *
 * `@sigx/zero-material` exists to answer one question: does a design language
 * zero was NOT designed around fit the contract as data, with no
 * special-casing anywhere in the kit? Every assertion here is phrased as
 * "Material's own vocabulary survives", not "the compiler emits something".
 */
import { describe, it, expect } from 'vitest';
import { compileDesignSystem, validateDesignSystem } from '@sigx/zero-kit';
import type { ManifestComponent } from '@sigx/zero-kit';
import { anatomies } from '@sigx/zero/anatomy';
import { designSystem, tokens } from '@sigx/zero-material';

const manifest = {
    components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[],
};
const compiled = compileDesignSystem(designSystem, manifest);
const css = compiled.tokensCss;

describe('a foreign design language on the shared contract', () => {
    it('validates with no errors and no warnings', () => {
        const result = validateDesignSystem(designSystem, manifest);
        expect(result.errors).toEqual([]);
        expect(result.warnings.map((w) => `${w.where}: ${w.message}`)).toEqual([]);
    });

    it('styles every component in the manifest', () => {
        expect(Object.keys(compiled.componentCss).length).toBe(manifest.components.length);
    });
});

describe('colour roles beyond the recommended eight', () => {
    it('declares Material’s vocabulary, not zero’s', () => {
        const declared = Object.keys(compiled.tokens.roles);
        expect(declared).toEqual(expect.arrayContaining([
            'tertiary', 'surface', 'surface-container', 'surface-container-high', 'outline',
        ]));
        expect(declared.length).toBeGreaterThan(8);
    });

    it('emits them by convention, needing no translation', () => {
        // Material's `on-surface` IS the `-content` suffix. That the two
        // conventions coincide is the reason no mapping layer exists.
        expect(css).toContain('--color-surface-container-high:');
        expect(css).toContain('--color-surface-container-high-content:');
        expect(css).toContain('--color-tertiary:');
    });

    it('suppresses derived tints where tonality is explicit', () => {
        // Material's containers ARE tones; a color-mix() against base-100
        // would be wrong, so they declare `soft: false`.
        expect(css).not.toContain('--color-surface-container-soft');
        expect(css).not.toContain('--color-outline-soft');
        // …while an ordinary role still gets its derived tint.
        expect(css).toMatch(/--color-tertiary-soft: color-mix\(/);
    });

    it('omits a content pairing for a role that has no foreground', () => {
        // `outline` is a hairline colour. Inventing `--color-outline-content`
        // would put an unused token in the manifest and a bogus pair in the
        // contrast check.
        expect(css).not.toContain('--color-outline-content');
    });
});

describe('open keys inside the closed categories', () => {
    it('carries an elevation ramp named level1…level5', () => {
        const shadow = compiled.tokens.system.shadow as Record<string, string>;
        expect(Object.keys(shadow)).toEqual(['level1', 'level2', 'level3', 'level4', 'level5']);
        expect(css).toContain('--shadow-level5:');
        // …and none of the recommended xs…xl names, which Material doesn't use.
        expect(css).not.toContain('--shadow-md:');
    });

    it('carries easings Material named itself', () => {
        expect(css).toContain('--ease-emphasized-decelerate:');
        expect(css).toContain('--ease-emphasized-accelerate:');
    });

    it('dims elevation under system dark', () => {
        // A shadow tuned for a light surface is nearly invisible on a dark
        // one, and light-dark() cannot express it.
        const media = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'));
        expect(media).toContain('--shadow-level1:');
    });
});

describe('breakpoints and the responsive dialog', () => {
    it('uses Material’s own window-size classes', () => {
        expect(compiled.tokens.breakpoints).toEqual({ sm: '600px', md: '840px', lg: '1240px' });
    });

    it('makes the dialog full-screen below sm', () => {
        const dialog = compiled.componentCss.dialog!;
        const media = dialog.indexOf('@media (min-width: 600px)');
        expect(media).toBeGreaterThan(-1);
        // Mobile-first: the flat full-bleed sheet is the base, and the raised
        // card is what the breakpoint adds.
        expect(dialog.slice(0, media)).toContain('height: 100dvh');
        expect(dialog.slice(media)).toContain('max-width: 35rem');
    });
});

describe('the swatch follows the declaration', () => {
    it('samples the roles that actually distinguish a Material theme', () => {
        // Not primary/neutral: Material themes differ in their tonal
        // surfaces, so a picker hardcoded to the recommended roles would
        // render every one of them identically.
        expect(tokens.swatch).toContain('surface-container');
        for (const theme of compiled.themes) {
            expect(Object.keys(theme.swatch)).toEqual(tokens.swatch);
        }
    });
});

describe('the colour axis covers what the vocabulary declares', () => {
    it('offers every action role as a button colour', () => {
        // A role declared but missing from the variant axis renders primary —
        // nothing sets --btn-accent, so it keeps the recipe's token default.
        // That reads as "the variant doesn't work" rather than "that one role
        // wasn't wired up".
        const button = designSystem.recipes.find((r) => r.component === 'button')!;
        const offered = new Set(Object.keys(button.variants?.color ?? {}));

        // Fills and hairlines are excluded on purpose: they are surfaces, not
        // things a button is coloured by.
        const notActionColours = new Set([
            'surface', 'surface-container', 'surface-container-high', 'outline',
        ]);
        const expected = Object.keys(tokens.roles ?? {}).filter((r) => !notActionColours.has(r));

        expect([...offered].sort()).toEqual(expected.sort());
    });
});
