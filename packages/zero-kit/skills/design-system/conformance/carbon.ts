/**
 * Conformance fixture: **IBM Carbon** — Button (conformance Tier 2 — docs/architecture.md §7).
 *
 * The mechanic this fixture exercises: **a renamed axis with respelled
 * values.** Carbon's `kind` is zero's `variant` under another name, and two of
 * its members (`danger--tertiary`, `danger--ghost`) use a double hyphen the
 * attribute grammar cannot hold — so the design system declares the kebab
 * spellings and the api's `values` remap is the only place the vendor
 * spelling lives. Grade: `reshaped` on the variant axis, `reshaped` on both
 * modifiers (boolean prop → presence attribute).
 */
import type { RecipeInput, TokensInput } from '@sigx/zero-kit';
import { defineApi } from '@sigx/zero-kit';

/**
 * Matrix placement. Tier 2, proven by the shipped package: `zero-carbon`
 * graduated this fixture's api (#183), so column 8 points at the artifact
 * that renders it — the fixture remains the matrix's row source and the
 * vocabulary is pinned verbatim to the package by `conformance.test.ts`.
 */
export const matrix = {
    system: 'Carbon',
    tier: 2,
    provenBy: 'packages/zero-carbon',
} as const;

export const source = {
    url: 'https://react.carbondesignsystem.com/?path=/docs/components-button--overview',
    version: '@carbon/react v11',
    verified: '2026-07-29',
} as const;

export const vocabulary = {
    variants: [
        'primary',
        'secondary',
        'tertiary',
        'ghost',
        'danger',
        'danger-tertiary',
        'danger-ghost',
    ],
    /**
     * The PACKAGE's whole declared modifier set, not Button's: graduation
     * (`conformance.test.ts`, "fixtures describing in-repo packages stay
     * verbatim") pins this vocabulary byte-equal to `zero-carbon`'s tokens,
     * and #340 added the DataTable's `zebra` (`useZebraStyles` at the prop
     * boundary — sourced from
     * react.carbondesignsystem.com/?path=/docs/components-datatable-basic,
     * verified 2026-08-05) to that set. The matrix row and `source.url`
     * above still grade BUTTON — `zebra` rides along because the fixture's
     * vocabulary is the package's, and only `icon-only`/`expressive` are
     * button facts.
     */
    modifiers: ['icon-only', 'expressive', 'zebra'],
} as const;

export const api = defineApi(vocabulary, {
    variant: {
        as: 'kind',
        values: {
            'danger-tertiary': 'danger--tertiary',
            'danger-ghost': 'danger--ghost',
        },
    },
    modifiers: {
        'icon-only': { as: 'hasIconOnly' },
        expressive: { as: 'isExpressive' },
        zebra: { as: 'useZebraStyles' },
    },
});

// ── The executing half (issue #174): a Button-only design system wiring the
//    whole vocabulary, so the matrix row compiles and emits the selectors it
//    claims. Minimal on purpose — the row is about the axis surface. ──

export const tokens = {
    roles: { primary: {} },
    variants: [...vocabulary.variants],
    modifiers: [...vocabulary.modifiers],
    defaultLight: 'white',
    themes: {
        white: {
            colorScheme: 'light',
            colors: {
                'base-100': 'oklch(100% 0 0)', 'base-200': 'oklch(96% 0 0)',
                'base-300': 'oklch(92% 0 0)', 'base-content': 'oklch(20% 0 0)',
                primary: 'oklch(51% 0.23 262)', 'primary-content': 'oklch(98% 0.01 262)',
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
            primary: { root: { base: { background: 'var(--color-primary)', color: 'var(--color-primary-content)' } } },
            secondary: { root: { base: { background: 'var(--color-base-300)', color: 'var(--color-base-content)' } } },
            tertiary: { root: { base: { background: 'transparent', color: 'var(--color-primary)', border: '1px solid' } } },
            ghost: { root: { base: { background: 'transparent', color: 'var(--color-primary)' } } },
            danger: { root: { base: { background: 'oklch(50% 0.2 25)', color: 'oklch(98% 0.01 25)' } } },
            // Carbon's double-hyphen members, in the attribute grammar's
            // spelling — the api's `values` remap owns the vendor spelling.
            'danger-tertiary': { root: { base: { background: 'transparent', color: 'oklch(50% 0.2 25)', border: '1px solid' } } },
            'danger-ghost': { root: { base: { background: 'transparent', color: 'oklch(50% 0.2 25)' } } },
        },
    },
    modifiers: {
        'icon-only': { root: { base: { aspectRatio: '1', padding: '0' } } },
        expressive: { root: { base: { fontSize: '1rem' } } },
    },
};
