/**
 * The UNAUGMENTED contract — no register module anywhere in this project.
 *
 * This is the regression test for the fallback branch: an empty
 * `ZeroVocabulary` must resolve every scoped helper to exactly the open union
 * it replaced, so a project that never imports a `/register` module compiles
 * byte-for-byte as before (the four-design-system playground depends on it).
 */
import type {
    AxesFor,
    ColorValue,
    ModsFor,
    ColorValueFor,
    SizeScale,
    SizeScaleFor,
    VariantValueFor,
    ZeroScope,
    ZeroBreakpointName,
    Responsive,
} from '@sigx/zero';
import type { Equal, MustBeTrue } from '../assert.js';

// The scoped forms ARE the open unions — not merely compatible, identical.
export type _colorIsOpen = MustBeTrue<Equal<ColorValueFor<'button'>, ColorValue>>;
export type _sizeIsOpen = MustBeTrue<Equal<SizeScaleFor<'button'>, SizeScale>>;
export type _variantIsOpen = MustBeTrue<Equal<VariantValueFor<'button'>, string>>;
export type _axesAreOpen = MustBeTrue<Equal<AxesFor<'button'>, Record<string, string>>>;
export type _modsAreOpen = MustBeTrue<Equal<ModsFor<'button'>, Record<string, boolean>>>;

// A scope no component declares behaves the same — unaugmented, everything
// falls back; there is nothing to be wrong about.
export type _unknownScopeIsOpen = MustBeTrue<Equal<ColorValueFor<'no-such-scope'>, ColorValue>>;

// The defaults keep un-scoped usage meaning "open".
export type _defaultIsOpen = MustBeTrue<Equal<ColorValueFor, ColorValue>>;

// Open means open: any string is accepted, recommended names still narrow in.
const typo: ColorValueFor<'button'> = 'primry';
const recommended: ColorValueFor<'button'> = 'primary';
const anyAxis: AxesFor<'checkbox'> = { density: 'compact', anything: 'goes' };

// The scope union tracks the anatomy registry.
const button: ZeroScope = 'button';
const treeView: ZeroScope = 'tree-view';
// @ts-expect-error — a scope the registry lacks is not a ZeroScope
const nope: ZeroScope = 'no-such-scope';

// ── responsive layout values, unaugmented ──
//
// The guard-first shape of `ZeroBreakpointName` has to fall back to `string`
// here. Written the other way round (testing the result against `never`) an
// app with no `/register` import could not write a breakpoint at ALL, which
// would make the layout tier unusable for exactly the consumers the open
// fallback exists to serve.
export type _breakpointsOpenUnaugmented = MustBeTrue<Equal<ZeroBreakpointName, string>>;

const anyBreakpoint: Responsive<'sm' | 'md'> = { base: 'sm', md: 'md', whatever: 'sm' };
// @ts-expect-error — the VALUE stays closed even when the key is open
const stillCheckedValue: Responsive<'sm' | 'md'> = { md: 'enormous' };

export { typo, recommended, anyAxis, button, treeView, nope, anyBreakpoint, stillCheckedValue };
