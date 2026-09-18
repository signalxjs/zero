/**
 * Conformance fixture: **Radix Themes** — Button (conformance Tier 1 — docs/architecture.md §7).
 *
 * The mechanics this fixture exercises: **an exact variant axis beside a
 * camelCase-renamed modifier.** Radix's `variant` vocabulary maps onto zero's
 * `variant` with no rename and no respelling — the `exact` grade the
 * declaration states with a bare `{}`. `radius` is a custom axis surfacing
 * unrenamed; `highContrast` is the camelCase rename of a kebab modifier, and
 * `loading` surfaces under its own name.
 */
import type { RecipeInput, TokensInput } from '@sigx/zero-kit';
import { defineApi } from '@sigx/zero-kit';

/** Matrix placement and the artifact column 8 of this system's rows points at. */
export const matrix = {
    system: 'Radix Themes',
    tier: 1,
    provenBy: 'skills/design-system/conformance/radix.ts',
} as const;

export const source = {
    url: 'https://www.radix-ui.com/themes/docs/components/button',
    version: '@radix-ui/themes v3',
    verified: '2026-07-29',
} as const;

export const vocabulary = {
    /** Radix's numeric ramp — §7.3's `numeric ramp` kind, and a legal zero size axis. */
    sizes: ['1', '2', '3', '4'],
    variants: ['classic', 'solid', 'soft', 'surface', 'outline', 'ghost'],
    axes: { radius: ['none', 'small', 'medium', 'large', 'full'] },
    modifiers: ['high-contrast', 'loading'],
} as const;

export const api = defineApi(vocabulary, {
    variant: {},
    axes: { radius: {} },
    modifiers: {
        'high-contrast': { as: 'highContrast' },
        loading: {},
    },
});

// ── The executing half (issue #174): Button-only. This is the repo's first
//    real use of `tokens.axes` (no shipped design system declares one) and
//    the first numeric size ramp — the two shapes Radix exists to prove. ──

export const tokens = {
    roles: { primary: {} },
    sizes: [...vocabulary.sizes],
    variants: [...vocabulary.variants],
    axes: { radius: [...vocabulary.axes.radius] },
    modifiers: [...vocabulary.modifiers],
    defaultLight: 'light',
    themes: {
        light: {
            colorScheme: 'light',
            colors: {
                'base-100': 'oklch(100% 0 0)', 'base-200': 'oklch(96% 0 0)',
                'base-300': 'oklch(92% 0 0)', 'base-content': 'oklch(20% 0 0)',
                primary: 'oklch(54% 0.19 275)', 'primary-content': 'oklch(98% 0.01 275)',
            },
        },
    },
} as TokensInput;

export const button: RecipeInput = {
    component: 'button',
    parts: {
        root: {
            base: { border: 'none', cursor: 'pointer' },
            states: { 'focus-visible': { outline: '2px solid var(--color-primary)', outlineOffset: '2px' } },
        },
    },
    variants: {
        variant: {
            classic: { root: { base: { background: 'var(--color-primary)', color: 'var(--color-primary-content)', boxShadow: 'inset 0 1px 0 oklch(100% 0 0 / 0.2)' } } },
            solid: { root: { base: { background: 'var(--color-primary)', color: 'var(--color-primary-content)' } } },
            soft: { root: { base: { background: 'var(--color-primary-soft)', color: 'var(--color-primary)' } } },
            surface: { root: { base: { background: 'var(--color-base-100)', border: '1px solid var(--color-base-300)' } } },
            outline: { root: { base: { background: 'transparent', border: '1px solid var(--color-primary)', color: 'var(--color-primary)' } } },
            ghost: { root: { base: { background: 'transparent', color: 'var(--color-primary)' } } },
        },
        size: {
            '1': { root: { base: { padding: '0.125rem 0.375rem', fontSize: '0.75rem' } } },
            '2': { root: { base: { padding: '0.25rem 0.625rem', fontSize: '0.875rem' } } },
            '3': { root: { base: { padding: '0.375rem 0.875rem', fontSize: '1rem' } } },
            '4': { root: { base: { padding: '0.5rem 1.125rem', fontSize: '1.125rem' } } },
        },
        radius: {
            none: { root: { base: { borderRadius: '0' } } },
            small: { root: { base: { borderRadius: '0.125rem' } } },
            medium: { root: { base: { borderRadius: '0.25rem' } } },
            large: { root: { base: { borderRadius: '0.5rem' } } },
            full: { root: { base: { borderRadius: '9999px' } } },
        },
    },
    modifiers: {
        'high-contrast': { root: { base: { filter: 'contrast(1.2)' } } },
        loading: { root: { base: { cursor: 'progress', opacity: '0.7' } } },
    },
};
