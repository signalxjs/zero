/**
 * Conformance fixture: **Material 3** — the extensible-vocabulary Tier-1 row
 * (docs/architecture.md §7, the conformance program).
 *
 * No fixture recipe: `packages/zero-material` IS the executing artifact. The
 * row states the shape the package proves reachable — M3's full colour-role
 * set (#414: the eight action roles, the four key-colour containers — the
 * rest reach the recipes as each role's soft pair, #421 — the seven-step surface
 * family, the inverse pair, `outline` / `outline-variant`, `scrim`, `shadow`)
 * — and, since #415, M3's component API: Button's five styles by M3's names
 * (`filled`, `tonal`, `elevated`, `outlined`, `text` — `exact`), its
 * `round` / `square` shapes (`exact`), and the icon-button and FAB
 * configurations, which M3 ships as separate components and zero as
 * modifiers on one Button (`reshaped`). The vocabulary and the api are pinned
 * verbatim against the package by `conformance.test.ts`.
 */
import { defineApi } from '@sigx/zero-kit';

/** Matrix placement and the artifact column 8 of this system's rows points at. */
export const matrix = {
    system: 'Material 3',
    tier: 1,
    provenBy: 'packages/zero-material',
} as const;

export const source = {
    url: 'https://m3.material.io/components/buttons/specs',
    version: 'Material 3 (2026 spec)',
    verified: '2026-09-28',
} as const;

export const vocabulary = {
    roles: [
        'primary', 'secondary', 'tertiary', 'error', 'neutral', 'info', 'success', 'warning',
        'primary-container', 'secondary-container', 'tertiary-container', 'error-container',
        'surface', 'surface-dim', 'surface-bright',
        'surface-container-lowest', 'surface-container-low', 'surface-container',
        'surface-container-high', 'surface-container-highest',
        'surface-variant', 'inverse-surface',
        'inverse-primary', 'outline', 'outline-variant', 'scrim', 'shadow',
    ],
    variants: [
        'filled', 'tonal', 'elevated', 'outlined', 'text',
        'primary', 'secondary',
        'small', 'center-aligned', 'medium', 'large', 'bottom',
        'drawer', 'rail', 'bar',
    ],
    modifiers: ['icon', 'fab', 'zebra', 'hover', 'inline'],
    axes: { shape: ['circle', 'square', 'rounded', 'round'] },
} as const;

/** The package's api, restated: `conformance.test.ts` holds the two equal. */
const m3Sizes = { size: { values: { sm: 's', md: 'm', lg: 'l' } } } as const;

export const api = defineApi(vocabulary, {
    variant: {},
    axes: { shape: {} },
    modifiers: { icon: {}, fab: {}, zebra: {}, hover: {}, inline: {} },
    components: { button: m3Sizes, toggle: m3Sizes },
});
