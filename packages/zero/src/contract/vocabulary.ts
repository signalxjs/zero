/**
 * The augmentation seam — how a compiled design system types the app.
 *
 * `ZeroVocabulary` is empty here, so zero itself stays design-system-neutral.
 * A design system's GENERATED `/register` module (emitted by `sigx zero:build`,
 * never authored) augments it with the vocabulary its compiled CSS actually
 * answers to; one `import '@sigx/<ds>/register'` at the app's entry narrows
 * every scoped prop. No augmentation means no change for anyone: every
 * resolver falls back to the open union it replaced.
 */
import type { ColorValue, SizeScale } from './tokens.js';
import { TOKEN_CATEGORIES, tokenProperty } from './tokens.js';

/**
 * Extension point: a design system's generated `/register` module augments
 * this. Empty here — see the module doc above.
 */
export interface ZeroVocabulary {}

type Scoped<S extends string> =
    ZeroVocabulary extends { components: infer C } ? (S extends keyof C ? C[S] : never) : never;

/**
 * Three cases, and they must stay distinguishable:
 *   - no augmentation, or a component this design system never styled → Fallback
 *   - the axis is declared                                            → its literal union
 *   - the axis is declared EMPTY (nothing wired)                      → never, so any value errors
 *
 * The `[Scoped<S>] extends [never]` guard MUST come first. Testing the axis
 * result against `never` cannot separate case 1 from case 3 — both produce
 * `never` — so a guard-last formulation silently hands the open fallback to
 * exactly the components whose unwired axes should error (see
 * docs/architecture.md, "The register artifact").
 */
type AxisOf<S extends string, A extends string, Fallback> =
    [Scoped<S>] extends [never]
        ? Fallback
        : [A] extends [keyof Scoped<S>] ? Extract<Scoped<S>[A], string> : Fallback;

/** `color` for one component scope — today's open `ColorValue` until a register module narrows it. */
export type ColorValueFor<S extends string = string> = AxisOf<S, 'color', ColorValue>;

/** `size` for one component scope — today's open `SizeScale` until a register module narrows it. */
export type SizeScaleFor<S extends string = string> = AxisOf<S, 'size', SizeScale>;

/** `variant` for one component scope — open `string` until a register module narrows it. */
export type VariantValueFor<S extends string = string> = AxisOf<S, 'variant', string>;

/**
 * The `axes` bag for one component scope. Narrowed per axis once augmented;
 * an empty declared `axes` is `Record<string, never>` in the generated file,
 * so any entry errors rather than silently minting an attribute.
 */
export type AxesFor<S extends string = string> =
    [Scoped<S>] extends [never]
        ? Record<string, string>
        : Scoped<S> extends { axes: infer A }
            ? { [K in keyof A]?: Extract<A[K], string> }
            : Record<string, string>;

/**
 * The `mods` bag for one component scope — presence-only design-system
 * modifiers, rendered as `data-mod-<name>`.
 *
 * Same three-case shape as `AxesFor`, and for the same reason: unaugmented, or
 * a component this design system never styled, keeps the open bag; a design
 * system that declares no modifiers gets `Record<string, never>`, so any entry
 * errors rather than silently minting an attribute that matches nothing.
 *
 * Values are `boolean` rather than a literal union because a modifier has no
 * vocabulary — it is present or it is not. The value type is nonetheless
 * projected through `Extract<…, boolean>` rather than written as a flat
 * `boolean`: `keyof Record<string, never>` is `string`, so a hardcoded value
 * type would turn the empty case into an index signature accepting every
 * name — silently restoring exactly what `Record<string, never>` is there to
 * forbid. Extracting from the declared member keeps `never` as `never`.
 */
export type ModsFor<S extends string = string> =
    [Scoped<S>] extends [never]
        ? Record<string, boolean>
        : Scoped<S> extends { mods: infer M }
            ? { [K in keyof M]?: Extract<M[K], boolean> }
            : Record<string, boolean>;

type Wide<K extends string> =
    ZeroVocabulary extends Record<K, infer V> ? (V extends string ? V : never) : never;

/**
 * Theme names, CLOSED on the authoring surface — `setTheme('dimm')` becoming
 * an error is most of the value. Resolves to `string` while unaugmented.
 */
export type ZeroThemeName = [Wide<'theme'>] extends [never] ? string : Wide<'theme'>;

/**
 * Theme names on the LOOKUP surface — `getTheme`, `pairOf`, and anything a
 * value can reach without the app having typed it (persisted storage, a
 * runtime-registered tenant theme). Open with autocomplete: authoring is
 * closed; anything that round-trips through storage or the registry is not.
 */
export type ZeroThemeNameOrCustom = ZeroThemeName | (string & {});

/**
 * Custom-property names, open with autocomplete: the design system is not the
 * only writer — `--press-x/y/r` and friends are runtime-published, and an
 * app's own properties are legal. Closing this would reject valid code.
 */
export type ZeroProperty = Wide<'property'> | (string & {});

/** Breakpoint names, open with autocomplete — an app's own media queries are not confined to the ramp. */
export type ZeroBreakpoint = Wide<'breakpoint'> | (string & {});

/**
 * Breakpoint names on the AUTHORING surface — the closed twin of
 * {@link ZeroBreakpoint}, standing in the same relation to it as
 * {@link ZeroThemeName} does to {@link ZeroThemeNameOrCustom}.
 *
 * The open union is right where a value can arrive from outside the design
 * system (an app's own `cssVar('--x')` call); it is wrong as a RECORD KEY,
 * where `(string & {})` collapses the union and a misspelled breakpoint in
 * `gap={{ mdd: 'lg' }}` type-checks, renders an attribute and matches
 * nothing. That is exactly the silent-miss `variantAttrs` throws to prevent.
 *
 * The `[…] extends [never]` guard must come FIRST, for the reason `AxisOf`
 * documents above: testing the result against `never` cannot tell "no design
 * system registered" from "this one declared none", and a guard-last
 * formulation hands the open fallback to precisely the apps that did import
 * a `/register` module.
 */
export type ZeroBreakpointName = [Wide<'breakpoint'>] extends [never] ? string : Wide<'breakpoint'>;

/**
 * The scale-shaped token categories — `border` and `disabled-opacity` are
 * scalar (keyless) and excluded. Closed even unaugmented: declaring a new
 * category root is a hard kit error, so there is no open case to preserve.
 */
export type ZeroTokenCategory =
    Extract<typeof TOKEN_CATEGORIES[number], { shape: 'scale' }>['id'];

/** A category's recommended keys — literal, because TOKEN_CATEGORIES is `as const satisfies`. */
type RecommendedKeysOf<C extends ZeroTokenCategory> =
    Extract<typeof TOKEN_CATEGORIES[number], { id: C }>['recommended'][number];

/**
 * The fallback is the category's RECOMMENDED keys, not bare `string`:
 * unaugmented, `TokenKeyFor<'shadow'>` is `'xs' | … | 'xl' | (string & {})` —
 * the exact shape of `SizeScale` — so autocomplete works before any design
 * system opts in. A bare-`string` fallback would collapse the union and lose
 * the autocomplete half of "autocomplete-but-open".
 */
type TokenKeysOf<C extends ZeroTokenCategory> =
    ZeroVocabulary extends { tokens: infer T }
        ? (C extends keyof T ? Extract<T[C], string> : RecommendedKeysOf<C>)
        : RecommendedKeysOf<C>;

/** Token keys per category, open with autocomplete — an app may define `--shadow-hero` itself. */
export type TokenKeyFor<C extends ZeroTokenCategory> = TokenKeysOf<C> | (string & {});

/** `cssVar('--shadow-level3')` → `'var(--shadow-level3)'`, with the property union's autocomplete. */
export function cssVar(name: ZeroProperty): string {
    return `var(${name})`;
}

/**
 * `token('shadow', 'level3')` → `'var(--shadow-level3)'` — the category
 * supplies its prefix, the key autocompletes from the design system's
 * declared-plus-recommended set.
 */
export function token<C extends ZeroTokenCategory>(category: C, key: TokenKeyFor<C>): string {
    const found = TOKEN_CATEGORIES.find((c) => c.id === category)!;
    return `var(${tokenProperty(found, key)})`;
}
