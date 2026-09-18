// @sigx/zero-kit — design-system authoring for SignalX Zero.
//
// Typed tokens and recipes compiled to plain, layered CSS against the
// @sigx/zero anatomy manifest. Node-only; a built design system ships CSS
// and a tiny runtime module that imports only @sigx/zero.

export type {
    CustomTokenDecl,
    DurationKey,
    EaseKey,
    MotionDecl,
    FontKey,
    LeadingKey,
    RadiusKey,
    ShadowKey,
    SpaceKey,
    TrackingKey,
    TypographyDecl,
    WeightKey,
    RolesDecl,
    Scale,
    ScopeVocabulary,
    SizeKey,
    SystemTokens,
    TextKey,
    ThemeColors,
    ThemeInput,
    ThemeSystem,
    TokenValue,
    TokensInput,
} from './tokens.js';
export { defineTokens } from './tokens.js';
export { compileTokensCss } from './targets/web/tokens-css.js';

export type { TypeScale } from './scale.js';
export { generateTypeScale } from './scale.js';
export type { DerivePaletteOptions, DeriveThemePairOptions, Harmony, Oklch, RoleSeed } from './palette.js';
export { clampChroma, contrastRatio, derivePalette, deriveThemePair, formatOklch, solveContentLightness } from './palette.js';

export { LAYOUT_SCOPES, layoutCss, layoutRecipes, layoutScopes } from './layout-recipes.js';

export type { FitReport } from './fit.js';
export { explainFit, fitRecipes, fitRecipesToVocabulary } from './fit.js';

export type { CssProps, PartStyles, RecipeContext, RecipeInput } from './recipes.js';
export { defineRecipe, BUILTIN_CONDITIONS } from './recipes.js';
export { compileRecipeCss } from './targets/web/recipe-css.js';

export type {
    DesignSystemInput,
    CompiledDesignSystem,
    CompiledTheme,
    CompiledComponentAxes,
} from './design-system.js';
export type {
    ApiVocabulary,
    AxisApi,
    AxisApiFor,
    CompiledApiRoute,
    CompiledComponentApi,
    ConformanceGrade,
    DesignSystemApi,
    DesignSystemApiFor,
    MappedGrade,
    ModifierApi,
    ScopeApiOverride,
    ValidateApiOptions,
} from './api.js';
export {
    API_PROP_PATTERN,
    RESERVED_PROPS_BY_SCOPE,
    apiGrade,
    defineApi,
    deriveComponentApi,
    modifierGrade,
    scopeApi,
    validateApi,
} from './api.js';
export {
    compileComponentsDts,
    compileComponentsJs,
    componentExportName,
} from './targets/web/components-dts.js';
export { compileRegisterDts, compileRegisterJs } from './targets/web/register-dts.js';
export { axisClaims, defineDesignSystem, compileDesignSystem, externalPackage, offeredFor, undeclaredAxes } from './design-system.js';

export type {
    AuditContext,
    AuditFinding,
    AuditArtifact,
    AuditOptions,
    AuditResult,
    AuditRuleId,
    AuditSeverity,
    AuditSummary,
    AuditWaiver,
    Cell,
    Combo,
    ContrastCell,
    ContrastMatrix,
    ContrastOptions,
    ContrastVerdict,
    CssRule,
    IndicatorCell,
    IndicatorSpec,
    LegibilityCase,
    NodeSpec,
    RGB,
    ThemeEnv,
    UnmeasuredReason,
    WiredAxes,
} from './audit/index.js';
export {
    AA,
    AUDIT_RULES,
    AUDIT_SCHEMA_URL,
    AXIS_CELL_BUDGET,
    DISABLED_FLOOR,
    FLOOR,
    INDICATORS,
    NOT_RENDERED_ON_WEB,
    PAINT_ONLY_PART,
    REFERENCE_MEDIA,
    RULE_SEVERITY,
    UNMEASURED_REASONS,
    auditDesignSystem,
    buildAuditArtifact,
    axisCellsFor,
    axisTag,
    blend,
    buildAuditContext,
    buildContrastMatrix,
    cellKey,
    chainFor,
    clipCollapsed,
    colourBearingAxes,
    combosFor,
    compareFindings,
    contrast,
    contrastFindings,
    derivedChainAncestors,
    evaluateMedia,
    formatAudit,
    hasInk,
    indicatorAncestors,
    indicatorCellsFor,
    indicatorChains,
    luminance,
    parseColor,
    parseRules,
    resolveOver,
    restingCombos,
    textCells,
    themeEnvironments,
    uncoveredPaintParts,
} from './audit/index.js';

export type { ValidationIssue, ValidationResult } from './resolve/validate.js';
export { suggestContrastFix, validateDesignSystem } from './resolve/validate.js';

export type {
    ApiSurfaceReport,
    AxisDivergence,
    AxisReport,
    AxisStatus,
    ComponentReport,
    CoverageSplit,
    DesignSystemReport,
    PartReport,
    StyledComponentReport,
    ThemeContrastReport,
    ContrastReportTheme,
    UnstyledComponentReport,
} from './resolve/report.js';
export { buildReport, formatReport, summarizeContrast, REPORT_SCHEMA_URL } from './resolve/report.js';
export type { AuditCounts, ReportScore, ScoreCriterion, ScoreExtras, ScoreGrade } from './resolve/score.js';
export type { Delta, PairDelta, ReportDiff } from './resolve/report-diff.js';
export { diffReports, formatReportDiff } from './resolve/report-diff.js';
export type { IterationEntry, IterationEntryInput } from './resolve/iteration.js';
export { formatIterationLine, formatIterationLog, isIterationEntry, iterationEntryFrom, whereFamily } from './resolve/iteration.js';
export { auditScore, computeScore, formatScore, gradeFor, pairScore, SCORE_WEIGHTS } from './resolve/score.js';

export type {
    ConformanceFixtureInput,
    ConformanceRow,
    ConformanceSource,
    ConformanceVocabulary,
    SurfaceKind,
} from './resolve/conformance.js';
export { conformanceRows, formatConformanceMatrix, reportRows } from './resolve/conformance.js';

export type { TokenVocabulary } from './resolve/vocabulary.js';
export { tokenVocabulary } from './resolve/vocabulary.js';
export { validateRecipes } from './resolve/validate-recipes.js';

export { buildDsManifest, writeArtifacts, DS_MANIFEST_VERSION } from './artifacts.js';
export type { DesignSystemManifest } from './artifacts.js';

export type { StandardBuildLogger, StandardBuildOptions, StandardBuildResult } from './build.js';
export { runStandardBuild } from './build.js';

export type { ManifestFragment } from './manifest.js';
export { attributeFindings, mergeManifests, packagesByScope, whereWithOwner, FRAGMENT_VERSION } from './manifest.js';

export { ECOSYSTEM_ENV, ECOSYSTEM_FIELD, declarationFor, discoverEcosystem, exportedSubpath, installedPackageDir, nearestPackageDir, packFromModule, resolveEcosystem, satisfiesKitRange, selectDependencies, selfDeclaration, zeroKitVersion } from './discover.js';
export type { EcosystemDeclaration, EcosystemLogger, EcosystemOptions, EcosystemPack, ResolvedEcosystem, ResolveEcosystemInput } from './discover.js';

export type {
    RoleDecl,
    RecommendedRole,
    RecommendedSize,
    SizeScale,
    BaseSurfaceToken,
    TokenCategory,
    TokenCategoryId,
    TokenCategoryShape,
    TokenSyntax,
    ManifestPart,
    ManifestComponent,
    ZeroManifest,
} from './contract.js';
export {
    RECOMMENDED_ROLE_LIST,
    DEFAULT_ROLES,
    // Exported so a design system can extend the recommended ramp rather than
    // retype it: `sizes: [...SIZE_SCALE_LIST, '2xl']`.
    SIZE_SCALE_LIST,
    BASE_SURFACE_TOKEN_LIST,
    LAYER_ORDER_STATEMENT,
    TOKEN_CATEGORIES,
    TOKEN_KEY_PATTERN,
    AXIS_VALUE_PATTERN,
    TEXT_FIXED_PREFIX,
    ROLE_NAME_PATTERN,
    RESERVED_ROLE_NAMES,
    tokenProperty,
    carrierPart,
    defaultSwatch,
    resolveRoles,
    isFillRole,
    axisRoles,
    systemNodeAt,
    requiredColorTokens,
    contrastPairs,
    INTERACTION_STATES,
    VARIANT_AXES,
    RESERVED_AXES,
    RUNTIME_PROPERTIES,
    MEDIUM_PROPERTIES,
} from './contract.js';
