/**
 * zero-heroui tokens — HeroUI v3's axis surface, expressed as declarations.
 *
 * This package exists to test one thing the other four design systems cannot:
 * an axis surface that is NOT orthogonal colour × treatment
 * (docs/architecture.md, "Thesis and shape").
 * HeroUI v3 removed the `color` prop entirely and fused colour into `variant`
 * — `primary`, `danger` and `danger-soft` are variants, not colours — and it
 * removed `radius` too. So this design system declares:
 *
 *   - **no roles at all.** `roles: {}` is legal and means what it says: there
 *     is no `color` axis, so every component types `color: never`. The palette
 *     lives in `custom` instead, because these are not role-axis members —
 *     nothing can pass them as `color`.
 *   - **seven fused variants**, emphatically not `solid | outline | soft |
 *     ghost`. That set is convention in the other four packages, not contract,
 *     and this is what proves it.
 *   - **a three-step size ramp.** No other design system declares `sizes` at
 *     all; they all take the recommended five.
 *   - **presence-only modifiers**, `isIconOnly` and `isPending` in HeroUI's
 *     own API.
 *
 * Values are approximated from public documentation. This package proves the
 * contract rather than shipping a licensed token set, which is why it is
 * private — the same framing `zero-material` carries.
 */
import { layoutScopes } from '@sigx/zero-kit/define';
import type { CustomTokenDecl, RoleDecl, SystemTokens, TokensInput } from '@sigx/zero-kit';

/**
 * Empty, deliberately — the whole point of this package.
 *
 * `resolveRoles({})` returns `{}` rather than defaulting to the recommended
 * eight, the required colour tokens collapse to the four base surfaces, and
 * the theme swatch degrades to the base pair. Every component's `color` axis
 * is then `never` under `@sigx/zero-heroui/register`, which is the honest type
 * for a design system whose components take no colour.
 */
export const roles = {} as const satisfies Record<string, RoleDecl>;

/**
 * The palette, as declared custom tokens rather than roles.
 *
 * The distinction is the point: a role is a member of the `color` axis, and
 * HeroUI v3 has no such axis. These are the fills its *variants* resolve to,
 * so they are design-system tokens like any other — validated, themed, and in
 * the manifest, but not passable as `color="…"`.
 */
export const custom = {
    'hero-primary': { description: 'The primary action fill.', syntax: '<color>' },
    'hero-primary-ink': { description: 'Ink on the primary fill.', syntax: '<color>' },
    'hero-secondary': { description: 'The secondary (outlined) accent.', syntax: '<color>' },
    'hero-danger': { description: 'The destructive fill.', syntax: '<color>' },
    'hero-danger-ink': { description: 'Ink on the destructive fill.', syntax: '<color>' },
    'hero-danger-soft': { description: 'The destructive tint behind danger-soft.', syntax: '<color>' },
    'hero-muted': { description: 'Secondary text and disabled ink.', syntax: '<color>' },
    'hero-line': { description: 'Hairlines and outlined borders.', syntax: '<color>' },
    'hero-focus': { description: 'The focus ring.', syntax: '<color>' },
    'hero-scrim': { description: 'The dialog backdrop scrim.', syntax: '<color>' },
} as const satisfies Record<string, CustomTokenDecl>;

export const system = {
    // v3 is softer than v2 — a generous, consistent corner on everything.
    radius: { selector: '0.5rem', field: '0.625rem', box: '0.875rem' },
    size: { selector: '0.25rem', field: '0.25rem' },
    border: '1px',
    disabledOpacity: '0.5',

    // Page-scale widths a Container is bounded by. The density ramp cannot
    // reach these — it tops out at a rung you would not notice.
    // HeroUI's app-shell widths — product chrome rather than prose.
    measure: {
        xs: '20rem',
        sm: '30rem',
        md: '48rem',
        lg: '64rem',
        xl: '80rem',
        prose: '65ch',
    },

    spacing: {
        '2xs': '0.125rem',
        xs: '0.25rem',
        sm: '0.5rem',
        md: '0.75rem',
        lg: '1rem',
        xl: '1.5rem',
        '2xl': '2rem',
    },

    /** Soft, low-contrast elevation — v3 leans on tint and hairlines, not depth. */
    shadow: {
        xs: '0 1px 2px 0 oklch(0% 0 0 / 0.05)',
        sm: '0 1px 3px 0 oklch(0% 0 0 / 0.08), 0 1px 2px -1px oklch(0% 0 0 / 0.08)',
        md: '0 4px 6px -1px oklch(0% 0 0 / 0.08), 0 2px 4px -2px oklch(0% 0 0 / 0.08)',
        lg: '0 10px 15px -3px oklch(0% 0 0 / 0.09), 0 4px 6px -4px oklch(0% 0 0 / 0.09)',
        xl: '0 20px 25px -5px oklch(0% 0 0 / 0.1), 0 8px 10px -6px oklch(0% 0 0 / 0.1)',
    },

    motion: {
        durations: { instant: '0ms', fast: '150ms', normal: '250ms', slow: '400ms' },
        easings: {
            linear: 'linear',
            standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
            accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
            decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
        },
    },

    typography: {
        fonts: {
            sans: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
            mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
        },
        sizes: {
            xs: '0.75rem',
            sm: '0.875rem',
            md: '1rem',
            lg: '1.125rem',
            xl: '1.25rem',
            '2xl': '1.5rem',
            '3xl': '1.875rem',
        },
        weights: { normal: '400', medium: '500', semibold: '600', bold: '700' },
        leading: { none: '1', tight: '1.25', normal: '1.5' },
        tracking: { tight: '-0.01em', normal: '0', wide: '0.02em' },
    },
} as const satisfies SystemTokens;

export const systemDark = {
    shadow: {
        xs: '0 1px 2px 0 oklch(0% 0 0 / 0.3)',
        sm: '0 1px 3px 0 oklch(0% 0 0 / 0.4), 0 1px 2px -1px oklch(0% 0 0 / 0.4)',
        md: '0 4px 6px -1px oklch(0% 0 0 / 0.45), 0 2px 4px -2px oklch(0% 0 0 / 0.45)',
        lg: '0 10px 15px -3px oklch(0% 0 0 / 0.5), 0 4px 6px -4px oklch(0% 0 0 / 0.5)',
        xl: '0 20px 25px -5px oklch(0% 0 0 / 0.55), 0 8px 10px -6px oklch(0% 0 0 / 0.55)',
    },
} as const satisfies Partial<SystemTokens>;

/**
 * The fused axis. `primary`/`secondary`/`tertiary` are a semantic
 * HIERARCHY, `danger`/`danger-soft` fold a colour and a treatment into one
 * member, and `outline`/`ghost` are the only two that would survive a
 * translation to the neutral vocabulary the other four packages share.
 *
 * Exported `as const` so the `api` declaration in `design-system.ts` narrows
 * against the literal members at the declaration, not just at build time.
 */
export const variants = ['primary', 'secondary', 'tertiary', 'outline', 'ghost', 'danger', 'danger-soft'] as const;

/** HeroUI's `isIconOnly` / `isPending`, plus table's `isStriped` (#340). */
export const modifiers = ['icon-only', 'pending', 'striped'] as const;

export const tokens: TokensInput<typeof roles, typeof system> = {
    roles,
    /**
     * Three steps, not the recommended five. HeroUI has `sm | md | lg`, and
     * declaring it closes the set — a recipe keying `size.xl` is an error
     * rather than a silently minted step.
     */
    sizes: ['sm', 'md', 'lg'],
    variants,
    modifiers,
    /**
     * Per-scope narrowing (#294): `isIconOnly`/`isPending` are BUTTON facts
     * and `isStriped` a TABLE fact — without this, every scope would type
     * all three (#340 review catch).
     */
    scopes: {
        // The layout tier wires neither colour nor size — every one of its
        // scopes is geometry, and `data-color` on geometry would paint
        // nothing. Declared out of existence rather than left to the
        // axis-coverage audit to report.
        ...layoutScopes,
        button: { modifiers: ['icon-only', 'pending'] },
        table: { modifiers: ['striped'] },
    },
    custom,
    system,
    systemDark,
    breakpoints: { sm: '640px', md: '768px', lg: '1024px' },
    defaultLight: 'hero-light',
    defaultDark: 'hero-dark',
    themes: {
        'hero-light': {
            colorScheme: 'light',
            pair: 'hero-dark',
            colors: {
                'base-100': 'oklch(100% 0 0)',
                'base-200': 'oklch(97.2% 0.002 286)',
                'base-300': 'oklch(92.8% 0.004 286)',
                'base-content': 'oklch(21% 0.006 286)',
            },
            custom: {
                'hero-primary': 'oklch(54.6% 0.192 259)',
                'hero-primary-ink': 'oklch(99% 0 0)',
                'hero-secondary': 'oklch(37% 0.008 286)',
                'hero-danger': 'oklch(54.5% 0.208 27)',
                'hero-danger-ink': 'oklch(99% 0 0)',
                'hero-danger-soft': 'oklch(95% 0.03 27)',
                'hero-muted': 'oklch(45% 0.008 286)',
                'hero-line': 'oklch(89% 0.005 286)',
                'hero-focus': 'oklch(54.6% 0.192 259)',
                'hero-scrim': 'oklch(0% 0 0 / 0.45)',
            },
        },
        'hero-dark': {
            colorScheme: 'dark',
            pair: 'hero-light',
            colors: {
                'base-100': 'oklch(17% 0.005 286)',
                'base-200': 'oklch(23% 0.006 286)',
                'base-300': 'oklch(31% 0.008 286)',
                'base-content': 'oklch(98% 0 0)',
            },
            custom: {
                'hero-primary': 'oklch(70.5% 0.155 259)',
                'hero-primary-ink': 'oklch(17% 0.005 286)',
                'hero-secondary': 'oklch(85% 0.005 286)',
                'hero-danger': 'oklch(70% 0.175 27)',
                'hero-danger-ink': 'oklch(17% 0.005 286)',
                'hero-danger-soft': 'oklch(30% 0.07 27)',
                'hero-muted': 'oklch(72% 0.008 286)',
                'hero-line': 'oklch(34% 0.008 286)',
                'hero-focus': 'oklch(70.5% 0.155 259)',
                // Deeper than light's — 45% black over a 17%-lightness page
                // would barely register, so the dark scrim doubles down.
                'hero-scrim': 'oklch(0% 0 0 / 0.65)',
            },
        },
    },
};
