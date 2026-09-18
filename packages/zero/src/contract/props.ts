/**
 * Common prop fragments — component props intersect these instead of
 * redeclaring the conventions, so the vocabulary can't drift.
 */
import type { Define, ModelModifiers } from 'sigx';
import type { AxesFor, ColorValueFor, ModsFor, SizeScaleFor, VariantValueFor } from './vocabulary.js';
// Type-only, and acyclic: the anatomy registry imports per-component
// anatomy.ts data modules, none of which reach back into contract/props.
import type { ZeroScope } from '../anatomy.js';
import type { Orientation } from './data-attrs.js';

// The runtime half lives in variant-attrs.ts (lib.dom-free — this module
// types the asChild bag with DOM event shapes); re-exported from its
// historical home so no import site changes.
export { variantAttrs, RESERVED_AXES, VARIANT_AXES, MOD_ATTR_PREFIX } from './variant-attrs.js';

/** Arbitrary extra classes appended to the part's root element. */
export type WithClass = Define.Prop<'class', string, false>;

/** Disabled: non-interactive + `data-disabled` on every part. */
export type WithDisabled = Define.Prop<'disabled', boolean, false>;

/**
 * sigx's `modelModifiers` (`trim`, `number`, `lazy`, `debounce`, custom) on a
 * component that renders a native control. sigx reads the prop on any
 * component but types it only on intrinsic elements, so a Root that forwards
 * timing to its element declares it here. Value transforms apply once at the
 * component boundary; timing reaches the element via `timingModifiers()`.
 */
export type WithModelModifiers = Define.Prop<'modelModifiers', ModelModifiers, false>;

// ── The form vocabulary ──
// One spelling per prop, so thirteen components cannot drift on what
// `name`/`form`/`invalid`/`required`/`readonly` mean. The runtime half is
// `createFormControl` (behaviors/form-control.ts).

/** The field name the control posts under. Absent → the control does not post. */
export type WithName = Define.Prop<'name', string, false>;
/** The `form` attribute: associate with a form by id from outside its subtree. */
export type WithForm = Define.Prop<'form', string, false>;
/** Invalid: `aria-invalid` + `data-invalid`. The prop OR the Field's. */
export type WithInvalid = Define.Prop<'invalid', boolean, false>;
/** Required: the native attribute + `data-required`. The prop OR the Field's. */
export type WithRequired = Define.Prop<'required', boolean, false>;
/** Read-only: the native attribute + `data-readonly`. The prop OR the Field's. */
export type WithReadonly = Define.Prop<'readonly', boolean, false>;
/** What every posting control takes: name, form, disabled, invalid, required. */
export type WithFormControl = WithName & WithForm & WithDisabled & WithInvalid & WithRequired;

/**
 * Semantic color of the component — passes through as `data-color`.
 * Recommended roles autocomplete; any DS-declared role name is valid. Generic
 * on the component scope: with a `/register` module imported, `S` narrows to
 * exactly what that design system wires for the component; the `string`
 * default keeps the open union everywhere else.
 */
export type WithColor<S extends string = string> = Define.Prop<'color', ColorValueFor<S>, false>;

/** Component size on the shared scale — passes through as `data-size`. */
export type WithSize<S extends string = string> = Define.Prop<'size', SizeScaleFor<S>, false>;

/**
 * Design-system fill/chrome variant — passes through as `data-variant`.
 * Values are DS-defined (outline, soft, ghost, …); zero does not interpret
 * them.
 */
export type WithVariant<S extends string = string> = Define.Prop<'variant', VariantValueFor<S>, false>;

/**
 * Additional design-system variant axes, passed through as `data-<axis>`.
 *
 * `color` / `size` / `variant` are the axes almost every design system has, so
 * they keep named props with autocomplete. They are not the only axes a design
 * language can have: Material specifies density, others emphasis or tone. The
 * kit compiles `[data-density="compact"]` selectors happily, and before this
 * prop nothing could ever set that attribute — the rules were dead on arrival,
 * which the validator had to warn about.
 *
 * ```tsx
 * <Button.Root color="primary" axes={{ density: 'compact' }}>Save</Button.Root>
 * ```
 *
 * An axis may not shadow the anatomy contract (`scope`, `part`, `state`,
 * `orientation`, or any flag). Those attributes already carry meaning that
 * zero sets and every design system selects on.
 */
export type WithAxes<S extends string = string> = Define.Prop<'axes', AxesFor<S>, false>;

/**
 * Presence-only design-system modifiers, rendered as `data-mod-<name>`.
 *
 * An axis answers "which one" and always carries a value; a modifier answers
 * "is it on" and carries none — daisyUI's `btn-block`, Radix's `highContrast`,
 * HeroUI's `isIconOnly`. Encoding those as one-member axes
 * (`axes={{ block: 'block' }}`) works but restates the name as its own value.
 *
 * ```tsx
 * <Button.Root color="primary" mods={{ block: true }}>Save</Button.Root>
 * ```
 *
 * The `mod-` prefix is not decoration. Zero's own flag vocabulary
 * (`data-disabled`, `data-pressed`, …) is presence-only too and it is
 * VERSIONED: an unprefixed design-system modifier named `busy` would start
 * matching a `data-busy` flag zero adds later, silently and with exactly the
 * right shape. Valued axes cannot fail that way — a collision there simply
 * never matches, and `variantAttrs` throws. Different hazard, different
 * treatment: prefix modifiers, don't prefix axes.
 */
export type WithMods<S extends string = string> = Define.Prop<'mods', ModsFor<S>, false>;

/**
 * Every variant surface for one component scope — the usual composition, and
 * it cannot mix scopes by accident.
 *
 * `S` is constrained to zero's own anatomy registry: a typo'd scope literal
 * (`WithVariantAxes<'buton'>`) is not a smaller type, it is a *different*
 * type — `AxisOf` hands an unknown scope the open fallback, silently
 * un-narrowing exactly the component the literal meant to narrow. Ecosystem
 * components, whose scopes are not in the registry by definition, use
 * {@link WithVariantAxesOpen}.
 */
export type WithVariantAxes<S extends ZeroScope> =
    WithColor<S> & WithSize<S> & WithVariant<S> & WithAxes<S> & WithMods<S>;

/**
 * {@link WithVariantAxes} for ecosystem component scopes, which zero's
 * anatomy registry cannot know. The open constraint is the deliberate
 * cost of an out-of-tree scope: nothing type-checks the literal, so a
 * register module built for the design system is what closes the loop.
 */
export type WithVariantAxesOpen<S extends string> =
    WithColor<S> & WithSize<S> & WithVariant<S> & WithAxes<S> & WithMods<S>;

/** Layout direction — rendered as `data-orientation`. */
export type WithOrientation = Define.Prop<'orientation', Orientation, false>;

/**
 * Render the part through the default slot instead of the built-in element
 * (`asChild`). The slot receives a spreadable `PartProps` bag; the caller
 * owns the element and MUST spread the bag for accessibility to work:
 *
 * ```tsx
 * <Tabs.Tab value="a" asChild>
 *     {(p) => <MyFancyButton {...p}>First</MyFancyButton>}
 * </Tabs.Tab>
 * ```
 */
export type WithAsChild = Define.Prop<'asChild', boolean, false>;

/**
 * The spreadable bag an `asChild` slot receives — everything the built-in
 * element would have carried. Explicit spreading over cloning magic: it is
 * SSR-trivial and visible in user code.
 */
export interface PartProps {
    id?: string;
    'data-scope': string;
    'data-part': string;
    'data-state'?: string;
    'data-disabled'?: '';
    'data-selected'?: '';
    'data-highlighted'?: '';
    'data-orientation'?: Orientation;
    'data-color'?: string;
    'data-size'?: string;
    'data-variant'?: string;
    role?: string;
    tabIndex?: number;
    'aria-selected'?: boolean | 'true' | 'false';
    'aria-controls'?: string;
    'aria-labelledby'?: string;
    'aria-describedby'?: string;
    'aria-expanded'?: boolean | 'true' | 'false';
    'aria-disabled'?: boolean | 'true' | 'false';
    'aria-checked'?: boolean | 'true' | 'false';
    'aria-haspopup'?: string;
    onClick?: (e: MouseEvent) => void;
    onKeydown?: (e: KeyboardEvent) => void;
    onKeyup?: (e: KeyboardEvent) => void;
    onFocus?: (e: FocusEvent) => void;
    onBlur?: (e: FocusEvent) => void;
    onPointerdown?: (e: PointerEvent) => void;
    onPointerup?: (e: PointerEvent) => void;
    onPointercancel?: (e: PointerEvent) => void;
    onPointerleave?: (e: PointerEvent) => void;
    ref?: (el: HTMLElement | null) => void;
    [key: string]: unknown;
}
