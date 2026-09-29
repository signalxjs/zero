/**
 * Zero Mail's tokens. They started as the "corporate" brief
 * (@sigx/zero-kit/skills/design-system/briefs, via @sigx/create-zero-ds) and
 * follow the skill's dense / data-tool route: a 14px base, a 1.15 ratio, a
 * tight 4-point spacing ramp. On top of that go an indigo accent over cool,
 * barely-tinted neutrals, Inter, and soft two-part shadows. The target is a
 * modern mail client (quiet chrome, one accent, content first), in light and
 * dark.
 *
 * The vocabulary is where the app's typography lives. Zero has no text
 * primitive (signalxjs/zero#440), so the kit's `Text` / `Heading` / `Time`
 * take their look from axes declared here:
 * - `tone`: the ink.
 * - `weight`: emphasis.
 * - `truncate` / `clamp`: modifiers.
 */
import type { RolesDecl, SystemTokens, TokensInput } from '@sigx/zero-kit';
import { layoutScopes } from '@sigx/zero-kit/define';

export const roles = {
    primary: {}, secondary: {}, accent: {}, neutral: {},
    info: {}, success: {}, warning: {}, error: {},
} as const satisfies RolesDecl;

export const system = {
    radius: { selector: '0.375rem', field: '0.5rem', box: '0.75rem' },
    size: { selector: '0.25rem', field: '0.25rem' },
    border: '1px',
    disabledOpacity: '0.45',

    // A 4-point ramp: dense enough for a list of 400 messages, with room at
    // the top for the reading pane to breathe.
    spacing: {
        '2xs': '0.125rem', xs: '0.25rem', sm: '0.5rem', md: '0.75rem',
        lg: '1rem', xl: '1.5rem', '2xl': '2rem', '3xl': '3rem',
    },

    shadow: {
        xs: '0 1px 2px 0 oklch(20% 0.02 280 / 0.05)',
        sm: '0 1px 2px -1px oklch(20% 0.02 280 / 0.08), 0 1px 3px 0 oklch(20% 0.02 280 / 0.08)',
        md: '0 2px 4px -2px oklch(20% 0.02 280 / 0.08), 0 6px 12px -2px oklch(20% 0.02 280 / 0.1)',
        lg: '0 4px 8px -4px oklch(20% 0.02 280 / 0.1), 0 16px 32px -8px oklch(20% 0.02 280 / 0.16)',
        xl: '0 8px 16px -8px oklch(20% 0.02 280 / 0.14), 0 24px 48px -12px oklch(20% 0.02 280 / 0.24)',
    },

    motion: {
        durations: { instant: '0ms', fast: '110ms', normal: '170ms', slow: '260ms' },
        easings: {
            linear: 'linear',
            standard: 'cubic-bezier(0.2, 0, 0, 1)',
            emphasized: 'cubic-bezier(0.3, 0, 0, 1)',
        },
    },

    typography: {
        fonts: {
            sans: '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
            serif: 'Georgia, "Times New Roman", serif',
            mono: 'ui-monospace, SFMono-Regular, Consolas, monospace',
        },
        weights: { normal: 400, medium: 500, semibold: 600, bold: 700 },
        leading: { none: 1, tight: 1.25, normal: 1.5, relaxed: 1.65 },
        tracking: { tight: '-0.011em', normal: '0em', wide: '0.04em' },
        scale: { base: '0.875rem', ratio: 1.15 },
    },
} as const satisfies SystemTokens;

export const systemDark = {
    shadow: {
        xs: '0 1px 2px 0 oklch(0% 0 0 / 0.3)',
        sm: '0 1px 2px -1px oklch(0% 0 0 / 0.4), 0 1px 3px 0 oklch(0% 0 0 / 0.35)',
        md: '0 2px 4px -2px oklch(0% 0 0 / 0.45), 0 6px 12px -2px oklch(0% 0 0 / 0.4)',
        lg: '0 4px 8px -4px oklch(0% 0 0 / 0.5), 0 16px 32px -8px oklch(0% 0 0 / 0.5)',
        xl: '0 8px 16px -8px oklch(0% 0 0 / 0.55), 0 24px 48px -12px oklch(0% 0 0 / 0.6)',
    },
} as const satisfies TokensInput<typeof roles, typeof system>['systemDark'];

/** The ink steps a Text/Heading/Time/Icon may take; unset is the body ink. */
export const TONES = ['muted', 'subtle', 'primary', 'secondary', 'accent', 'info', 'success', 'warning', 'error'] as const;
export const WEIGHTS = ['normal', 'medium', 'semibold', 'bold'] as const;

export const tokens: TokensInput<typeof roles, typeof system> = {
    roles,
    variants: ['solid', 'outline', 'soft', 'ghost'],
    modifiers: ['truncate', 'clamp', 'compact', 'zebra', 'hover', 'inline'],
    axes: {
        tone: TONES,
        weight: WEIGHTS,
        shape: ['circle', 'square', 'rounded'],
    },
    scopes: {
        ...layoutScopes,
        badge: { variants: ['solid', 'soft', 'outline'] },
        select: { variants: ['outline', 'soft', 'ghost'] },
        button: { variants: ['solid', 'outline', 'soft', 'ghost'] },
        table: { modifiers: ['zebra', 'hover'] },
        countdown: { modifiers: ['inline'] },
        avatar: { axes: { shape: ['circle', 'square', 'rounded'] } },
        // The kit's scopes (examples/mail/kit). Typography carries size,
        // tone, weight and the two overflow modifiers; nothing else paints.
        'mail-text': { axes: { tone: TONES, weight: WEIGHTS }, modifiers: ['truncate', 'clamp'], colors: [], variants: [] },
        'mail-heading': { axes: { tone: TONES, weight: WEIGHTS }, modifiers: ['truncate'], colors: [], variants: [] },
        'mail-time': { axes: { tone: TONES, weight: WEIGHTS }, colors: [], variants: [] },
        'mail-icon': { axes: { tone: TONES }, colors: [], variants: [] },
        'mail-row': { colors: [], sizes: [], variants: [] },
        'mail-toolbar': { colors: [], sizes: [], variants: [] },
        'mail-list': { modifiers: ['compact'], colors: [], sizes: [], variants: [] },
        'mail-shell': { colors: [], sizes: [], variants: [] },
        'mail-split': { colors: [], sizes: [], variants: [] },
    },
    system,
    systemDark,
    swatch: ['primary', 'neutral', 'base-100', 'base-content'],
    breakpoints: { sm: '640px', md: '768px', lg: '1024px', xl: '1280px' },
    defaultLight: 'mail',
    defaultDark: 'mail-dark',
    themes: {
        mail: {
            colorScheme: 'light',
            pair: 'mail-dark',
            softMix: 0.1,
            colors: {
                'base-100': 'oklch(100% 0 0)',
                'base-200': 'oklch(97.6% 0.003 280)',
                'base-300': 'oklch(92.4% 0.006 280)',
                'base-content': 'oklch(17% 0.018 280)',

                primary: 'oklch(51% 0.21 277)',
                'primary-content': 'oklch(99% 0.005 277)',
                secondary: 'oklch(44% 0.03 280)',
                'secondary-content': 'oklch(99% 0 0)',
                accent: 'oklch(52% 0.19 340)',
                'accent-content': 'oklch(99% 0 0)',
                neutral: 'oklch(30% 0.016 280)',
                'neutral-content': 'oklch(98% 0.003 280)',

                info: 'oklch(49% 0.14 240)',
                'info-content': 'oklch(99% 0 0)',
                success: 'oklch(47% 0.12 155)',
                'success-content': 'oklch(99% 0 0)',
                warning: 'oklch(52% 0.13 65)',
                'warning-content': 'oklch(99% 0 0)',
                error: 'oklch(50% 0.19 25)',
                'error-content': 'oklch(99% 0 0)',
            },
        },
        'mail-dark': {
            colorScheme: 'dark',
            pair: 'mail',
            softMix: 0.18,
            colors: {
                'base-100': 'oklch(20.5% 0.009 280)',
                'base-200': 'oklch(17.5% 0.008 280)',
                'base-300': 'oklch(29% 0.012 280)',
                'base-content': 'oklch(93.5% 0.006 280)',

                primary: 'oklch(72% 0.14 277)',
                'primary-content': 'oklch(18% 0.04 277)',
                secondary: 'oklch(76% 0.03 280)',
                'secondary-content': 'oklch(18% 0.02 280)',
                accent: 'oklch(74% 0.14 340)',
                'accent-content': 'oklch(18% 0.04 340)',
                neutral: 'oklch(80% 0.01 280)',
                'neutral-content': 'oklch(18% 0.01 280)',

                info: 'oklch(74% 0.11 240)',
                'info-content': 'oklch(18% 0.03 240)',
                success: 'oklch(74% 0.13 155)',
                'success-content': 'oklch(18% 0.03 155)',
                warning: 'oklch(80% 0.13 75)',
                'warning-content': 'oklch(20% 0.03 75)',
                error: 'oklch(72% 0.16 25)',
                'error-content': 'oklch(18% 0.03 25)',
            },
        },
    },
};
