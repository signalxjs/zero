/**
 * The REAL generated artifact, type-checked end to end: `material.register.d.ts`
 * in this directory is the golden emitted by `compileRegisterDts` for
 * `@sigx/zero-material` (kept current by `register-dts.test.ts`), and this
 * probe asserts the register-generation gate against it — `tertiary`
 * autocompleted and accepted, `primry` rejected, `token('shadow', 'level3')`
 * narrowed by Material's elevation ramp, theme names closed on the authoring
 * surface. It also re-states the file's scope-validity assertion in a `.ts`,
 * which `skipLibCheck` cannot skip, and is the augmentation-binding check for
 * the emitted file (docs/architecture.md, "The register artifact"): the
 * augmentation targets `@sigx/zero`
 * and must merge through the re-export.
 */
import type {
    AxesFor,
    ColorValueFor,
    SizeScaleFor,
    ThemeController,
    VariantValueFor,
    ZeroScope,
    ZeroThemeName,
    ZeroVocabulary,
} from '@sigx/zero';
import type { Equal, MustBeTrue } from '../assert.js';

// ── the §9 phase-3 gate, verbatim ──
const tertiary: ColorValueFor<'button'> = 'tertiary';
// @ts-expect-error — a typo is rejected under material's register module
const typo: ColorValueFor<'button'> = 'primry';

// Material's shadow union is the recommended ramp AND the elevation levels.
export type _shadowRamp = MustBeTrue<Equal<
    ZeroVocabulary['tokens']['shadow'],
    'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'level1' | 'level2' | 'level3' | 'level4' | 'level5'
>>;
// Its easings include the two Material-specific curves.
export type _easings = MustBeTrue<
    'emphasized-decelerate' extends ZeroVocabulary['tokens']['ease'] ? true : false
>;

// ── theme names close on the authoring surface ──
export type _themesClosed = MustBeTrue<Equal<ZeroThemeName, 'material' | 'material-dark'>>;
export type _setThemeClosed = MustBeTrue<Equal<
    Parameters<ThemeController['setTheme']>[0],
    'material' | 'material-dark' | null
>>;

// ── the property union carries the emitted specials ──
export type _propertyHasLevels = MustBeTrue<
    '--shadow-level3' extends ZeroVocabulary['property'] ? true : false
>;

// ── material wires button fully; its filtered role set excludes the tonal
//    surfaces (9 of 13 roles — harvest-from-compiled, not from declaration) ──
const buttonVariant: VariantValueFor<'button'> = 'ghost';
const buttonSize: SizeScaleFor<'button'> = 'md';
// @ts-expect-error — `surface-container` is declared but deliberately not wired on button
const tonal: ColorValueFor<'button'> = 'surface-container';

// ── phase 4 (#103) wired the six: checkbox narrows instead of erroring ──
const checkboxColor: ColorValueFor<'checkbox'> = 'primary';
const checkboxSize: SizeScaleFor<'checkbox'> = 'lg';
// @ts-expect-error — wired means CLOSED: a typo still errors
const checkboxTypo: ColorValueFor<'checkbox'> = 'primry';

// ── phase 4a (#168) wired the last four: avatar narrows instead of erroring ──
const avatarColor: ColorValueFor<'avatar'> = 'primary';
const avatarSize: SizeScaleFor<'avatar'> = 'xl';
// @ts-expect-error — wired means CLOSED here too
const avatarTypo: ColorValueFor<'avatar'> = 'primry';

// ── the still-unwired axis keeps the visible break. `variant` is deferred
//    on purpose (docs/architecture.md, "The ledgers"): only button wires it, because its
//    vocabulary is convention rather than contract ──
// @ts-expect-error — avatar accepts data-variant at runtime; nothing wires it
const avatarVariant: VariantValueFor<'avatar'> = 'solid';
// @ts-expect-error — empty declared axes reject every bag entry
const mintedAxis: AxesFor<'button'> = { density: 'compact' };

// ── the emitted scope keys are all real anatomy scopes (re-stated here in a
//    .ts so skipLibCheck cannot exempt the generated file's own assertion) ──
export type _scopesValid = MustBeTrue<
    keyof ZeroVocabulary['components'] extends ZeroScope ? true : false
>;

// ── coexistence with an adapted surface (issue #179): the register
//    augmentation above narrows the BASE components through the vocabulary,
//    but an `Adapted` surface removed its contract props by key — so the
//    vocabulary-scoped types are never even evaluated in it, and the two
//    mechanisms cannot fight over the same prop ──
type VendorButton = import('@sigx/zero/adapt').Adapted<
    typeof import('@sigx/zero').Button,
    'color' | 'size' | 'variant' | 'axes' | 'mods',
    { kind?: 'solid' | 'ghost' }
>;
type VendorButtonProps = Parameters<VendorButton>[0];
const vendorOk: VendorButtonProps = { kind: 'ghost' };
// @ts-expect-error — the register module narrows base `variant`, but the
// adapted surface removed it entirely; the augmentation must not resurrect it
const vendorZeroName: VendorButtonProps = { variant: 'filled' };
export { vendorOk, vendorZeroName };

export { tertiary, typo, buttonVariant, buttonSize, tonal, checkboxColor, checkboxSize, checkboxTypo, avatarColor, mintedAxis };
