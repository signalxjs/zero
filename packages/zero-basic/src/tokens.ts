/**
 * zero-basic tokens — "Monograph": documentation-grade calm.
 *
 * Paper-tinted surfaces, hairline structure, printed-ink color, one petrol
 * blue-black protagonist at hue 205. Structure is drawn with 1px hairlines;
 * shadows exist only to separate transient layers from the page.
 *
 * Type-only import from the kit's Node-only barrel: this module is pure
 * data and ships in the runtime bundle (installThemes derives registry
 * metadata from it), so it must not pull that in at runtime. `/define` is
 * the exception by contract — its module graph is `node:`-free, which is
 * what lets `layoutScopes` be a value import here.
 */
import { layoutScopes } from '@sigx/zero-kit/define';
import type { RoleDecl, SystemTokens, ThemeSystem, TokensInput } from '@sigx/zero-kit';

/**
 * zero-basic's color vocabulary — exactly the recommended eight roles.
 * Declared explicitly (rather than relying on the kit default) so the DS
 * manifest documents the vocabulary and so this file shows the pattern a
 * DS with a different vocabulary follows.
 */
export const roles = {
    primary: {}, secondary: {}, accent: {}, neutral: {},
    info: {}, success: {}, warning: {}, error: {},
} as const satisfies Record<string, RoleDecl>;

/**
 * zero-basic's non-color token values — declared once for the design system
 * rather than restated per theme. Both themes share this structural feel;
 * a theme that wanted its own would override via its `system` block.
 */
export const system = {
    // Uniform and small — a technical drawing. Selectors and fields share one
    // radius; boxes get exactly 2x. Shape never signals hierarchy here.
    radius: { selector: '0.25rem', field: '0.25rem', box: '0.5rem' },
    size: { selector: '0.25rem', field: '0.25rem' },
    // Typography. `fonts` is FAMILIES; the `--text-*` ramp is generated from
    // the 1.2 modular scale (minor third, base 1rem) with the small end
    // hand-pinned to pixel-honest UI sizes and the top capped at 2rem —
    // documentation headlines inform, they don't shout.
    typography: {
        fonts: {
            sans: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
            mono: 'ui-monospace, "SF Mono", SFMono-Regular, "Cascadia Mono", Consolas, Menlo, monospace',
        },
        weights: { normal: 400, medium: 500, semibold: 600, bold: 700 },
        // Reading leading is the point: `normal` 1.55 is more generous than
        // every sibling. Controls use `none`/`tight`.
        leading: { none: 1, tight: 1.3, normal: 1.55 },
        // `tight` for headings >= xl; `wide` is reserved for the mono
        // meta-text (overlines, badges, kbd), never body.
        tracking: { tight: '-0.011em', normal: '0em', wide: '0.04em' },
        scale: { base: '1rem', ratio: 1.2 },
        sizes: { xs: '0.75rem', sm: '0.875rem', '3xl': '2rem' },
    },
    // Density ramp — compactness is on-identity for a reading tool.
    // Page-scale widths a Container is bounded by. The density ramp cannot
    // reach these — it tops out at a rung you would not notice.
    // Documentation-grade: a narrow reading column, because this skin's
    // whole posture is text you are meant to read rather than scan.
    measure: {
        xs: '20rem',
        sm: '30rem',
        md: '44rem',
        lg: '60rem',
        xl: '75rem',
        prose: '62ch',
    },

    spacing: {
        '2xs': '0.125rem',
        xs: '0.25rem',
        sm: '0.375rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.5rem',
    },
    // Elevation, light scheme — inked in slate 260, never pure black: paper
    // shading, not smoke. xs-md are contact whispers for the rare raised
    // control; `lg` is the one honest shadow, reserved for overlays.
    // `systemDark` below carries dark's own physics.
    shadow: {
        xs: '0 1px 2px oklch(25% 0.02 260 / 0.05)',
        sm: '0 1px 3px oklch(25% 0.02 260 / 0.07)',
        md: '0 2px 8px -2px oklch(25% 0.02 260 / 0.09)',
        lg: '0 16px 40px -12px oklch(25% 0.02 260 / 0.18)',
    },
    // Unhurried but decisive: color on interactive states at `fast`, overlay
    // entry at `normal`, toast slide at `slow`. `standard` is a firm
    // decelerate — things arrive and settle; `exit` accelerates — things
    // leave without ceremony. Recipes reference `var(--duration-*)` /
    // `var(--ease-*)` so reduced motion collapses them.
    motion: {
        durations: { fast: '120ms', normal: '180ms', slow: '280ms' },
        easings: {
            standard: 'cubic-bezier(0.25, 0, 0.15, 1)',
            exit: 'cubic-bezier(0.4, 0, 1, 1)',
        },
    },
    border: '1px',
    disabledOpacity: '0.45',
} as const satisfies SystemTokens;

/**
 * Dark-scheme overrides. Depth in dark shifts to surface steps + hairlines;
 * elevated overlays additionally catch light on their top edge via an inset
 * highlight, so dark floats read lit-from-above rather than merely outlined.
 */
export const systemDark = {
    shadow: {
        xs: '0 1px 2px oklch(0% 0 0 / 0.25)',
        sm: '0 1px 3px oklch(0% 0 0 / 0.30)',
        md: 'inset 0 1px 0 oklch(100% 0 0 / 0.06), 0 2px 8px -2px oklch(0% 0 0 / 0.35)',
        lg: 'inset 0 1px 0 oklch(100% 0 0 / 0.08), 0 16px 48px -12px oklch(0% 0 0 / 0.55)',
    },
} as const satisfies ThemeSystem<typeof system>;

export const tokens: TokensInput<typeof roles, typeof system> = {
    roles,
    // The `variant` axis vocabulary — what button's variants.variant keys on.
    // Declared so a recipe typo is a build error, not a minted value.
    variants: ['solid', 'outline', 'soft', 'ghost'],
    /**
     * Presence-only modifiers (#340): table's zebra striping and
     * hover-highlight — per-instance styling choices, so they are design-
     * system vocabulary rather than anatomy. `scopes.table` narrows them to
     * the one scope that styles them.
     */
    modifiers: ['zebra', 'hover'],
    /**
     * Per-scope narrowing (#294; docs/architecture.md, "Declared
     * vocabulary") — and this is the repo's
     * first use of it, so it is worth saying what it buys.
     *
     * `scopes` narrows and never widens: badge offers three of the four
     * values above, and `ghost` is the one it drops. A ghost BUTTON is
     * furniture that reveals itself on hover; a badge has no hover and
     * nothing to reveal, so a ghost badge is a word with no box — which is a
     * word. Radix Themes' Badge lands on the same three-plus-surface set with
     * no ghost, independently.
     *
     * The narrowing is enforced, not documentation: a badge recipe keying
     * `variants.variant.ghost` is a validation error, `register.d.ts` narrows
     * `variant` on `Badge` to the three, and the compiled manifest advertises
     * only those. Button keeps the full set.
     */
    scopes: {
        // The layout tier wires neither colour nor size — every one of its
        // scopes is geometry, and `data-color` on geometry would paint
        // nothing. Declared out of existence rather than left to the
        // axis-coverage audit to report.
        ...layoutScopes,
        badge: { variants: ['solid', 'soft', 'outline'] },
        table: { modifiers: ['zebra', 'hover'] },
        /**
         * A select is a FIELD, and a field filled with the role at full
         * strength stops reading as an input and starts reading as a button —
         * so `solid` is the value select drops. What is left is the three ways
         * a well can be drawn: `outline` is the hairline default, `soft` fills
         * it with the role's tint, `ghost` removes the border until you reach
         * for it.
         *
         * Radix Themes' Select reaches the same count by a different route
         * (`classic | surface | soft | ghost` on the Trigger); the spellings
         * are its own vocabulary, and zero's fidelity stance is that it
         * owes the visual states, not the prop names (docs/architecture.md,
         * "The components artifact — vendor-named apis").
         */
        select: { variants: ['outline', 'soft', 'ghost'] },
        // Restating the union is not redundancy — it is the explicit claim
        // "yes, button carries all four", which is the answer to the question
        // badge's narrowing raises. The validator asks it of every scope that
        // paints the axis, and button is the only other one that does (#175).
        button: { variants: ['solid', 'outline', 'soft', 'ghost'] },
    },
    system,
    systemDark,
    // Mobile-first min-widths. Declaration order is emission order, so these
    // must ascend — the validator enforces it.
    breakpoints: { sm: '640px', md: '768px', lg: '1024px' },
    defaultLight: 'basic',
    defaultDark: 'basic-dark',
    // A cool slate ground — hue 260 in every neutral and hairline — one
    // petrol blue-black ink protagonist (hue 205), a muted copper
    // counterpoint (hue 55), statuses desaturated to printed-ink density.
    // Chroma ceiling 0.14; no pure white and no pure black anywhere.
    themes: {
        basic: {
            colorScheme: 'light',
            pair: 'basic-dark',
            // Soft tints read like a printed 10% screen, not a highlight.
            softMix: 0.10,
            colors: {
                'base-100': 'oklch(98.6% 0.003 260)',
                'base-200': 'oklch(96% 0.005 260)',
                'base-300': 'oklch(91.5% 0.008 260)',
                'base-content': 'oklch(26% 0.015 260)',
                primary: 'oklch(45% 0.11 205)',
                'primary-content': 'oklch(98.5% 0.01 205)',
                secondary: 'oklch(40% 0.04 260)',
                'secondary-content': 'oklch(98.5% 0.004 260)',
                accent: 'oklch(48% 0.11 55)',
                'accent-content': 'oklch(98.5% 0.012 55)',
                neutral: 'oklch(30% 0.012 260)',
                'neutral-content': 'oklch(96% 0.004 260)',
                info: 'oklch(46% 0.10 245)',
                'info-content': 'oklch(98% 0.01 245)',
                success: 'oklch(44% 0.09 155)',
                'success-content': 'oklch(98% 0.01 155)',
                warning: 'oklch(65% 0.12 85)',
                'warning-content': 'oklch(18% 0.04 85)',
                error: 'oklch(47% 0.14 25)',
                'error-content': 'oklch(98% 0.01 25)',
            },
        },
        'basic-dark': {
            colorScheme: 'dark',
            pair: 'basic',
            softMix: 0.14,
            colors: {
                'base-100': 'oklch(19% 0.012 260)',
                'base-200': 'oklch(23% 0.014 260)',
                'base-300': 'oklch(28.5% 0.016 260)',
                'base-content': 'oklch(91% 0.006 260)',
                primary: 'oklch(74% 0.10 205)',
                'primary-content': 'oklch(20% 0.05 205)',
                secondary: 'oklch(74% 0.035 260)',
                'secondary-content': 'oklch(20% 0.02 260)',
                accent: 'oklch(75% 0.10 60)',
                'accent-content': 'oklch(21% 0.05 60)',
                neutral: 'oklch(33% 0.012 260)',
                'neutral-content': 'oklch(92% 0.005 260)',
                info: 'oklch(75% 0.09 245)',
                'info-content': 'oklch(20% 0.05 245)',
                success: 'oklch(74% 0.10 155)',
                'success-content': 'oklch(20% 0.05 155)',
                warning: 'oklch(80% 0.11 85)',
                'warning-content': 'oklch(20% 0.05 85)',
                error: 'oklch(72% 0.13 25)',
                'error-content': 'oklch(19% 0.06 25)',
            },
        },
    },
};
