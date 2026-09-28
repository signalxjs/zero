/**
 * zero-material tokens — the Material 3 token set on the zero contract (#414).
 *
 * Not an approximation any more: every value here is M3's own.
 *
 * - **Colour** is generated, not picked. `scheme.generated.ts` runs M3's
 *   colour algorithm (HCT tonal palettes from seed #6750A4) through Google's
 *   `@material/material-color-utilities`, for light and dark at standard,
 *   medium and high contrast. `on-X` is zero's `X-content`, which needs no
 *   translation.
 * - **Roles** are M3's full set: the four key colours and their containers,
 *   the seven-step surface family, `surface-variant`, the inverse pair,
 *   `outline` / `outline-variant`, `scrim` and `shadow`. Fills and hairlines
 *   opt out of the `color` axis (`soft: false` / `content: false`).
 * - **Shape** is M3's corner scale, extra-small → extra-extra-large + full.
 * - **Type** is M3's fifteen type roles (display/headline/title/body/label ×
 *   large/medium/small), spread across four ramps with parallel keys — see
 *   the `type()` helper in `recipes.ts` for why (zero-kit has no composite
 *   type-role category; #423).
 * - **Motion** is M3's duration tokens (short1 … extra-long4), its easing set,
 *   and the M3 Expressive springs as `linear()` curves.
 * - **Elevation** is `level0`…`level5`; **state layers** are tokens rather
 *   than literals.
 *
 * Type-only import from the kit's Node-only barrel: this module ships in
 * the browser bundle. `/define` is the exception by contract — its module
 * graph is `node:`-free, which is what lets `layoutScopes` be a value
 * import here.
 */
import { layoutScopes } from '@sigx/zero-kit/define';
import type { RoleDecl, SystemTokens, ThemeInput, ThemeSystem, TokensInput } from '@sigx/zero-kit';
import { schemes, type SchemeName } from './scheme.generated.js';

/** A fill or hairline: a token recipes read, never a `color` axis value. */
const fill = { soft: false } as const;
const hairline = { content: false, soft: false } as const;

/**
 * Material's colour roles.
 *
 * The eight action roles (primary … warning) form the `color` axis. Their
 * `-soft` token — zero's tonal fill — is set explicitly to the role's M3
 * **container** in every theme rather than mixed, so a recipe written
 * against `--color-<role>-soft` paints M3's tonal colour. The containers are
 * also declared as roles of their own, with their `on-*-container` ink as
 * `-content`, and recipes paint the pair: zero's `-soft` has no ink of its
 * own, and the key colour on its container fails in M3's high-contrast
 * schemes, where the container goes dark (#421). They stay off the axis by
 * declaring `soft: false`, the only way to say "not an axis value" (#425).
 */
export const roles = {
    primary: { description: 'Primary key colour; `-soft` is primary-container' },
    secondary: { description: 'Secondary key colour; `-soft` is secondary-container' },
    tertiary: { description: 'Tertiary key colour; `-soft` is tertiary-container' },
    error: { description: 'Error; `-soft` is error-container' },
    neutral: { description: 'M3 has no neutral role — the inverse-surface pairing (a snackbar\'s colours)' },
    info: { description: 'Custom colour harmonised toward the seed' },
    success: { description: 'Custom colour harmonised toward the seed' },
    warning: { description: 'Custom colour harmonised toward the seed' },

    'primary-container': { ...fill, description: 'Tonal fill in the primary hue' },
    'secondary-container': { ...fill, description: 'Tonal fill in the secondary hue — selection indicators' },
    'tertiary-container': { ...fill, description: 'Tonal fill in the tertiary hue' },
    'error-container': { ...fill, description: 'Tonal fill for errors' },
    'info-container': { ...fill, description: 'Tonal fill for info' },
    'success-container': { ...fill, description: 'Tonal fill for success' },
    'warning-container': { ...fill, description: 'Tonal fill for warnings' },
    'neutral-container': { ...fill, description: 'Tonal fill for neutral: surface-variant' },

    surface: { ...fill, description: 'The page' },
    'surface-dim': { ...fill, description: 'The dimmest surface' },
    'surface-bright': { ...fill, description: 'The brightest surface' },
    'surface-container-lowest': { ...fill, description: 'Lowest-emphasis container' },
    'surface-container-low': { ...fill, description: 'Elevated cards, modal sheets' },
    'surface-container': { ...fill, description: 'Menus, navigation surfaces' },
    'surface-container-high': { ...fill, description: 'Dialogs, date pickers' },
    'surface-container-highest': { ...fill, description: 'Filled cards and text fields, switch tracks' },
    'surface-variant': { ...fill, description: 'Low-emphasis fill; its ink is on-surface-variant' },
    'inverse-surface': { ...fill, description: 'Snackbars, plain tooltips' },

    'inverse-primary': { ...hairline, description: 'Actions on an inverse surface' },
    outline: { ...hairline, description: 'Important boundaries — text-field outlines' },
    'outline-variant': { ...hairline, description: 'Decorative boundaries — dividers' },
    scrim: { ...hairline, description: 'Behind modal surfaces' },
    shadow: { ...hairline, description: 'Elevation shadow colour' },
} as const satisfies Record<string, RoleDecl>;

/** One px step of M3's layout grid, in rem (M3 measures in dp; 1dp = 1px here). */
const dp = (n: number): string => `${n / 16}rem`;

/**
 * An M3 line height as zero's unitless `leading`: the kit's leading category
 * is `<number>`-only, and M3 states line heights in dp, so each is divided by
 * its role's size — the same box, and it scales with the text (#423).
 */
const lh = (lineHeight: number, size: number): number => Math.round((lineHeight / size) * 1e5) / 1e5;

export const system = {
    /**
     * M3's corner-radius scale. `selector` / `field` / `box` are zero's
     * recommended names: kept as aliases because the anatomy's token hints,
     * `@sigx/zero`'s structural fallbacks and the kit's layout Box read them
     * by those names (#422). They point at M3's checkbox, text-field
     * and card corners.
     */
    radius: {
        none: '0',
        'extra-small': dp(4),
        small: dp(8),
        medium: dp(12),
        large: dp(16),
        'large-increased': dp(20),
        'extra-large': dp(28),
        'extra-large-increased': dp(32),
        'extra-extra-large': dp(48),
        full: '624.9375rem',
        selector: dp(2),
        field: dp(4),
        box: dp(12),
    },
    size: { selector: dp(4), field: dp(4) },
    border: '1px',
    /** M3's disabled content opacity. The container's is `--state-disabled-container`. */
    disabledOpacity: '0.38',

    // Page-scale widths a Container is bounded by: the window size classes'
    // lower bounds, which is where M3 lets margins take the rest.
    measure: {
        xs: '20rem',
        sm: '37.5rem',
        md: '52.5rem',
        lg: '75rem',
        xl: '100rem',
        prose: '70ch',
    },

    // M3's 4dp grid.
    spacing: {
        '2xs': dp(4),
        xs: dp(8),
        sm: dp(12),
        md: dp(16),
        lg: dp(24),
        xl: dp(32),
        '2xl': dp(48),
    },

    /** M3's elevation levels, as the key-plus-ambient shadow pair it draws. */
    shadow: {
        level0: 'none',
        level1: '0 1px 2px 0 oklch(0% 0 0 / 0.3), 0 1px 3px 1px oklch(0% 0 0 / 0.15)',
        level2: '0 1px 2px 0 oklch(0% 0 0 / 0.3), 0 2px 6px 2px oklch(0% 0 0 / 0.15)',
        level3: '0 4px 8px 3px oklch(0% 0 0 / 0.15), 0 1px 3px 0 oklch(0% 0 0 / 0.3)',
        level4: '0 6px 10px 4px oklch(0% 0 0 / 0.15), 0 2px 3px 0 oklch(0% 0 0 / 0.3)',
        level5: '0 8px 12px 6px oklch(0% 0 0 / 0.15), 0 4px 4px 0 oklch(0% 0 0 / 0.3)',
    },

    motion: {
        /** M3's duration tokens, plus the settle time of each Expressive spring. */
        durations: {
            short1: '50ms',
            short2: '100ms',
            short3: '150ms',
            short4: '200ms',
            medium1: '250ms',
            medium2: '300ms',
            medium3: '350ms',
            medium4: '400ms',
            long1: '450ms',
            long2: '500ms',
            long3: '550ms',
            long4: '600ms',
            'extra-long1': '700ms',
            'extra-long2': '800ms',
            'extra-long3': '900ms',
            'extra-long4': '1000ms',
            'spatial-fast': '260ms',
            'spatial-default': '350ms',
            'spatial-slow': '475ms',
            'effects-fast': '190ms',
            'effects-default': '270ms',
            'effects-slow': '370ms',
        },
        /**
         * M3's easing set. `emphasized` is a two-segment path no single
         * cubic-bezier draws, so it is sampled into `linear()`; the
         * `spatial-*` / `effects-*` curves are M3 Expressive's standard
         * motion-scheme springs (damping 0.9 / 1, stiffness 1400/700/300 and
         * 3800/1600/800), simulated and sampled the same way. Pair each spring
         * with its same-named duration.
         */
        easings: {
            linear: 'linear',
            standard: 'cubic-bezier(0.2, 0, 0, 1)',
            'standard-accelerate': 'cubic-bezier(0.3, 0, 1, 1)',
            'standard-decelerate': 'cubic-bezier(0, 0, 0, 1)',
            emphasized:
                'linear(0 0%, 0.003 2%, 0.013 4%, 0.03 6%, 0.056 8%, 0.093 10%, 0.146 12%, 0.222 14%, 0.341 16%, 0.52 18%, 0.636 20%, 0.706 22%, 0.754 24%, 0.818 28%, 0.86 32%, 0.902 38%, 0.938 46%, 0.965 56%, 0.987 70%, 0.997 85%, 1 100%)',
            'emphasized-decelerate': 'cubic-bezier(0.05, 0.7, 0.1, 1)',
            'emphasized-accelerate': 'cubic-bezier(0.3, 0, 0.8, 0.15)',
            legacy: 'cubic-bezier(0.4, 0, 0.2, 1)',
            'legacy-accelerate': 'cubic-bezier(0.4, 0, 1, 1)',
            'legacy-decelerate': 'cubic-bezier(0, 0, 0.2, 1)',
            'spatial-fast':
                'linear(0, 0.07, 0.206, 0.368, 0.519, 0.648, 0.746, 0.826, 0.884, 0.923, 0.952, 0.971, 0.983, 0.991, 0.996, 0.999, 1, 1.001, 1.001, 1.001, 1.001, 1.001, 1.001, 1, 1)',
            'spatial-default':
                'linear(0, 0.061, 0.191, 0.341, 0.485, 0.615, 0.719, 0.8, 0.861, 0.906, 0.939, 0.961, 0.977, 0.987, 0.993, 0.997, 0.999, 1.001, 1.001, 1.001, 1.001, 1.001, 1.001, 1.001, 1)',
            'spatial-slow':
                'linear(0, 0.05, 0.158, 0.292, 0.423, 0.546, 0.649, 0.737, 0.808, 0.861, 0.903, 0.933, 0.955, 0.971, 0.982, 0.99, 0.995, 0.998, 1, 1.001, 1.001, 1.001, 1.001, 1.001, 1)',
            'effects-fast':
                'linear(0, 0.095, 0.257, 0.434, 0.577, 0.697, 0.783, 0.85, 0.894, 0.928, 0.95, 0.967, 0.977, 0.985, 0.99, 0.993, 0.995, 0.997, 0.998, 0.999, 0.999, 0.999, 1, 1, 1)',
            'effects-default':
                'linear(0, 0.082, 0.234, 0.4, 0.542, 0.663, 0.757, 0.825, 0.876, 0.914, 0.939, 0.958, 0.971, 0.98, 0.986, 0.991, 0.994, 0.996, 0.997, 0.998, 0.999, 0.999, 0.999, 1, 1)',
            'effects-slow':
                'linear(0, 0.075, 0.218, 0.378, 0.523, 0.639, 0.735, 0.808, 0.861, 0.901, 0.93, 0.95, 0.965, 0.976, 0.983, 0.988, 0.992, 0.994, 0.996, 0.997, 0.998, 0.999, 0.999, 0.999, 1)',
        },
    },

    /**
     * M3's type scale. Each of the fifteen roles is a size, a line height and
     * a tracking under the same key (`--text-title-medium`,
     * `--leading-title-medium`, `--tracking-title-medium`); its weight is
     * regular (`normal`) or `medium`, recorded in `recipes.ts`'s `type()`.
     *
     * The recommended `xs`…`3xl` ramp is kept for the size axes the shared
     * recipes key on, each step on an M3 size — except `lg`, which has no M3
     * role at 18px and sits between body-large and title-large.
     */
    typography: {
        fonts: {
            sans: 'Roboto, system-ui, -apple-system, "Segoe UI", sans-serif',
            mono: '"Roboto Mono", ui-monospace, SFMono-Regular, monospace',
        },
        weights: { normal: 400, medium: 500, semibold: 500, bold: 700 },
        leading: {
            none: 1,
            tight: 1.25,
            normal: 1.5,
            relaxed: 1.6,
            'display-large': lh(64, 57),
            'display-medium': lh(52, 45),
            'display-small': lh(44, 36),
            'headline-large': lh(40, 32),
            'headline-medium': lh(36, 28),
            'headline-small': lh(32, 24),
            'title-large': lh(28, 22),
            'title-medium': lh(24, 16),
            'title-small': lh(20, 14),
            'body-large': lh(24, 16),
            'body-medium': lh(20, 14),
            'body-small': lh(16, 12),
            'label-large': lh(20, 14),
            'label-medium': lh(16, 12),
            'label-small': lh(16, 11),
        },
        tracking: {
            tight: '0em',
            normal: '0.00625em',
            wide: '0.03125em',
            'display-large': dp(-0.25),
            'display-medium': '0rem',
            'display-small': '0rem',
            'headline-large': '0rem',
            'headline-medium': '0rem',
            'headline-small': '0rem',
            'title-large': '0rem',
            'title-medium': dp(0.15),
            'title-small': dp(0.1),
            'body-large': dp(0.5),
            'body-medium': dp(0.25),
            'body-small': dp(0.4),
            'label-large': dp(0.1),
            'label-medium': dp(0.5),
            'label-small': dp(0.5),
        },
        sizes: {
            xs: dp(12),
            sm: dp(14),
            md: dp(16),
            lg: dp(18),
            xl: dp(22),
            '2xl': dp(24),
            '3xl': dp(36),
            'display-large': dp(57),
            'display-medium': dp(45),
            'display-small': dp(36),
            'headline-large': dp(32),
            'headline-medium': dp(28),
            'headline-small': dp(24),
            'title-large': dp(22),
            'title-medium': dp(16),
            'title-small': dp(14),
            'body-large': dp(16),
            'body-medium': dp(14),
            'body-small': dp(12),
            'label-large': dp(14),
            'label-medium': dp(12),
            'label-small': dp(11),
        },
    },
} as const satisfies SystemTokens;

/** Elevation reads differently on a dark surface — Material deepens it. */
export const systemDark = {
    shadow: {
        level1: '0 1px 2px 0 oklch(0% 0 0 / 0.6), 0 1px 3px 1px oklch(0% 0 0 / 0.45)',
        level2: '0 1px 2px 0 oklch(0% 0 0 / 0.6), 0 2px 6px 2px oklch(0% 0 0 / 0.45)',
        level3: '0 4px 8px 3px oklch(0% 0 0 / 0.45), 0 1px 3px 0 oklch(0% 0 0 / 0.6)',
        level4: '0 6px 10px 4px oklch(0% 0 0 / 0.45), 0 2px 3px 0 oklch(0% 0 0 / 0.6)',
        level5: '0 8px 12px 6px oklch(0% 0 0 / 0.45), 0 4px 4px 0 oklch(0% 0 0 / 0.6)',
    },
} as const satisfies ThemeSystem<typeof system>;

/**
 * M3's state-layer opacities. Theme-independent, but zero-kit's `custom`
 * tokens only take per-theme values, so every theme repeats them (#424).
 */
const stateLayers = {
    'state-hover': '0.08',
    'state-focus': '0.1',
    'state-pressed': '0.1',
    'state-dragged': '0.16',
    'state-disabled-container': '0.12',
} as const;

/** The action roles whose `-soft` token is their M3 container. */
const TONAL = ['primary', 'secondary', 'tertiary', 'error', 'neutral', 'info', 'success', 'warning'] as const;

function theme(
    name: SchemeName,
    colorScheme: 'light' | 'dark',
    pair: SchemeName,
): ThemeInput<typeof roles, typeof system> {
    const colors = schemes[name];
    const soft = Object.fromEntries(TONAL.map((r) => [`${r}-soft`, colors[`${r}-container`]]));
    return {
        colorScheme,
        pair,
        colors: { ...colors, ...soft },
        custom: { ...stateLayers },
    };
}

export const tokens: TokensInput<typeof roles, typeof system> = {
    roles,
    // The `variant` axis vocabulary — what button's variants.variant keys on.
    // Declared so a recipe typo is a build error, not a minted value.
    variants: ['solid', 'outline', 'soft', 'ghost'],
    /**
     * Table's zebra striping and hover-highlight (#340) and countdown's
     * inline treatment (#57) — presence-only, each narrowed to its scope.
     */
    modifiers: ['zebra', 'hover', 'inline'],
    /**
     * The avatar's shape (zero#129) — the first custom axis a shipped skin
     * declares, and the acceptance test for `tokens.axes`: an enumerated
     * choice with no named prop (`axes={{ shape: 'square' }}` →
     * `data-shape="square"`). Wired on avatar alone; its unset default is
     * this skin's own avatar radius.
     */
    axes: { shape: ['circle', 'square', 'rounded'] },
    scopes: {
        // The layout tier wires neither colour nor size — every one of its
        // scopes is geometry, and `data-color` on geometry would paint
        // nothing. Declared out of existence rather than left to the
        // axis-coverage audit to report.
        ...layoutScopes,
        table: { modifiers: ['zebra', 'hover'] },
        // A countdown set inside a sentence (#57).
        countdown: { modifiers: ['inline'] },
    },
    custom: {
        'state-hover': { description: 'M3 state layer: hover', syntax: '<number>' },
        'state-focus': { description: 'M3 state layer: focus', syntax: '<number>' },
        'state-pressed': { description: 'M3 state layer: pressed', syntax: '<number>' },
        'state-dragged': { description: 'M3 state layer: dragged', syntax: '<number>' },
        'state-disabled-container': { description: 'M3 disabled container opacity', syntax: '<number>' },
    },
    system,
    systemDark,
    /**
     * M3's window size classes by their lower bounds: medium (600), expanded
     * (840), large (1200), extra-large (1600). Named on zero's ramp so
     * responsive props written against the recommended breakpoints resolve.
     */
    breakpoints: { sm: '600px', md: '840px', lg: '1200px', xl: '1600px' },
    // The swatch picks the key colours and a container — what distinguishes
    // one M3 scheme from another.
    swatch: ['primary', 'secondary', 'tertiary', 'primary-container', 'base-100', 'base-content'],
    defaultLight: 'material',
    defaultDark: 'material-dark',
    themes: {
        material: theme('material', 'light', 'material-dark'),
        'material-dark': theme('material-dark', 'dark', 'material'),
        'material-medium-contrast': theme('material-medium-contrast', 'light', 'material-dark-medium-contrast'),
        'material-dark-medium-contrast': theme('material-dark-medium-contrast', 'dark', 'material-medium-contrast'),
        'material-high-contrast': theme('material-high-contrast', 'light', 'material-dark-high-contrast'),
        'material-dark-high-contrast': theme('material-dark-high-contrast', 'dark', 'material-high-contrast'),
    },
};
