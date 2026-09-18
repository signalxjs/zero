/**
 * The generic-root pin (#443, the mechanism #438 chose): a root written once
 * against `unknown` and exported through a cast to a generic call signature
 * infers `T` from `items`, types the model as the item unless `itemValue`
 * says otherwise, makes it an array under `multiple`, hands the scoped slot
 * the typed item, and rejects every mismatch — all through sigx's own JSX
 * prop mapping (`JsxProps`), and `compound()` still accepts the cast root.
 *
 * No runtime: a broken inference here is a compile error in `pnpm test:types`.
 */
import { component, compound, signal } from 'sigx';
import type { Define, JSXElement } from 'sigx';
import type { FactoryBrands, JsxProps } from '@sigx/zero/contract';

type RootProps<T, M> =
    & Define.Model<M>
    // As on the real roots: typed per overload, `unknown` here — declared as
    // `M` it silently stops T's inference for the itemValue overload.
    & Define.Prop<'defaultValue', unknown, false>
    & Define.Prop<'items', ReadonlyArray<T>, false>
    & Define.Prop<'itemKey', (item: T) => string, false>
    & Define.Event<'valueChange', M>
    & Define.Slot<'item', { item: T }>
    & Define.Slot<'default'>;

const Impl = component<RootProps<unknown, unknown>>(() => () => null as unknown as JSXElement);

type GenericRoot = {
    (props: JsxProps<RootProps<unknown, string>> & { items?: undefined; defaultValue?: string; itemValue?: undefined; multiple?: false }): JSXElement;
    (props: JsxProps<RootProps<unknown, string[]>> & { items?: undefined; defaultValue?: string[]; itemValue?: undefined; multiple: true }): JSXElement;
    <T>(props: JsxProps<RootProps<T, T | null>> & { items: ReadonlyArray<T>; defaultValue?: T | null; itemValue?: undefined; multiple?: false }): JSXElement;
    <T>(props: JsxProps<RootProps<T, T[]>> & { items: ReadonlyArray<T>; defaultValue?: T[]; itemValue?: undefined; multiple: true }): JSXElement;
    <T, V>(props: JsxProps<RootProps<T, V | null>> & { items: ReadonlyArray<T>; defaultValue?: V | null; itemValue: (item: T) => V; multiple?: false }): JSXElement;
    <T, V>(props: JsxProps<RootProps<T, V[]>> & { items: ReadonlyArray<T>; defaultValue?: V[]; itemValue: (item: T) => V; multiple: true }): JSXElement;
} & FactoryBrands;

const Root = Impl as unknown as GenericRoot;
const Select = compound(Root, { Root });

interface Country { code: string; name: string }
const countries: Country[] = [];
const state = signal({ c: null as Country | null, cs: [] as Country[], code: '' as string | null, codes: [] as string[], n: 0 as number | null, s: '', ss: [] as string[] });

// ── valid ──
// The item model is `T | null` — nothing selected is null, so the change
// event's payload must be narrowed.
export const objectModel = <Root items={countries} model={() => state.c} itemKey={(i) => i.code} onValueChange={(v) => v?.name} />;
export const nullDefault = <Root items={countries} model={() => state.c} defaultValue={null} />;
export const keyModel = <Root items={countries} itemValue={(i) => i.code} model={() => state.code} onValueChange={(v) => v?.toUpperCase()} />;
// V is whatever itemValue returns — a number model, nullable like every single-select model.
export const numberModel = <Root items={[1, 2, 3]} itemValue={(n) => n * 10} model={() => state.n} onValueChange={(v) => v?.toFixed(1)} />;
export const primitives = <Root items={['a', 'b']} model={() => state.code} />;
export const multipleObjects = <Root items={countries} multiple model={() => state.cs} onValueChange={(v) => v[0]?.name} />;
export const multipleKeys = <Root items={countries} multiple itemValue={(i) => i.code} model={() => state.codes} />;
export const scopedSlot = <Select.Root items={countries} model={() => state.c} slots={{ item: ({ item }) => <span>{item.name}</span> }} />;
export const tupleForm = <Root items={countries} model={[state, 'c']} />;
export const withDefault = <Root items={countries} itemValue={(i) => i.code} defaultValue="se" model={() => state.code} />;
// Hand-written items: the model is the <select>'s string, or string[] under multiple.
export const jsxMode = <Root model={() => state.s} defaultValue="a" onValueChange={(v) => v.toUpperCase()} />;
export const jsxMultiple = <Root multiple model={() => state.ss} />;

// ── invalid ──
// @ts-expect-error — the model is the item unless itemValue says otherwise
export const e1 = <Root items={countries} model={() => state.code} />;
// @ts-expect-error — itemValue returns string, so the model is string
export const e2 = <Root items={countries} itemValue={(i) => i.code} model={() => state.c} />;
// @ts-expect-error — multiple makes the model an array
export const e3 = <Root items={countries} multiple model={() => state.c} />;
// @ts-expect-error — not multiple, so the model is not an array
export const e4 = <Root items={countries} model={() => state.cs} />;
// @ts-expect-error — itemKey's parameter is the item
export const e5 = <Root items={countries} model={() => state.c} itemKey={(i: number) => String(i)} />;
// @ts-expect-error — defaultValue follows the model
export const e7 = <Root items={countries} itemValue={(i) => i.code} defaultValue={3} />;
// @ts-expect-error — the change event carries the item
export const e6 = <Root items={countries} model={() => state.c} onValueChange={(v: string) => v} />;
// @ts-expect-error — the item model is nullable: nothing selected is null
export const e8 = <Root items={countries} model={() => state.c} onValueChange={(v: Country) => v.name} />;
// @ts-expect-error — so is a value model
export const e9 = <Root items={countries} itemValue={(i) => i.code} model={() => state.code} onValueChange={(v: string) => v} />;
// @ts-expect-error — without items the model is a string key, not a number
export const e10 = <Root model={() => state.n} />;
// @ts-expect-error — nor an object
export const e11 = <Root model={() => state.c} />;
// @ts-expect-error — nor an object array under multiple
export const e12 = <Root multiple model={() => state.cs} />;
// @ts-expect-error — itemValue has nothing to read without items
export const e13 = <Root itemValue={(i: Country) => i.code} model={() => state.code} />;
