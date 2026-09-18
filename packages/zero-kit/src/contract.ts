/**
 * Kit-side copy of the zero token contract vocabulary.
 *
 * Deliberately duplicated from `@sigx/zero/contract` so the kit stays a
 * pure Node tool with no runtime dependency on zero. The duplication is kept
 * honest by `packages/zero-kit/__tests__/contract-parity.test.ts`, which
 * compares every shared export by value, fails when a new shared export is
 * added without a parity row, and re-derives the reserved-name claim from
 * zero's actual `resolveColorToken` behavior.
 *
 * The color contract is a naming GRAMMAR, not a vocabulary: a design system
 * declares its own role names (`roles`), and every color token is
 * `--color-<role>` with the suffix semantics `-content` (readable foreground
 * on the role color, contrast-validated) and `-soft` (tinted surface derived
 * against `base-100`, mixed in oklab at the theme's `softMix` — every emit
 * target derives it the same way, so one theme tints identically
 * everywhere). Only the base surfaces are fixed — they anchor soft
 * derivation, `light-dark()` root emission and theme swatches.
 */

/** Declaration of one color role in a design system's vocabulary. */
export interface RoleDecl {
    /** Emit + require + contrast-check a `<role>-content` pairing. Default true. */
    content?: boolean;
    /** Emit a `<role>-soft` tint (explicit value or `softMix` derivation). Default true. */
    soft?: boolean;
    /** Intent of the role — surfaced in the DS manifest for tooling/AI. */
    description?: string;
}

/** Role names must be bare kebab-case identifiers (they become `--color-<role>`). */
export const ROLE_NAME_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** How a token category spells its custom properties. */
export type TokenCategoryShape = 'scale' | 'scalar';

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
 * Categories are closed and kit-curated; the KEYS inside are declared by each
 * design system and open. This is the color model (`roles`) generalized to
 * every other token family — colors themselves stay separate and stricter,
 * because a role is a semantic contract whose completeness must be enforced,
 * whereas a category is a value set with structural fallbacks in base.css.
 *
 * Mirrors `TOKEN_CATEGORIES` in `@sigx/zero/contract`; the parity test keeps
 * the two identical.
 */
export interface TokenCategory {
    readonly id: string;
    readonly shape: TokenCategoryShape;
    /** Custom-property prefix, including the leading `--`. */
    readonly prefix: string;
    /** Where the category lives in the authoring shape, under `system`. */
    readonly path: readonly string[];
    /** Keys base.css ships fallbacks for; open to any other key. */
    readonly recommended: readonly string[];
    readonly syntax: TokenSyntax;
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
 * may start with a digit (`--text-2xl`).
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
 * compiler also emits `--text-fixed-<key>` — on the web a pure indirection
 * (`--text-fixed-sm: var(--text-sm)`); on a target with a runtime font scale
 * (lynx's `fontScale`) a materialized literal the scaler never touches.
 * Recipes reference it for control chrome that must not grow with in-app
 * text scaling. Derived, never authored — a literal `typography.sizes` key
 * spelling a `fixed-*` name wins over the derived alias. Mirrors
 * `TEXT_FIXED_PREFIX` in `@sigx/zero/contract` (parity-tested).
 */
export const TEXT_FIXED_PREFIX = '--text-fixed-';

/**
 * Read a category's node out of an authoring object, following the whole
 * `path`. Categories added later nest (`['typography', 'sizes']`), so
 * shortcutting to `path[0]` would silently resolve the wrong object.
 */
export function systemNodeAt(source: unknown, path: readonly string[]): unknown {
    let node = source;
    for (const segment of path) {
        if (node === undefined || node === null || typeof node !== 'object') return undefined;
        node = (node as Record<string, unknown>)[segment];
    }
    return node;
}

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
        throw new Error(`[zero-kit] token category "${category.id}" is a scale — tokenProperty needs a key`);
    }
    return `${category.prefix}${key}`;
}

/**
 * Role names zero's `resolveColorToken` treats as CSS keywords and never
 * resolves to `var(--color-<role>)` — declaring them would create tokens
 * that can't be referenced by convention. Mirrors `CSS_COLOR_KEYWORDS` in
 * `@sigx/zero/contract`; the parity test asserts both that the sets match and
 * that each name really does survive `resolveColorToken` unchanged.
 */
export const RESERVED_ROLE_NAMES: ReadonlySet<string> = new Set([
    'inherit', 'initial', 'unset', 'revert', 'revert-layer',
    'currentcolor', 'transparent', 'none',
]);

/**
 * The recommended role vocabulary — the default `roles` declaration when a
 * design system doesn't provide one. Shared component recipes and the
 * generation skill reference these names; declaring more (or fewer) roles is
 * fully supported.
 */
export const RECOMMENDED_ROLE_LIST = [
    'primary', 'secondary', 'accent', 'neutral',
    'info', 'success', 'warning', 'error',
] as const;

export type RecommendedRole = typeof RECOMMENDED_ROLE_LIST[number];

export const DEFAULT_ROLES: Record<RecommendedRole, RoleDecl> = Object.fromEntries(
    RECOMMENDED_ROLE_LIST.map((r) => [r, {}]),
) as Record<RecommendedRole, RoleDecl>;

/**
 * The recommended component size ramp — the default `sizes` vocabulary when a
 * design system doesn't declare one. Mirrors `SIZE_SCALE_LIST` in
 * `@sigx/zero/contract` (parity-tested). Declaring a different ramp is fully
 * supported; see `TokensInput.sizes`.
 */
export const SIZE_SCALE_LIST = ['xs', 'sm', 'md', 'lg', 'xl'] as const;

export type RecommendedSize = typeof SIZE_SCALE_LIST[number];

/** A `size` axis value: recommended names autocompleted, any name valid. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type SizeScale = RecommendedSize | (string & {});

/** Normalize a sizes declaration (undefined → the recommended ramp). */
export function resolveSizes(sizes: readonly string[] | undefined): readonly string[] {
    return sizes ?? SIZE_SCALE_LIST;
}

/** The fixed base surfaces every design system must provide. */
export const BASE_SURFACE_TOKEN_LIST = ['base-100', 'base-200', 'base-300', 'base-content'] as const;

export type BaseSurfaceToken = typeof BASE_SURFACE_TOKEN_LIST[number];

/**
 * The tokens a theme picker samples when a design system declares no `swatch`
 * of its own: the first four declared roles, plus the base pair.
 *
 * Mirrors `defaultSwatch` in `@sigx/zero/contract` (parity-tested). The
 * compiler applies it here; `registerThemes` applies it at runtime — the two
 * must produce the same list or a picker disagrees with the DS manifest.
 */
export function defaultSwatch(roleNames: readonly string[]): string[] {
    return [...roleNames.slice(0, 4), 'base-100', 'base-content'];
}

/** Normalize a roles declaration (undefined → the recommended vocabulary). */
export function resolveRoles(roles: Record<string, RoleDecl> | undefined): Record<string, RoleDecl> {
    return roles ?? DEFAULT_ROLES;
}

/**
 * Whether a role is a fill or a hairline rather than an action colour.
 *
 * `tokens.roles` does double duty as the palette and as the `color` axis
 * vocabulary (#286). A role that opts out of `-content` or `-soft` —
 * Material's tonal `surface*` family, its `outline` — is a token a recipe
 * reads, not a value a consumer can pass as `color`; every skin filters it
 * out of the axis, the value-coverage guard exempts it, and the score leaves
 * it out of the vocabulary denominator. One predicate, so #286 becomes a
 * one-function change when the declaration grows an explicit field.
 */
export function isFillRole(decl: RoleDecl | undefined): boolean {
    return decl?.content === false || decl?.soft === false;
}

/** The roles that make up the `color` axis — every declared role that is not a fill, in declaration order. */
export function axisRoles(roles: Record<string, RoleDecl>): string[] {
    return Object.entries(roles)
        .filter(([, decl]) => !isFillRole(decl))
        .map(([name]) => name);
}

/** Theme-authorable color token names for a declaration (no `-soft` — optional). */
export function requiredColorTokens(roles: Record<string, RoleDecl>): string[] {
    return [
        ...Object.entries(roles).flatMap(([name, decl]) =>
            decl.content === false ? [name] : [name, `${name}-content`]),
        ...BASE_SURFACE_TOKEN_LIST,
    ];
}

/** `bg` / `fg` pairs the validator contrast-checks for a declaration. */
export function contrastPairs(roles: Record<string, RoleDecl>): readonly (readonly [string, string])[] {
    return [
        ...Object.entries(roles)
            .filter(([, decl]) => decl.content !== false)
            .map(([name]) => [name, `${name}-content`] as const),
        ['base-100', 'base-content'],
        ['base-200', 'base-content'],
        ['base-300', 'base-content'],
    ];
}

/**
 * Custom properties the `@sigx/zero` runtime writes on elements — not design
 * tokens, but runtime-published interaction/measurement data recipes may
 * reference. `--press-*` come from the press-feedback behavior (press point
 * and farthest-corner radius, in px, on any part whose anatomy declares the
 * `pressed` flag); the percent trio is written by Progress, Slider and
 * Diff, and `--countdown-value` by Countdown (the raw number, for recipes
 * that want the property rather than the rendered digits).
 *
 * WEB-ONLY: these exist because the DOM runtime can write custom properties
 * that stylesheet rules then read. A target whose engine cannot resolve
 * `var()` written inline (lynx) has no equivalent mechanism, so its
 * capability set rejects recipes that reference them outside a web-only
 * target section.
 */
export const RUNTIME_PROPERTIES = [
    '--press-x',
    '--press-y',
    '--press-r',
    '--progress-percent',
    '--slider-percent',
    '--diff-percent',
    '--countdown-value',
] as const;

/**
 * Custom properties `@sigx/zero/css` declares that are facts about a MEDIUM
 * rather than design tokens — a design system may override one, but never has
 * to declare it, so a recipe referencing one always resolves.
 *
 * `--print-ink` is the ink a print fallback draws with. Paper is not
 * theme-aware: `print-color-adjust: economy` drops background paint, so a mark
 * drawn as a background comes back as a glyph, and every theme-carried
 * candidate for that glyph's ink fails on one side or the other —
 * `--color-base-content` and `CanvasText` are both white under a dark theme,
 * and an on-accent ink is white under a light one, over a fill that did not
 * print. Both are 1.00:1 on white paper (#233).
 */
export const MEDIUM_PROPERTIES = [
    '--print-ink',
] as const;

/**
 * The cascade-layer order of the whole zero system, exactly as
 * `@sigx/zero/css/base.css` declares it (pinned byte-equal by
 * `layer-order.test.ts`). Emitted at the top of every compiled `tokens.css`
 * and `index.css`: the FIRST mention of a layer establishes its position, so
 * a design-system stylesheet parsed before base.css would otherwise create
 * `zero.tokens` first and leave base.css's `zero.fallback` ABOVE it —
 * neutral fallbacks silently overriding the design system's tokens.
 * Restating the order is idempotent; relying on load order is not.
 */
export const LAYER_ORDER_STATEMENT = '@layer zero.fallback, zero.tokens, zero.recipes, zero.structure;';

/** Interaction states resolved to real pseudo-classes, not data attributes. */
export const INTERACTION_STATES: Record<string, string> = {
    hover: ':hover:not([data-disabled])',
    focus: ':focus',
    'focus-visible': ':focus-visible',
    active: ':active:not([data-disabled])',
};

/**
 * The variant axes with named props on every zero component.
 *
 * NOT a closed set: a design system may key `variants` on any axis it names —
 * density, emphasis, tone — and an app reaches it through zero's `axes` prop,
 * which spells it `data-<axis>` by the same rule. These three get autocomplete
 * because almost every design language has them.
 */
export const VARIANT_AXES: Record<string, string> = {
    color: 'data-color',
    size: 'data-size',
    variant: 'data-variant',
};

/**
 * The namespace design-system modifiers render into. Mirrors
 * `MOD_ATTR_PREFIX` in `@sigx/zero/contract` (parity-tested): the compiler
 * emits `[data-mod-<name>]` selectors and the runtime sets exactly those
 * attributes, so the two spellings cannot be allowed to drift.
 *
 * Prefixed because zero's own presence-only flags are versioned — see
 * `WithMods` in zero — and an unprefixed modifier would silently collide with
 * a flag added later.
 */
export const MOD_ATTR_PREFIX = 'data-mod-';

/**
 * The shared boolean-flag vocabulary. Mirrors `FLAG_VOCABULARY` in
 * `@sigx/zero/contract` (parity-tested): `mergeManifests` holds ecosystem
 * fragments to it — the "no synonyms" rule, enforced on the surface the
 * README sells to ecosystem authors rather than only on zero's own anatomies.
 */
export const FLAG_VOCABULARY = [
    'disabled',
    'highlighted',
    'selected',
    'invalid',
    'required',
    'readonly',
    'placeholder',
    'focus-visible',
    'pressed',
    'press-animating',
] as const;

/**
 * The governed `data-state` vocabulary, grouped by family — the states half
 * of the same governance. Mirrors `STATE_VOCABULARY` in `@sigx/zero/contract`
 * (parity-tested). Families are documentation; membership is checked against
 * the union (`STATE_NAMES`).
 */
export const STATE_VOCABULARY = {
    presence: ['open', 'closed'],
    selection: ['checked', 'unchecked', 'indeterminate'],
    activation: ['active', 'inactive'],
    toggle: ['on', 'off'],
    loading: ['loading', 'loaded', 'complete', 'error'],
    fill: ['full', 'half', 'empty'],
} as const;

/** Every governed `data-state` value, flat. Mirrors zero's `STATE_NAMES`. */
export const STATE_NAMES: ReadonlySet<string> = new Set(Object.values(STATE_VOCABULARY).flat());

/**
 * Spellings the state vocabulary deliberately does not contain, mapped to the
 * member that means the same thing — diagnostic only. Mirrors
 * `STATE_SYNONYMS` in `@sigx/zero/contract` (parity-tested).
 */
export const STATE_SYNONYMS: Record<string, string> = {
    expanded: 'open',
    collapsed: 'closed',
    visible: 'open',
    shown: 'open',
    hidden: 'closed',
    dismissed: 'closed',
    selected: 'checked',
    unselected: 'unchecked',
    mixed: 'indeterminate',
    current: 'active',
    pressed: 'on',
    unpressed: 'off',
    busy: 'loading',
    pending: 'loading',
    done: 'complete',
    finished: 'complete',
    failed: 'error',
    errored: 'error',
};

/**
 * The closed `data-placement` vocabulary. Mirrors `PLACEMENT_VOCABULARY` in
 * `@sigx/zero/contract` (parity-tested); a part's declared `placements` must
 * be a subset. The bare `start`/`end` pair (#334) is the LOGICAL inline
 * sides — reading-direction-relative, unlike the physical `left`/`right` the
 * anchored-position behavior reports — see the zero copy for the reasoning.
 */
export const PLACEMENT_VOCABULARY = [
    'top', 'top-start', 'top-end',
    'bottom', 'bottom-start', 'bottom-end',
    'left', 'left-start', 'left-end',
    'right', 'right-start', 'right-end',
    'start', 'end',
] as const;

/**
 * Axis names that are NOT available, because the anatomy contract already
 * gives `data-<name>` a meaning. Mirrors `RESERVED_AXES` in
 * `@sigx/zero/contract` (parity-tested): the validator must reject exactly
 * what the runtime refuses to render, or a design system would compile
 * selectors nothing is ever able to set. Derived from the flag vocabulary the
 * same way zero derives it, so the two lists cannot drift independently
 * WITHIN the kit either.
 */
export const RESERVED_AXES: ReadonlySet<string> = new Set([
    'scope', 'part', 'state', 'orientation', ...FLAG_VOCABULARY,
]);

/**
 * The layout attribute family. Mirrors `LAYOUT_ATTR_PREFIX`,
 * `LAYOUT_VOCABULARY` and `SPACE_STEPS` in `@sigx/zero/contract`
 * (parity-tested).
 *
 * Note what the prefix buys on THIS side: because every layout attribute is
 * namespaced, none of these names appears in `RESERVED_AXES`, so a design
 * system remains free to declare an axis called `align` or `track`. An
 * unprefixed family would have had to seize all fifteen words permanently
 * from every design system in the ecosystem.
 */
export const LAYOUT_ATTR_PREFIX = 'data-l-';

/**
 * The key `Responsive` uses for the unqualified value, and therefore a name
 * no breakpoint may take. Mirrors `BASE_BREAKPOINT_KEY` in
 * `@sigx/zero/contract`; the validator rejects a breakpoint declared with it.
 */
export const BASE_BREAKPOINT_KEY = 'base';

export interface LayoutAttrSpec {
    readonly values: readonly string[];
    readonly responsive?: true;
}

export const SPACE_STEPS = ['none', '2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const;

const TRACK_COUNTS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'] as const;

export const LAYOUT_VOCABULARY = {
    gap: { values: SPACE_STEPS, responsive: true },
    'gap-x': { values: SPACE_STEPS },
    'gap-y': { values: SPACE_STEPS },
    pad: { values: SPACE_STEPS, responsive: true },
    'pad-x': { values: SPACE_STEPS },
    'pad-y': { values: SPACE_STEPS },
    align: { values: ['start', 'center', 'end', 'stretch', 'baseline'], responsive: true },
    justify: { values: ['start', 'center', 'end', 'between', 'around', 'evenly'], responsive: true },
    wrap: { values: ['wrap', 'nowrap', 'wrap-reverse'] },
    cols: { values: [...TRACK_COUNTS, 'auto'], responsive: true },
    span: { values: [...TRACK_COUNTS, 'full'], responsive: true },
    track: { values: ['xs', 'sm', 'md', 'lg', 'xl'] },
    grow: { values: ['0', '1'] },
    axis: { values: ['both', 'inline', 'block'] },
    space: { values: SPACE_STEPS },
    /**
     * A Container's maximum width — a rung of the `--measure-*` ramp, or
     * `full` for no bound at all.
     *
     * Deliberately NOT the `size` axis. A container's width is a different
     * question from a control's size: `size="lg"` on a Button means a
     * chunkier button, and on a Container it would mean a wider page. Those
     * ramps have no reason to move together, and `prose` — a reading measure
     * in `ch` — is not a size at all.
     */
    measure: { values: ['xs', 'sm', 'md', 'lg', 'xl', 'prose', 'full'] },
} as const satisfies Record<string, LayoutAttrSpec>;

export type LayoutAttrName = keyof typeof LAYOUT_VOCABULARY;

export const LAYOUT_ATTR_NAMES: ReadonlySet<string> = new Set(Object.keys(LAYOUT_VOCABULARY));

/** One attribute's spec, widened — see the zero copy for why the union needs it. */
export const layoutAttrSpec = (attr: LayoutAttrName): LayoutAttrSpec => LAYOUT_VOCABULARY[attr];

/**
 * Attribute names longest-first — the scan order `parseLayoutAttr` needs so
 * `md-gap-x` resolves to the attribute `gap-x` rather than stopping at `gap`.
 */
const ATTRS_LONGEST_FIRST: readonly LayoutAttrName[] =
    (Object.keys(LAYOUT_VOCABULARY) as LayoutAttrName[]).sort((a, b) => b.length - a.length);

/**
 * Split a rendered layout attribute into its parts, or `undefined` when the
 * name is not one of ours. Mirrors `parseLayoutAttr` in `@sigx/zero/contract`
 * — including the suffix-matching rule: a breakpoint name may contain a
 * hyphen (`tablet-lg`), so the closed ATTRIBUTE vocabulary is what gets
 * anchored on, matched from the end, longest first.
 */
export function parseLayoutAttr(name: string): { attr: LayoutAttrName; breakpoint?: string } | undefined {
    if (!name.startsWith(LAYOUT_ATTR_PREFIX)) return undefined;
    const rest = name.slice(LAYOUT_ATTR_PREFIX.length);
    if (LAYOUT_ATTR_NAMES.has(rest)) return { attr: rest as LayoutAttrName };
    for (const attr of ATTRS_LONGEST_FIRST) {
        const suffix = `-${attr}`;
        if (!rest.endsWith(suffix)) continue;
        const breakpoint = rest.slice(0, rest.length - suffix.length);
        if (breakpoint.length === 0) return undefined;
        if (!layoutAttrSpec(attr).responsive) return undefined;
        if (!TOKEN_KEY_PATTERN.test(breakpoint)) return undefined;
        if (breakpoint === BASE_BREAKPOINT_KEY) return undefined;
        return { attr, breakpoint };
    }
    return undefined;
}


// ── Minimal structural mirror of @sigx/zero's AnatomyJSON/manifest types ──

export interface ManifestPart {
    name: string;
    element: string;
    /**
     * The same-scope part this part renders inside — the anatomy's part
     * TREE. Names the containing part, not necessarily the immediate parent
     * element; absent for a top-level part and for `pseudo` parts. The web
     * recipe compiler reads it to bound descendant-anchored axis rules at
     * nested same-scope instances, and the contrast audit derives its
     * ancestor chains from it.
     */
    parent?: string;
    states?: readonly string[];
    flags?: readonly string[];
    /**
     * The `data-placement` values this part can carry — declared contract
     * data, a subset of `PLACEMENT_VOCABULARY`. Absent for parts the runtime
     * never stamps.
     */
    placements?: readonly string[];
    /**
     * The layout attributes this part can carry — declared contract data, a
     * subset of `LAYOUT_VOCABULARY`'s keys, rendered under the `data-l-`
     * prefix. Absent for parts that take none.
     */
    layout?: readonly string[];
    /**
     * States in which zero's runtime sets `hidden` on this part, so it paints
     * nothing while it is in them (avatar's `image` while `error`). Styling
     * such a state identically to a visible one is correct, not lazy — the
     * difference is presence, and the runtime owns it. Read by the
     * state-legibility guard, which would otherwise need a hardcoded list of
     * the components that work this way. A non-empty subset of `states` when
     * present; absent for every part the runtime never hides.
     */
    hiddenIn?: readonly string[];
    tokens?: readonly string[];
    asChild?: boolean;
    /**
     * Present when the part renders no element of its own on the web and
     * projects onto a pseudo-element of another part (dialog's `backdrop` →
     * `popup`'s `::backdrop`). The web compiler composes
     * `[data-part="<of>"]<state fragments><selector>` — pseudo-element last,
     * because attributes can only narrow the host.
     */
    pseudo?: { of: string; selector: string };
    /** state/flag name → selector fragment (e.g. `open` → `[data-state="open"]`). */
    selectors: Record<string, string>;
}

/**
 * One model a component's API carries (zero's `ModelJSON`): what it binds
 * (`model`, or `model:<name>`), what seeds it (`default`), what it emits
 * (`change`), and whether it posts to a form. The two companion names follow
 * one rule — `default<Concept>` and `<concept>Change` — which
 * `mergeManifests` enforces on ecosystem fragments.
 */
export interface ManifestModel {
    /** The `model:<name>` key of a named model; absent for the unnamed `model`. */
    name?: string;
    /** The stem of both companions; a named model's concept is its name. */
    concept: string;
    /** A TypeScript type expression (`T` the item type on a generic root). */
    type: string;
    /** The compound member carrying it when not Root. */
    member?: string;
    /** The `multiple` prop makes it an array of the selectable value instead (`type` is the single-select shape; `T | null` → `T[]`). */
    multiple?: true;
    /** Posts under `name` (the form contract). */
    formControl?: true;
    /** `default<Concept>`. */
    default: string;
    /** `<concept>Change`. */
    change: string;
}

export interface ManifestComponent {
    scope: string;
    orientation?: boolean;
    parts: ManifestPart[];
    /** The models the API carries; absent when there are none (Card, Badge, …). */
    models?: ManifestModel[];
    /**
     * Present exactly on components merged from an ecosystem manifest
     * fragment (`mergeManifests`): the package that owns the scope. Zero's
     * own manifest never carries it — its absence is what marks a scope as
     * zero-origin, which the register artifact's compile gate and the
     * api-mode import specifiers both depend on.
     */
    package?: string;
}

/**
 * The part that carries the variant attributes (`data-color` etc.) — by
 * convention the part named `root`, else the first declared part. Pure
 * manifest logic (no target in it): the web recipe compiler anchors variant
 * selectors on it, and the components emitter adapts it.
 */
export function carrierPart(component: ManifestComponent): string {
    return component.parts.find((p) => p.name === 'root')?.name ?? component.parts[0]!.name;
}

export interface ZeroManifest {
    zeroVersion: string;
    tokens: {
        colors: {
            convention: { prefix: string; contentSuffix: string; softSuffix: string };
            required: string[];
            recommendedRoles: string[];
        };
        categories: TokenCategory[];
        /**
         * The recommended `size` axis ramp — what a design system gets by
         * default, not a closed set. Named like `colors.recommendedRoles` for
         * the same reason: both are defaults a design system may replace.
         */
        recommendedSizes: string[];
    };
    components: ManifestComponent[];
}
