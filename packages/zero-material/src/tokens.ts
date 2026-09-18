/**
 * zero-material tokens — a Material-flavoured vocabulary on the zero contract.
 *
 * This package exists to prove the contract holds for a design language it
 * was not designed around. Material differs from the recommended vocabulary in
 * four ways at once, and all four are expressed as data:
 *
 * 1. It has roles zero never heard of — `tertiary`, `outline`, and a tonal
 *    `surface` family.
 * 2. Its foreground colours are `on-primary`, `on-surface`… which is exactly
 *    the `-content` suffix convention, so they need no translation.
 * 3. Its surface containers are explicit tones, not tints derived from a
 *    base — hence `soft: false`, which suppresses the `color-mix()` the
 *    contract would otherwise derive.
 * 4. Its elevation is named `level1`…`level5`, not `sm`/`md`/`lg`.
 *
 * Type-only import from the kit's Node-only barrel: this module ships in
 * the browser bundle. `/define` is the exception by contract — its module
 * graph is `node:`-free, which is what lets `layoutScopes` be a value
 * import here.
 */
import { layoutScopes } from '@sigx/zero-kit/define';
import type { RoleDecl, SystemTokens, ThemeSystem, TokensInput } from '@sigx/zero-kit';

/**
 * Material's colour roles. Thirteen, where the recommended vocabulary has
 * eight — and `outline` carries no readable foreground of its own, so it
 * declares `content: false` rather than inventing an unused token.
 */
export const roles = {
    primary: { description: 'Primary key colour' },
    secondary: { description: 'Secondary key colour' },
    tertiary: { description: 'Tertiary key colour — Material has no `accent`' },
    error: { description: 'Error state' },
    // The tonal surface family. Explicit tones, not derived tints.
    surface: { soft: false, description: 'Base surface tone' },
    'surface-container': { soft: false, description: 'Cards, sheets, raised fills' },
    'surface-container-high': { soft: false, description: 'Menus, dialogs, the most raised fill' },
    // Not a fill: a hairline colour, so it has no foreground pairing.
    outline: { content: false, soft: false, description: 'Hairline borders and dividers' },
    // Kept from the recommended vocabulary so shared recipes still resolve.
    neutral: {},
    info: {},
    success: {},
    warning: {},
    accent: { description: 'Alias of tertiary, for recipes written against the recommended set' },
} as const satisfies Record<string, RoleDecl>;

export const system = {
    // Material's shape scale is generous and rounded.
    radius: { selector: '0.25rem', field: '0.75rem', box: '1.75rem' },
    size: { selector: '0.25rem', field: '0.25rem' },
    border: '1px',
    disabledOpacity: '0.38',

    // Page-scale widths a Container is bounded by. The density ramp cannot
    // reach these — it tops out at a rung you would not notice.
    // Material's breakpoint-derived content widths: the spec bounds a
    // page at its large-tablet width and lets margins take the rest.
    measure: {
        xs: '20rem',
        sm: '37.5rem',
        md: '52.5rem',
        lg: '60rem',
        xl: '75rem',
        prose: '70ch',
    },

    spacing: {
        '2xs': '0.25rem',
        xs: '0.5rem',
        sm: '0.75rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem',
        '2xl': '3rem',
    },

    /**
     * Elevation as Material names it. The recommended ramp is xs…xl; these
     * keys are the design system's own and flow into its manifest untouched —
     * the property the category model exists to provide.
     */
    shadow: {
        level1: '0 1px 2px 0 oklch(0% 0 0 / 0.3), 0 1px 3px 1px oklch(0% 0 0 / 0.15)',
        level2: '0 1px 2px 0 oklch(0% 0 0 / 0.3), 0 2px 6px 2px oklch(0% 0 0 / 0.15)',
        level3: '0 4px 8px 3px oklch(0% 0 0 / 0.15), 0 1px 3px 0 oklch(0% 0 0 / 0.3)',
        level4: '0 6px 10px 4px oklch(0% 0 0 / 0.15), 0 2px 3px 0 oklch(0% 0 0 / 0.3)',
        level5: '0 8px 12px 6px oklch(0% 0 0 / 0.15), 0 4px 4px 0 oklch(0% 0 0 / 0.3)',
    },

    /**
     * Material's easing set, which is where its motion personality lives.
     * `emphasized-decelerate` and `emphasized-accelerate` are its own names —
     * beyond the recommended `standard`/`emphasized`, and equally valid.
     */
    motion: {
        durations: {
            instant: '0ms',
            fast: '100ms',
            normal: '300ms',
            slow: '500ms',
            'extra-long': '700ms',
        },
        easings: {
            linear: 'linear',
            standard: 'cubic-bezier(0.2, 0, 0, 1)',
            emphasized: 'cubic-bezier(0.2, 0, 0, 1)',
            'emphasized-decelerate': 'cubic-bezier(0.05, 0.7, 0.1, 1)',
            'emphasized-accelerate': 'cubic-bezier(0.3, 0, 0.8, 0.15)',
        },
    },

    typography: {
        fonts: {
            sans: 'Roboto, system-ui, -apple-system, "Segoe UI", sans-serif',
            mono: '"Roboto Mono", ui-monospace, SFMono-Regular, monospace',
        },
        weights: { normal: 400, medium: 500, semibold: 500, bold: 700 },
        leading: { none: 1, tight: 1.25, normal: 1.5, relaxed: 1.6 },
        tracking: { tight: '0em', normal: '0.00625em', wide: '0.03125em' },
        // Material's type scale is closer to a 1.125 ratio than the default.
        scale: { base: '1rem', ratio: 1.125 },
        // …with the display end hand-tuned, as the real scale is.
        sizes: { '3xl': '2.25rem' },
    },
} as const satisfies SystemTokens;

/** Elevation reads differently on a dark surface — Material dims it. */
export const systemDark = {
    shadow: {
        level1: '0 1px 2px 0 oklch(0% 0 0 / 0.6), 0 1px 3px 1px oklch(0% 0 0 / 0.45)',
        level2: '0 1px 2px 0 oklch(0% 0 0 / 0.6), 0 2px 6px 2px oklch(0% 0 0 / 0.45)',
        level3: '0 4px 8px 3px oklch(0% 0 0 / 0.45), 0 1px 3px 0 oklch(0% 0 0 / 0.6)',
        level4: '0 6px 10px 4px oklch(0% 0 0 / 0.45), 0 2px 3px 0 oklch(0% 0 0 / 0.6)',
        level5: '0 8px 12px 6px oklch(0% 0 0 / 0.45), 0 4px 4px 0 oklch(0% 0 0 / 0.6)',
    },
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
    // Material's own window-size classes.
    breakpoints: { sm: '600px', md: '840px', lg: '1240px' },
    // The swatch picks the tonal surfaces, not the base ones — a theme picker
    // built from this shows what actually distinguishes a Material theme.
    swatch: ['primary', 'tertiary', 'surface-container', 'base-100', 'base-content'],
    defaultLight: 'material',
    defaultDark: 'material-dark',
    themes: {
        material: {
            colorScheme: 'light',
            pair: 'material-dark',
            softMix: 0.12,
            colors: {
                'base-100': 'oklch(99% 0.005 285)',
                'base-200': 'oklch(96% 0.008 285)',
                'base-300': 'oklch(92% 0.011 285)',
                'base-content': 'oklch(21% 0.014 285)',

                primary: 'oklch(48% 0.14 292)',
                'primary-content': 'oklch(100% 0 0)',
                secondary: 'oklch(48% 0.05 295)',
                'secondary-content': 'oklch(100% 0 0)',
                tertiary: 'oklch(49% 0.09 5)',
                'tertiary-content': 'oklch(100% 0 0)',
                error: 'oklch(45% 0.19 27)',
                'error-content': 'oklch(100% 0 0)',

                surface: 'oklch(99% 0.005 285)',
                'surface-content': 'oklch(21% 0.014 285)',
                'surface-container': 'oklch(95% 0.008 285)',
                'surface-container-content': 'oklch(21% 0.014 285)',
                'surface-container-high': 'oklch(92% 0.011 285)',
                'surface-container-high-content': 'oklch(21% 0.014 285)',
                outline: 'oklch(52% 0.014 285)',

                neutral: 'oklch(37% 0.012 285)',
                'neutral-content': 'oklch(100% 0 0)',
                info: 'oklch(48% 0.1 240)',
                'info-content': 'oklch(100% 0 0)',
                success: 'oklch(45% 0.11 150)',
                'success-content': 'oklch(100% 0 0)',
                warning: 'oklch(52% 0.12 75)',
                'warning-content': 'oklch(100% 0 0)',
                accent: 'oklch(49% 0.09 5)',
                'accent-content': 'oklch(100% 0 0)',
            },
        },
        'material-dark': {
            colorScheme: 'dark',
            pair: 'material',
            softMix: 0.18,
            colors: {
                'base-100': 'oklch(17% 0.012 285)',
                'base-200': 'oklch(21% 0.014 285)',
                'base-300': 'oklch(26% 0.015 285)',
                'base-content': 'oklch(91% 0.008 285)',

                primary: 'oklch(82% 0.09 292)',
                'primary-content': 'oklch(28% 0.11 292)',
                secondary: 'oklch(83% 0.04 295)',
                'secondary-content': 'oklch(30% 0.04 295)',
                tertiary: 'oklch(84% 0.06 5)',
                'tertiary-content': 'oklch(31% 0.08 5)',
                error: 'oklch(80% 0.11 27)',
                'error-content': 'oklch(29% 0.15 27)',

                surface: 'oklch(17% 0.012 285)',
                'surface-content': 'oklch(91% 0.008 285)',
                'surface-container': 'oklch(23% 0.014 285)',
                'surface-container-content': 'oklch(91% 0.008 285)',
                'surface-container-high': 'oklch(28% 0.015 285)',
                'surface-container-high-content': 'oklch(91% 0.008 285)',
                outline: 'oklch(70% 0.012 285)',

                neutral: 'oklch(80% 0.01 285)',
                'neutral-content': 'oklch(23% 0.012 285)',
                info: 'oklch(80% 0.08 240)',
                'info-content': 'oklch(25% 0.09 240)',
                success: 'oklch(80% 0.09 150)',
                'success-content': 'oklch(25% 0.09 150)',
                warning: 'oklch(85% 0.1 75)',
                'warning-content': 'oklch(28% 0.1 75)',
                accent: 'oklch(84% 0.06 5)',
                'accent-content': 'oklch(31% 0.08 5)',
            },
        },
    },
};
