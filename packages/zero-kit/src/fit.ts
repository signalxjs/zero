/**
 * Fit a recipe set to a design system's declared vocabulary —
 * `fitRecipesToVocabulary`.
 *
 * The scaffold (`@sigx/create-zero-ds`) starts every new design system from
 * `@sigx/zero-basic`'s recipes, and those recipes speak the recommended
 * vocabulary: the eight roles, the `xs…xl` ramp, `solid|outline|soft|ghost`,
 * and role tokens by name in a hundred-odd string values (`var(--color-primary)`
 * in a focus ring, `var(--color-error)` on an invalid field). A brief that
 * declares a different shape — `roles: {}`, `sizes: []`, a fused `variant`
 * vocabulary — makes every one of those an error under `validate`, and the
 * validator is right: they are promises the design system did not make.
 *
 * This helper closes the gap as DATA, not as text surgery on a 6000-line
 * file: it walks the recipes and keeps exactly what the declaration admits.
 * For the recommended shape it is the identity — pinned in `fit.test.ts`
 * against all six in-repo skins — so a design system that keeps the defaults
 * pays nothing for it. For a declining one the result is a monochrome,
 * ink-on-paper baseline: every role the tokens do not declare is redrawn in
 * `base-content` on `base-100`, which for a two-ink press or a no-colour-axis
 * system is the honest starting point. The brief's own Button recipe shows
 * where the inks get spent from there.
 *
 * Lives on the `/define` subpath because the generated `src/recipes.ts` calls
 * it at module scope: that module ships in the browser bundle, so this graph
 * may reach only relative modules (`ds-runtime-imports.test.ts` walks it).
 *
 * Deliberately NOT handled — `tokens.scopes` narrowing (a scope that narrows
 * still admits a value the union declares; the validator reports the
 * declined value, and the author decides which scope keeps it).
 */
import { TOKEN_CATEGORIES, resolveRoles, tokenProperty } from './contract.js';
import type { RecipeInput, RecipeTargetOverride } from './recipes.js';
import { tokenVocabulary } from './resolve/vocabulary.js';
import type { RolesDecl, SystemTokens, TokensInput } from './tokens.js';

/** What the fit changed, per rule — every count is a decision the author may want to revisit. */
export interface FitReport {
    /** `variants.color` values dropped because the role is not declared. */
    droppedColorValues: number;
    /** `variants.size` values dropped because they are off the declared ramp. */
    droppedSizeValues: number;
    /** `variants.variant` values dropped because they are outside the declared vocabulary. */
    droppedVariantValues: number;
    /** Custom-axis values dropped (axis undeclared, or value outside its list). */
    droppedAxisValues: number;
    /** `modifiers` entries dropped because the name is not declared. */
    droppedModifiers: number;
    /** `defaultVariants` entries dropped because their value no longer exists. */
    droppedDefaults: number;
    /**
     * `variants.variant` (or custom-axis) BLOCKS dropped whole because, after
     * filtering, they no longer covered the scope's declared vocabulary. A
     * block that wires some declared values and not others is the
     * ramp-with-a-hole `zero:audit` refuses (`axis-value-coverage/gap`, #422),
     * and claiming the rest with empty entries is refused too (only one value
     * may claim the base). So a fused vocabulary basic's badge never heard of
     * (riso's `key|spot|tint`) leaves badge with no variant axis at all —
     * honest: the axis is unwired until the author writes it, and the brief's
     * Button shows how. Colour and size never need this: a declared ramp
     * filters basic's blocks to exactly itself.
     */
    droppedVariantBlocks: number;
    /** `compoundVariants` entries dropped because a matched value no longer exists. */
    droppedCompounds: number;
    /** `var(--color-<role>…)` references rewritten to the base surfaces. */
    rewrittenRoleRefs: number;
    /** References to an undeclared step of a token category, collapsed to that category's resting step. */
    collapsedCategoryRefs: number;
    /** True when nothing changed — the recipes already fit the vocabulary. */
    identity: boolean;
}

type AnyTokens = TokensInput<RolesDecl, SystemTokens>;

/** The vocabulary the fit keeps, resolved once per call. */
interface Admits {
    roles: ReadonlySet<string>;
    /** Present when `tokens.sizes` is declared; undefined = any value keeps. */
    sizes: ReadonlySet<string> | undefined;
    variants: ReadonlySet<string> | undefined;
    axes: Readonly<Record<string, ReadonlySet<string>>> | undefined;
    modifiers: ReadonlySet<string> | undefined;
    /** `tokens.scopes` narrowings, per scope — a scope's own vocabulary wins over the design-system-wide one. */
    scopes: Readonly<Record<string, { variants?: ReadonlySet<string>; axes?: Readonly<Record<string, ReadonlySet<string>>> }>>;
    /** Every custom property a recipe may reference under this design system — the validator's own set. */
    names: ReadonlySet<string>;
}

/** The declared value set for `axis` on `scope`, or undefined when the axis is open (colour and size are handled by `keepsValue`). */
function declaredFor(admits: Admits, scope: string, axis: string): ReadonlySet<string> | undefined {
    if (axis === 'color' || axis === 'size') return undefined;
    const scoped = admits.scopes[scope];
    if (axis === 'variant') return scoped?.variants ?? admits.variants;
    return scoped?.axes?.[axis] ?? admits.axes?.[axis];
}

function admitsOf(tokens: AnyTokens): Admits {
    const t = tokens as {
        roles?: RolesDecl;
        sizes?: readonly string[];
        variants?: readonly string[];
        axes?: Record<string, readonly string[]>;
        modifiers?: readonly string[];
        scopes?: Record<string, { variants?: readonly string[]; axes?: Record<string, readonly string[]> }>;
    };
    const roles = resolveRoles(t.roles);
    return {
        roles: new Set(Object.keys(roles)),
        sizes: t.sizes ? new Set(t.sizes) : undefined,
        variants: t.variants ? new Set(t.variants) : undefined,
        axes: t.axes
            ? Object.fromEntries(Object.entries(t.axes).map(([axis, values]) => [axis, new Set(values)]))
            : undefined,
        modifiers: t.modifiers ? new Set(t.modifiers) : undefined,
        scopes: Object.fromEntries(Object.entries(t.scopes ?? {}).map(([scope, decl]) => [scope, {
            ...(decl.variants ? { variants: new Set(decl.variants) } : {}),
            ...(decl.axes ? { axes: Object.fromEntries(Object.entries(decl.axes).map(([axis, values]) => [axis, new Set(values)])) } : {}),
        }])),
        names: tokenVocabulary(tokens).names,
    };
}

/**
 * The step a category collapses to when a recipe names one the design system
 * never declared — `var(--ease-exit)` under a system that declares only the
 * recommended easings. Every entry is a recommended key, so it always
 * resolves (`@sigx/zero/css` ships the fallbacks), and each is the category's
 * resting step rather than its first: `standard` not `linear`, `normal` not
 * `instant`, `md` not `xs`. A ramp step is a *degree* of something, so the
 * honest substitute for an unknown degree is the middle one.
 */
const RESTING_STEP: Readonly<Record<string, string>> = {
    radius: 'field',
    size: 'field',
    font: 'sans',
    text: 'md',
    weight: 'normal',
    leading: 'normal',
    tracking: 'normal',
    space: 'md',
    shadow: 'md',
    duration: 'normal',
    ease: 'standard',
};

/** Whether one axis value survives — `undefined` sets mean "undeclared, anything keeps". */
function keepsValue(admits: Admits, scope: string, axis: string, value: string): boolean {
    if (axis === 'color') return admits.roles.has(value);
    if (axis === 'size') return admits.sizes?.has(value) ?? true;
    // A scope's own vocabulary (`tokens.scopes`) wins over the design-system-wide
    // one — daisyui's tabs wire `border|lift|box`, which the DS-wide set never lists.
    const declared = declaredFor(admits, scope, axis);
    if (axis === 'variant') return declared?.has(value) ?? true;
    if (!admits.axes && !admits.scopes[scope]?.axes) return true;
    return declared?.has(value) ?? false;
}

function keepsModifier(admits: Admits, name: string): boolean {
    return admits.modifiers?.has(name) ?? true;
}

/**
 * The reference grammar the rewrite recognises: `var(--<name>` followed by
 * `)` or a fallback comma. A role name may carry hyphens (Material's
 * `surface-container`), so the `-content` / `-soft` test below is a string
 * test on the whole name rather than a regex group.
 */
const TOKEN_REF = /var\((--[a-z0-9-]+)(?=[,)])/g;

interface Counters { roles: number; categories: number }

function rewriteRefs(value: string, admits: Admits, counters: Counters): string {
    return value.replace(TOKEN_REF, (whole, name: string) => {
        if (admits.names.has(name)) return whole;
        if (name.startsWith('--color-')) {
            const role = name.slice('--color-'.length);
            const replacement = role.endsWith('-content')
                ? 'base-100'
                : role.endsWith('-soft')
                    ? 'base-200'
                    : 'base-content';
            counters.roles += 1;
            return `var(--color-${replacement}`;
        }
        // A category step the design system never declared: collapse to the
        // resting step. Anything else — a component token the recipe itself
        // declares (`--btn-accent`), an app-supplied property read with a
        // fallback — is not this design system's to rewrite.
        const category = TOKEN_CATEGORIES.find((c) => c.shape === 'scale' && name.startsWith(c.prefix));
        const resting = category && RESTING_STEP[category.id];
        if (category && resting) {
            counters.categories += 1;
            return `var(${tokenProperty(category, resting)}`;
        }
        return whole;
    });
}

/** Deep-clone a JSON-shaped value, rewriting every string leaf. Keys are never touched. */
function rewriteStrings<T>(value: T, admits: Admits, counters: Counters): T {
    if (typeof value === 'string') return rewriteRefs(value, admits, counters) as T;
    if (Array.isArray(value)) return value.map((v) => rewriteStrings(v, admits, counters)) as T;
    if (value && typeof value === 'object') {
        const out: Record<string, unknown> = {};
        for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
            out[key] = rewriteStrings(inner, admits, counters);
        }
        return out as T;
    }
    return value;
}

type Sections = Pick<RecipeInput, 'variants' | 'modifiers' | 'compoundVariants' | 'defaultVariants'>;

/**
 * The structural half: drop what the vocabulary does not admit from one
 * section set (the shared recipe, or one of its per-target overrides).
 * Returns a new object; empty containers are removed rather than left as
 * `{}`, so an axis the fit emptied does not linger as a declared-but-empty
 * axis (which the validator would flag on its own).
 */
function fitSections<T extends Sections>(input: T, scope: string, admits: Admits, report: FitReport, shared: boolean): T {
    const out: Sections & Record<string, unknown> = { ...input };
    const droppedAxes = new Set<string>();

    if (input.variants) {
        const variants: NonNullable<RecipeInput['variants']> = {};
        for (const [axis, values] of Object.entries(input.variants)) {
            const kept: Record<string, Record<string, unknown>> = {};
            for (const [value, parts] of Object.entries(values)) {
                if (keepsValue(admits, scope, axis, value)) {
                    kept[value] = parts;
                } else if (axis === 'color') report.droppedColorValues += 1;
                else if (axis === 'size') report.droppedSizeValues += 1;
                else if (axis === 'variant') report.droppedVariantValues += 1;
                else report.droppedAxisValues += 1;
            }
            // A SHARED block that survives with fewer values than the scope's
            // vocabulary declares is dropped whole (see `droppedVariantBlocks`).
            // A per-target override is exempt: it deep-merges over the shared
            // block and legitimately restates one value (daisyui's tabs
            // restate `border` alone for lynx).
            const declared = shared ? declaredFor(admits, scope, axis) : undefined;
            const covers = !declared || [...declared].every((value) => kept[value] !== undefined);
            if (Object.keys(kept).length > 0 && !covers) {
                report.droppedVariantBlocks += 1;
                droppedAxes.add(axis);
                continue;
            }
            if (Object.keys(kept).length > 0) variants[axis] = kept as (typeof variants)[string];
        }
        if (Object.keys(variants).length > 0) out.variants = variants;
        else delete out.variants;
    }

    if (input.modifiers) {
        const modifiers: NonNullable<RecipeInput['modifiers']> = {};
        for (const [name, parts] of Object.entries(input.modifiers)) {
            if (keepsModifier(admits, name)) modifiers[name] = parts;
            else report.droppedModifiers += 1;
        }
        if (Object.keys(modifiers).length > 0) out.modifiers = modifiers;
        else delete out.modifiers;
    }

    if (input.compoundVariants) {
        const compounds = input.compoundVariants.filter((entry) => {
            const keeps = Object.entries(entry.match).every(([axis, value]) =>
                !droppedAxes.has(axis) && (value === true ? keepsModifier(admits, axis) : keepsValue(admits, scope, axis, value)));
            if (!keeps) report.droppedCompounds += 1;
            return keeps;
        });
        if (compounds.length > 0) out.compoundVariants = compounds;
        else delete out.compoundVariants;
    }

    if (input.defaultVariants) {
        const defaults: Record<string, string> = {};
        for (const [axis, value] of Object.entries(input.defaultVariants)) {
            // A default must name a value the recipe still wires: it was
            // written against the pre-fit set, so an axis the fit emptied
            // loses its default too.
            const wired = out.variants?.[axis]?.[value] !== undefined;
            if (wired) defaults[axis] = value;
            else report.droppedDefaults += 1;
        }
        if (Object.keys(defaults).length > 0) out.defaultVariants = defaults;
        else delete out.defaultVariants;
    }

    return out as T;
}

function fitRecipe(recipe: RecipeInput, admits: Admits, report: FitReport): RecipeInput {
    const fitted: RecipeInput = fitSections(recipe, recipe.component, admits, report, true);
    if (recipe.targets) {
        const targets: NonNullable<RecipeInput['targets']> = {};
        for (const [target, override] of Object.entries(recipe.targets) as [keyof NonNullable<RecipeInput['targets']>, RecipeTargetOverride][]) {
            targets[target] = fitSections(override, recipe.component, admits, report, false);
        }
        fitted.targets = targets;
    }
    const counters: Counters = { roles: 0, categories: 0 };
    const rewritten = rewriteStrings(fitted, admits, counters);
    report.rewrittenRoleRefs += counters.roles;
    report.collapsedCategoryRefs += counters.categories;
    return rewritten;
}

function emptyReport(): FitReport {
    return {
        droppedColorValues: 0,
        droppedSizeValues: 0,
        droppedVariantValues: 0,
        droppedAxisValues: 0,
        droppedModifiers: 0,
        droppedDefaults: 0,
        droppedVariantBlocks: 0,
        droppedCompounds: 0,
        rewrittenRoleRefs: 0,
        collapsedCategoryRefs: 0,
        identity: true,
    };
}

function run(recipes: readonly RecipeInput[], tokens: AnyTokens): { recipes: RecipeInput[]; report: FitReport } {
    const admits = admitsOf(tokens);
    const report = emptyReport();
    const fitted = recipes.map((recipe) => fitRecipe(recipe, admits, report));
    report.identity =
        report.droppedColorValues + report.droppedSizeValues + report.droppedVariantValues
            + report.droppedAxisValues + report.droppedModifiers + report.droppedDefaults
            + report.droppedCompounds + report.rewrittenRoleRefs + report.collapsedCategoryRefs
            + report.droppedVariantBlocks === 0;
    return { recipes: fitted, report };
}

/**
 * The recipes, fitted to what `tokens` declares. Pure: never mutates its
 * input, returns new objects throughout. The identity for recipes that
 * already speak the vocabulary — every in-repo skin round-trips deep-equal.
 */
export function fitRecipesToVocabulary<R extends RolesDecl, S extends SystemTokens>(
    recipes: readonly RecipeInput[],
    tokens: TokensInput<R, S>,
): RecipeInput[] {
    return run(recipes, tokens as AnyTokens).recipes;
}

/**
 * The fitted recipes AND what the fit cost, in one walk.
 *
 * `fitRecipesToVocabulary` and `explainFit` each throw away half of what the
 * same pass already computed, which is fine for a caller that wants one of
 * them and wasteful for ecosystem composition, which wants both for every
 * adopted pack.
 */
export function fitRecipes<R extends RolesDecl, S extends SystemTokens>(
    recipes: readonly RecipeInput[],
    tokens: TokensInput<R, S>,
): { recipes: RecipeInput[]; report: FitReport } {
    return run(recipes, tokens as AnyTokens);
}

/** What `fitRecipesToVocabulary` would change, without the recipes. */
export function explainFit<R extends RolesDecl, S extends SystemTokens>(
    recipes: readonly RecipeInput[],
    tokens: TokensInput<R, S>,
): FitReport {
    return run(recipes, tokens as AnyTokens).report;
}
