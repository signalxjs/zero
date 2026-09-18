/**
 * The shared colour baker (`resolve/color-bake.ts`) against what the browser
 * paints. Found by the parity gate (#403, slice D): `color-mix()` toward an
 * achromatic colour interpolated an invented hue — CSS Color 4 §12.3 says a
 * MISSING component (black's hue in oklch) is carried over from the other
 * colour. Chrome paints `color-mix(in oklch, #0087a0 86%, black)` as
 * `#006d82`; the baker said `#00716a`.
 */
import { describe, it, expect } from 'vitest';
import { bakeColorValue, carryMissingComponents } from '../src/resolve/color-bake.js';

describe('color-mix() missing components', () => {
    it('carries the other colour\'s hue over an achromatic endpoint (Chrome: #006d82)', () => {
        expect(bakeColorValue('color-mix(in oklch, #0087a0 86%, black)', {}, 'light', 'test')).toBe('#006d82');
        expect(bakeColorValue('color-mix(in oklch, #2e5060 86%, black)', {}, 'light', 'test')).toBe('#24404d');
    });

    it('keeps the premultiplied-alpha behaviour toward transparent (Chrome: #0087a0 at 0.7)', () => {
        expect(bakeColorValue('color-mix(in oklch, #0087a0 70%, transparent)', {}, 'light', 'test')).toBe('#0087a0b3');
    });

    it('carryMissingComponents fills only what is missing, and never alpha', () => {
        const [a, b] = carryMissingComponents('#0087a0', '#000000', 'oklch') as unknown as [Record<string, number>, Record<string, number>];
        expect(b.h).toBeCloseTo(a.h!, 6);
        expect(b.l).toBe(0);
        expect(a.alpha).toBeUndefined();
    });
});
