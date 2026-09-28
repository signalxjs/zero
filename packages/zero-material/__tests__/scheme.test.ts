/**
 * zero-material's colour is generated from M3's algorithm (#414) into a
 * checked-in file. Regenerate in memory and compare, so a stale scheme is a
 * failing test rather than a silent drift from the seed.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- untyped build script, imported for its pure helpers
import { renderScheme } from '../scripts/gen-scheme.mjs';

describe('zero-material scheme.generated.ts', () => {
    it('is exactly what gen-scheme.mjs generates', () => {
        // vitest runs from the repo root; a Windows checkout with autocrlf
        // hands the file back with CRLF, so both sides are read as LF.
        const lf = (s: string) => s.replace(/\r\n/g, '\n');
        const committed = readFileSync(resolve('packages/zero-material/src/scheme.generated.ts'), 'utf8');
        expect(lf(committed)).toBe(lf(renderScheme()));
    });

    it('draws M3\'s published baseline from seed #6750A4', () => {
        const light = /'material': \{([^}]*)\}/.exec(readFileSync(resolve('packages/zero-material/src/scheme.generated.ts'), 'utf8'))![1];
        expect(light).toContain("'primary': '#6750A4'");
        expect(light).toContain("'error': '#BA1A1A'");
    });
});
