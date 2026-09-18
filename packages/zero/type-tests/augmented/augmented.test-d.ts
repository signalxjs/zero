/**
 * The AUGMENTED contract — `./register.d.ts` augments `@sigx/zero` exactly
 * the way a generated `/register` module does (docs/architecture.md, "The
 * register artifact"), and every
 * narrowing case class is asserted, positive and negative.
 *
 * The augmentation targets `@sigx/zero` while `ZeroVocabulary` is DECLARED in
 * `contract/vocabulary.ts` and re-exported — so this project is also the
 * regression test that interface merging works through the re-export (the
 * `@vue/runtime-core` landmine).
 */
import type {
    AxesFor,
    ColorValue,
    ModsFor,
    ColorValueFor,
    SizeScaleFor,
    VariantValueFor,
    ZeroScope,
    ZeroVocabulary,
    ZeroBreakpointName,
    Responsive,
    LayoutProp,
    LayoutProps,
} from '@sigx/zero';
import type { Equal, MustBeTrue } from '../assert.js';

// ── fully wired: closed unions, typos rejected ──
const color: ColorValueFor<'button'> = 'primary';
// @ts-expect-error — a typo is no longer a silently minted value
const typo: ColorValueFor<'button'> = 'primry';
// @ts-expect-error — a role outside what THIS design system wires errors too
const unwired: ColorValueFor<'button'> = 'success';
const size: SizeScaleFor<'button'> = 'md';
const variant: VariantValueFor<'button'> = 'ghost';
// @ts-expect-error — variant is a closed set once wired
const badVariant: VariantValueFor<'button'> = 'ghots';

// ── empty declared axes must reject everything (Record<string, never>) ──
const noAxes: AxesFor<'button'> = {};
// @ts-expect-error — `{}` emission would silently permit this; Record<string, never> must not
const mintedAxis: AxesFor<'button'> = { density: 'compact' };

// ── partially wired: each axis narrows independently ──
const toggleColor: ColorValueFor<'toggle'> = 'secondary';
// @ts-expect-error — toggle wires no variant, so ANY value errors (never)
const toggleVariant: VariantValueFor<'toggle'> = 'solid';

// ── modifiers: presence-only, so the value type is boolean and the NAMES
//    are the vocabulary ──
const mods: ModsFor<'button'> = { block: true, 'icon-only': false };
// @ts-expect-error — a modifier this design system never declared
const mintedMod: ModsFor<'button'> = { wide: true };
// @ts-expect-error — a modifier has no vocabulary of values; it is on or off
const valuedMod: ModsFor<'button'> = { block: 'yes' };
// @ts-expect-error — toggle declares no modifiers, so Record<string, never> rejects every entry
const noMods: ModsFor<'toggle'> = { block: true };

// ── custom axes narrow per axis name and value ──
const density: AxesFor<'tabs'> = { density: 'compact' };
// @ts-expect-error — a value outside the declared axis vocabulary
const badDensity: AxesFor<'tabs'> = { density: 'tigth' };
// @ts-expect-error — an axis this design system never declared
const badAxis: AxesFor<'tabs'> = { emphasis: 'high' };

// ── nothing wired: the visible break, not the open fallback ──
// @ts-expect-error — checkbox accepts data-color at runtime, but nothing wires it
const checkboxColor: ColorValueFor<'checkbox'> = 'success';

// ── a scope ABSENT from the vocabulary falls back to the open union: the
//    guard-ordering case — `[Scoped<S>] extends [never]` must come first,
//    or this would collapse into the checkbox case above ──
export type _absentScopeFallsBack = MustBeTrue<Equal<ColorValueFor<'avatar'>, ColorValue>>;

// ── the generated file's scope-validity assertion (docs/architecture.md,
//    "The register artifact"):
//    every components key must be a real anatomy scope ──
export type _scopesValid = MustBeTrue<
    keyof ZeroVocabulary['components'] extends ZeroScope ? true : false
>;
type BadRegister = { button: object; checkbxo: object };
// @ts-expect-error — a typo'd scope fails the assertion instead of silently un-narrowing
export type _badScopesCaught = MustBeTrue<keyof BadRegister extends ZeroScope ? true : false>;

export { color, size, variant, noAxes, toggleColor, density };
export { typo, unwired, badVariant, mintedAxis, toggleVariant, badDensity, badAxis, checkboxColor };

// ── responsive layout values: the breakpoint record narrows ──
//
// The whole reason `Responsive` keys on `ZeroBreakpointName` (the CLOSED
// twin) rather than the published `ZeroBreakpoint` (open, `| (string & {})`).
// Open, every one of the negative cases below would type-check, render an
// attribute and match nothing — the silent miss `variantAttrs` throws over.

const bare: Responsive<'sm' | 'md'> = 'md';
const withBase: Responsive<'sm' | 'md'> = { base: 'sm', md: 'md' };
const noBase: Responsive<'sm' | 'md'> = { lg: 'md' };
const everyBreakpoint: Responsive<'sm' | 'md'> = { base: 'sm', sm: 'md', md: 'sm', lg: 'md' };

// @ts-expect-error — `xl` is not a breakpoint this design system declares
const unknownBreakpoint: Responsive<'sm' | 'md'> = { xl: 'md' };
// @ts-expect-error — a near-miss typo is the case this exists to catch
const typoBreakpoint: Responsive<'sm' | 'md'> = { mdd: 'md' };
// @ts-expect-error — the VALUE is still checked inside the record
const badValue: Responsive<'sm' | 'md'> = { md: 'enormous' };

type BreakpointsAreClosed = MustBeTrue<Equal<ZeroBreakpointName, 'sm' | 'md' | 'lg'>>;

// ── layout props follow the vocabulary's own `responsive` flag ──
//
// Derived rather than hand-written per prop, so the type cannot disagree
// with the runtime guard. Typing a non-responsive attribute as Responsive
// would let `gapX={{ md: 'lg' }}` compile and then throw.

const gapBare: LayoutProp<'gap'> = 'md';
const gapResponsive: LayoutProp<'gap'> = { base: 'sm', md: 'lg' };
const padResponsive: LayoutProp<'pad'> = { lg: 'xl' };
const alignResponsive: LayoutProp<'align'> = { md: 'center' };

const gapXBare: LayoutProp<'gap-x'> = 'lg';
// @ts-expect-error — `gap-x` does not vary per breakpoint; a record throws at runtime
const gapXResponsive: LayoutProp<'gap-x'> = { md: 'lg' };
// @ts-expect-error — nor does `pad-y`
const padYResponsive: LayoutProp<'pad-y'> = { md: 'lg' };
// @ts-expect-error — nor `wrap`, which describes what a box IS
const wrapResponsive: LayoutProp<'wrap'> = { md: 'wrap' };

// The value union stays closed in both shapes.
// @ts-expect-error — not a rung of the ramp
const gapTypo: LayoutProp<'gap'> = 'roomy';
// @ts-expect-error — and not inside the record either
const gapTypoResponsive: LayoutProp<'gap'> = { md: 'roomy' };

// The numeric twin: `cols={4}` is how a consumer writes it, and layoutAttrs
// stringifies. The twin lives on the PROP, not on LayoutValue — the rendered
// attribute is always a string.
const colsNumber: LayoutProp<'cols'> = 4;
const colsString: LayoutProp<'cols'> = '4';
const colsAuto: LayoutProp<'cols'> = 'auto';
const colsResponsiveNumber: LayoutProp<'cols'> = { base: 1, md: 2, lg: 4 };
// @ts-expect-error — `xl` is not a breakpoint THIS design system declares,
// so the numeric twin does not loosen the key narrowing either
const colsUnknownBreakpoint: LayoutProp<'cols'> = { xl: 4 };
// @ts-expect-error — still closed: a twelve-column grid stops at 12
const colsOver: LayoutProp<'cols'> = 13;
// @ts-expect-error — and a spacing rung has no numeric twin to offer
const gapNumber: LayoutProp<'gap'> = 4;

// The bag derives from LayoutProp, so it cannot represent a shape the
// runtime would reject.
const bag: LayoutProps = { gap: { md: 'lg' }, 'gap-x': 'sm', cols: 3 };
// @ts-expect-error — `gap-x` does not vary per breakpoint
const badBag: LayoutProps = { 'gap-x': { md: 'sm' } };
