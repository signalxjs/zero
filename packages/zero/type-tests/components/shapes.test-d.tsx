/**
 * The value shapes of #455, pinned against the REAL roots: ToggleGroup's
 * and TreeView's (#287) model follows `multiple` (`string`, or `string[]`), and RadioGroup's
 * `items` infer `T` while the model stays the posted string.
 */
import { signal } from 'sigx';
import { Combobox, RadioGroup, Select, ToggleGroup, TreeView } from '@sigx/zero';

interface Plan { id: string; name: string }
const plans: Plan[] = [];
const state = signal({ align: '', marks: [] as string[], plan: '', n: 0, planObjs: [] as Plan[], code: '' as string | null, planObj: null as Plan | null });
// A list still loading (#172): `items` is `T[] | undefined`, the usual shape of a query result.
const loading = null as unknown as Plan[] | undefined;

// ── valid ──
// Items that arrive later type as data mode: the model is the item (or itemValue's V), nullable.
export const selectLoading = <Select.Root items={loading} model={() => state.planObj} onValueChange={(v) => v?.name} />;
export const selectLoadingKeys = <Select.Root items={loading} itemValue={(p) => p.id} model={() => state.code} />;
export const comboboxLoading = <Combobox.Root items={loading} multiple model={() => state.planObjs} />;
export const radioLoading = <RadioGroup.Root items={loading} itemKey={(p) => p.id} model={() => state.plan} />;
export const single = <ToggleGroup.Root model={() => state.align} defaultValue="left" onValueChange={(v) => v.toUpperCase()} />;
export const multiple = <ToggleGroup.Root multiple model={() => state.marks} defaultValue={['b']} onValueChange={(v) => v.length} />;
export const treeSingle = <TreeView.Root model={() => state.align} defaultValue="src" onValueChange={(v) => v.toUpperCase()} />;
export const treeMultiple = <TreeView.Root multiple model={() => state.marks} defaultValue={['src']} onValueChange={(v) => v.length} />;
export const radioItems = <RadioGroup.Root items={plans} itemKey={(p) => p.id} itemLabel={(p) => p.name} model={() => state.plan} slots={{ item: ({ item }) => <b>{item.name}</b> }} />;
export const radioPrimitives = <RadioGroup.Root items={['a', 'b']} model={() => state.plan} />;

// Combobox `allowCustom` (#39): free text commits as the value, so a string model only.
export const customJsx = <Combobox.Root multiple allowCustom model={() => state.marks} />;
export const customStrings = <Combobox.Root items={['a', 'b']} multiple allowCustom model={() => state.marks} />;
export const customKeys = <Combobox.Root items={plans} itemValue={(p) => p.id} allowCustom model={() => state.code} />;
export const customTagSlot = <Combobox.Root items={plans} multiple model={() => state.planObjs} slots={{ tag: ({ item, label }) => <b>{item?.name ?? label}</b> }} />;

// Combobox trigger mode (#58): `insert` carries one option's value, typed from the items.
export const mention = <Combobox.Root trigger="@" items={plans} onInsert={(d) => { const p: Plan = d.value; void p; void d.label; void d.text; }} />;
export const mentionKeys = <Combobox.Root trigger={/(?:^|\s)#(\w*)/} items={plans} itemValue={(p) => p.id} onInsert={(d) => { const id: string = d.value; void id; }} />;
export const mentionJsx = <Combobox.Root trigger="@" onInsert={(d) => { const k: string = d.value; void k; }} />;
// `itemInsert` (#107): the item and the value typed like `insert`'s.
export const insertItem = <Combobox.Root trigger="@" items={plans} itemInsert={(d) => `@[${d.item?.name ?? d.label}](plan:${d.value.id})${d.prefix}${d.query}`} />;
export const insertKeys = <Combobox.Root trigger="@" items={plans} itemValue={(p) => p.id} itemInsert={(d) => `@${d.value.toUpperCase()}`} />;

// ── invalid ──
// @ts-expect-error — an object model cannot hold free text
export const e6 = <Combobox.Root items={plans} multiple allowCustom model={() => state.planObjs} />;
// @ts-expect-error — nor can a number itemValue
export const e7 = <Combobox.Root items={plans} itemValue={(p) => p.name.length} allowCustom />;
// @ts-expect-error — an item's value is the item, not its key
export const e8 = <Combobox.Root trigger="@" items={plans} onInsert={(d) => { const k: string = d.value; void k; }} />;
// @ts-expect-error — itemInsert returns the text to insert
export const e10 = <Combobox.Root trigger="@" items={plans} itemInsert={(d) => d.item} />;
// @ts-expect-error — the value of a key-valued item is its key, not the item
export const e11 = <Combobox.Root trigger="@" items={plans} itemValue={(p) => p.id} itemInsert={(d) => d.value.name} />;
// @ts-expect-error — a trigger is a string or a RegExp
export const e9 = <Combobox.Root trigger={64} />;
// @ts-expect-error — single mode holds a string, not an array
export const e1 = <ToggleGroup.Root model={() => state.marks} />;
// @ts-expect-error — multiple holds an array, not a string
export const e2 = <ToggleGroup.Root multiple model={() => state.align} />;
// @ts-expect-error — the seed follows the shape
export const e3 = <ToggleGroup.Root defaultValue={['a']} />;
// @ts-expect-error — a single-select tree holds a string, not an array
export const e14 = <TreeView.Root model={() => state.marks} />;
// @ts-expect-error — a multiple tree holds an array, not a string
export const e15 = <TreeView.Root multiple model={() => state.align} />;
// @ts-expect-error — and its seed is an array too
export const e16 = <TreeView.Root multiple defaultValue="src" />;
// @ts-expect-error — the model is the posted string, never the item
export const e4 = <RadioGroup.Root items={plans} model={() => state.n} />;
// @ts-expect-error — a loading list is still data mode: the model is the item, not the key string
export const e12 = <Select.Root items={loading} model={() => state.align} />;
// @ts-expect-error — the same for Combobox
export const e13 = <Combobox.Root items={loading} model={() => state.align} />;
// @ts-expect-error — itemKey's parameter is the item
export const e5 = <RadioGroup.Root items={plans} itemKey={(p: number) => String(p)} />;
