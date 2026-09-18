/**
 * Derive a design system from another — `extendDesignSystem` and
 * `extendRecipe` (#60).
 *
 * A second recipe for a scope the base already styles is a hard error in
 * `compileDesignSystem`, and it should be: two recipes for one scope is a
 * cascade to debug, not a design decision to read. So a derived design
 * system must compile ONE recipe per scope, and the only way to get there
 * without forking a 6000-line `recipes.ts` is to patch the base's recipe as
 * data. These helpers are that patch, with the merge semantics written down
 * once rather than hand-rolled by every consumer that extends a skin.
 *
 * The merge rule, everywhere:
 *
 * - plain objects merge per key, recursively — a patch states only what it
 *   changes, and the base's reasoning (ink mixes, RTL guards, presence
 *   transitions) stays in force underneath;
 * - arrays and scalars replace;
 * - `null` deletes the key — a declaration, a state, a selector, a part, an
 *   axis value, a theme. The one way to UNDO something the base does,
 *   rather than countering it with a second declaration;
 * - `compoundVariants` are addressed by their `match`: a patch entry whose
 *   match equals a base entry's (same axes, same values) merges into it,
 *   any other is appended. An entry left with no parts is dropped;
 * - a recipe's `css` hatch concatenates (base first); `null` drops the base's;
 * - `targets.web` / `targets.lynx` are patched with the same rules.
 *
 * Lives on the `/define` subpath: a derived design system's source module is
 * in its package's runtime graph (the barrel re-exports `designSystem`), so
 * this graph may reach only relative modules (`ds-runtime-imports.test.ts`).
 *
 * Deliberately NOT here — declared public hooks on a skin (custom
 * properties, keyframes, pseudo-element parts a derived system may rely on)
 * and the validator warning for a patch that reaches a base's private name.
 * Tracked in #73; a patch can reference anything today, and whatever it
 * references is only as stable as the base's source.
 */
import type { DesignSystemApi } from './api.js';
import type { DesignSystemInput } from './design-system.js';
import { LAYOUT_SCOPES, layoutCss, layoutRecipes } from './layout-recipes.js';
import type { PartStyles, RecipeInput, RecipeTargetOverride } from './recipes.js';
import type { RolesDecl, SystemTokens, TokensInput } from './tokens.js';

/**
 * A deep patch of `T`: every object key optional, `null` deletes it, arrays
 * and scalars replace whole.
 */
export type Patch<T> =
    T extends readonly unknown[] ? T
    : T extends object ? { [K in keyof T]?: Patch<T[K]> | null }
    : T;

/** A patch of one part's styles — `base`, `states`, `selectors` and `at`, each per key. */
export type PartStylesPatch = Patch<PartStyles>;

/** A `compoundVariants` entry in a patch: addressed by `match`, merged per part. */
export interface CompoundVariantPatch {
    match: Record<string, string | true>;
    parts: Record<string, PartStylesPatch | null>;
}

/** What a per-target section of a patch may carry — the same surface, patched. */
export interface RecipeTargetPatch
    extends Patch<Omit<RecipeTargetOverride, 'compoundVariants' | 'css'>> {
    compoundVariants?: readonly CompoundVariantPatch[];
    css?: string | null;
}

/**
 * A patch of one recipe. `component` is optional and, when given, must name
 * the scope being patched — it exists so a patch can be written with
 * `defineRecipe`-style self-description, never to retarget a recipe.
 */
export interface RecipePatch extends Patch<Omit<RecipeInput, 'component' | 'compoundVariants' | 'css' | 'targets'>> {
    component?: string;
    compoundVariants?: readonly CompoundVariantPatch[];
    css?: string | null;
    targets?: { web?: RecipeTargetPatch | null; lynx?: RecipeTargetPatch | null };
}

/** What a derived design system changes about its base. */
export interface DesignSystemExtension {
    /** The derived design system's name — required; a derivation is its own system. */
    name: string;
    /**
     * Deep patch of the base's tokens: `system`, `custom`, `themes` and the
     * rest merge per key, the vocabulary arrays (`modifiers`, `variants`,
     * `sizes`) replace, and `null` removes — `themes: { light: null }` drops
     * a base theme.
     */
    tokens?: Patch<TokensInput>;
    /**
     * Patches to the base's recipes, keyed by scope. Patching a scope the base
     * does not style is an error (a typo would otherwise be a silent no-op) —
     * a new scope goes in `addRecipes`. `null` drops the base's recipe.
     */
    recipes?: Record<string, RecipePatch | null>;
    /**
     * Recipes for scopes the base does not style — an ecosystem fragment's
     * pack, the derived system's own components. A scope the base already
     * styles is an error: that is exactly the double recipe `recipes` exists
     * to avoid.
     */
    addRecipes?: readonly RecipeInput[];
    /** Raw CSS appended after the base's `css` entries. */
    css?: readonly string[];
    /**
     * The base's vendor-named `api`, patched (`null` drops it). Absent, the
     * base's api is carried unchanged.
     */
    api?: Patch<DesignSystemApi> | null;
}

type Plain = Record<string, unknown>;

const isPlain = (value: unknown): value is Plain =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/** `base[key]`, own properties only — `constructor` passes the scope grammar. */
const own = (record: Plain, key: string): unknown => (Object.hasOwn(record, key) ? record[key] : undefined);

function mergeValue(base: unknown, patch: unknown): unknown {
    if (patch === undefined) return base;
    if (isPlain(patch)) return mergeRecord(isPlain(base) ? base : {}, patch);
    return patch;
}

/** The merge rule: objects per key, recursively; `null` deletes; everything else replaces. */
function mergeRecord(base: Plain, patch: Plain): Plain {
    const out: Plain = { ...base };
    for (const [key, value] of Object.entries(patch)) {
        if (value === null) delete out[key];
        else if (value !== undefined) out[key] = mergeValue(own(base, key), value);
    }
    return out;
}

const sameMatch = (a: Record<string, string | true>, b: Record<string, string | true>): boolean => {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((k) => Object.hasOwn(b, k) && b[k] === a[k]);
};

function mergeCompounds(
    base: RecipeInput['compoundVariants'],
    patch: readonly CompoundVariantPatch[],
): NonNullable<RecipeInput['compoundVariants']> {
    const out = [...(base ?? [])];
    for (const entry of patch) {
        const at = out.findIndex((c) => sameMatch(c.match, entry.match));
        const parts = mergeRecord(at >= 0 ? out[at]!.parts : {}, entry.parts) as Record<string, PartStyles>;
        // The base entry keeps its own match object: key order is emission order.
        const merged = { match: at >= 0 ? out[at]!.match : { ...entry.match }, parts };
        if (at >= 0) out[at] = merged;
        else out.push(merged);
    }
    return out.filter((c) => Object.keys(c.parts).length > 0);
}

/**
 * The shared half of recipe and target patching: every section by the merge
 * rule, `compoundVariants` by match, `css` by concatenation.
 */
function patchSections<T extends RecipeTargetOverride>(base: T, patch: RecipeTargetPatch): T {
    const { compoundVariants, css, ...rest } = patch;
    const out = mergeRecord(base as Plain, rest as Plain) as T;
    if (compoundVariants) {
        const merged = mergeCompounds(base.compoundVariants, compoundVariants);
        if (merged.length > 0) out.compoundVariants = merged;
        else delete out.compoundVariants;
    }
    if (css === null) delete out.css;
    else if (css !== undefined) out.css = base.css ? `${base.css}\n${css}` : css;
    return out;
}

/**
 * `base` with `patch` applied — a new recipe; `base` is never mutated.
 * Subtrees the patch does not touch are shared with `base`, not copied.
 */
export function extendRecipe(base: RecipeInput, patch: RecipePatch): RecipeInput {
    const { component, targets, ...sections } = patch;
    if (component !== undefined && component !== base.component) {
        throw new Error(
            `[zero-kit] extendRecipe: a patch for "${component}" cannot apply to the "${base.component}" recipe`,
        );
    }
    const out = patchSections<RecipeInput>(base, sections);
    if (targets) {
        const merged: NonNullable<RecipeInput['targets']> = { ...base.targets };
        for (const target of ['web', 'lynx'] as const) {
            const section = targets[target];
            if (section === null) delete merged[target];
            else if (section !== undefined) merged[target] = patchSections(base.targets?.[target] ?? {}, section);
        }
        if (Object.keys(merged).length > 0) out.targets = merged;
        else delete out.targets;
    }
    return out;
}

const LAYOUT: ReadonlySet<string> = new Set(LAYOUT_SCOPES);

/**
 * A design system derived from `base`: its tokens and api patched, its
 * recipes patched per scope — one recipe per scope, always — and new ones
 * added.
 *
 * The layout tier is generated from tokens (`layoutRecipes`/`layoutCss`
 * read the roles, the spacing and measure keys and the breakpoints), so
 * where the base carries it unmodified it is regenerated from the DERIVED
 * tokens — the base's copy bakes in breakpoints and roles the derivation may
 * have changed. A base whose layout recipes differ from the generated ones
 * has customised them, and keeps its copy.
 */
export function extendDesignSystem<R extends RolesDecl, T extends SystemTokens>(
    base: DesignSystemInput<R, T>,
    extension: DesignSystemExtension,
): DesignSystemInput {
    const where = `[zero-kit] extendDesignSystem: "${extension.name}" (base "${base.name}")`;
    const baseTokens = base.tokens as TokensInput;
    const tokens = (extension.tokens ? mergeValue(baseTokens, extension.tokens) : baseTokens) as TokensInput;

    // Stale generations of the layout tier, keyed by what they were generated from.
    const regenerate = tokens !== baseTokens;
    const staleLayout = regenerate ? new Map(layoutRecipes(baseTokens).map((r) => [r.component, JSON.stringify(r)])) : undefined;
    const freshLayout = regenerate ? new Map(layoutRecipes(tokens).map((r) => [r.component, r])) : undefined;
    const staleLayoutCss = regenerate ? layoutCss(baseTokens) : undefined;

    const counts = new Map<string, number>();
    for (const recipe of base.recipes) counts.set(recipe.component, (counts.get(recipe.component) ?? 0) + 1);

    const patches = extension.recipes ?? {};
    for (const scope of Object.keys(patches)) {
        const count = counts.get(scope) ?? 0;
        if (count === 0) {
            throw new Error(`${where}: "${base.name}" has no recipe for "${scope}" to extend — a new scope goes in addRecipes`);
        }
        if (count > 1) {
            throw new Error(`${where}: "${base.name}" styles "${scope}" with ${count} recipes — there is no one recipe to patch`);
        }
    }

    const recipes: RecipeInput[] = [];
    for (const recipe of base.recipes) {
        const scope = recipe.component;
        let current = recipe;
        if (freshLayout && LAYOUT.has(scope) && staleLayout?.get(scope) === JSON.stringify(recipe)) {
            current = freshLayout.get(scope) ?? recipe;
        }
        if (!Object.hasOwn(patches, scope)) {
            recipes.push(current);
            continue;
        }
        const patch = patches[scope];
        if (patch === null) continue;
        if (patch !== undefined) recipes.push(extendRecipe(current, patch));
        else recipes.push(current);
    }

    const styled = new Set(recipes.map((r) => r.component));
    for (const recipe of extension.addRecipes ?? []) {
        if (styled.has(recipe.component)) {
            const already = counts.has(recipe.component) ? `"${base.name}" already styles it — patch it through recipes` : 'added twice';
            throw new Error(`${where}: addRecipes has a recipe for "${recipe.component}", but ${already}`);
        }
        styled.add(recipe.component);
        recipes.push(recipe);
    }

    const css = [
        ...(base.css ?? []).map((entry) => (staleLayoutCss !== undefined && entry === staleLayoutCss ? layoutCss(tokens) : entry)),
        ...(extension.css ?? []),
    ];

    const api = extension.api === null
        ? undefined
        : extension.api === undefined
            ? base.api
            : (mergeValue(base.api ?? {}, extension.api) as DesignSystemApi);

    return {
        name: extension.name,
        tokens,
        recipes,
        ...(css.length > 0 ? { css } : {}),
        ...(api ? { api } : {}),
    };
}
