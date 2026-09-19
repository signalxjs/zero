/**
 * The authoring surface, importable from a browser graph —
 * `@sigx/zero-kit/define`.
 *
 * The kit's barrel is Node-only (`writeArtifacts` drags in `node:fs`), which
 * is why design-system packages may never value-import `@sigx/zero-kit` at
 * runtime — one such import externalizes the Node built-ins and takes every
 * browser consumer down. But the `define*` helpers are identity functions
 * with typing: nothing about them is Node-bound, and forcing DS modules to
 * reimplement their narrowing with `satisfies` (as zero-carbon and
 * zero-heroui did) means the authoring surface goes unused by its own
 * design systems.
 *
 * This subpath's module graph is `node:`-free BY CONTRACT —
 * `ds-runtime-imports.test.ts` walks it and fails on the first `node:`
 * import — so a design-system module in a package's runtime graph may
 * value-import it. Everything else (compilers, validators, artifacts, the
 * build harness) stays behind the Node-only barrel and `/build`.
 */
export type {
    ContrastPairDecl,
    CustomTokenDecl,
    RolesDecl,
    ScopeVocabulary,
    SystemTokens,
    ThemeColors,
    ThemeInput,
    ThemeSystem,
    TokenValue,
    TokensInput,
    TypographyDecl,
} from './tokens.js';
export { defineTokens } from './tokens.js';

export type { DerivePaletteOptions, DeriveThemePairOptions, Harmony, Oklch, RoleSeed } from './palette.js';
export { clampChroma, contrastRatio, derivePalette, deriveThemePair, formatOklch, solveContentLightness } from './palette.js';
export type { RoleDecl } from './contract.js';
export { axisRoles, isFillRole } from './contract.js';

export type { CssProps, PartStyles, RecipeContext, RecipeHooks, RecipeInput } from './recipes.js';
export { defineRecipe, HOOK_PSEUDO_ELEMENTS } from './recipes.js';

export { LAYOUT_SCOPES, layoutCss, layoutRecipes, layoutScopes } from './layout-recipes.js';
export type { TableStackPart } from './table-stack.js';
export { tableStackAt } from './table-stack.js';

export type { FitReport } from './fit.js';
export { explainFit, fitRecipes, fitRecipesToVocabulary } from './fit.js';

export type { CompoundVariantPatch, DerivedRecipe, DesignSystemDerivation, DesignSystemExtension, PartStylesPatch, Patch, RecipePatch, RecipeTargetPatch } from './extend.js';
export { extendDesignSystem, extendRecipe } from './extend.js';

// The fragment contract, for an ecosystem package's authoring code. Its
// `./fragment` runtime entry reads the constant from `@sigx/zero/contract`
// instead: the kit is a devDependency there.
export type { ManifestFragment } from './manifest.js';
export { FRAGMENT_VERSION } from './manifest.js';

export type { DesignSystemInput } from './design-system.js';
export { defineDesignSystem } from './design-system.js';

export type {
    ApiVocabulary,
    AxisApi,
    AxisApiFor,
    DesignSystemApi,
    DesignSystemApiFor,
    ModifierApi,
    ScopeApiOverride,
} from './api.js';
export { defineApi } from './api.js';
