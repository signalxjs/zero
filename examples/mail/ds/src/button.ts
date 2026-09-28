// The worked Button recipe — copied from the "corporate" brief in @sigx/zero-kit/skills/design-system/briefs by @sigx/create-zero-ds@0.13.0.
// It is yours now: edit freely, nothing keeps it in sync with the source.

import type { RecipeInput } from '@sigx/zero-kit';
import { roles } from './tokens.js';
const ROLES = Object.keys(roles);

export const button: RecipeInput = {
    component: 'button',
    tokens: {
        '--btn-accent': 'var(--color-primary)',
        '--btn-on-accent': 'var(--color-primary-content)',
        '--btn-soft': 'var(--color-primary-soft)',
    },
    parts: {
        // The loading spinner zero renders while `loading` (#50): a ring in
        // `currentColor` with one open quadrant. Literal duration + explicit
        // reduced-motion `none` — a loop at ~0s strobes rather than stops.
        spinner: {
            base: {
                boxSizing: 'border-box',
                inlineSize: '1em',
                blockSize: '1em',
                flex: 'none',
                borderRadius: '9999px',
                border: 'calc(var(--border) * 2) solid currentColor',
                borderBlockStartColor: 'transparent',
                animation: 'mail-btn-spin 0.8s linear infinite',
            },
            at: { 'reduced-motion': { base: { animation: 'none' } } },
        },
        root: {
            base: {
                appearance: 'none',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-sm)',
                padding: 'var(--space-sm) var(--space-lg)',
                borderRadius: 'var(--radius-field)',
                border: 'var(--border) solid transparent',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-md)',
                fontWeight: 'var(--weight-medium)',
                lineHeight: 'var(--leading-none)',
                boxShadow: 'var(--shadow-xs)',
                cursor: 'pointer',
                transition: 'background var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard)',
            },
            states: {
                loading: { cursor: 'progress' },
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed', boxShadow: 'none' },
                hover: { boxShadow: 'var(--shadow-sm)' },
                // Two-tone ring: it stays visible on both a light card and a
                // coloured button, which one colour cannot do.
                'focus-visible': {
                    outline: '2px solid var(--btn-accent)',
                    outlineOffset: '2px',
                    boxShadow: '0 0 0 4px var(--color-base-100)',
                },
            },
            selectors: {
                '&:active:not([data-disabled])': { boxShadow: 'var(--shadow-xs)' },
                // An icon-only button (a toolbar's ActionButton, a discard ✕)
                // is a square hit area at every size, not a label's pill.
                '&:has(> [data-scope="mail-icon"]:only-child)': { padding: 'var(--space-sm)' },
            },
        },
    },
    variants: {
        color: Object.fromEntries(ROLES.map((role) => [
            role,
            {
                root: {
                    base: {
                        '--btn-accent': `var(--color-${role})`,
                        '--btn-on-accent': `var(--color-${role}-content)`,
                        '--btn-soft': `var(--color-${role}-soft)`,
                    },
                },
            },
        ])),
        variant: {
            solid: { root: { base: { background: 'var(--btn-accent)', color: 'var(--btn-on-accent)' } } },
            outline: {
                root: {
                    base: {
                        background: 'var(--color-base-100)',
                        borderColor: 'var(--color-base-300)',
                        color: 'var(--color-base-content)',
                    },
                },
            },
            soft: { root: { base: { background: 'var(--btn-soft)', color: 'var(--btn-accent)' } } },
            ghost: {
                root: {
                    base: { background: 'transparent', color: 'var(--btn-accent)', boxShadow: 'none' },
                    // No lift: a ghost is furniture until you reach for it,
                    // then a wash of its own ink (the toolbar's icon buttons).
                    states: {
                        hover: { background: 'color-mix(in oklch, var(--btn-accent) 8%, transparent)', boxShadow: 'none' },
                    },
                },
            },
        },
        // The whole recommended ramp, not a sm|md|lg excerpt: the scaffold lays
        // a baseline under this Button that paints xs and xl on every sibling,
        // and a step every sibling has that Button neither paints nor claims
        // is the ramp-with-a-hole the audit refuses (#422). `md` claims the
        // base with an empty entry — the un-attributed render IS that step.
        size: {
            xs: { root: { base: { padding: 'var(--space-2xs) var(--space-sm)', fontSize: 'var(--text-xs)' } } },
            sm: { root: { base: { padding: 'var(--space-xs) var(--space-md)', fontSize: 'var(--text-sm)' } } },
            md: { root: { base: {} } },
            lg: { root: { base: { padding: 'var(--space-md) var(--space-xl)', fontSize: 'var(--text-lg)' } } },
            xl: { root: { base: { padding: 'var(--space-lg) var(--space-2xl)', fontSize: 'var(--text-xl)' } } },
        },
    },
    defaultVariants: { color: 'primary', variant: 'solid', size: 'md' },
    keyframes: { 'mail-btn-spin': 'to { transform: rotate(360deg) }' },
};
