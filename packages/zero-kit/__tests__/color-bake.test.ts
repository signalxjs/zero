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

    // #123: missing means CONVERTED powerless. An achromatic colour written in
    // the mix's own space is never converted, so its hue is a real endpoint.
    // Every expectation is Chrome's own paint of the same expression.
    it('keeps the hue an achromatic operand WROTE in the mix space (Chrome: #fdeff5, #7a96fb)', () => {
        expect(bakeColorValue('color-mix(in oklch, #006fee 8%, oklch(100% 0 0))', {}, 'light', 'test')).toBe('#fdeff5');
        expect(bakeColorValue('color-mix(in oklch, #338ef7 85%, oklch(98% 0 0))', {}, 'light', 'test')).toBe('#7a96fb');
    });

    it('still carries a hue that is missing: converted (#fff, hsl()) or written `none` (Chrome: #edf4ff)', () => {
        for (const white of ['#ffffff', 'white', 'hsl(0 0% 100%)', 'oklch(100% 0 none)']) {
            expect(bakeColorValue(`color-mix(in oklch, #006fee 8%, ${white})`, {}, 'light', 'test'), white).toBe('#edf4ff');
        }
    });

    it('reads a token\'s written form through `var()` when the baked map cannot carry it', () => {
        const colors = { primary: '#006fee', 'base-100': '#ffffff' };
        const mix = 'color-mix(in oklch, var(--color-primary) 8%, var(--color-base-100))';
        // Baked literals alone: the hue is lost with the conversion to hex.
        expect(bakeColorValue(mix, colors, 'light', 'test')).toBe('#edf4ff');
        // The written token keeps it, as the browser reading the same token does.
        expect(bakeColorValue(mix, colors, 'light', 'test', { 'base-100': 'oklch(100% 0 0)' })).toBe('#fdeff5');
        // In oklab there is no hue to keep: the written form changes nothing.
        expect(bakeColorValue(mix.replace('oklch', 'oklab'), colors, 'light', 'test', { 'base-100': 'oklch(100% 0 0)' }))
            .toBe(bakeColorValue(mix.replace('oklch', 'oklab'), colors, 'light', 'test'));
    });

    it('carryMissingComponents fills only what is missing, and never alpha', () => {
        const [a, b] = carryMissingComponents('#0087a0', '#000000', 'oklch') as unknown as [Record<string, number>, Record<string, number>];
        expect(b.h).toBeCloseTo(a.h!, 6);
        expect(b.l).toBe(0);
        expect(a.alpha).toBeUndefined();
    });
});

// #182: CSS Color 5 §2.1 percentage normalization, in full. A sum under 100
// scales the result's alpha by it; a zero sum is invalid; the percentage may
// be written before the colour as well as after it.
describe('color-mix() percentage normalization (#182)', () => {
    const bake = (v: string) => bakeColorValue(v, {}, 'light', 'test');

    it('scales alpha by the sum when the percentages add up to less than 100', () => {
        expect(bake('color-mix(in srgb, red 50%, blue 50%)')).toBe('#800080');
        expect(bake('color-mix(in srgb, red 30%, blue 30%)')).toBe('#80008099');
        expect(bake('color-mix(in srgb, red 20%, blue 20%)')).toBe('#80008066');
    });

    it('rejects two percentages that sum to zero instead of baking black', () => {
        expect(() => bake('color-mix(in srgb, red 0%, blue 0%)')).toThrow(/sum to 0%/);
    });

    it('parses a percentage written before the colour', () => {
        expect(bake('color-mix(in srgb, 30% red, blue)')).toBe(bake('color-mix(in srgb, red 30%, blue)'));
        expect(bake('color-mix(in srgb, red, 70% blue)')).toBe(bake('color-mix(in srgb, red 30%, blue)'));
    });
});

// #182: a value with more than 16 top-level colour functions (a long gradient,
// a many-layer shadow) must bake every one of them, not silently stop.
describe('bakeColorValue: no cap on colour functions (#182)', () => {
    it('bakes all eighteen top-level functions of a long list', () => {
        const v = Array.from({ length: 18 }, (_, i) => `oklch(50% 0.1 ${i * 10})`).join(', ');
        const out = bakeColorValue(v, {}, 'light', 'test');
        expect(out).not.toMatch(/oklch\(/);
        expect(out.split(', ')).toHaveLength(18);
        for (const part of out.split(', ')) expect(part).toMatch(/^#[0-9a-f]{6}$/);
    });
});
