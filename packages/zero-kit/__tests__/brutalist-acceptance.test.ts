/**
 * The end-to-end proof: a style brief, taken through the `design-system`
 * skill, becomes a working design system as data.
 *
 * `@sigx/zero-material` tests whether a foreign VOCABULARY fits the contract.
 * This tests whether a brief fits the SKILL — the assertions below are the
 * cheat sheet's brutalist row, checked against what actually compiled.
 */
import { describe, it, expect } from 'vitest';
import { compileDesignSystem, validateDesignSystem } from '@sigx/zero-kit';
import type { DesignSystemInput, ManifestComponent } from '@sigx/zero-kit';
import { anatomies } from '@sigx/zero/anatomy';
import { designSystem } from '@sigx/zero-brutalist';

const manifest = {
    components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[],
};
const compiled = compileDesignSystem(designSystem, manifest);
const css = compiled.indexCss;

describe('a brief compiles clean', () => {
    it('validates with no errors and no warnings', () => {
        const result = validateDesignSystem(designSystem, manifest);
        expect(result.errors).toEqual([]);
        expect(result.warnings.map((w) => `${w.where}: ${w.message}`)).toEqual([]);
    });

    it('covers every component in the manifest', () => {
        expect(Object.keys(compiled.componentCss).length).toBe(manifest.components.length);
    });
});

describe('the brief survives into the CSS', () => {
    // Each row is a line from the skill's brutalist cheat-sheet entry.
    it('rounds nothing', () => {
        const radius = compiled.tokens.system.radius as Record<string, string>;
        expect(Object.values(radius).every((v) => v === '0')).toBe(true);
    });

    it('draws thick borders', () => {
        expect(compiled.tokens.system.border).toBe('3px');
    });

    it('uses hard offset shadows with no blur', () => {
        // `4px 4px 0 0` in the cheat sheet: two offsets, zero blur, zero
        // spread. The give-away is the third value being 0.
        const shadow = compiled.tokens.system.shadow as Record<string, string>;
        for (const value of Object.values(shadow)) {
            expect(value).toMatch(/^\d+px \d+px 0 0 /);
        }
    });

    it('sets uppercase tracked-out mono labels', () => {
        expect(css).toContain('text-transform: uppercase');
        expect(css).toMatch(/--font-mono:[^;]*monospace/);
        expect(css).toContain('--tracking-wide: 0.1em');
    });

    it('carries weights heavy enough for the brief', () => {
        // "800+ weights" — the whole ramp shifts up rather than adding a step.
        expect(css).toContain('--weight-bold: 900');
        expect(css).toContain('--weight-semibold: 800');
    });

    it('refuses to ease', () => {
        // steps() does not interpolate, which is the motion equivalent of a
        // square corner.
        expect(css).toContain('--ease-standard: steps(2, end)');
    });
});

describe('it still obeys the contract it was generated against', () => {
    it('generates the type ramp from the declared ratio', () => {
        // 1.414 from `md: 1rem` — a dramatic jump, per the skill's note that
        // ratio is the whole personality.
        expect(css).toContain('--text-md: 1rem;');
        expect(css).toContain('--text-lg: 1.414rem;');
    });

    it('hand-tunes the display step the ratio cannot express', () => {
        expect(css).toMatch(/--text-3xl: clamp\(/);
    });

    it('goes full-bleed below its own breakpoint', () => {
        const dialog = compiled.componentCss.dialog!;
        const media = dialog.indexOf('@media (min-width: 640px)');
        expect(media).toBeGreaterThan(-1);
        expect(dialog.slice(0, media)).toContain('height: 100dvh');
    });

    it('stops the indeterminate loop under reduced motion', () => {
        const progress = compiled.componentCss.progress!;
        const reduced = progress.slice(progress.indexOf('@media (prefers-reduced-motion: reduce)'));
        expect(reduced).toContain('animation: none');
    });

    it('composes the button axes rather than multiplying them', () => {
        const button = compiled.componentCss.button!;
        const selectors = button.match(/^\s*\[data-scope="button"\][^{]*/gm) ?? [];
        expect(selectors.filter((s) => s.includes('data-color') && s.includes('data-variant'))).toEqual([]);
    });
});

describe('an unknown category key is an error, not a shrug', () => {
    it('rejects `system.text`, naming where the ramp actually lives', () => {
        // This is the mistake the skill itself used to describe. The compiler
        // ignored it silently, so a generator following the old wording
        // produced a design system with no type ramp and nothing to explain
        // why. Documentation alone wouldn't have stopped the next one.
        const ds: DesignSystemInput = {
            name: 'probe',
            recipes: [],
            tokens: {
                roles: { primary: {} },
                system: { text: { md: '1rem' } },
                defaultLight: 'l',
                themes: {
                    l: {
                        colorScheme: 'light',
                        colors: {
                            'base-100': 'oklch(100% 0 0)', 'base-200': 'oklch(96% 0 0)',
                            'base-300': 'oklch(92% 0 0)', 'base-content': 'oklch(20% 0 0)',
                            primary: 'oklch(50% 0.2 260)', 'primary-content': 'oklch(98% 0.01 260)',
                        },
                    },
                },
            } as DesignSystemInput['tokens'],
        };
        const messages = validateDesignSystem(ds, manifest).errors.map((e) => e.message);
        expect(messages).toContainEqual(expect.stringContaining('is not a token category'));
        expect(messages).toContainEqual(expect.stringContaining('did you mean "typography.sizes"'));
    });
});
