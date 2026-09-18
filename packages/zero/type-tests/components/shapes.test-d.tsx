/**
 * The value shapes of #455, pinned against the REAL roots: ToggleGroup's
 * model follows `multiple` (`string`, or `string[]`), and RadioGroup's
 * `items` infer `T` while the model stays the posted string.
 */
import { signal } from 'sigx';
import { RadioGroup, ToggleGroup } from '@sigx/zero';

interface Plan { id: string; name: string }
const plans: Plan[] = [];
const state = signal({ align: '', marks: [] as string[], plan: '', n: 0 });

// ── valid ──
export const single = <ToggleGroup.Root model={() => state.align} defaultValue="left" onValueChange={(v) => v.toUpperCase()} />;
export const multiple = <ToggleGroup.Root multiple model={() => state.marks} defaultValue={['b']} onValueChange={(v) => v.length} />;
export const radioItems = <RadioGroup.Root items={plans} itemKey={(p) => p.id} itemLabel={(p) => p.name} model={() => state.plan} slots={{ item: ({ item }) => <b>{item.name}</b> }} />;
export const radioPrimitives = <RadioGroup.Root items={['a', 'b']} model={() => state.plan} />;

// ── invalid ──
// @ts-expect-error — single mode holds a string, not an array
export const e1 = <ToggleGroup.Root model={() => state.marks} />;
// @ts-expect-error — multiple holds an array, not a string
export const e2 = <ToggleGroup.Root multiple model={() => state.align} />;
// @ts-expect-error — the seed follows the shape
export const e3 = <ToggleGroup.Root defaultValue={['a']} />;
// @ts-expect-error — the model is the posted string, never the item
export const e4 = <RadioGroup.Root items={plans} model={() => state.n} />;
// @ts-expect-error — itemKey's parameter is the item
export const e5 = <RadioGroup.Root items={plans} itemKey={(p: number) => String(p)} />;
