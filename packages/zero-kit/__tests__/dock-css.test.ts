/**
 * The responsive Drawer's per-breakpoint structure (#82): the rules that make
 * `modal={{ below: 'md' }}`'s docked server markup correct on first paint.
 * Emitted once per declared breakpoint, in `@layer zero.structure`, on the
 * drawer's own stylesheet — or index.css alone when the design system paints
 * no drawer, since the markup needs them either way.
 */
import { describe, expect, it } from 'vitest';
import { anatomies } from '@sigx/zero/anatomy';
import { compileDesignSystem } from '@sigx/zero-kit';
import type { ManifestComponent } from '@sigx/zero-kit';
import { designSystem as basicDS } from '@sigx/zero-basic';

const manifest = { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] };

const structure = (css: string): string => css.slice(css.indexOf('@layer zero.structure'));

describe('responsive Drawer structure', () => {
    it('hides trigger and close at or above each breakpoint, and the undocked panel below it', () => {
        const { componentCss } = compileDesignSystem(basicDS, manifest);
        const css = structure(componentCss['drawer']!);
        // Every declared breakpoint, with the boundaries useMediaQuery uses.
        for (const [bp, width] of [['sm', '640px'], ['md', '768px'], ['lg', '1024px']]) {
            const above = css.slice(css.indexOf(`@media (min-width: ${width})`));
            expect(above).toMatch(new RegExp(
                `^@media \\(min-width: ${width}\\) \\{\\s*`
                + `\\[data-scope="drawer"\\]\\[data-part="trigger"\\]\\[data-l-${bp}-dock="inline"\\],\\s*`
                + `\\[data-scope="drawer"\\]\\[data-part="close"\\]\\[data-l-${bp}-dock="inline"\\] \\{\\s*display: none;`,
            ));
            expect(css).toContain(`@media (width < ${width}) {\n        [data-scope="drawer"][data-part="panel"][data-l-${bp}-dock="inline"]:not(:modal) {\n            display: none;`);
        }
        // The docked panel is back in flow: the UA's dialog geometry is an overlay's.
        expect(css).toContain('[data-scope="drawer"][data-part="panel"][data-l-md-dock="inline"] {\n            position: relative;\n            inset: auto;\n            margin: 0;');
    });

    it('rides the drawer stylesheet once, and index.css carries it through it', () => {
        const { componentCss, indexCss } = compileDesignSystem(basicDS, manifest);
        expect(componentCss['drawer']).toContain('@layer zero.structure');
        expect(indexCss.split('data-l-md-dock="inline"]:not(:modal)').length - 1).toBe(1);
    });

    it('a design system with no drawer recipe still ships it, in index.css', () => {
        const bare = { ...basicDS, recipes: basicDS.recipes.filter((r) => r.component !== 'drawer') };
        const { componentCss, indexCss } = compileDesignSystem(bare, manifest);
        expect(componentCss['drawer']).toBeUndefined();
        expect(indexCss).toContain('[data-scope="drawer"][data-part="panel"][data-l-md-dock="inline"]:not(:modal)');
    });

    it('an empty ramp emits nothing', () => {
        // No recipes: basic's own use `at: { sm }`, which a flat ramp refuses.
        const flat = { ...basicDS, recipes: [], tokens: { ...basicDS.tokens, breakpoints: {} } };
        expect(compileDesignSystem(flat, manifest).indexCss).not.toContain('-dock=');
    });
});
