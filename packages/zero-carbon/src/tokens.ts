/**
 * zero-carbon tokens — IBM Carbon's Button axis surface, expressed as
 * declarations (issue #183).
 *
 * This package exists to test one thing no other design system exercises at
 * runtime: **the api `values` remap**. Carbon spells two of its `kind`
 * members with a double hyphen (`danger--tertiary`, `danger--ghost`), which
 * the attribute grammar cannot hold — so the design system declares the
 * kebab spellings and the api declaration in `design-system.ts` is the only
 * place the vendor spelling lives. So it declares:
 *
 *   - **no roles at all.** Carbon Button has no colour prop; `kind` fuses
 *     colour and treatment (`danger` is a kind), the same non-orthogonal
 *     shape `zero-heroui` proved for `variant`. The palette lives in
 *     `custom`.
 *   - **the seven-member `kind` vocabulary**, kebab-spelled.
 *   - **Carbon's five-step size ramp** (`sm`–`2xl`, the 32–80 px heights).
 *   - **presence-only modifiers**, `hasIconOnly` and `isExpressive` in
 *     Carbon's own API.
 *
 * Values are approximated from public documentation. This package proves the
 * contract rather than shipping a licensed token set, which is why it is
 * private — the same framing `zero-material` and `zero-heroui` carry.
 */
import { layoutScopes } from '@sigx/zero-kit/define';
import type { CustomTokenDecl, RoleDecl, SystemTokens, TokensInput } from '@sigx/zero-kit';

/** Empty, deliberately — Carbon Button has no colour axis; `kind` is the axis. */
export const roles = {} as const satisfies Record<string, RoleDecl>;

/**
 * The palette, as declared custom tokens rather than roles — these are the
 * fills the *kinds* resolve to, not members of a colour axis.
 */
export const custom = {
    'carbon-interactive': { description: 'The primary action fill (blue 60).', syntax: '<color>' },
    'carbon-interactive-ink': { description: 'Ink on the primary fill.', syntax: '<color>' },
    'carbon-secondary': { description: 'The secondary fill (gray 80).', syntax: '<color>' },
    'carbon-secondary-ink': { description: 'Ink on the secondary fill.', syntax: '<color>' },
    'carbon-danger': { description: 'The destructive fill (red 60).', syntax: '<color>' },
    'carbon-danger-ink': { description: 'Ink on the destructive fill.', syntax: '<color>' },
    'carbon-focus': { description: 'The focus outline.', syntax: '<color>' },
    'carbon-line': { description: 'Hairlines and tertiary borders.', syntax: '<color>' },
    'carbon-border-strong': { description: 'The assertive stroke: the field-01 underline and the toggle-off track ($border-strong).', syntax: '<color>' },
    'carbon-field-hover': { description: 'The field-01 hover fill ($field-hover) — darker than the layer in white, lighter in g100.', syntax: '<color>' },
    'carbon-toggle-on': { description: 'The toggle ON fill (green 50 / green 40).', syntax: '<color>' },
} as const satisfies Record<string, CustomTokenDecl>;

/**
 * The fused axis, exported `as const` so the `api` declaration narrows
 * against the literal members. Note the kebab spellings of Carbon's
 * double-hyphen members — the vendor spelling lives only in the api.
 */
export const variants = [
    'primary',
    'secondary',
    'tertiary',
    'ghost',
    'danger',
    'danger-tertiary',
    'danger-ghost',
] as const;

/** Carbon's `hasIconOnly` / `isExpressive`, plus the data table's `useZebraStyles` (#340). */
export const modifiers = ['icon-only', 'expressive', 'zebra'] as const;

export const system = {
    // Carbon is square. Every corner, everywhere.
    radius: { selector: '0', field: '0', box: '0' },
    size: { selector: '0.25rem', field: '0.25rem' },
    border: '1px',
    disabledOpacity: '0.25',

    // The 8 px mini-unit grid.
    // Page-scale widths a Container is bounded by. The density ramp cannot
    // reach these — it tops out at a rung you would not notice.
    // Carbon's 2x grid: its wide breakpoints, in rem.
    measure: {
        xs: '20rem',
        sm: '42rem',
        md: '66rem',
        lg: '82rem',
        xl: '99rem',
        prose: '66ch',
    },

    spacing: {
        '2xs': '0.125rem',
        xs: '0.25rem',
        sm: '0.5rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem',
        '2xl': '2.5rem',
    },

    /** Carbon elevates with hairlines and layers, not depth — shadows stay faint. */
    shadow: {
        xs: '0 1px 2px 0 oklch(0% 0 0 / 0.1)',
        sm: '0 2px 6px 0 oklch(0% 0 0 / 0.2)',
        md: '0 2px 6px 0 oklch(0% 0 0 / 0.2)',
        lg: '0 4px 8px 0 oklch(0% 0 0 / 0.2)',
        xl: '0 12px 24px 0 oklch(0% 0 0 / 0.2)',
    },

    motion: {
        // Carbon's productive tokens: fast-01/fast-02/moderate-01.
        durations: { instant: '0ms', fast: '70ms', normal: '110ms', slow: '240ms' },
        easings: {
            linear: 'linear',
            standard: 'cubic-bezier(0.2, 0, 0.38, 0.9)',
            accelerate: 'cubic-bezier(0.2, 0, 1, 0.9)',
            decelerate: 'cubic-bezier(0, 0, 0.38, 0.9)',
        },
    },

    typography: {
        fonts: {
            sans: '"IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, sans-serif',
            mono: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
        },
        sizes: {
            xs: '0.75rem',
            sm: '0.875rem',
            md: '1rem',
            lg: '1.125rem',
            xl: '1.25rem',
            '2xl': '1.75rem',
            '3xl': '2rem',
        },
        weights: { normal: '400', medium: '500', semibold: '600', bold: '700' },
        leading: { none: '1', tight: '1.29', normal: '1.5' },
        tracking: { tight: '-0.01em', normal: '0', wide: '0.16px' },
    },
} as const satisfies SystemTokens;

export const systemDark = {
    shadow: {
        xs: '0 1px 2px 0 oklch(0% 0 0 / 0.4)',
        sm: '0 2px 6px 0 oklch(0% 0 0 / 0.5)',
        md: '0 2px 6px 0 oklch(0% 0 0 / 0.5)',
        lg: '0 4px 8px 0 oklch(0% 0 0 / 0.5)',
        xl: '0 12px 24px 0 oklch(0% 0 0 / 0.5)',
    },
} as const satisfies Partial<SystemTokens>;

export const tokens: TokensInput<typeof roles, typeof system> = {
    roles,
    /**
     * Carbon's five button heights (32/40/48/64/80 px) — a declared ramp two
     * steps past the recommended five's shape, closing the set.
     */
    sizes: ['sm', 'md', 'lg', 'xl', '2xl'],
    variants,
    modifiers,
    /**
     * Per-scope narrowing (#294): `hasIconOnly`/`isExpressive` are BUTTON
     * facts and `useZebraStyles` a DataTable fact — without this, every
     * scope would type all three (#340 review catch).
     */
    scopes: {
        // The layout tier wires neither colour nor size — every one of its
        // scopes is geometry, and `data-color` on geometry would paint
        // nothing. Declared out of existence rather than left to the
        // axis-coverage audit to report.
        ...layoutScopes,
        button: { modifiers: ['icon-only', 'expressive'] },
        table: { modifiers: ['zebra'] },
    },
    custom,
    system,
    systemDark,
    breakpoints: { sm: '672px', md: '1056px', lg: '1312px' },
    defaultLight: 'white',
    defaultDark: 'g100',
    themes: {
        // Carbon's own theme names.
        white: {
            colorScheme: 'light',
            pair: 'g100',
            colors: {
                'base-100': 'oklch(100% 0 0)',
                'base-200': 'oklch(96.7% 0 0)',
                'base-300': 'oklch(90.6% 0 0)',
                'base-content': 'oklch(20.5% 0 0)',
            },
            custom: {
                'carbon-interactive': 'oklch(53% 0.23 262)',
                'carbon-interactive-ink': 'oklch(100% 0 0)',
                'carbon-secondary': 'oklch(35.6% 0 0)',
                'carbon-secondary-ink': 'oklch(100% 0 0)',
                'carbon-danger': 'oklch(55.6% 0.213 27)',
                'carbon-danger-ink': 'oklch(100% 0 0)',
                'carbon-focus': 'oklch(53% 0.23 262)',
                'carbon-line': 'oklch(90.6% 0 0)',
                'carbon-border-strong': 'oklch(62% 0 0)',
                'carbon-field-hover': 'oklch(93.3% 0 0)',
                'carbon-toggle-on': 'oklch(62% 0.15 152)',
            },
        },
        g100: {
            colorScheme: 'dark',
            pair: 'white',
            colors: {
                'base-100': 'oklch(20.5% 0 0)',
                'base-200': 'oklch(26.5% 0 0)',
                'base-300': 'oklch(35.6% 0 0)',
                'base-content': 'oklch(96.7% 0 0)',
            },
            custom: {
                'carbon-interactive': 'oklch(62% 0.19 262)',
                'carbon-interactive-ink': 'oklch(100% 0 0)',
                'carbon-secondary': 'oklch(48.4% 0 0)',
                'carbon-secondary-ink': 'oklch(100% 0 0)',
                'carbon-danger': 'oklch(60% 0.19 25)',
                'carbon-danger-ink': 'oklch(100% 0 0)',
                'carbon-focus': 'oklch(100% 0 0)',
                'carbon-line': 'oklch(48.4% 0 0)',
                'carbon-border-strong': 'oklch(55% 0 0)',
                'carbon-field-hover': 'oklch(32% 0 0)',
                'carbon-toggle-on': 'oklch(71% 0.16 150)',
            },
        },
    },
};
