/**
 * The shared design-system token contract — web edition.
 *
 * `@sigx/zero` is the design-system-neutral foundation that DS packages
 * (`@sigx/zero-basic`, `@sigx/zero-daisyui`, …) build on. This module is the
 * *grammar* they agree on — size scales, color naming conventions and
 * structural theme token names — so that switching an app from one design
 * system to another is an import swap, not a rewrite.
 *
 * Rules of the contract:
 *
 * - The color contract is a naming GRAMMAR, not a vocabulary: each design
 *   system declares its own role names (via `@sigx/zero-kit`), and every
 *   color token is `--color-<role>`, optionally paired with
 *   `--color-<role>-content` (readable foreground on the role color) and
 *   `--color-<role>-soft` (tinted surface derived against `base-100`, mixed
 *   in oklab at the theme's `softMix` — every emit target derives it the
 *   same way, so one theme tints identically everywhere).
 *   Zero itself knows no role names — only the convention.
 * - The base surfaces (`base-100/200/300/base-content`) are the one fixed
 *   color vocabulary: they anchor soft derivation, `light-dark()` root
 *   emission and theme swatches, and every DS must provide them.
 * - `RECOMMENDED_ROLE_LIST` is the default vocabulary a DS gets when it
 *   declares nothing — shared recipes and the generation skill reference
 *   these names, but nothing in zero requires them.
 * - The `size` axis is the same shape: `SIZE_SCALE_LIST` is the recommended
 *   ramp a DS gets by default, and `SizeScale` accepts any DS-declared name
 *   (Material's density steps, a numbered ramp). Zero passes it through as
 *   `data-size` without interpreting it.
 * - `variant` (fill style: outline, soft, ghost, …) is intentionally NOT in
 *   the contract — it is design-system chrome and differs per DS. Zero passes
 *   it through as `data-variant` without interpreting it.
 * - Structural custom-property NAMES are part of the contract; the *values*
 *   come from each DS's compiled themes.
 *
 * ## The token-category contract
 *
 * Non-color tokens follow the same shape as colors: a closed set of
 * CATEGORIES (`TOKEN_CATEGORIES`), each fixing a `--prefix-` and the value
 * grammar tooling needs, with fully OPEN keys inside that a design system
 * declares and that flow into its manifest. `recommended` names the keys
 * `css/base.css` ships fallbacks for, so a category a design system never
 * mentions still resolves.
 *
 * - Colors:    `--color-<role>[-content|-soft]` per the DS's declaration,
 *              plus the fixed `--color-base-100/200/300` / `--color-base-content`
 * - Categories: `--radius-*`, `--size-*`, `--text-*`, `--border`,
 *              `--disabled-opacity` — see `TOKEN_CATEGORIES`
 * - Aliases:   every `--text-<key>` also emits `--text-fixed-<key>` — see
 *              `TEXT_FIXED_PREFIX`
 *
 * Colors stay a separate, stricter mechanism on purpose; the reasoning is on
 * `TokenCategory`.
 */

/**
 * The recommended component size scale — the default vocabulary a design
 * system gets when it declares no `sizes` of its own. Used for prop
 * autocomplete; any DS-declared size name is equally valid everywhere these
 * appear.
 */
export const SIZE_SCALE_LIST = ['xs', 'sm', 'md', 'lg', 'xl'] as const;

export type RecommendedSize = typeof SIZE_SCALE_LIST[number];

/**
 * A value for the `size` axis: recommended sizes autocompleted, any
 * DS-declared size name equally valid.
 *
 * Open for the same reason `ColorValue` is — the size ramp is design-system
 * vocabulary, not contract. Material specifies density (`compact`,
 * `comfortable`), other systems number their steps; a foundation for building
 * *new* design systems cannot require `xs`–`xl`.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type SizeScale = RecommendedSize | (string & {});

/**
 * The recommended color roles — the default vocabulary a design system gets
 * when it declares no `roles` of its own. Used for prop autocomplete and
 * structural defaults; any DS-declared role name is equally valid everywhere
 * these appear.
 */
export const RECOMMENDED_ROLE_LIST = [
    'primary', 'secondary', 'accent', 'neutral',
    'info', 'success', 'warning', 'error',
] as const;

export type RecommendedRole = typeof RECOMMENDED_ROLE_LIST[number];

/** The fixed base surfaces every design system provides. */
export const BASE_SURFACE_TOKEN_LIST = ['base-100', 'base-200', 'base-300', 'base-content'] as const;

export type BaseSurfaceToken = typeof BASE_SURFACE_TOKEN_LIST[number];

/**
 * The tokens a theme picker samples when a design system declares no `swatch`
 * of its own: the first four declared roles, plus the base pair that says what
 * the canvas looks like.
 *
 * Order comes from the declaration, so a design system controls this by
 * declaring its most distinguishing roles first — or overrides it outright
 * with `tokens.swatch` when the four that matter aren't the first four
 * (Material's themes differ in their tonal surfaces, not in `primary`).
 *
 * The compiler and the runtime registry must agree on this or a picker
 * disagrees with the design system's own manifest, so it lives in the
 * contract both sides mirror rather than in either one.
 */
export function defaultSwatch(roleNames: readonly string[]): string[] {
    return [...roleNames.slice(0, 4), 'base-100', 'base-content'];
}

/**
 * A value for the semantic `color` axis: a role name — recommended roles
 * autocompleted, any DS-declared role equally valid. Base surfaces are not
 * part of the axis.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type ColorValue = RecommendedRole | (string & {});

/** How a token category spells its custom properties. */
export type TokenCategoryShape =
    /** `${prefix}${key}` — the keys are design-system-declared. */
    | 'scale'
    /** `prefix` verbatim; the category holds a single value, no keys. */
    | 'scalar';

/**
 * CSS value grammar of a category. Published in the manifest so tooling and
 * generators know what a category accepts. NOT currently used for `@property`
 * registration: a registered `<length>` computes to an absolute value, which
 * would break `em`-relative and inheritance-sensitive ramps. Categories that
 * benefit from registration (animatable ones) opt in when they are added.
 */
export type TokenSyntax = '<length>' | '<time>' | '<number>' | '<color>' | '*';

/**
 * One token category: the naming GRAMMAR for a family of custom properties.
 *
 * Categories are a closed, kit-curated set — each carries the semantics
 * tooling needs to reason about that family (its value grammar, and later
 * things like reduced-motion handling for durations).
 * The KEYS inside a category are fully open: a design system declares its own
 * (`shadow: { level1, …, level5 }`) and they flow into its manifest.
 * `recommended` is guidance, autocomplete and the set `base.css` ships
 * fallbacks for — never a constraint.
 *
 * This is the color contract's "declared vocabulary + naming grammar" model
 * (see `RECOMMENDED_ROLE_LIST`) generalized to every other token family.
 * Colors are deliberately NOT in this table: a role is a semantic contract
 * whose completeness must be enforced (a missing role breaks contrast
 * validation and leaves `var(--color-x)` unresolved), so they keep the
 * stricter declare-then-require model. Categories are value sets with
 * structural fallbacks, so absence is never an error.
 */
export interface TokenCategory {
    /** Stable id — the key used in zero's and every design system's manifest. */
    readonly id: string;
    readonly shape: TokenCategoryShape;
    /** Custom-property prefix, including the leading `--`. */
    readonly prefix: string;
    /** Where the category lives in the authoring shape, under `system`. */
    readonly path: readonly string[];
    /** Keys a design system gets fallbacks for; open to any other key. */
    readonly recommended: readonly string[];
    readonly syntax: TokenSyntax;
    /** One-line intent — published in the manifest for tooling and AI. */
    readonly description: string;
}

export const TOKEN_CATEGORIES = [
    {
        id: 'radius', shape: 'scale', prefix: '--radius-', path: ['radius'],
        recommended: ['selector', 'field', 'box'], syntax: '<length>',
        description: 'Corner rounding per surface kind: selector (checkbox/radio), field (input/button), box (card/dialog).',
    },
    {
        id: 'size', shape: 'scale', prefix: '--size-', path: ['size'],
        recommended: ['selector', 'field'], syntax: '<length>',
        description: 'Base unit control sizing multiplies — calc(var(--size-field) * 10).',
    },
    {
        id: 'font', shape: 'scale', prefix: '--font-', path: ['typography', 'fonts'],
        recommended: ['sans', 'serif', 'mono', 'display'], syntax: '*',
        description: 'Font FAMILY stacks. Sizes live in --text-*; this namespace is families only.',
    },
    {
        id: 'text', shape: 'scale', prefix: '--text-', path: ['typography', 'sizes'],
        recommended: ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'], syntax: '<length>',
        description: 'Font-size ramp; may be generated from a modular typography.scale. Every key also emits a --text-fixed-<key> alias for platform-scale-immune control chrome.',
    },
    {
        id: 'weight', shape: 'scale', prefix: '--weight-', path: ['typography', 'weights'],
        recommended: ['normal', 'medium', 'semibold', 'bold'], syntax: '<number>',
        description: 'Font weights.',
    },
    {
        id: 'leading', shape: 'scale', prefix: '--leading-', path: ['typography', 'leading'],
        recommended: ['none', 'tight', 'normal', 'relaxed'], syntax: '<number>',
        description: 'Unitless line-height multipliers.',
    },
    {
        id: 'tracking', shape: 'scale', prefix: '--tracking-', path: ['typography', 'tracking'],
        recommended: ['tight', 'normal', 'wide'], syntax: '<length>',
        description: 'Letter spacing.',
    },
    {
        id: 'space', shape: 'scale', prefix: '--space-', path: ['spacing'],
        recommended: ['2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'], syntax: '<length>',
        description: 'Density ramp for padding, gap and margin — how tightly the system is packed.',
    },
    {
        id: 'measure', shape: 'scale', prefix: '--measure-', path: ['measure'],
        recommended: ['xs', 'sm', 'md', 'lg', 'xl', 'prose'], syntax: '<length>',
        description: 'Page-scale widths a container is bounded by — how wide the design system lets content run, as distinct from the --space-* density ramp.',
    },
    {
        id: 'shadow', shape: 'scale', prefix: '--shadow-', path: ['shadow'],
        recommended: ['xs', 'sm', 'md', 'lg', 'xl'], syntax: '*',
        description: 'Elevation ramp. Commonly differs per color scheme — dark surfaces need heavier shadows to read.',
    },
    {
        id: 'duration', shape: 'scale', prefix: '--duration-', path: ['motion', 'durations'],
        recommended: ['instant', 'fast', 'normal', 'slow'], syntax: '<time>',
        description: 'Transition and animation durations; collapsed to ~0 under prefers-reduced-motion.',
    },
    {
        id: 'ease', shape: 'scale', prefix: '--ease-', path: ['motion', 'easings'],
        recommended: ['linear', 'standard', 'emphasized'], syntax: '*',
        description: 'Easing functions — the shape of a motion, independent of its duration.',
    },
    {
        id: 'border', shape: 'scalar', prefix: '--border', path: ['border'],
        recommended: [], syntax: '<length>',
        description: 'Default border width.',
    },
    {
        id: 'disabled-opacity', shape: 'scalar', prefix: '--disabled-opacity', path: ['disabledOpacity'],
        recommended: [], syntax: '<number>',
        description: 'Opacity applied to disabled parts.',
    },
] as const satisfies readonly TokenCategory[];

export type TokenCategoryId = typeof TOKEN_CATEGORIES[number]['id'];

/**
 * Token keys become the tail of a custom property, so unlike color roles they
 * may start with a digit (`--text-2xl`). Color roles keep the stricter
 * `ROLE_NAME_PATTERN` because `resolveColorToken` has to resolve a bare
 * identifier to `var(--color-<role>)`.
 */
export const TOKEN_KEY_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Axis VALUES have a grammar of their own (#198). A value only ever lands in
 * a quoted attribute selector (`[data-variant="danger--tertiary"]`), a
 * single-quoted literal in `register.d.ts`, and — on the lynx target — an
 * unescaped class name (`zx-a-variant-danger--tertiary`). Repeated hyphens
 * are legal in all three, which is Carbon's entire `kind` axis
 * (`danger--tertiary`). `%` and `.` are not: a class name would need CSS
 * escaping for them, so Radix's `105%` stays an `api.values` remap. Quotes,
 * backslashes and whitespace stay out so every interpolation site stays
 * escape-free; uppercase stays out because `data-*` values are
 * case-sensitive. Axis, modifier and role NAMES keep `TOKEN_KEY_PATTERN`.
 */
export const AXIS_VALUE_PATTERN = /^[a-z0-9]+(-+[a-z0-9]+)*$/;

/**
 * Fixed-size alias for the text ramp: for every emitted `--text-<key>` the
 * token compiler also emits `--text-fixed-<key>`.
 *
 * The two names answer different questions. `--text-<key>` is "this step of
 * the ramp, subject to whatever runtime text scaling the platform applies";
 * `--text-fixed-<key>` is "the same step, immune to that scaling". On the web
 * there is no such scaling, so the alias is pure indirection
 * (`--text-fixed-sm: var(--text-sm)`); an emit target with a runtime font
 * scale (lynx's `fontScale`) materializes the alias as a literal the scaler
 * never touches. Recipes reference it for control chrome — button labels,
 * badges, input affordances — that must not grow with in-app text scaling.
 *
 * A design system never authors these: they are derived from the declared
 * `--text-*` keys. A literal `typography.sizes` key that happens to spell a
 * `fixed-*` name wins over the derived alias.
 */
export const TEXT_FIXED_PREFIX = '--text-fixed-';

/**
 * The custom-property name a category key emits.
 *
 * `scalar` categories hold a single value and take no key; `scale`
 * categories require one — omitting it would silently produce
 * `--radius-undefined`, so it throws instead.
 */
export function tokenProperty(category: TokenCategory, key?: string): string {
    if (category.shape === 'scalar') return category.prefix;
    if (key === undefined) {
        throw new Error(`[zero] token category "${category.id}" is a scale — tokenProperty needs a key`);
    }
    return `${category.prefix}${key}`;
}

/**
 * Values `resolveColorToken` must never rewrite into `var(--color-*)`.
 *
 * Exported because `@sigx/zero-kit` keeps a mirror of this contract and
 * rejects role declarations that use these names (a role named `transparent`
 * could never be referenced by convention). The mirror is kept honest by
 * `packages/zero-kit/__tests__/contract-parity.test.ts`.
 */
export const CSS_COLOR_KEYWORDS: ReadonlySet<string> = new Set([
    'inherit', 'initial', 'unset', 'revert', 'revert-layer',
    'currentcolor', 'transparent', 'none',
]);

/**
 * Role names must be bare kebab-case identifiers — they become
 * `--color-<role>`, and `resolveColorToken` resolves them by that shape alone.
 */
export const ROLE_NAME_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/**
 * Resolve a color value to a CSS color string — by convention, not by
 * vocabulary (zero doesn't know which roles a design system declared).
 *
 * - `--anything`                    → `var(--anything)`
 * - bare kebab-case identifier
 *   (`'primary'`, `'base-100'`, any DS-declared role) → `var(--color-<name>)`
 * - CSS-wide keywords, `transparent`, `currentcolor`, `none` → unchanged
 * - anything else (`'#ffaa00'`, `'rgb(…)'`, `'oklch(…)'`) → unchanged
 *
 * Note the convention makes named CSS colors like `'red'` resolve as token
 * names — write them as `#f00` / `rgb()` when a literal color is meant.
 */
export function resolveColorToken(value: string): string {
    if (value.startsWith('--')) return `var(${value})`;
    if (CSS_COLOR_KEYWORDS.has(value)) return value;
    return ROLE_NAME_PATTERN.test(value) ? `var(--color-${value})` : value;
}

/**
 * Accepts a color token name — roles or base surfaces (recommended names
 * autocompleted; DS-declared names equally valid) — OR any raw CSS color
 * string (`'#fff'`, `'rgb(…)'`, `'var(--foo)'`).
 */
export type BackgroundValue = ColorValue | BaseSurfaceToken;
