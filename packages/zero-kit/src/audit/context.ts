/**
 * What every audit rule reads, built once per run.
 *
 * The rules judge the ARTIFACT — the compiled CSS — not the recipe tree, for
 * the reason the state-legibility guard's docblock gives: state styling
 * reaches the stylesheet through seven doors (`states`, `selectors`,
 * `variants.*`, `compoundVariants`, `modifiers`, nested `at`, raw `css`) and
 * only the emitted CSS sees all of them. So the context compiles the design
 * system once (or takes a caller's compile), parses each scope's CSS once,
 * and hands every rule the same parsed rules, the same manifest and the same
 * recipes (which carry the one waiver the CSS cannot: `skipStates`).
 */
import type { ManifestComponent, ZeroManifest } from '../contract.js';
import type { CompiledDesignSystem, DesignSystemInput } from '../design-system.js';
import { compileDesignSystem } from '../design-system.js';
import type { RecipeInput } from '../recipes.js';
import type { CssRule } from './css-rules.js';
import { parseRules } from './css-rules.js';

export interface AuditContext {
    name: string;
    ds: DesignSystemInput;
    manifest: Pick<ZeroManifest, 'components'>;
    compiled: CompiledDesignSystem;
    /** scope → its anatomy, for the scopes the manifest declares. */
    components: ReadonlyMap<string, ManifestComponent>;
    /** scope → the recipe that styles it, for the scopes that have one. */
    recipes: ReadonlyMap<string, RecipeInput>;
    /** scope → the parsed rules of its compiled CSS, for the scopes that emit any. */
    cssRules: ReadonlyMap<string, readonly CssRule[]>;
}

export function buildAuditContext(
    ds: DesignSystemInput,
    manifest: Pick<ZeroManifest, 'components'>,
    compiled: CompiledDesignSystem = compileDesignSystem(ds, manifest),
): AuditContext {
    const components = new Map(manifest.components.map((c) => [c.scope, c]));
    const recipes = new Map<string, RecipeInput>();
    // First recipe per scope wins here. `compileDesignSystem` never faces the
    // question — it THROWS on a duplicate (`design-system.ts`) — so this map
    // is defensive rather than a mirror of it. Ecosystem composition is what
    // keeps a duplicate from reaching either: a discovered recipe for a scope
    // the design system already styles is dropped before the build sees it.
    for (const recipe of ds.recipes) {
        if (!recipes.has(recipe.component)) recipes.set(recipe.component, recipe);
    }
    const cssRules = new Map<string, readonly CssRule[]>();
    for (const [scope, css] of Object.entries(compiled.componentCss)) cssRules.set(scope, parseRules(css));
    return { name: ds.name, ds, manifest, compiled, components, recipes, cssRules };
}

/**
 * The scopes a rule can judge: in the manifest, with a recipe, and with CSS.
 *
 * A component with no recipe is a DIFFERENT failure the validator already
 * warns about ("will render unstyled"); conflating the two would make every
 * rule fail for a reason it was not built to catch.
 */
export function styledScopes(ctx: AuditContext): Array<{
    scope: string;
    component: ManifestComponent;
    recipe: RecipeInput;
    rules: readonly CssRule[];
}> {
    const out: Array<{ scope: string; component: ManifestComponent; recipe: RecipeInput; rules: readonly CssRule[] }> = [];
    for (const component of ctx.manifest.components) {
        const recipe = ctx.recipes.get(component.scope);
        const rules = ctx.cssRules.get(component.scope);
        if (!recipe || !rules) continue;
        out.push({ scope: component.scope, component, recipe, rules });
    }
    return out;
}
