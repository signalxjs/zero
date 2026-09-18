/**
 * Brief: **corporate** — the restrained default. A blue primary over a neutral
 * grey ramp, modest radii, subtle layered shadows, AA contrast everywhere.
 *
 * The mechanic this brief teaches: **restraint is a set of decisions, not an
 * absence of them.** Every value below was chosen to be unremarkable, and the
 * two things a corporate brief is actually judged on — contrast and
 * responsiveness — are declared explicitly: every role/`-content` pair clears
 * 4.5:1 in both schemes, and `breakpoints` are declared so recipes can use
 * `at` without inventing media queries.
 *
 * Copy this file to `src/tokens.ts` and the `button` export to
 * `src/recipes.ts`, then write the remaining recipes.
 */
import type { RecipeInput, RolesDecl, SystemTokens, TokensInput } from '@sigx/zero-kit';

export const brief = {
    id: 'corporate',
    summary: 'A blue primary over a neutral grey ramp: modest, layered, AA everywhere.',
    teaches: 'contrast discipline and declared breakpoints — the two things this brief is judged on',
    signature: 'a two-part shadow ramp (contact + ambient) and a 1.2 type ratio',
} as const;

export const roles = {
    primary: {}, secondary: {}, accent: {}, neutral: {},
    info: {}, success: {}, warning: {}, error: {},
} as const satisfies RolesDecl;

export const system = {
    // Softened, not round. The corner should be noticed only in its absence.
    radius: { selector: '0.25rem', field: '0.375rem', box: '0.5rem' },
    size: { selector: '0.28rem', field: '0.28rem' },
    border: '1px',
    disabledOpacity: '0.45',

    // An 8-point grid, which is what "looks professional" usually means.
    spacing: {
        '2xs': '0.125rem', xs: '0.25rem', sm: '0.5rem', md: '0.75rem',
        lg: '1rem', xl: '1.5rem', '2xl': '2rem', '3xl': '3rem',
    },

    /**
     * Two shadows per step: a tight contact shadow plus a wider ambient one.
     * A single blur reads as a sticker; the pair reads as a card sitting on a
     * surface. This is the entire difference between "has a shadow" and
     * "looks considered".
     */
    shadow: {
        xs: '0 1px 2px 0 oklch(0% 0 0 / 0.05)',
        sm: '0 1px 2px -1px oklch(0% 0 0 / 0.1), 0 1px 3px 0 oklch(0% 0 0 / 0.1)',
        md: '0 2px 4px -2px oklch(0% 0 0 / 0.1), 0 4px 6px -1px oklch(0% 0 0 / 0.1)',
        lg: '0 4px 6px -4px oklch(0% 0 0 / 0.1), 0 10px 15px -3px oklch(0% 0 0 / 0.1)',
        xl: '0 8px 10px -6px oklch(0% 0 0 / 0.1), 0 20px 25px -5px oklch(0% 0 0 / 0.1)',
    },

    motion: {
        // Quick enough to feel responsive, slow enough not to feel nervous.
        durations: { instant: '0ms', fast: '120ms', normal: '180ms', slow: '280ms' },
        easings: {
            linear: 'linear',
            standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
            emphasized: 'cubic-bezier(0.4, 0, 0.6, 1)',
        },
    },

    typography: {
        fonts: {
            sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            serif: 'Georgia, "Times New Roman", serif',
            mono: 'ui-monospace, SFMono-Regular, Consolas, monospace',
        },
        weights: { normal: 400, medium: 500, semibold: 600, bold: 700 },
        leading: { none: 1, tight: 1.25, normal: 1.5, relaxed: 1.65 },
        tracking: { tight: '-0.01em', normal: '0em', wide: '0.04em' },
        // 1.2 — enough hierarchy to scan, not enough to shout.
        scale: { base: '1rem', ratio: 1.2 },
    },
} as const satisfies SystemTokens;

/** A dark page needs the ambient half of each shadow to carry more weight. */
export const systemDark = {
    shadow: {
        xs: '0 1px 2px 0 oklch(0% 0 0 / 0.3)',
        sm: '0 1px 2px -1px oklch(0% 0 0 / 0.4), 0 1px 3px 0 oklch(0% 0 0 / 0.35)',
        md: '0 2px 4px -2px oklch(0% 0 0 / 0.45), 0 4px 6px -1px oklch(0% 0 0 / 0.4)',
        lg: '0 4px 6px -4px oklch(0% 0 0 / 0.5), 0 10px 15px -3px oklch(0% 0 0 / 0.45)',
        xl: '0 8px 10px -6px oklch(0% 0 0 / 0.55), 0 20px 25px -5px oklch(0% 0 0 / 0.5)',
    },
} as const satisfies TokensInput<typeof roles, typeof system>['systemDark'];

export const tokens: TokensInput<typeof roles, typeof system> = {
    roles,
    system,
    systemDark,
    swatch: ['primary', 'neutral', 'base-100', 'base-content'],
    // Declared here so recipes can write `at: { md: … }` instead of a literal
    // media query. Ascending order is enforced by the validator.
    breakpoints: { sm: '640px', md: '768px', lg: '1024px', xl: '1280px' },
    defaultLight: 'corporate',
    defaultDark: 'corporate-dark',
    themes: {
        corporate: {
            colorScheme: 'light',
            pair: 'corporate-dark',
            softMix: 0.1,
            colors: {
                'base-100': 'oklch(100% 0 0)',
                'base-200': 'oklch(97% 0.002 265)',
                'base-300': 'oklch(93% 0.004 265)',
                'base-content': 'oklch(25% 0.01 265)',

                primary: 'oklch(48% 0.16 255)',
                'primary-content': 'oklch(99% 0 0)',
                secondary: 'oklch(45% 0.06 265)',
                'secondary-content': 'oklch(99% 0 0)',
                accent: 'oklch(50% 0.12 195)',
                'accent-content': 'oklch(99% 0 0)',
                neutral: 'oklch(38% 0.01 265)',
                'neutral-content': 'oklch(99% 0 0)',

                info: 'oklch(48% 0.13 235)',
                'info-content': 'oklch(99% 0 0)',
                success: 'oklch(45% 0.13 150)',
                'success-content': 'oklch(99% 0 0)',
                warning: 'oklch(52% 0.14 75)',
                'warning-content': 'oklch(99% 0 0)',
                error: 'oklch(48% 0.19 27)',
                'error-content': 'oklch(99% 0 0)',
            },
        },
        'corporate-dark': {
            colorScheme: 'dark',
            pair: 'corporate',
            softMix: 0.18,
            colors: {
                'base-100': 'oklch(20% 0.008 265)',
                'base-200': 'oklch(24% 0.01 265)',
                'base-300': 'oklch(29% 0.012 265)',
                'base-content': 'oklch(94% 0.004 265)',

                primary: 'oklch(74% 0.13 255)',
                'primary-content': 'oklch(18% 0.03 255)',
                secondary: 'oklch(74% 0.05 265)',
                'secondary-content': 'oklch(18% 0.02 265)',
                accent: 'oklch(78% 0.1 195)',
                'accent-content': 'oklch(18% 0.03 195)',
                neutral: 'oklch(72% 0.01 265)',
                'neutral-content': 'oklch(18% 0.01 265)',

                info: 'oklch(74% 0.11 235)',
                'info-content': 'oklch(18% 0.03 235)',
                success: 'oklch(74% 0.13 150)',
                'success-content': 'oklch(18% 0.03 150)',
                warning: 'oklch(80% 0.13 75)',
                'warning-content': 'oklch(20% 0.03 75)',
                error: 'oklch(72% 0.16 27)',
                'error-content': 'oklch(18% 0.03 27)',
            },
        },
    },
};

const ROLES = Object.keys(roles);

export const button: RecipeInput = {
    component: 'button',
    tokens: {
        '--btn-accent': 'var(--color-primary)',
        '--btn-on-accent': 'var(--color-primary-content)',
        '--btn-soft': 'var(--color-primary-soft)',
    },
    parts: {
        root: {
            base: {
                appearance: 'none',
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
            selectors: { '&:active:not([data-disabled])': { boxShadow: 'var(--shadow-xs)' } },
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
};
