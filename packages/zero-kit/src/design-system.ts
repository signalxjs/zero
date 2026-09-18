/**
 * Design-system assembly: tokens + recipes (+ optional raw CSS) compiled
 * into the artifacts a DS package ships — per-component CSS files, a
 * combined index, and theme metadata for the runtime registry.
 */
import type { ManifestComponent, RoleDecl, ZeroManifest } from './contract.js';
import { DEFAULT_ROLES, defaultSwatch, resolveRoles, resolveSizes } from './contract.js';
import type { CompiledComponentApi, DesignSystemApi } from './api.js';
import { deriveComponentApi, scopeApi } from './api.js';
import type { CustomTokenDecl, RolesDecl, ScopeVocabulary, SystemTokens, TokensInput } from './tokens.js';
import { compileTokensCss } from './targets/web/tokens-css.js';
import type { RecipeInput } from './recipes.js';
import { resolveRecipeForTarget } from './recipes.js';
import { compileRecipeCss } from './targets/web/recipe-css.js';

export interface DesignSystemInput<
    R extends RolesDecl = RolesDecl,
    T extends SystemTokens = SystemTokens,
> {
    name: string;
    tokens: TokensInput<R, T>;
    recipes: RecipeInput[];
    /** Raw CSS appended verbatim after the compiled recipes (escape hatch). */
    css?: string[];
    /**
     * Vendor-named component API: how zero's axes surface on this design
     * system's `./components` module (issue #179). Validated against the
     * declared vocabulary; grades for the conformance matrix derive from it.
     */
    api?: DesignSystemApi;
}

/** Identity with typing — the authoring entry point. */
export function defineDesignSystem<
    const R extends RolesDecl = typeof DEFAULT_ROLES,
    const T extends SystemTokens = SystemTokens,
>(input: DesignSystemInput<R, T>): DesignSystemInput<R, T> {
    return input;
}

export interface CompiledTheme {
    name: string;
    colorScheme: 'light' | 'dark';
    pair?: string;
    swatch: Record<string, string>;
}

/**
 * The axis vocabulary one component's recipe actually wires — `variants`
 * keys unioned with every `compoundVariants[].match` value, since the
 * compiler emits CSS for both and a generated type must cover everything the
 * CSS matches. An absent axis is an empty array (the register generator
 * emits it as `never`).
 */
export interface CompiledComponentAxes {
    color: string[];
    size: string[];
    variant: string[];
    /** Custom axes: axis name → wired values. */
    axes: Record<string, string[]>;
    /** Presence-only modifiers this recipe wires — rendered `data-mod-<name>`. */
    mods: string[];
    /**
     * The recipe's `defaultVariants`, validated against the wired sets in
     * `validateRecipes`. Manifest/docs only — never widens a union.
     */
    defaults?: Record<string, string>;
    /**
     * The vocabulary this scope OFFERS — its `tokens.scopes` entry, resolved
     * against the design-system-wide union (#294). Present only when the scope
     * restricts something, so a design system that declares no `scopes` emits
     * a byte-identical manifest.
     *
     * Distinct from every sibling field above, which is what the recipe
     * WIRES: `offered` is the promise, those are the delivery, and the gap
     * between them is a finding.
     *
     * Resolved here rather than left to each reader: the playground and the
     * e2e specs both want "what may this scope render", and a second
     * hand-derivation is how a mirror drifts.
     */
    offered?: {
        color?: string[];
        size?: string[];
        variant?: string[];
        axes?: Record<string, string[]>;
        mods?: string[];
    };
}

/**
 * The ecosystem package owning `scope`, or `undefined` when zero ships it.
 *
 * The one read path for `externalScopes`, so no caller has to remember that
 * `constructor` passes the scope grammar — a plain index lookup for it
 * returns an inherited value and reports a first-party scope as foreign.
 */
export function externalPackage(compiled: Pick<CompiledDesignSystem, 'externalScopes'>, scope: string): string | undefined {
    const owners = compiled.externalScopes;
    return owners && Object.hasOwn(owners, scope) ? owners[scope] : undefined;
}

export interface CompiledDesignSystem {
    name: string;
    tokensCss: string;
    /** component scope → compiled recipe CSS. */
    componentCss: Record<string, string>;
    /** tokens + all components + raw css, in order. */
    indexCss: string;
    themes: CompiledTheme[];
    /** scope → the axis vocabulary the recipes actually wire. */
    components: Record<string, CompiledComponentAxes>;
    /**
     * Styled scopes whose anatomy came from an ecosystem manifest fragment
     * rather than zero's registry: scope → the owning package (the fragment's
     * `package`, stamped by `mergeManifests`). Present only when non-empty, so
     * a design system compiled against the stock manifest is unchanged. The
     * register artifact excludes exactly these scopes from its ZeroScope
     * compile gate, and the api emitters import them from the owning package
     * instead of `@sigx/zero/<scope>`.
     */
    externalScopes?: Record<string, string>;
    /**
     * scope → the vendor-named API filtered to what that scope wires —
     * present iff the design system declares an `api` (issue #179). Part of
     * the compiled form (rather than a `writeArtifacts` parameter, the shape
     * the report took) so the manifest, the emitters and the CLI all read one
     * derivation.
     */
    componentApi?: Record<string, CompiledComponentApi>;
    /** The DS's declared token vocabulary — emitted into the DS manifest. */
    tokens: {
        roles: Record<string, RoleDecl>;
        /** The DS's `size` axis vocabulary, resolved (declared, else recommended). */
        sizes: string[];
        /**
         * The DS's declared `variant` axis vocabulary ([] when undeclared OR
         * declared out of existence — `variantsDeclared` tells the two apart).
         */
        variants: string[];
        /**
         * Whether `tokens.variants` was stated at all. `variants: []` is the
         * claim "this design system has no variant axis" (#200/#295), the
         * grammar `sizes: []` uses; an omitted key is only silence. The
         * resolved list alone cannot carry that difference, since the
         * recommended default for `variants` is nothing rather than a ramp.
         */
        variantsDeclared: boolean;
        /** Declared custom variant axes: axis name → values ({} when undeclared). */
        axes: Record<string, string[]>;
        /** Declared presence-only modifiers ([] when undeclared). */
        modifiers: string[];
        /**
         * Per-scope restrictions of the vocabularies above ({} when none are
         * declared) — which is what makes them the UNION of every scope's
         * vocabulary rather than one vocabulary every scope shares (#294).
         */
        scopes: Record<string, ScopeVocabulary>;
        custom: Record<string, CustomTokenDecl>;
        breakpoints: Record<string, string>;
        /** DS-level values per category id, e.g. `{ radius: { field: '0.5rem' } }`. */
        system: Record<string, unknown>;
        /** Overrides applied to dark-scheme themes. */
        systemDark: Record<string, unknown>;
        /**
         * Every custom property this design system emits, flat and sorted —
         * what editor completion, the docs site and cross-platform emitters
         * want, rather than re-deriving it from the grammar.
         */
        properties: string[];
    };
}

/**
 * Every custom property the compiled tokens.css defines, sorted and deduped.
 *
 * Read back off the emitted CSS rather than re-derived from the declaration,
 * so it cannot drift from what the design system actually ships — including
 * derived tokens like `--color-<role>-soft` that no declaration lists.
 */
function emittedProperties(tokensCss: string): string[] {
    const found = new Set<string>();
    for (const [, prop] of tokensCss.matchAll(/^\s*(--[\w-]+)\s*:/gm)) found.add(prop!);
    return [...found].sort();
}

/** The wired-axis harvest for one recipe — see `CompiledComponentAxes`. */
function harvestAxes(recipe: RecipeInput): CompiledComponentAxes {
    const byAxis = new Map<string, Set<string>>();
    for (const [axis, values] of Object.entries(recipe.variants ?? {})) {
        byAxis.set(axis, new Set(Object.keys(values)));
    }
    // `true` in a match is a modifier, not an axis value — it must not be
    // harvested as one, or the generated types would offer the string "true".
    const mods = new Set(Object.keys(recipe.modifiers ?? {}));
    for (const compound of recipe.compoundVariants ?? []) {
        for (const [axis, value] of Object.entries(compound.match)) {
            if (value === true) {
                mods.add(axis);
                continue;
            }
            let set = byAxis.get(axis);
            if (!set) byAxis.set(axis, (set = new Set()));
            set.add(value);
        }
    }
    const take = (axis: string): string[] => {
        const values = [...(byAxis.get(axis) ?? [])];
        byAxis.delete(axis);
        return values;
    };
    const result: CompiledComponentAxes = {
        color: take('color'),
        size: take('size'),
        variant: take('variant'),
        axes: Object.fromEntries([...byAxis.entries()].map(([axis, values]) => [axis, [...values]])),
        mods: [...mods],
    };
    if (recipe.defaultVariants && Object.keys(recipe.defaultVariants).length > 0) {
        result.defaults = { ...recipe.defaultVariants };
    }
    return result;
}

/**
 * Axes this design system has declared OUT OF EXISTENCE, as opposed to merely
 * left unwired.
 *
 * The distinction matters in the diagnostic: "no recipe wires it" tells an
 * author to go wire one, which is wrong advice when there is no axis to wire.
 *
 * Every named axis can be declared away, and only by an *explicitly empty*
 * declaration: `resolveRoles(undefined)` yields the recommended eight and
 * `resolveSizes(undefined)` the recommended ramp, so an empty result there
 * can only have come from `roles: {}` or `sizes: []`. `variant` has no
 * recommended default — `compileDesignSystem` normalises an OMITTED
 * `tokens.variants` to `[]` as well — so the resolved list alone cannot say
 * which of its two meanings an empty `variant` has, and `variantsDeclared`
 * carries the difference (#200/#295): `variants: []` is the claim "no variant
 * axis"; omission means "declared nothing, check nothing", and treating that
 * as out-of-existence would mislabel every unwired `variant` in a design
 * system that simply never declared the vocabulary — the exact error this
 * function exists to avoid, pointed the other way.
 *
 * Target-neutral, and shared: `compileRegisterDts` picks the `never` doc
 * comment from it, and `buildReport` names the same axes. Two readers of one
 * predicate, so the report and the register artifact cannot disagree — which is
 * the gate the conformance program (docs/architecture.md §7) puts on the
 * report.
 */
export function undeclaredAxes(compiled: CompiledDesignSystem, scope?: string): ReadonlySet<string> {
    const out = new Set<string>();
    if (Object.keys(compiled.tokens.roles).length === 0) out.add('color');
    if (compiled.tokens.sizes.length === 0) out.add('size');
    if (compiled.tokens.variantsDeclared && compiled.tokens.variants.length === 0) out.add('variant');
    // A scope may declare an axis out of existence FOR ITSELF, with the same
    // empty-list grammar (#294): `variants: []` on a scope is the same positive
    // claim the design-system-wide declaration makes, scoped to one component.
    const offered = scope ? compiled.components[scope]?.offered : undefined;
    if (offered) {
        if (offered.color?.length === 0) out.add('color');
        if (offered.size?.length === 0) out.add('size');
        if (offered.variant?.length === 0) out.add('variant');
    }
    return out;
}

/**
 * Who claims which values of one axis, per the declared per-scope
 * vocabularies (#294).
 *
 * `unrestricted` is true when at least one STYLED scope declares no
 * restriction for the axis: its vocabulary is the whole union, so no value can
 * be "claimed by nobody" and the unclaimed diagnostic must stay silent.
 *
 * Exported and shared for the same reason `undeclaredAxes` is — the recipe
 * validator's unclaimed warning and `axis-value-coverage.test.ts`'s rule C
 * both read it, so the two cannot disagree about what counts.
 */
export function axisClaims(compiled: CompiledDesignSystem, axis: string): {
    byScope: ReadonlyMap<string, readonly string[]>;
    claimed: ReadonlySet<string>;
    unrestricted: boolean;
} {
    const byScope = new Map<string, readonly string[]>();
    const claimed = new Set<string>();
    let unrestricted = false;
    for (const [scope, wired] of Object.entries(compiled.components)) {
        const own = offeredFor(wired, axis);
        if (own === undefined) {
            unrestricted = true;
            continue;
        }
        byScope.set(scope, own);
        for (const value of own) claimed.add(value);
    }
    return { byScope, claimed, unrestricted };
}

/**
 * The values one scope offers for one axis — `undefined` when it declared no
 * restriction, `[]` when it declared the axis out of existence for itself.
 * Keyed by the axis name a recipe wires (`color` / `size` / `variant` / a
 * custom axis / `mods`), not by the `tokens.scopes` spelling.
 */
export function offeredFor(wired: CompiledComponentAxes, axis: string): readonly string[] | undefined {
    const offered = wired.offered;
    if (!offered) return undefined;
    if (axis === 'color') return offered.color;
    if (axis === 'size') return offered.size;
    if (axis === 'variant') return offered.variant;
    if (axis === 'mods') return offered.mods;
    return offered.axes?.[axis];
}

export function compileDesignSystem<R extends RolesDecl, T extends SystemTokens>(
    ds: DesignSystemInput<R, T>,
    manifest: Pick<ZeroManifest, 'components'>,
): CompiledDesignSystem {
    const byScope = new Map<string, ManifestComponent>(
        manifest.components.map((c) => [c.scope, c]),
    );

    const tokensCss = compileTokensCss(ds.tokens);

    const componentCss: Record<string, string> = {};
    const components: Record<string, CompiledComponentAxes> = {};
    for (const recipe of ds.recipes) {
        const component = byScope.get(recipe.component);
        if (!component) {
            const known = [...byScope.keys()].join(', ');
            throw new Error(
                `[zero-kit] design system "${ds.name}" has a recipe for unknown component "${recipe.component}" (known: ${known})`,
            );
        }
        if (componentCss[recipe.component]) {
            throw new Error(`[zero-kit] duplicate recipe for component "${recipe.component}"`);
        }
        // The web view of the recipe: shared sections + targets.web merged.
        // Axes are harvested from the same view — what the web CSS matches is
        // what the register artifact must type.
        const resolved = resolveRecipeForTarget(recipe, 'web');
        componentCss[recipe.component] = compileRecipeCss(resolved, component, {
            breakpoints: ds.tokens.breakpoints,
        });
        components[recipe.component] = harvestAxes(resolved);
    }

    // The declared side of each scope, resolved against the union and attached
    // beside the harvest. Only for scopes that actually restrict something —
    // an undeclaring design system's manifest is unchanged byte for byte.
    const scopeVocabularies = ds.tokens.scopes ?? {};
    for (const [scope, axes] of Object.entries(components)) {
        const own = scopeVocabularies[scope];
        if (!own) continue;
        const offered: NonNullable<CompiledComponentAxes['offered']> = {};
        if (own.colors) offered.color = [...own.colors];
        if (own.sizes) offered.size = [...own.sizes];
        if (own.variants) offered.variant = [...own.variants];
        if (own.axes) {
            offered.axes = Object.fromEntries(
                Object.entries(own.axes).map(([axis, values]) => [axis, [...values]]),
            );
        }
        if (own.modifiers) offered.mods = [...own.modifiers];
        if (Object.keys(offered).length > 0) axes.offered = offered;
    }

    const rawCss = (ds.css ?? []).join('\n');
    const indexCss = [
        `/* ${ds.name} — generated by @sigx/zero-kit. Do not edit. */`,
        tokensCss,
        ...Object.values(componentCss),
        ...(rawCss ? [`@layer zero.recipes {\n${rawCss}\n}`] : []),
    ].join('\n');

    const roles = resolveRoles(ds.tokens.roles);
    const swatch = ds.tokens.swatch ?? defaultSwatch(Object.keys(roles));
    const themes: CompiledTheme[] = Object.entries(ds.tokens.themes).map(([name, theme]) => {
        const colors = theme.colors as Record<string, string>;
        return {
            name,
            colorScheme: theme.colorScheme,
            ...(theme.pair ? { pair: theme.pair } : {}),
            swatch: Object.fromEntries(
                swatch.flatMap((t) => (colors[t] ? [[t, colors[t]]] : [])),
            ),
        };
    });

    // Provenance survives compilation: a styled scope whose manifest entry
    // names an owning package is external, and downstream emitters read the
    // fact from the compiled form rather than re-consulting the manifest.
    // Null prototype. The scope grammar is lowercase, which rules out
    // `toString` and the rest — but `constructor` passes it, and on a plain
    // object a lookup for that one returns something inherited and truthy, so
    // a scope zero ships would be reported as owned by a function.
    const externalScopes: Record<string, string> = Object.create(null) as Record<string, string>;
    for (const scope of Object.keys(components)) {
        const pkg = byScope.get(scope)?.package;
        if (pkg) externalScopes[scope] = pkg;
    }

    const componentApi = ds.api
        ? Object.fromEntries(
            Object.entries(components).map(([scope, axes]) => [
                scope,
                // Per-scope overrides resolve HERE, once — the emitters, the
                // manifest and the runtime spec all read the same merge.
                deriveComponentApi(scopeApi(ds.api!, scope), axes, byScope.get(scope)!),
            ]),
        )
        : undefined;

    return {
        name: ds.name,
        tokensCss,
        componentCss,
        indexCss,
        themes,
        components,
        ...(Object.keys(externalScopes).length > 0 ? { externalScopes } : {}),
        ...(componentApi ? { componentApi } : {}),
        tokens: {
            roles,
            sizes: [...resolveSizes(ds.tokens.sizes)],
            variants: [...(ds.tokens.variants ?? [])],
            variantsDeclared: ds.tokens.variants !== undefined,
            axes: Object.fromEntries(
                Object.entries(ds.tokens.axes ?? {}).map(([axis, values]) => [axis, [...values]]),
            ),
            modifiers: [...(ds.tokens.modifiers ?? [])],
            scopes: Object.fromEntries(
                Object.keys(scopeVocabularies).sort().map((scope) => [scope, scopeVocabularies[scope]!]),
            ),
            custom: ds.tokens.custom ?? {},
            breakpoints: ds.tokens.breakpoints ?? {},
            system: (ds.tokens.system ?? {}) as Record<string, unknown>,
            systemDark: (ds.tokens.systemDark ?? {}) as Record<string, unknown>,
            properties: emittedProperties(tokensCss),
        },
    };
}
