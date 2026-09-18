/**
 * zero-daisyui tokens — daisyUI's "light" and "dark" theme values on the
 * zero contract. Values match the daisy presets `@sigx/daisyui` ships, so a
 * zero app skinned with this package sits visually next to a daisy app.
 */
import { layoutScopes } from '@sigx/zero-kit/define';
import type { CustomTokenDecl, RoleDecl, SystemTokens, TokensInput } from '@sigx/zero-kit';

/** daisyUI's color vocabulary — the recommended eight roles, declared explicitly. */
export const roles = {
    primary: {}, secondary: {}, accent: {}, neutral: {},
    info: {}, success: {}, warning: {}, error: {},
} as const satisfies Record<string, RoleDecl>;

/**
 * daisy's non-color token values — declared once for the design system rather
 * than restated per theme, with the three radii per-theme overridden below
 * where daisy's own themes differ.
 *
 * The radii are `light`/`dark`'s real shipped values. They used to be
 * `selector: 1.5rem` / `field: .5rem` / `box: 1rem`, which no daisyUI 5 theme
 * declares for any of the three — and `1.5rem` in particular is a value
 * `--radius-selector` never takes in any of daisy's 35 themes. The error was
 * masked on the checkbox alone by a compensating `calc(… / 3)` in `recipes.ts`
 * (`1.5rem / 3` = the `.5rem` daisy uses undivided); every other reader —
 * `switch.control`, `switch.thumb`, `progress`, the rating focus rings — was
 * simply 3× too round. Source: daisyUI 5's shipped `themes.css`, parsed across
 * all 35 themes.
 */
export const system = {
    radius: { selector: '0.5rem', field: '0.25rem', box: '0.5rem' },
    size: { selector: '0.25rem', field: '0.25rem' },
    // Typography. `fonts` is FAMILIES — sizes are the --text-* ramp, which
    // this design system inherits from @sigx/zero's fallbacks.
    typography: {
        fonts: {
            sans: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
            mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        },
        weights: { normal: 400, medium: 500, semibold: 600, bold: 700 },
        leading: { none: 1, tight: 1.25, normal: 1.5 },
        tracking: { normal: '0em', wide: '0.05em' },
    },
    // daisy runs a slightly roomier ramp than basic — the `xl`/`2xl` steps
    // are where its cards and modals get their air.
    // Page-scale widths a Container is bounded by. The density ramp cannot
    // reach these — it tops out at a rung you would not notice.
    // Tailwind's container ramp, which is what daisy is authored against.
    measure: {
        xs: '20rem',
        sm: '24rem',
        md: '28rem',
        lg: '32rem',
        xl: '36rem',
        prose: '65ch',
    },

    spacing: {
        '2xs': '0.125rem',
        xs: '0.25rem',
        sm: '0.375rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.25rem',
    },
    // daisy leans on many barely-separated low elevations; preserved exactly.
    shadow: {
        xs: '0 1px 2px oklch(0% 0 0 / 0.08)',
        sm: '0 1px 2px oklch(0% 0 0 / 0.15)',
        md: '0 1px 2px oklch(0% 0 0 / 0.2)',
        lg: '0 12px 32px -8px oklch(0% 0 0 / 0.3)',
        xl: '0 25px 50px -12px oklch(0% 0 0 / 0.4)',
    },
    // daisy's own timings, unchanged in value — 0.15s/0.2s/0.3s as authored.
    // `instant` is the 100ms daisy writes as a literal `.1s` in the checkbox
    // tick's and the toggle knob's transition DELAY. Declared as a token so no
    // literal time appears in a recipe, and — unlike daisy's own — so the kit's
    // reduced-motion block collapses the delay along with every duration.
    motion: {
        durations: { instant: '100ms', fast: '150ms', normal: '200ms', slow: '300ms' },
        easings: { standard: 'ease' },
    },
    border: '1px',
    disabledOpacity: '0.3',
} as const satisfies SystemTokens;

/**
 * daisy's fractal-noise tile, verbatim from its own `:root` — the `--fx-noise`
 * layer its checkboxes, toggles and buttons carry at `--noise` strength.
 */
const FX_NOISE = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cfilter id='a'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.34' numOctaves='4' stitchTiles='stitch'%3E%3C/feTurbulence%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23a)' opacity='0.2'%3E%3C/rect%3E%3C/svg%3E\")";

/**
 * The two paints `--depth` scales, named rather than inlined.
 *
 * daisy writes `oklch(0% 0 0 / calc(var(--depth) * .1))` straight into every
 * inset box-shadow. Written that way in a recipe the validator flags a
 * hardcoded colour — its scrim exemption parses the literal, and a
 * `calc(var(…))` alpha does not survive `stripVars`. Naming them keeps the
 * recipes var-only, which is the rule the exemption exists to protect.
 */
const DEPTH_SHADE = 'oklch(0% 0 0 / calc(var(--depth) * 0.1))';
const DEPTH_SHEEN = 'oklch(100% 0 0 / calc(var(--depth) * 0.1))';

/**
 * daisy's two non-contract knobs. `--depth` needs `syntax: '<number>'` so
 * `calc(var(--depth) * 10%)` interpolates rather than resolving to a guess.
 */
export const custom = {
    depth: { description: "daisy's inset-shadow depth: 1 = shadowed, 0 = flat.", syntax: '<number>' },
    'depth-shade': { description: 'The black inset paint --depth scales.' },
    'depth-sheen': { description: 'The white inset paint --depth scales.' },
    noise: { description: "daisy's fractal-noise overlay strength (0–1).", syntax: '<number>' },
    'fx-noise': { description: "daisy's fractal-noise tile." },
} as const satisfies Record<string, CustomTokenDecl>;

/** Per-theme values for `custom` — only `--depth` actually varies. */
const fx = (depth: '0' | '1'): Record<string, string> => ({
    depth,
    'depth-shade': DEPTH_SHADE,
    'depth-sheen': DEPTH_SHEEN,
    noise: '0',
    'fx-noise': FX_NOISE,
});

/**
 * Button's `variant` vocabulary — what button's variants.variant keys on.
 * Declared so a recipe typo is a build error, not a minted value; exported
 * `as const` so `defineApi` can narrow the api declaration against it.
 *
 * `dash` and `link` are daisyUI 5's `btn-dash` / `btn-link` (#332). daisy
 * documents `dash` (with `outline` and `soft`) on badge and alert too, but
 * this package wires them on button only — the repo-wide decision (#175) —
 * and the `scopes` entry makes that claim explicit.
 */
export const buttonVariants = ['solid', 'outline', 'soft', 'ghost', 'dash', 'link'] as const;

/**
 * Tabs' `variant` vocabulary — daisy's three tab flavors (#377):
 * `tabs-border` (underline, daisy's default look), `tabs-lift`, `tabs-box`.
 * Its own set rather than a widening of button's: a `border` button or a
 * `solid` tab is a word with no box, and the per-scope claims below keep
 * each recipe answerable only for its own flavors.
 */
export const tabVariants = ['border', 'lift', 'box'] as const;

/**
 * The design-system-wide `variant` axis vocabulary — the union of the
 * per-scope sets; `scopes` narrows each scope back to its own.
 */
export const variants = [...buttonVariants, ...tabVariants] as const;

/**
 * daisyUI 5's button modifier set (#332), each a documented `btn-*` class:
 * `btn-wide`, `btn-block`, `btn-square`, `btn-circle`, `btn-active`, and
 * the loading spinner (daisy renders it as a `loading loading-spinner`
 * span; here the recipe draws it, no DOM change). All six were boolean
 * props on the old `@sigx/daisyui` Button — the api declaration routes
 * them back to those names.
 *
 * `glass` is deliberately NOT here: daisyUI 5 no longer documents it on
 * any component (a v4 relic whose v5 survival is a compatibility style
 * with open breakage — saadeghi/daisyui#3316, #3501), and the old
 * `@sigx/daisyui` Button never exposed it either.
 */
export const modifiers = ['wide', 'block', 'square', 'circle', 'active', 'loading'] as const;

/**
 * daisyUI's table looks (#340): `table-zebra` and the row-level `hover`
 * class, spelled as presence-only mods on the table root. Kept apart from
 * the button set so `scopes` can hand each scope exactly its own names.
 */
export const tableModifiers = ['zebra', 'hover'] as const;

export const tokens: TokensInput<typeof roles, typeof system> = {
    roles,
    custom,
    variants,
    modifiers: [...modifiers, ...tableModifiers],
    /**
     * daisyUI's own ramp — Tailwind's, which daisy is authored against.
     *
     * Declared because of the layout tier: the other five skins already had
     * breakpoints, and without one here a responsive layout prop
     * (`gap={{ md: 'lg' }}`) would render an attribute that matches nothing
     * on this skin alone — a zero-level prop silently working in five design
     * systems and not the sixth. `resolveCondition` also throws on an
     * unknown condition key, so a recipe could not reference one either.
     */
    breakpoints: { sm: '40rem', md: '48rem', lg: '64rem' },
    /**
     * Per-scope vocabulary claims (#294). Button wires `variant` and the
     * `btn-*` modifier set (#175); restating its union is the explicit
     * claim "yes, button carries all of it", the same grammar zero-basic's
     * button entry uses. Table (#340) narrows to its own two looks — the
     * "later scope adopts part of the axis" case this block predicted —
     * and tabs (#377) carries the three flavors and nothing of button's.
     */
    scopes: {
        // The layout tier wires neither colour nor size — every one of its
        // scopes is geometry, and `data-color` on geometry would paint
        // nothing. Declared out of existence rather than left to the
        // axis-coverage audit to report.
        ...layoutScopes,
        button: {
            variants: [...buttonVariants],
            modifiers: [...modifiers],
        },
        table: { modifiers: [...tableModifiers] },
        tabs: { variants: [...tabVariants] },
    },
    system,
    defaultLight: 'light',
    defaultDark: 'dark',
    themes: {
        light: {
            colorScheme: 'light',
            pair: 'dark',
            softMix: 0.12,
            colors: {
                'base-100': 'oklch(100% 0 0)',
                'base-200': 'oklch(98% 0 0)',
                'base-300': 'oklch(95% 0 0)',
                'base-content': 'oklch(21% 0.006 285.885)',
                primary: 'oklch(45% 0.24 277.023)',
                'primary-content': 'oklch(93% 0.034 272.788)',
                secondary: 'oklch(65% 0.241 354.308)',
                'secondary-content': 'oklch(94% 0.028 342.258)',
                accent: 'oklch(77% 0.152 181.912)',
                'accent-content': 'oklch(38% 0.063 188.416)',
                neutral: 'oklch(14% 0.005 285.823)',
                'neutral-content': 'oklch(92% 0.004 286.32)',
                info: 'oklch(74% 0.16 232.661)',
                'info-content': 'oklch(29% 0.066 243.157)',
                success: 'oklch(76% 0.177 163.223)',
                'success-content': 'oklch(37% 0.077 168.94)',
                warning: 'oklch(82% 0.189 84.429)',
                'warning-content': 'oklch(41% 0.112 45.904)',
                error: 'oklch(71% 0.194 13.428)',
                'error-content': 'oklch(27% 0.105 12.094)',
            },
            custom: fx('1'),
        },
        dark: {
            colorScheme: 'dark',
            pair: 'light',
            softMix: 0.16,
            colors: {
                'base-100': 'oklch(25.33% 0.016 252.42)',
                'base-200': 'oklch(23.26% 0.014 253.1)',
                'base-300': 'oklch(21.15% 0.012 254.09)',
                'base-content': 'oklch(97.807% 0.029 256.847)',
                primary: 'oklch(58% 0.233 277.117)',
                'primary-content': 'oklch(96% 0.018 272.314)',
                secondary: 'oklch(65% 0.241 354.308)',
                'secondary-content': 'oklch(94% 0.028 342.258)',
                accent: 'oklch(77% 0.152 181.912)',
                'accent-content': 'oklch(38% 0.063 188.416)',
                neutral: 'oklch(14% 0.005 285.823)',
                'neutral-content': 'oklch(92% 0.004 286.32)',
                info: 'oklch(74% 0.16 232.661)',
                'info-content': 'oklch(29% 0.066 243.157)',
                success: 'oklch(76% 0.177 163.223)',
                'success-content': 'oklch(37% 0.077 168.94)',
                warning: 'oklch(82% 0.189 84.429)',
                'warning-content': 'oklch(41% 0.112 45.904)',
                error: 'oklch(71% 0.194 13.428)',
                'error-content': 'oklch(27% 0.105 12.094)',
            },
            custom: fx('1'),
        },
        // The N-theme proof (#132; docs/architecture.md, "The theme model"):
        // three more of daisyUI's own
        // themes. `defaultLight`/`defaultDark` stay light/dark, so the `:root`
        // light-dark() emission is untouched and these live purely in their
        // own [data-theme] blocks. A `dim` theme is a THEME whose scheme is
        // dark — not a third scheme. Unpaired on purpose: `toggle()` falls
        // back to the scheme default, which is what a one-off theme wants.
        dim: {
            colorScheme: 'dark',
            softMix: 0.16,
            colors: {
                'base-100': 'oklch(30.857% 0.023 264.149)',
                'base-200': 'oklch(28.036% 0.019 264.182)',
                'base-300': 'oklch(26.346% 0.018 262.177)',
                'base-content': 'oklch(82.901% 0.031 222.959)',
                primary: 'oklch(86.133% 0.141 139.549)',
                'primary-content': 'oklch(17.226% 0.028 139.549)',
                secondary: 'oklch(73.375% 0.165 35.353)',
                'secondary-content': 'oklch(14.675% 0.033 35.353)',
                accent: 'oklch(74.229% 0.133 311.379)',
                'accent-content': 'oklch(14.845% 0.026 311.379)',
                neutral: 'oklch(24.731% 0.02 264.094)',
                'neutral-content': 'oklch(82.901% 0.031 222.959)',
                info: 'oklch(86.078% 0.142 206.182)',
                'info-content': 'oklch(17.215% 0.028 206.182)',
                success: 'oklch(86.171% 0.142 166.534)',
                'success-content': 'oklch(17.234% 0.028 166.534)',
                warning: 'oklch(86.163% 0.142 94.818)',
                'warning-content': 'oklch(17.232% 0.028 94.818)',
                error: 'oklch(82.418% 0.099 33.756)',
                'error-content': 'oklch(16.483% 0.019 33.756)',
            },
            system: { radius: { selector: '1rem', field: '0.5rem', box: '1rem' } },
            custom: fx('0'),
        },
        nord: {
            colorScheme: 'light',
            softMix: 0.12,
            colors: {
                'base-100': 'oklch(95.127% 0.007 260.731)',
                'base-200': 'oklch(93.299% 0.01 261.788)',
                'base-300': 'oklch(89.925% 0.016 262.749)',
                'base-content': 'oklch(32.437% 0.022 264.182)',
                primary: 'oklch(59.435% 0.077 254.027)',
                'primary-content': 'oklch(11.887% 0.015 254.027)',
                secondary: 'oklch(69.651% 0.059 248.687)',
                'secondary-content': 'oklch(13.93% 0.011 248.687)',
                accent: 'oklch(77.464% 0.062 217.469)',
                'accent-content': 'oklch(15.492% 0.012 217.469)',
                neutral: 'oklch(45.229% 0.035 264.131)',
                'neutral-content': 'oklch(89.925% 0.016 262.749)',
                info: 'oklch(69.207% 0.062 332.664)',
                'info-content': 'oklch(13.841% 0.012 332.664)',
                success: 'oklch(76.827% 0.074 131.063)',
                'success-content': 'oklch(15.365% 0.014 131.063)',
                warning: 'oklch(85.486% 0.089 84.093)',
                'warning-content': 'oklch(17.097% 0.017 84.093)',
                error: 'oklch(60.61% 0.12 15.341)',
                'error-content': 'oklch(12.122% 0.024 15.341)',
            },
            // `field`/`box` already match the system default.
            system: { radius: { selector: '1rem' } },
            custom: fx('0'),
        },
        sunset: {
            colorScheme: 'dark',
            softMix: 0.16,
            colors: {
                'base-100': 'oklch(22% 0.019 237.69)',
                'base-200': 'oklch(20% 0.019 237.69)',
                'base-300': 'oklch(18% 0.019 237.69)',
                'base-content': 'oklch(77.383% 0.043 245.096)',
                primary: 'oklch(74.703% 0.158 39.947)',
                'primary-content': 'oklch(14.94% 0.031 39.947)',
                secondary: 'oklch(72.537% 0.177 2.72)',
                'secondary-content': 'oklch(14.507% 0.035 2.72)',
                accent: 'oklch(71.294% 0.166 299.844)',
                'accent-content': 'oklch(14.258% 0.033 299.844)',
                neutral: 'oklch(26% 0.019 237.69)',
                'neutral-content': 'oklch(70% 0.019 237.69)',
                info: 'oklch(85.559% 0.085 206.015)',
                'info-content': 'oklch(17.111% 0.017 206.015)',
                success: 'oklch(85.56% 0.085 144.778)',
                'success-content': 'oklch(17.112% 0.017 144.778)',
                warning: 'oklch(85.569% 0.084 74.427)',
                'warning-content': 'oklch(17.113% 0.016 74.427)',
                error: 'oklch(85.511% 0.078 16.886)',
                'error-content': 'oklch(17.102% 0.015 16.886)',
            },
            system: { radius: { selector: '1rem', field: '0.5rem', box: '1rem' } },
            custom: fx('0'),
        },
    },
};
