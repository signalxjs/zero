/**
 * Brief: **brutalist** — raw structure, no softening. Square corners, thick
 * ink-black rules, shadows that are a displaced copy rather than light.
 *
 * The mechanic this brief teaches: **the standard axes taken to their limit.**
 * Nothing here is a custom token or an escape hatch — a radius of `0`, a
 * `3px` border, a 1.414 type ratio and a `steps()` easing are all ordinary
 * declarations. If a brief can be reached by pushing the declared categories
 * far enough, push them; reach for `custom` only when no category owns the
 * value (see `glass.ts`).
 *
 * This one ships in full as `@sigx/zero-brutalist` — recipes for every
 * component the manifest declares. Read that package when you want the
 * complete worked example; the `system` block below is the same one it
 * declares.
 */
import type { RecipeInput, RolesDecl, SystemTokens, TokensInput } from '@sigx/zero-kit';

export const brief = {
    id: 'brutalist',
    summary: 'Raw structure: square, thick-ruled, hard-shadowed, shouted in mono.',
    teaches: 'how far the standard categories stretch before you need a custom token',
    signature: 'shadows drawn in var(--color-base-content) with zero blur, and steps() easings',
} as const;

export const roles = {
    primary: {}, secondary: {}, accent: {}, neutral: {},
    info: {}, success: {}, warning: {}, error: {},
} as const satisfies RolesDecl;

export const system = {
    // The brief's first instruction. Nothing is rounded.
    radius: { selector: '0', field: '0', box: '0' },
    size: { selector: '0.25rem', field: '0.25rem' },
    border: '3px',
    disabledOpacity: '0.45',

    spacing: {
        '2xs': '0.125rem', xs: '0.25rem', sm: '0.5rem', md: '0.75rem',
        lg: '1rem', xl: '1.5rem', '2xl': '2.5rem',
    },

    /**
     * Page-scale widths a Container is bounded by — a category of its own
     * because the density ramp cannot reach them. Brutalism fills the
     * viewport, so this ramp is wide and `prose` is the only rung that
     * admits a reading measure at all.
     */
    measure: {
        xs: '24rem', sm: '40rem', md: '60rem', lg: '80rem',
        xl: '100rem', prose: '80ch',
    },

    /**
     * Hard offset shadows with no blur. They read as a second, displaced copy
     * of the element rather than as light, so they are drawn in the
     * foreground colour. The compiler restates a colour-referencing token
     * inside every theme block, so this one value is right in every theme.
     */
    shadow: {
        xs: '2px 2px 0 0 var(--color-base-content)',
        sm: '3px 3px 0 0 var(--color-base-content)',
        md: '5px 5px 0 0 var(--color-base-content)',
        lg: '8px 8px 0 0 var(--color-base-content)',
        xl: '12px 12px 0 0 var(--color-base-content)',
    },

    /** `steps()` refuses to interpolate, which is the point: brutalism doesn't ease. */
    motion: {
        durations: { instant: '0ms', fast: '80ms', normal: '120ms', slow: '200ms' },
        easings: { linear: 'linear', standard: 'steps(2, end)', emphasized: 'steps(3, end)' },
    },

    typography: {
        // Mono for body text too — that is what makes a page read as one.
        fonts: {
            mono: 'ui-monospace, SFMono-Regular, "Cascadia Mono", Menlo, monospace',
            sans: 'ui-monospace, SFMono-Regular, "Cascadia Mono", Menlo, monospace',
        },
        // The whole ramp shifts up rather than adding a step.
        weights: { normal: 500, medium: 700, semibold: 800, bold: 900 },
        leading: { none: 1, tight: 1.1, normal: 1.35, relaxed: 1.5 },
        tracking: { tight: '-0.03em', normal: '0em', wide: '0.1em' },
        // The most violent ratio in the pack — the jump from body to display
        // is the design.
        scale: { base: '1rem', ratio: 1.414 },
        // …with the display step hand-tuned fluid, which a ratio can't express.
        sizes: { '3xl': 'clamp(2.5rem, 1.5rem + 5vw, 4.5rem)' },
    },
} as const satisfies SystemTokens;

/** A 3px rule reads heavier against dark, so it comes down one pixel. */
export const systemDark = {
    border: '2px',
} as const satisfies TokensInput<typeof roles, typeof system>['systemDark'];

export const tokens: TokensInput<typeof roles, typeof system> = {
    roles,
    system,
    systemDark,
    breakpoints: { sm: '640px', md: '900px', lg: '1200px' },
    defaultLight: 'brutalist',
    defaultDark: 'brutalist-dark',
    themes: {
        brutalist: {
            colorScheme: 'light',
            pair: 'brutalist-dark',
            // Low: brutalist tints are barely there, or they soften the flat fills.
            softMix: 0.1,
            colors: {
                // Paper and ink. The contrast IS the design.
                'base-100': 'oklch(97% 0.02 95)',
                'base-200': 'oklch(93% 0.03 95)',
                'base-300': 'oklch(88% 0.04 95)',
                'base-content': 'oklch(0% 0 0)',

                primary: 'oklch(50% 0.22 28)',
                'primary-content': 'oklch(100% 0 0)',
                secondary: 'oklch(45% 0.2 265)',
                'secondary-content': 'oklch(100% 0 0)',
                accent: 'oklch(58% 0.16 92)',
                'accent-content': 'oklch(0% 0 0)',
                neutral: 'oklch(0% 0 0)',
                'neutral-content': 'oklch(100% 0 0)',

                info: 'oklch(45% 0.2 265)',
                'info-content': 'oklch(100% 0 0)',
                success: 'oklch(48% 0.17 150)',
                'success-content': 'oklch(100% 0 0)',
                warning: 'oklch(58% 0.16 92)',
                'warning-content': 'oklch(0% 0 0)',
                error: 'oklch(50% 0.22 28)',
                'error-content': 'oklch(100% 0 0)',
            },
        },
        'brutalist-dark': {
            colorScheme: 'dark',
            pair: 'brutalist',
            softMix: 0.16,
            colors: {
                'base-100': 'oklch(14% 0.01 95)',
                'base-200': 'oklch(19% 0.012 95)',
                'base-300': 'oklch(25% 0.014 95)',
                'base-content': 'oklch(100% 0 0)',

                primary: 'oklch(78% 0.19 28)',
                'primary-content': 'oklch(0% 0 0)',
                secondary: 'oklch(72% 0.16 265)',
                'secondary-content': 'oklch(0% 0 0)',
                accent: 'oklch(87% 0.17 92)',
                'accent-content': 'oklch(0% 0 0)',
                neutral: 'oklch(100% 0 0)',
                'neutral-content': 'oklch(0% 0 0)',

                info: 'oklch(72% 0.16 265)',
                'info-content': 'oklch(0% 0 0)',
                success: 'oklch(76% 0.16 150)',
                'success-content': 'oklch(0% 0 0)',
                warning: 'oklch(87% 0.17 92)',
                'warning-content': 'oklch(0% 0 0)',
                error: 'oklch(78% 0.19 28)',
                'error-content': 'oklch(0% 0 0)',
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
                border: 'var(--border) solid var(--color-base-content)',
                borderRadius: '0',
                background: 'var(--color-base-100)',
                color: 'var(--color-base-content)',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-md)',
                fontWeight: 'var(--weight-bold)',
                lineHeight: 'var(--leading-none)',
                letterSpacing: 'var(--tracking-wide)',
                textTransform: 'uppercase',
                boxShadow: 'var(--shadow-sm)',
                cursor: 'pointer',
                transition: 'box-shadow var(--duration-fast) var(--ease-standard), transform var(--duration-fast) var(--ease-standard), background var(--duration-fast) var(--ease-standard)',
            },
            states: {
                disabled: {
                    opacity: 'var(--disabled-opacity)',
                    cursor: 'not-allowed',
                    boxShadow: 'none',
                    transform: 'none',
                },
                // The shadow shortens as the element moves into it.
                hover: { boxShadow: 'var(--shadow-xs)', transform: 'translate(1px, 1px)' },
                'focus-visible': { outline: 'var(--border) solid var(--color-primary)', outlineOffset: '3px' },
            },
            selectors: {
                '&:active:not([data-disabled])': { boxShadow: 'none', transform: 'translate(3px, 3px)' },
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
            outline: { root: { base: { background: 'var(--color-base-100)', color: 'var(--color-base-content)' } } },
            soft: { root: { base: { background: 'var(--btn-soft)', color: 'var(--color-base-content)' } } },
            // Even "ghost" keeps the rule. Brutalism has no invisible states.
            ghost: { root: { base: { background: 'transparent', boxShadow: 'none' } } },
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
