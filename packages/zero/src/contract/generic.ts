/**
 * Generic roots — how a component is typed generic at the JSX level.
 *
 * sigx's `component<Props>()` is not JSX-generic: a factory carries one
 * props type. What CAN be generic is the exported TYPE. A root is written
 * once against `unknown` and exported through a cast to a call signature
 * with type parameters, so `<Select.Root items={countries} …>` infers `T`
 * from `items` and types `model`, `itemValue`, the scoped slots and the
 * change event from it (proven by the #438 probe: every valid case infers,
 * every mismatch errors, and `compound()` accepts the cast root because the
 * brands survive it).
 *
 * ```ts
 * type Root = {
 *     <T>(props: JsxProps<RootProps<T, T>> & { itemValue?: undefined }): JSXElement;
 *     <T, V>(props: JsxProps<RootProps<T, V>> & { itemValue: (item: T) => V }): JSXElement;
 * } & FactoryBrands;
 * export const Select = compound(SelectRootImpl as unknown as Root, { … });
 * ```
 */
// Type-only on purpose: `typeof component` below is a type QUERY, which
// TypeScript permits on a type-only import — and this module must add no
// runtime edge to sigx (it is on the DOM-free contract barrel).
import type { AnyComponentFactory, component } from 'sigx';

/**
 * The JSX prop surface sigx derives for a props declaration — the same
 * mapping the factory applies (`model` accepts the getter/tuple/Model
 * forms, events become `on<Name>`, slots become `slots`), so a generic
 * signature spelled with it stays in step with the runtime's own.
 */
export type JsxProps<P extends Record<string, unknown>> = Parameters<ReturnType<typeof component<P>>>[0];

/**
 * The type brands a factory carries beside its call signature. `compound()`
 * constrains its members structurally on these, so a cast root keeps them.
 */
export type FactoryBrands = Pick<AnyComponentFactory, '__setup' | '__props' | '__events' | '__ref' | '__slots'>;
