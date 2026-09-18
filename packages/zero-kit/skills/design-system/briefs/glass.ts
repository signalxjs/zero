/**
 * Brief: **glassmorphism** — frosted, translucent surfaces floating over a
 * soft, low-chroma field.
 *
 * The mechanic this brief teaches: **declared `custom` tokens**. A blur
 * radius and a translucent fill are not colours, radii or spacing — no
 * category owns them. Declaring them under `tokens.custom` gives them a
 * description, an `@property` registration and a slot in the design-system
 * manifest, which `extra` does not.
 *
 * Copy this file to `src/tokens.ts` and the `button` export to
 * `src/recipes.ts`, then write the remaining recipes.
 */
import type { RecipeInput, RolesDecl, SystemTokens, TokensInput } from '@sigx/zero-kit';

export const brief = {
    id: 'glass',
    summary: 'Frosted translucent surfaces floating over a soft, low-chroma field.',
    teaches: 'declared custom tokens, and translucency that survives both schemes',
    signature: 'backdrop-filter: blur(var(--glass-blur)) on every floating surface',
} as const;

export const roles = {
    primary: {}, secondary: {}, accent: {}, neutral: {},
    info: {}, success: {}, warning: {}, error: {},
} as const satisfies RolesDecl;

export const system = {
    // Glass is round. The blur reads as depth only when nothing is sharp.
    radius: { selector: '0.5rem', field: '0.75rem', box: '1.25rem' },
    size: { selector: '0.3rem', field: '0.3rem' },
    // Hairline, and it will be drawn translucent — the edge is a highlight,
    // not an outline.
    border: '1px',
    disabledOpacity: '0.4',

    spacing: {
        '2xs': '0.125rem', xs: '0.25rem', sm: '0.5rem', md: '0.875rem',
        lg: '1.25rem', xl: '1.75rem', '2xl': '2.75rem',
    },

    // Wide, soft and low-opacity: glass casts a diffuse shadow, never a
    // hard edge. Large negative spread keeps it under the element.
    shadow: {
        xs: '0 1px 2px -1px oklch(0% 0 0 / 0.08)',
        sm: '0 2px 8px -3px oklch(0% 0 0 / 0.12)',
        md: '0 8px 24px -8px oklch(0% 0 0 / 0.16)',
        lg: '0 16px 48px -16px oklch(0% 0 0 / 0.22)',
        xl: '0 28px 72px -24px oklch(0% 0 0 / 0.28)',
    },

    motion: {
        durations: { instant: '0ms', fast: '140ms', normal: '240ms', slow: '420ms' },
        easings: {
            linear: 'linear',
            // Glass drifts. Nothing snaps.
            standard: 'cubic-bezier(0.32, 0.72, 0, 1)',
            emphasized: 'cubic-bezier(0.2, 0.9, 0.1, 1)',
        },
    },

    typography: {
        fonts: {
            sans: '"Inter var", Inter, ui-sans-serif, system-ui, sans-serif',
            mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        },
        weights: { normal: 400, medium: 500, semibold: 600, bold: 700 },
        leading: { none: 1, tight: 1.25, normal: 1.55, relaxed: 1.7 },
        tracking: { tight: '-0.015em', normal: '0em', wide: '0.02em' },
        // Gentle: the depth does the talking, not the type.
        scale: { base: '1rem', ratio: 1.25 },
    },
} as const satisfies SystemTokens;

/**
 * On a dark page the same shadows vanish and the same tint reads as fog, so
 * both are restated for dark schemes. This is what `systemDark` is for —
 * `light-dark()` only accepts `<color>`, so it cannot carry a `box-shadow`.
 */
export const systemDark = {
    shadow: {
        xs: '0 1px 2px -1px oklch(0% 0 0 / 0.4)',
        sm: '0 2px 8px -3px oklch(0% 0 0 / 0.5)',
        md: '0 8px 24px -8px oklch(0% 0 0 / 0.6)',
        lg: '0 16px 48px -16px oklch(0% 0 0 / 0.7)',
        xl: '0 28px 72px -24px oklch(0% 0 0 / 0.8)',
    },
} as const satisfies TokensInput<typeof roles, typeof system>['systemDark'];

export const tokens: TokensInput<typeof roles, typeof system> = {
    roles,
    system,
    systemDark,
    /**
     * The three values that make this design system what it is, and that no
     * token category owns. Declared here they are typed, `@property`-
     * registered and listed in the manifest; put in `extra` they would be
     * none of those things.
     */
    custom: {
        'glass-blur': { description: 'Backdrop blur radius for frosted surfaces', syntax: '<length>' },
        'glass-tint': { description: 'Translucent fill layered over the blur', syntax: '<color>' },
        'glass-edge': { description: 'Translucent highlight along a frosted edge', syntax: '<color>' },
    },
    breakpoints: { sm: '640px', md: '900px', lg: '1200px' },
    defaultLight: 'glass',
    defaultDark: 'glass-dark',
    themes: {
        glass: {
            colorScheme: 'light',
            pair: 'glass-dark',
            softMix: 0.14,
            custom: {
                'glass-blur': '16px',
                'glass-tint': 'oklch(100% 0 0 / 0.55)',
                'glass-edge': 'oklch(100% 0 0 / 0.7)',
            },
            colors: {
                // A tinted field rather than white — the blur has to have
                // something to blur.
                'base-100': 'oklch(96% 0.015 255)',
                'base-200': 'oklch(93% 0.02 255)',
                'base-300': 'oklch(89% 0.025 255)',
                'base-content': 'oklch(24% 0.03 255)',

                primary: 'oklch(46% 0.2 265)',
                'primary-content': 'oklch(99% 0 0)',
                secondary: 'oklch(50% 0.16 320)',
                'secondary-content': 'oklch(99% 0 0)',
                accent: 'oklch(52% 0.14 200)',
                'accent-content': 'oklch(99% 0 0)',
                neutral: 'oklch(42% 0.02 255)',
                'neutral-content': 'oklch(99% 0 0)',

                info: 'oklch(50% 0.14 240)',
                'info-content': 'oklch(99% 0 0)',
                success: 'oklch(48% 0.13 150)',
                'success-content': 'oklch(99% 0 0)',
                warning: 'oklch(60% 0.15 75)',
                'warning-content': 'oklch(15% 0.03 75)',
                error: 'oklch(52% 0.2 25)',
                'error-content': 'oklch(99% 0 0)',
            },
        },
        'glass-dark': {
            colorScheme: 'dark',
            pair: 'glass',
            softMix: 0.2,
            custom: {
                // More blur and a darker tint: on a dark field the frost has
                // to be heavier to read as frost at all.
                'glass-blur': '22px',
                'glass-tint': 'oklch(32% 0.02 255 / 0.55)',
                'glass-edge': 'oklch(100% 0 0 / 0.14)',
            },
            colors: {
                'base-100': 'oklch(21% 0.025 265)',
                'base-200': 'oklch(26% 0.03 265)',
                'base-300': 'oklch(31% 0.035 265)',
                'base-content': 'oklch(95% 0.01 265)',

                primary: 'oklch(76% 0.15 265)',
                'primary-content': 'oklch(18% 0.04 265)',
                secondary: 'oklch(76% 0.12 320)',
                'secondary-content': 'oklch(18% 0.04 320)',
                accent: 'oklch(80% 0.11 200)',
                'accent-content': 'oklch(18% 0.04 200)',
                neutral: 'oklch(72% 0.02 265)',
                'neutral-content': 'oklch(18% 0.02 265)',

                info: 'oklch(76% 0.12 240)',
                'info-content': 'oklch(18% 0.04 240)',
                success: 'oklch(76% 0.13 150)',
                'success-content': 'oklch(18% 0.04 150)',
                warning: 'oklch(82% 0.14 75)',
                'warning-content': 'oklch(20% 0.04 75)',
                error: 'oklch(74% 0.16 25)',
                'error-content': 'oklch(18% 0.04 25)',
            },
        },
    },
};

const ROLES = Object.keys(roles);

/**
 * The signature move: every raised surface is `--glass-tint` over a
 * `backdrop-filter` blur, edged with a one-pixel highlight. Apply the same
 * three declarations to the dialog, popover, menu and tooltip popups and the
 * look is done.
 */
export const frosted = {
    background: 'var(--glass-tint)',
    backdropFilter: 'blur(var(--glass-blur)) saturate(1.6)',
    WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(1.6)',
    border: 'var(--border) solid var(--glass-edge)',
};

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
                border: 'var(--border) solid var(--glass-edge)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-md)',
                fontWeight: 'var(--weight-medium)',
                lineHeight: 'var(--leading-none)',
                letterSpacing: 'var(--tracking-normal)',
                boxShadow: 'var(--shadow-sm)',
                cursor: 'pointer',
                transition: 'background var(--duration-fast) var(--ease-standard), box-shadow var(--duration-normal) var(--ease-standard), transform var(--duration-fast) var(--ease-standard)',
            },
            states: {
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed', boxShadow: 'none' },
                hover: { boxShadow: 'var(--shadow-md)', transform: 'translateY(-1px)' },
                'focus-visible': {
                    outline: '2px solid var(--btn-accent)',
                    outlineOffset: '2px',
                },
            },
            selectors: { '&:active:not([data-disabled])': { transform: 'translateY(0)', boxShadow: 'var(--shadow-xs)' } },
        },
    },
    variants: {
        // One rule per role, not one per role × fill: the colour lands on a
        // component token and the fill rules read it.
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
            // The frosted fill — the signature move, on a control. It still
            // takes its text and edge from `--btn-accent`, because a fill that
            // ignores `data-color` makes the whole colour axis invisible.
            outline: {
                root: {
                    base: {
                        ...frosted,
                        color: 'var(--btn-accent)',
                        borderRadius: 'var(--radius-field)',
                    },
                },
            },
            soft: { root: { base: { background: 'var(--btn-soft)', color: 'var(--btn-accent)' } } },
            ghost: {
                root: {
                    base: {
                        background: 'transparent',
                        borderColor: 'transparent',
                        color: 'var(--btn-accent)',
                        boxShadow: 'none',
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
};
