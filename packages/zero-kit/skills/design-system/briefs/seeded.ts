/**
 * Brief: **seeded** — two hues, everything derived. An indigo primary with a
 * coral accent, soft-cornered, quiet shadows, a near-flat type ramp; the
 * calm product look you get when the brief is a single word and a colour.
 *
 * The mechanic this brief teaches: **the palette is derived, not authored.**
 * The other five briefs hand-write every `oklch()` in both schemes, and the
 * validator's contrast check is the only thing between a guess and a
 * shipped 2.8:1 label. This one names two hues and lets `deriveThemePair`
 * produce every token `requiredColorTokens(roles)` asks for — base surfaces,
 * eight roles, their `-content` pairs — for a light and a dark theme, with
 * every `<role>`/`<role>-content` pair at or above 4.5:1 and `base-100`
 * against `base-content` at or above 7:1 **by construction**. Nothing in
 * `themes` below is a colour literal, and the validator has nothing to say.
 *
 * It is also the worked example of the one runtime import a design system
 * may make from the kit: `@sigx/zero-kit/define` is a `node:`-free graph
 * (#318), so `tokens.ts` — which ships in the browser bundle — can call it.
 * Everything else in the kit stays `import type`.
 *
 * Where hand-tuning still belongs: a brand-locked value (the logo's exact
 * blue) goes in as a full `RoleSeed` — `primary: { hue, chroma, lightness }`
 * — and the solver still derives its `-content`; a value that must be
 * literal is written into the theme by hand, and the validator measures it.
 *
 * Copy this file to `src/tokens.ts` and the `button` export to
 * `src/recipes.ts`, then write the remaining recipes.
 */
import type { RecipeInput, RolesDecl, SystemTokens, TokensInput } from '@sigx/zero-kit';
import { deriveThemePair } from '@sigx/zero-kit/define';

export const brief = {
    id: 'seeded',
    summary: 'An indigo primary and a coral accent, derived: two hues, every theme colour solved for contrast.',
    teaches: 'deriving a whole palette from seed hues with the contrast guarantee, and where hand-tuning still belongs',
    signature: 'no colour literal anywhere in themes — deriveThemePair from two seed hues',
} as const;

export const roles = {
    primary: {}, secondary: {}, accent: {}, neutral: {},
    info: {}, success: {}, warning: {}, error: {},
} as const satisfies RolesDecl;

export const system = {
    // Softly rounded: the corner reads as friendly without becoming a pill.
    radius: { selector: '0.375rem', field: '0.5rem', box: '0.75rem' },
    size: { selector: '0.3rem', field: '0.3rem' },
    border: '1.5px',
    disabledOpacity: '0.5',

    spacing: {
        '2xs': '0.125rem', xs: '0.25rem', sm: '0.5rem', md: '0.75rem',
        lg: '1rem', xl: '1.5rem', '2xl': '2.5rem', '3xl': '4rem',
    },

    // Quiet: one blurred shadow per step, low alpha, no contact shadow. The
    // derived surfaces already separate through their tint.
    shadow: {
        xs: '0 1px 2px oklch(0% 0 0 / 0.04)',
        sm: '0 2px 6px oklch(0% 0 0 / 0.06)',
        md: '0 4px 12px oklch(0% 0 0 / 0.08)',
        lg: '0 8px 24px oklch(0% 0 0 / 0.1)',
        xl: '0 16px 40px oklch(0% 0 0 / 0.12)',
    },

    motion: {
        durations: { instant: '0ms', fast: '140ms', normal: '220ms', slow: '320ms' },
        easings: {
            linear: 'linear',
            standard: 'cubic-bezier(0.2, 0, 0, 1)',
            emphasized: 'cubic-bezier(0.3, 0, 0, 1.2)',
        },
    },

    typography: {
        fonts: {
            sans: 'Inter, "Segoe UI", system-ui, sans-serif',
            serif: '"Source Serif 4", Georgia, serif',
            mono: '"JetBrains Mono", ui-monospace, monospace',
        },
        weights: { normal: 400, medium: 500, semibold: 600, bold: 700 },
        leading: { none: 1, tight: 1.3, normal: 1.55, relaxed: 1.7 },
        tracking: { tight: '-0.015em', normal: '0em', wide: '0.03em' },
        // 1.15 — the flattest ramp in the pack. Hierarchy comes from weight
        // and colour, which a derived palette supplies for free.
        scale: { base: '1rem', ratio: 1.15 },
    },
} as const satisfies SystemTokens;

/** A dark page needs the shadow to carry more weight to read at all. */
export const systemDark = {
    shadow: {
        xs: '0 1px 2px oklch(0% 0 0 / 0.3)',
        sm: '0 2px 6px oklch(0% 0 0 / 0.35)',
        md: '0 4px 12px oklch(0% 0 0 / 0.4)',
        lg: '0 8px 24px oklch(0% 0 0 / 0.45)',
        xl: '0 16px 40px oklch(0% 0 0 / 0.5)',
    },
} as const satisfies TokensInput<typeof roles, typeof system>['systemDark'];

export const tokens: TokensInput<typeof roles, typeof system> = {
    roles,
    system,
    systemDark,
    swatch: ['primary', 'accent', 'base-100', 'base-content'],
    // Declared so recipes can write `at: { md: … }`; the baseline recipes use `sm`.
    breakpoints: { sm: '640px', md: '840px', lg: '1120px' },
    defaultLight: 'seeded',
    defaultDark: 'seeded-dark',
    themes: {
        // Two hues. `secondary` follows `primary` by the analogous rotation,
        // `neutral` is the primary hue desaturated, the semantic four take
        // the kit's fixed hues, and every `-content` is solved against its
        // role. Both schemes come out of the same seeds, already paired.
        ...deriveThemePair<typeof roles, typeof system>({
            roles,
            seeds: { primary: 260, accent: 30 },
            light: 'seeded',
            dark: 'seeded-dark',
        }),
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
                fontWeight: 'var(--weight-semibold)',
                lineHeight: 'var(--leading-none)',
                letterSpacing: 'var(--tracking-tight)',
                boxShadow: 'var(--shadow-xs)',
                cursor: 'pointer',
                transition: 'background var(--duration-fast) var(--ease-standard), '
                    + 'box-shadow var(--duration-fast) var(--ease-standard), '
                    + 'translate var(--duration-fast) var(--ease-standard)',
            },
            states: {
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed', boxShadow: 'none' },
                hover: { boxShadow: 'var(--shadow-sm)', translate: '0 -1px' },
                // The ring is the accent itself, offset so it reads on both
                // the page and a solid button of the same colour.
                'focus-visible': {
                    outline: '2px solid var(--btn-accent)',
                    outlineOffset: '2px',
                    boxShadow: '0 0 0 4px var(--color-base-100)',
                },
            },
            selectors: { '&:active:not([data-disabled])': { boxShadow: 'var(--shadow-xs)', translate: '0 0' } },
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
