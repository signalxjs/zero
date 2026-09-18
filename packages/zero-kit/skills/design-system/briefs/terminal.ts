/**
 * Brief: **terminal** — a phosphor console. Monospace everywhere, square
 * corners, one signal colour glowing on a near-black field.
 *
 * The mechanic this brief teaches: **how to say "no motion" without opting
 * out of `prefers-reduced-motion`.** The instinct is `transition: none` in
 * every recipe. Don't — declare the durations as `0ms` instead. Recipes go on
 * referencing `var(--duration-*)`, the interface is instant, and the reduced-
 * motion collapse the kit emits stays meaningful for anything you later
 * decide *should* move.
 *
 * Copy this file to `src/tokens.ts` and the `button` export to
 * `src/recipes.ts`, then write the remaining recipes.
 */
import type { RecipeInput, RolesDecl, SystemTokens, TokensInput } from '@sigx/zero-kit';

export const brief = {
    id: 'terminal',
    summary: 'A phosphor console: monospace everywhere, square, one glowing signal colour.',
    teaches: '0ms durations instead of transition:none, and a glow built from theme colours',
    signature: 'every duration is 0ms, and --shadow-* is a glow in var(--color-primary)',
} as const;

export const roles = {
    primary: {}, secondary: {}, accent: {}, neutral: {},
    info: {}, success: {}, warning: {}, error: {},
} as const satisfies RolesDecl;

export const system = {
    // A console has no curves.
    radius: { selector: '0', field: '0', box: '0' },
    size: { selector: '0.25rem', field: '0.25rem' },
    border: '1px',
    disabledOpacity: '0.35',

    // A character grid: the ramp steps in whole and half characters rather
    // than on a geometric curve.
    spacing: {
        '2xs': '0.125rem', xs: '0.25rem', sm: '0.5rem', md: '0.75rem',
        lg: '1rem', xl: '1.5rem', '2xl': '2rem',
    },

    /**
     * Not a shadow — a phosphor glow, so it has to be the theme's own colour.
     * Geometry is design-system-level and the colour reaches each theme
     * through `var()`: green on the console, amber on paper, stated once. The
     * compiler restates a colour-referencing token inside every theme block so
     * the reference resolves there rather than freezing at `:root`.
     */
    shadow: {
        xs: '0 0 2px 0 var(--color-primary)',
        sm: '0 0 4px 0 var(--color-primary)',
        md: '0 0 8px 0 var(--color-primary)',
        lg: '0 0 16px 0 var(--color-primary)',
        xl: '0 0 28px 0 var(--color-primary)',
    },

    /**
     * Nothing animates. Declaring `0ms` rather than writing `transition: none`
     * in recipes keeps every recipe honest: it still names
     * `var(--duration-fast)`, so the validator's literal-duration warning
     * still applies, and retuning the whole system is still a one-line edit.
     */
    motion: {
        durations: { instant: '0ms', fast: '0ms', normal: '0ms', slow: '0ms' },
        easings: { linear: 'linear', standard: 'linear', emphasized: 'linear' },
    },

    typography: {
        // One family. A terminal that mixes families isn't a terminal.
        fonts: {
            mono: 'ui-monospace, "SF Mono", "Cascadia Mono", "JetBrains Mono", Menlo, monospace',
            sans: 'ui-monospace, "SF Mono", "Cascadia Mono", "JetBrains Mono", Menlo, monospace',
        },
        weights: { normal: 400, medium: 500, semibold: 600, bold: 700 },
        // Tight and even — text sits on fixed rows.
        leading: { none: 1, tight: 1.2, normal: 1.4, relaxed: 1.6 },
        tracking: { tight: '0em', normal: '0.02em', wide: '0.14em' },
        // The most restrained ratio in the pack: a console barely varies size,
        // it varies colour.
        scale: { base: '0.9375rem', ratio: 1.125 },
    },
} as const satisfies SystemTokens;

export const tokens: TokensInput<typeof roles, typeof system> = {
    roles,
    system,
    swatch: ['primary', 'success', 'error', 'base-100'],
    breakpoints: { sm: '640px', md: '960px' },
    /**
     * Dark is the real design; the light theme is a paper terminal — amber on
     * cream, the way a printout looked. Both are declared, because `:root`
     * still has to answer for a system-light visitor.
     */
    defaultLight: 'paper',
    defaultDark: 'terminal',
    themes: {
        terminal: {
            colorScheme: 'dark',
            pair: 'paper',
            softMix: 0.18,
            colors: {
                'base-100': 'oklch(16% 0.01 150)',
                'base-200': 'oklch(20% 0.014 150)',
                'base-300': 'oklch(26% 0.018 150)',
                'base-content': 'oklch(88% 0.14 145)',

                // Phosphor green is the whole identity.
                primary: 'oklch(82% 0.19 145)',
                'primary-content': 'oklch(14% 0.03 145)',
                secondary: 'oklch(80% 0.15 195)',
                'secondary-content': 'oklch(14% 0.03 195)',
                accent: 'oklch(85% 0.16 90)',
                'accent-content': 'oklch(14% 0.03 90)',
                neutral: 'oklch(62% 0.02 150)',
                'neutral-content': 'oklch(12% 0.01 150)',

                info: 'oklch(80% 0.15 195)',
                'info-content': 'oklch(14% 0.03 195)',
                success: 'oklch(82% 0.19 145)',
                'success-content': 'oklch(14% 0.03 145)',
                warning: 'oklch(85% 0.16 90)',
                'warning-content': 'oklch(14% 0.03 90)',
                error: 'oklch(72% 0.2 27)',
                'error-content': 'oklch(14% 0.03 27)',
            },
        },
        paper: {
            colorScheme: 'light',
            pair: 'terminal',
            softMix: 0.12,
            colors: {
                'base-100': 'oklch(96% 0.02 85)',
                'base-200': 'oklch(92% 0.03 85)',
                'base-300': 'oklch(87% 0.04 85)',
                'base-content': 'oklch(30% 0.06 60)',

                primary: 'oklch(48% 0.13 60)',
                'primary-content': 'oklch(98% 0.01 85)',
                secondary: 'oklch(46% 0.1 200)',
                'secondary-content': 'oklch(98% 0.01 85)',
                accent: 'oklch(50% 0.14 40)',
                'accent-content': 'oklch(98% 0.01 85)',
                neutral: 'oklch(42% 0.03 60)',
                'neutral-content': 'oklch(98% 0.01 85)',

                info: 'oklch(46% 0.1 200)',
                'info-content': 'oklch(98% 0.01 85)',
                success: 'oklch(45% 0.12 145)',
                'success-content': 'oklch(98% 0.01 85)',
                warning: 'oklch(46% 0.14 75)',
                'warning-content': 'oklch(98% 0.01 85)',
                error: 'oklch(48% 0.18 27)',
                'error-content': 'oklch(98% 0.01 85)',
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
                padding: 'var(--space-xs) var(--space-md)',
                borderRadius: '0',
                border: 'var(--border) solid var(--btn-accent)',
                background: 'transparent',
                color: 'var(--btn-accent)',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-md)',
                fontWeight: 'var(--weight-normal)',
                lineHeight: 'var(--leading-none)',
                letterSpacing: 'var(--tracking-wide)',
                textTransform: 'uppercase',
                cursor: 'pointer',
                // Still token-driven, and still 0ms — see the note on `motion`.
                transition: 'background var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard)',
            },
            states: {
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed', boxShadow: 'none' },
                // Hovering lights the phosphor.
                hover: { background: 'var(--btn-soft)', boxShadow: 'var(--shadow-sm)' },
                'focus-visible': {
                    outline: 'var(--border) solid var(--btn-accent)',
                    outlineOffset: '2px',
                    boxShadow: 'var(--shadow-md)',
                },
            },
            selectors: { '&:active:not([data-disabled])': { background: 'var(--btn-accent)', color: 'var(--btn-on-accent)' } },
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
            // Inverted — a highlighted console row.
            solid: { root: { base: { background: 'var(--btn-accent)', color: 'var(--btn-on-accent)' } } },
            outline: { root: { base: {} } },
            soft: { root: { base: { background: 'var(--btn-soft)', color: 'var(--btn-accent)' } } },
            // A prompt rather than a button.
            ghost: { root: { base: { borderColor: 'transparent', boxShadow: 'none' } } },
        },
        // The whole recommended ramp on the character grid — the scaffold's
        // baseline paints xs and xl on every sibling, and a step Button neither
        // paints nor claims is the ramp-with-a-hole the audit refuses (#422).
        size: {
            xs: { root: { base: { padding: '0 var(--space-xs)', fontSize: 'var(--text-xs)' } } },
            sm: { root: { base: { padding: '0 var(--space-sm)', fontSize: 'var(--text-sm)' } } },
            md: { root: { base: {} } },
            lg: { root: { base: { padding: 'var(--space-sm) var(--space-lg)', fontSize: 'var(--text-lg)' } } },
            xl: { root: { base: { padding: 'var(--space-md) var(--space-xl)', fontSize: 'var(--text-xl)' } } },
        },
    },
    defaultVariants: { color: 'primary', variant: 'outline', size: 'md' },
};
