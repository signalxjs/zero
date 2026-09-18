/**
 * Conformance fixture: **Material 3** — the extensible-vocabulary Tier-1 row
 * (docs/architecture.md §7, the conformance program).
 *
 * No `api` and no fixture recipe: `packages/zero-material` IS the executing
 * artifact, and a design system built on zero is zero-native — its documented
 * surface is zero's, so every declared surface grades `exact` by
 * construction. What the row states is the SHAPE the package proves
 * reachable: thirteen colour roles (four beyond the recommended eight, three
 * tonal surfaces, a hairline `outline`) and its own variant vocabulary.
 *
 * Deliberately NOT graded here: Google's component API (`elevated`/`filled`/
 * `tonal`/`outlined`/`text` on M3 Button). That would be a vendor-surface
 * fixture with an `api` declaration of its own — this row is about the token
 * system, which is what zero-material set out to prove. The vocabulary below
 * is pinned verbatim against the package by `conformance.test.ts`.
 */

/** Matrix placement and the artifact column 8 of this system's rows points at. */
export const matrix = {
    system: 'Material 3',
    tier: 1,
    provenBy: 'packages/zero-material',
} as const;

export const source = {
    url: 'https://m3.material.io/styles/color/roles',
    version: 'Material 3 (2026 spec)',
    verified: '2026-07-29',
} as const;

export const vocabulary = {
    roles: [
        'primary', 'secondary', 'tertiary', 'error',
        'surface', 'surface-container', 'surface-container-high', 'outline',
        'neutral', 'info', 'success', 'warning', 'accent',
    ],
    variants: ['solid', 'outline', 'soft', 'ghost'],
} as const;
