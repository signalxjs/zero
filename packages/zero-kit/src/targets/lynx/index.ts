/**
 * The lynx emit target (#351): class-grammar selectors over the same anatomy
 * manifest, tokens and colors baked to literals lynx's engine parses, wired
 * into `runStandardBuild` via `targets: ['web', 'lynx']` (emits under
 * `dist/lynx/`, capability findings under `report.json`'s `lynx` key).
 */
export {
    CLASS_GRAMMAR_VERSION,
    HOST_CLASS,
    partClass,
    stateClass,
    flagClass,
    axisClass,
    modClass,
    orientationClass,
    placementClass,
    themeClass,
} from './class-names.js';
export type { LynxCapabilityReport, LynxFinding } from './capabilities.js';
export {
    INTERACTION_STATE_CLASSES,
    bakeColor,
    bakeColorValue,
    bakeSoft,
    emptyReport,
    foldConstantCalc,
    hasComparisonFunction,
    hasUnsupportedColorFunction,
    LynxRuntimePropertyError,
    runtimePropertyIn,
} from './capabilities.js';
export { STRUCTURAL_FALLBACKS, compileLynxTokensCss, lynxThemeColors } from './tokens-css.js';
export type { LynxThemeColors } from './recipe-css.js';
export { compileLynxRecipeCss } from './recipe-css.js';
export type { ChainVocabulary } from './calc-chains.js';
export { inlineCalcChains } from './calc-chains.js';
export type { CompiledLynxTarget, LynxTargetManifest } from './compile.js';
export { assertNoCalcVarChains, assertNoDanglingVars, compileDesignSystemLynx, writeLynxArtifacts } from './compile.js';
