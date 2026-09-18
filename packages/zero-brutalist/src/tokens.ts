/**
 * zero-brutalist tokens — generated from the brief "brutalist" through the
 * `design-system` agent skill.
 *
 * The skill's cheat sheet gives the brief as: radius 0, 2–3px solid borders,
 * a high-contrast palette with few hues, hard offset shadows, uppercase
 * labels, and a mono or condensed stack with 800+ weights and wide tracking.
 * Everything below is that brief expressed as declarations — no component
 * code, and no escape hatches.
 */
import { layoutScopes } from '@sigx/zero-kit/define';
import type { RoleDecl, SystemTokens, ThemeSystem, TokensInput } from '@sigx/zero-kit';

/**
 * Few hues, as the brief asks. The recommended eight are kept so shared
 * recipes resolve, but the palette collapses them onto three signal colours
 * plus black — brutalism does not have a subtle secondary.
 */
export const roles = {
    primary: {}, secondary: {}, accent: {}, neutral: {},
    info: {}, success: {}, warning: {}, error: {},
} as const satisfies Record<string, RoleDecl>;

export const system = {
    // The brief's first instruction. Nothing is rounded.
    radius: { selector: '0', field: '0', box: '0' },
    size: { selector: '0.25rem', field: '0.25rem' },
    border: '3px',
    disabledOpacity: '0.45',

    // Page-scale widths a Container is bounded by. The density ramp cannot
    // reach these — it tops out at a rung you would not notice.
    // Brutalism fills the viewport: the ramp is wide, and `prose` is the
    // only rung that admits a reading measure at all.
    measure: {
        xs: '24rem',
        sm: '40rem',
        md: '60rem',
        lg: '80rem',
        xl: '100rem',
        prose: '80ch',
    },

    spacing: {
        '2xs': '0.125rem',
        xs: '0.25rem',
        sm: '0.5rem',
        md: '0.75rem',
        lg: '1rem',
        xl: '1.5rem',
        '2xl': '2.5rem',
    },

    /**
     * Hard offset shadows with no blur — the brutalist signature. They read as
     * a second, displaced copy of the element rather than as light, so they
     * are drawn in the foreground colour rather than in black.
     */
    shadow: {
        xs: '2px 2px 0 0 var(--color-base-content)',
        sm: '3px 3px 0 0 var(--color-base-content)',
        md: '5px 5px 0 0 var(--color-base-content)',
        lg: '8px 8px 0 0 var(--color-base-content)',
        xl: '12px 12px 0 0 var(--color-base-content)',
    },

    /**
     * Snappy and mechanical. `steps()` easings refuse to interpolate, which
     * is the point: brutalism doesn't ease.
     */
    motion: {
        durations: { instant: '0ms', fast: '80ms', normal: '120ms', slow: '200ms' },
        easings: {
            linear: 'linear',
            standard: 'steps(2, end)',
            emphasized: 'steps(3, end)',
        },
    },

    typography: {
        // Mono, as the brief asks — and the same stack for body text, which
        // is what makes a brutalist page read as one.
        fonts: {
            mono: 'ui-monospace, SFMono-Regular, "Cascadia Mono", Menlo, monospace',
            sans: 'ui-monospace, SFMono-Regular, "Cascadia Mono", Menlo, monospace',
        },
        // 800+, per the brief. `normal` is already heavier than most systems'
        // bold, so the whole ramp shifts up rather than adding a step.
        weights: { normal: 500, medium: 700, semibold: 800, bold: 900 },
        leading: { none: 1, tight: 1.1, normal: 1.35, relaxed: 1.5 },
        // Wide tracking on labels; tight on display, which is the other half
        // of the look.
        tracking: { tight: '-0.03em', normal: '0em', wide: '0.1em' },
        // A dramatic ratio — the skill notes 1.5+ is dramatic, and brutalism
        // wants the jump between body and display to be violent.
        scale: { base: '1rem', ratio: 1.414 },
        // …with the display step hand-tuned to be fluid, which a ratio can't
        // express.
        sizes: { '3xl': 'clamp(2.5rem, 1.5rem + 5vw, 4.5rem)' },
    },
} as const satisfies SystemTokens;

/**
 * On a dark page a black offset shadow is invisible, so the ramp is redrawn
 * in the foreground colour, which `--color-base-content` already is in every
 * theme — the compiler restates a colour-referencing token inside each theme
 * block, so one declaration covers them all. The shadows therefore need no
 * dark counterpart; what does change is the border weight, which reads
 * thinner against dark.
 */
export const systemDark = {
    border: '2px',
} as const satisfies ThemeSystem<typeof system>;

export const tokens: TokensInput<typeof roles, typeof system> = {
    roles,
    // The `variant` axis vocabulary — what button's variants.variant keys on.
    // Declared so a recipe typo is a build error, not a minted value.
    variants: ['solid', 'outline', 'soft', 'ghost'],
    /** Table's zebra striping and hover-highlight (#340) — presence-only, table-scoped. */
    modifiers: ['zebra', 'hover'],
    scopes: {
        // The layout tier wires neither colour nor size — every one of its
        // scopes is geometry, and `data-color` on geometry would paint
        // nothing. Declared out of existence rather than left to the
        // axis-coverage audit to report.
        ...layoutScopes,
        table: { modifiers: ['zebra', 'hover'] },
    },
    system,
    systemDark,
    breakpoints: { sm: '640px', md: '900px', lg: '1200px' },
    defaultLight: 'brutalist',
    defaultDark: 'brutalist-dark',
    themes: {
        brutalist: {
            colorScheme: 'light',
            pair: 'brutalist-dark',
            // A low mix: brutalist tints are barely there, or they'd soften
            // the flat fills.
            softMix: 0.1,
            colors: {
                // Paper and ink. No greys in the surfaces — the contrast IS
                // the design.
                'base-100': 'oklch(97% 0.02 95)',
                'base-200': 'oklch(93% 0.03 95)',
                'base-300': 'oklch(88% 0.04 95)',
                'base-content': 'oklch(0% 0 0)',

                primary: 'oklch(56% 0.24 28)',
                'primary-content': 'oklch(100% 0 0)',
                secondary: 'oklch(45% 0.2 265)',
                'secondary-content': 'oklch(100% 0 0)',
                accent: 'oklch(80% 0.18 92)',
                'accent-content': 'oklch(0% 0 0)',
                neutral: 'oklch(0% 0 0)',
                'neutral-content': 'oklch(100% 0 0)',

                info: 'oklch(45% 0.2 265)',
                'info-content': 'oklch(100% 0 0)',
                success: 'oklch(48% 0.17 150)',
                'success-content': 'oklch(100% 0 0)',
                warning: 'oklch(80% 0.18 92)',
                'warning-content': 'oklch(0% 0 0)',
                error: 'oklch(56% 0.24 28)',
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

                primary: 'oklch(72% 0.2 28)',
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
                error: 'oklch(72% 0.2 28)',
                'error-content': 'oklch(0% 0 0)',
            },
        },
    },
};
