/**
 * #190: the primary button's fill holds its white label at AA in BOTH themes.
 *
 * Carbon keeps `$button-primary` at blue 60 in g100 while `$interactive`
 * lightens to blue 50 for links and focus on the dark base. The skin used to
 * fuse the two, painting the g100 primary button with the lighter blue —
 * 3.74:1 under white text. The fill is its own token now; the lighter
 * interactive blue stays where its lightness is the point.
 */
import { describe, it, expect } from 'vitest';
import { anatomies } from '@sigx/zero/anatomy';
import { auditDesignSystem } from '@sigx/zero-kit';
import type { ManifestComponent } from '@sigx/zero-kit';
import { button, designSystem } from '@sigx/zero-carbon';

const manifest = { components: Object.values(anatomies).map((a) => a.toJSON()) as ManifestComponent[] };
const AA = 4.5;

describe('the primary button fill (#190)', () => {
    const result = auditDesignSystem(designSystem, manifest, { rules: ['contrast/text'] });

    it.each(['white', 'g100'])('%s: every primary-kind label cell clears 4.5:1', (theme) => {
        const cells = result.contrast.themes.find((t) => t.name === theme)!.cells.filter((c) =>
            c.scope === 'button' && c.part === 'root' && c.flag !== 'disabled'
            && (c.axes?.variant === undefined || c.axes.variant === 'primary'));
        expect(cells.length).toBeGreaterThan(0);
        const below = cells
            .filter((c) => c.verdict !== 'unmeasured' && (c.ratio ?? 0) < AA)
            .map((c) => `${c.key} → ${c.ratio}:1 (${c.ink} on ${c.bg})`);
        expect(below).toEqual([]);
    });

    it('no button fill paints with the interactive accent — resting, hover or pressed', () => {
        // The static matrix measures resting/focus/loading cells only; the
        // tertiary kind's solid hover and pressed fills sit under the white
        // label too, so hold every fill slot in the recipe to the button token.
        const fills: string[] = [];
        const walk = (node: unknown): void => {
            if (node === null || typeof node !== 'object') return;
            for (const [key, value] of Object.entries(node)) {
                if (typeof value === 'string' && key.startsWith('--btn-fill')) fills.push(`${key}: ${value}`);
                else walk(value);
            }
        };
        // Only the declaration-bearing sections: `hooks` documents the same
        // property names in prose, which is not a fill.
        walk([button.tokens, button.parts, button.variants, button.modifiers]);
        expect(fills.length).toBeGreaterThan(0);
        expect(fills.filter((f) => f.includes('var(--carbon-interactive)'))).toEqual([]);
        expect(fills).toEqual(expect.arrayContaining([
            '--btn-fill: var(--carbon-button-primary)',
            '--btn-fill-hover: var(--carbon-button-primary)',
            expect.stringMatching(/^--btn-fill-active: .*var\(--carbon-button-primary\)/),
        ]));
    });

    it('g100 keeps a lighter interactive accent than the button fill — only the fill moved', () => {
        const lightness = (color: string) => Number(/oklch\(([\d.]+)%/.exec(color)![1]);
        const g100 = designSystem.tokens.themes!['g100']!.custom!;
        expect(g100['carbon-interactive']).not.toBe(g100['carbon-button-primary']);
        expect(lightness(g100['carbon-interactive']!)).toBeGreaterThan(lightness(g100['carbon-button-primary']!));
    });
});
