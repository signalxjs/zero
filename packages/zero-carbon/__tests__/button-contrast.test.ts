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
import { designSystem } from '@sigx/zero-carbon';

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

    it('g100 keeps the lighter interactive blue for links and focus — only the button fill moved', () => {
        const g100 = designSystem.tokens.themes!['g100']!.custom!;
        expect(g100['carbon-interactive']).toBe('oklch(62% 0.19 262)');
    });
});
