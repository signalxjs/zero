/**
 * Conformance fixture: **Ant Design** — Button (conformance Tier 2 — docs/architecture.md §7).
 *
 * The mechanics this fixture exercises: **a renamed axis that shadows a
 * component prop, an exact custom axis, and modifiers under their own
 * names.** Ant's `type` is zero's `variant` renamed — and `type` is also
 * zero-Button's native button-type prop. The shadowing is vendor-faithful
 * (Ant itself spells the native attribute `htmlType`) — and since #318 it is
 * a PER-SCOPE decision: `type` sits in `RESERVED_PROPS_BY_SCOPE`, so the
 * rename is declared under `api.components.button`, where the shadowing is
 * chosen for Button rather than inflicted on every scope. This fixture is
 * therefore also the acceptance test for the per-scope `components` key.
 * `shape` is a custom axis surfacing unrenamed; `danger`/`ghost`/`block` are
 * presence flags surfacing as boolean props of the same name.
 */
import type { RecipeInput, TokensInput } from '@sigx/zero-kit';
import { defineApi } from '@sigx/zero-kit';

/** Matrix placement and the artifact column 8 of this system's rows points at. */
export const matrix = {
    system: 'Ant Design',
    tier: 2,
    provenBy: 'skills/design-system/conformance/ant.ts',
} as const;

export const source = {
    url: 'https://ant.design/components/button',
    version: 'antd v5',
    verified: '2026-07-29',
} as const;

export const vocabulary = {
    variants: ['primary', 'dashed', 'link', 'text', 'default'],
    axes: { shape: ['default', 'circle', 'round'] },
    modifiers: ['danger', 'ghost', 'block'],
} as const;

export const api = defineApi(vocabulary, {
    components: { button: { variant: { as: 'type' } } },
    axes: { shape: {} },
    modifiers: { danger: {}, ghost: {}, block: {} },
});

// ── The executing half (issue #174): Button-only, wiring the declared
//    variant vocabulary, the `shape` custom axis and all three modifiers. ──

export const tokens = {
    roles: { primary: {} },
    variants: [...vocabulary.variants],
    axes: { shape: [...vocabulary.axes.shape] },
    modifiers: [...vocabulary.modifiers],
    defaultLight: 'light',
    themes: {
        light: {
            colorScheme: 'light',
            colors: {
                'base-100': 'oklch(100% 0 0)', 'base-200': 'oklch(96% 0 0)',
                'base-300': 'oklch(92% 0 0)', 'base-content': 'oklch(20% 0 0)',
                primary: 'oklch(58% 0.2 255)', 'primary-content': 'oklch(98% 0.01 255)',
            },
        },
    },
} as TokensInput;

export const button: RecipeInput = {
    component: 'button',
    parts: {
        root: {
            base: { border: '1px solid transparent', cursor: 'pointer' },
            states: { 'focus-visible': { outline: '2px solid var(--color-primary)', outlineOffset: '2px' } },
        },
    },
    variants: {
        variant: {
            primary: { root: { base: { background: 'var(--color-primary)', color: 'var(--color-primary-content)' } } },
            dashed: { root: { base: { background: 'transparent', borderStyle: 'dashed', borderColor: 'var(--color-base-300)' } } },
            link: { root: { base: { background: 'transparent', color: 'var(--color-primary)' } } },
            text: { root: { base: { background: 'transparent', color: 'var(--color-base-content)' } } },
            default: { root: { base: { background: 'var(--color-base-100)', borderColor: 'var(--color-base-300)' } } },
        },
        shape: {
            default: {},
            circle: { root: { base: { borderRadius: '50%', aspectRatio: '1' } } },
            round: { root: { base: { borderRadius: '9999px' } } },
        },
    },
    modifiers: {
        danger: { root: { base: { color: 'oklch(55% 0.2 25)' } } },
        ghost: { root: { base: { background: 'transparent' } } },
        block: { root: { base: { width: '100%' } } },
    },
};
