/**
 * Brief: **riso** — a duotone risograph print. Two spot inks on warm paper,
 * halftone tints, and the off-register drift of a machine that prints one
 * colour at a time.
 *
 * The mechanic this brief teaches: **a design system whose axis surface is not
 * the default one.** The other four briefs all take the recommended eight
 * roles, the recommended size ramp and the `solid | outline | soft | ghost`
 * variant set — which reads as though those were the contract. They are not.
 * This brief declares three axes *out of the shape* the others assume:
 *
 * - **`roles: {}`** — no `color` axis at all. A duotone press has two inks, not
 *   eight semantic roles, so `color="success"` would be a promise the medium
 *   cannot keep. The palette lives in `custom` declarations instead: still
 *   themed, still validated, still in the manifest — just not passable as a
 *   prop. `@sigx/zero-heroui` declares this shape.
 * - **`sizes: []`** — no `size` axis either. Empty is a *statement*
 *   ("there isn't one"), where omitting the key means "I didn't say" and takes
 *   the recommended `xs…xl`. A printed form has one button size because the
 *   grid has one; declaring the ramp and wiring one step would be the lie.
 * - **A fused `variant` vocabulary** — `key | spot | tint | outline | ghost`.
 *   The first three name *which ink*, the last two name a *treatment*, and no
 *   orthogonal decomposition of that set exists. This is what a variant axis
 *   looks like when it carries colour, and it is why the four-name set the
 *   other briefs share is one convention rather than the contract.
 *
 * It also uses the two mechanisms that shape needs: **`modifiers`** for
 * presence-only styling (`overprint`, `misregister` — no value, just present or
 * not), and a **`compoundVariants`** entry that matches one, for the case where
 * a variant and a modifier together need a rule neither states alone.
 *
 * Copy this file to `src/tokens.ts` and the `button` export to
 * `src/recipes.ts`, then write the remaining recipes.
 */
import type { CustomTokenDecl, RecipeInput, RolesDecl, SystemTokens, TokensInput } from '@sigx/zero-kit';

export const brief = {
    id: 'riso',
    summary: 'A duotone risograph print: two spot inks on warm paper, halftone tints, off-register drift.',
    teaches: 'roles:{} and sizes:[] to decline an axis, a fused variant vocabulary, modifiers and a compound that matches one',
    signature: 'overlapping ink multiplies instead of covering, via a modifier and a compound that matches it',
} as const;

/**
 * Empty, and that is the brief.
 *
 * `resolveRoles({})` returns `{}` instead of the recommended eight: the
 * required colour tokens collapse to the four base surfaces, the theme swatch
 * degrades to the base pair, and every component's `color` axis types as
 * `never` under this design system's `/register` module. That is the honest
 * type for a press that holds two inks.
 *
 * Note the difference from `sizes: []` below: `roles` reaches "no axis" through
 * an empty *object*, `sizes` through an empty *array*. Both mean the same
 * thing, and for both, *omitting* the key means the opposite — take the
 * recommended vocabulary.
 */
export const roles = {} as const satisfies RolesDecl;

/**
 * The palette, declared as custom tokens rather than roles.
 *
 * The distinction is the whole point: a role is a member of the `color` axis,
 * and this design system has no such axis. These are the inks its *variants*
 * resolve to — validated, themed and published to the manifest like any other
 * token, but never passable as `color="…"`.
 *
 * Two inks, not seven tokens' worth: `key` and `spot` are the inks, and
 * everything else is one of them at a different density, the way a real
 * duotone separation works.
 */
export const custom = {
    'riso-key': { description: 'The key ink — near-black, warm.', syntax: '<color>' },
    'riso-key-ink': { description: 'Paper showing through a solid key fill.', syntax: '<color>' },
    'riso-spot': { description: 'The spot ink — fluorescent, the one colour on the page.', syntax: '<color>' },
    'riso-spot-ink': { description: 'Key ink over a solid spot fill; a press overprints dark on light.', syntax: '<color>' },
    'riso-tint': { description: 'The spot ink at halftone density.', syntax: '<color>' },
    'riso-line': { description: 'Key ink at rule density — hairlines and outlined borders.', syntax: '<color>' },
    'riso-muted': { description: 'Key ink at text-secondary density.', syntax: '<color>' },
} as const satisfies Record<string, CustomTokenDecl>;

export const system = {
    // Barely rounded — a trimmed edge, not a curve.
    radius: { selector: '0.125rem', field: '0.125rem', box: '0.125rem' },
    size: { selector: '0.3rem', field: '0.3rem' },
    // Thick enough to survive a misregistered second pass.
    border: '2px',
    disabledOpacity: '0.4',

    /**
     * A print grid: the ramp steps on a 4px baseline rather than a geometric
     * curve, because everything on the page has to land on the same rows.
     */
    spacing: {
        '2xs': '0.125rem', xs: '0.25rem', sm: '0.5rem', md: '0.75rem',
        lg: '1.25rem', xl: '2rem', '2xl': '3rem',
    },

    /**
     * `shadow` is deliberately absent. Ink on paper casts nothing, and a
     * category left out entirely takes the `@sigx/zero/css` fallbacks — which
     * is a different thing from declaring half a ramp. Absence is never a
     * validation error; a partial scale is a trap for whoever copies this.
     */

    /**
     * A press is mechanical: it moves at one speed, and it does not ease.
     * Recipes still name `var(--duration-*)`, so reduced motion still collapses
     * them and retuning is still a one-line edit.
     */
    motion: {
        durations: { instant: '0ms', fast: '90ms', normal: '140ms', slow: '220ms' },
        easings: { linear: 'linear', standard: 'steps(3, end)', emphasized: 'steps(5, end)' },
    },

    typography: {
        fonts: {
            sans: '"Helvetica Neue", Inter, system-ui, sans-serif',
            mono: 'ui-monospace, "SF Mono", "Cascadia Mono", Menlo, monospace',
        },
        weights: { normal: 400, medium: 500, semibold: 600, bold: 800 },
        leading: { none: 1, tight: 1.15, normal: 1.45, relaxed: 1.7 },
        tracking: { tight: '-0.02em', normal: '0em', wide: '0.08em' },
        // A poster ratio: the widest in the pack, because a print sells its
        // hierarchy on size where it cannot sell it on colour.
        scale: { base: '1rem', ratio: 1.333 },
    },
} as const satisfies SystemTokens;

/**
 * The fused variant vocabulary.
 *
 * `key`, `spot` and `tint` name an **ink**; `outline` and `ghost` name a
 * **treatment**. There is no orthogonal (colour × treatment) decomposition of
 * that set — which is exactly why it is one axis and not two. Declaring it
 * closes the set: a recipe keying `variant.solid` is a build error rather than
 * a silently minted value.
 */
export const variants = ['key', 'spot', 'tint', 'outline', 'ghost'] as const;

/**
 * Presence-only styling: a modifier is either on the element or it is not, and
 * it carries no value. Reach for this rather than a one-member axis
 * (`axes: { overprint: ['overprint'] }`) — that encoding is what modifiers
 * replaced. Consumers pass them as `mods={{ overprint: true }}`, and they
 * render as `data-mod-overprint`, a namespace disjoint from zero's own flags by
 * construction.
 */
export const modifiers = ['overprint', 'misregister'] as const;

export const tokens: TokensInput<typeof roles, typeof system> = {
    roles,
    // No size axis. See the note on `roles` — empty declares it out of
    // existence, omitting it would take xs…xl.
    sizes: [],
    variants,
    modifiers,
    custom,
    system,
    breakpoints: { sm: '640px', md: '960px' },
    /**
     * No `swatch`: with no roles there is nothing to swatch, and the theme
     * picker falls back to the base pair on its own.
     */
    defaultLight: 'press',
    defaultDark: 'nightpress',
    themes: {
        press: {
            colorScheme: 'light',
            pair: 'nightpress',
            colors: {
                // Uncoated stock, slightly warm — never pure white.
                'base-100': 'oklch(97% 0.008 85)',
                'base-200': 'oklch(93% 0.012 85)',
                'base-300': 'oklch(88% 0.016 85)',
                'base-content': 'oklch(22% 0.02 60)',
            },
            custom: {
                'riso-key': 'oklch(24% 0.02 60)',
                'riso-key-ink': 'oklch(97% 0.008 85)',
                // Fluorescent pink is the risograph signature ink.
                'riso-spot': 'oklch(65% 0.26 5)',
                // Key ink over spot, not paper-white: a press lays dark on
                // light, and it clears 4.5:1 where white would sit near 2.6:1.
                'riso-spot-ink': 'oklch(20% 0.02 60)',
                'riso-tint': 'oklch(92% 0.06 5)',
                'riso-line': 'oklch(58% 0.015 60)',
                'riso-muted': 'oklch(48% 0.015 60)',
            },
        },
        nightpress: {
            colorScheme: 'dark',
            pair: 'press',
            colors: {
                'base-100': 'oklch(20% 0.01 60)',
                'base-200': 'oklch(25% 0.012 60)',
                'base-300': 'oklch(31% 0.014 60)',
                'base-content': 'oklch(93% 0.01 85)',
            },
            custom: {
                // The separation inverts: on a dark stock the key ink is the
                // one that reads as paper.
                'riso-key': 'oklch(93% 0.01 85)',
                'riso-key-ink': 'oklch(18% 0.01 60)',
                'riso-spot': 'oklch(72% 0.22 5)',
                'riso-spot-ink': 'oklch(18% 0.01 60)',
                'riso-tint': 'oklch(34% 0.09 5)',
                'riso-line': 'oklch(55% 0.015 60)',
                'riso-muted': 'oklch(72% 0.012 60)',
            },
        },
    },
};

export const button: RecipeInput = {
    component: 'button',
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
                background: 'transparent',
                color: 'var(--riso-key)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-md)',
                fontWeight: 'var(--weight-semibold)',
                lineHeight: 'var(--leading-none)',
                letterSpacing: 'var(--tracking-wide)',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'background var(--duration-fast) var(--ease-standard), '
                    + 'color var(--duration-fast) var(--ease-standard)',
            },
            states: {
                disabled: { opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' },
                hover: { background: 'var(--riso-tint)' },
                // The focus ring is a second pass in the spot ink, offset the
                // way a misregistered plate would land.
                'focus-visible': {
                    outline: 'var(--border) solid var(--riso-spot)',
                    outlineOffset: '2px',
                },
            },
            selectors: {
                '&:active:not([data-disabled])': { transform: 'translate(1px, 1px)' },
            },
        },
    },
    variants: {
        /**
         * No `color` block — there is no colour axis. The ink is chosen here,
         * in `variant`, which is what "fused" means in practice.
         */
        variant: {
            key: { root: { base: { background: 'var(--riso-key)', color: 'var(--riso-key-ink)' } } },
            spot: { root: { base: { background: 'var(--riso-spot)', color: 'var(--riso-spot-ink)' } } },
            tint: { root: { base: { background: 'var(--riso-tint)', color: 'var(--riso-key)' } } },
            outline: { root: { base: { borderColor: 'var(--riso-line)', color: 'var(--riso-key)' } } },
            ghost: { root: { base: { color: 'var(--riso-muted)' } } },
        },
    },
    modifiers: {
        /**
         * The signature move: a second pass of ink does not cover the first, it
         * multiplies with it. One declaration, and every overprinted control on
         * the page composites like a real separation.
         */
        overprint: { root: { base: { mixBlendMode: 'multiply' } } },
        // The plate landing a hair off — a duplicate of the label in spot ink.
        misregister: { root: { base: { textShadow: '1.5px 1.5px 0 var(--riso-spot)' } } },
    },
    compoundVariants: [
        {
            /**
             * A `ghost` control has no fill, so there is nothing for
             * `mix-blend-mode` to multiply and `overprint` would do literally
             * nothing on it. Neither declaration can say this alone — which is
             * what `compoundVariants` is for, and a `match` value of `true`
             * is how it names a presence-only modifier rather than an axis
             * value.
             *
             * `match` is also checked against `defaultVariants`, so this fires
             * on a `<Button.Root mods={{ overprint: true }}>` that carries no
             * `data-variant` at all — the default is part of the match.
             */
            match: { variant: 'ghost', overprint: true },
            parts: { root: { base: { background: 'var(--riso-tint)' } } },
        },
    ],
    // No `size` here: `sizes: []` means wiring one would be an error, not an
    // omission. `variant` is the only axis this design system has.
    defaultVariants: { variant: 'key' },
};
