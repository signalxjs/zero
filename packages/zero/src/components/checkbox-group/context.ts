/**
 * The seam between `CheckboxGroup.Root` and the `Checkbox.Root`s inside it.
 *
 * It lives apart from the group component so Checkbox can read it without
 * pulling the group into `@sigx/zero/checkbox`: a box outside any group sees
 * the inert fallback (`inert: true`) and behaves exactly as it always has.
 */
import { defineInjectable, signal } from 'sigx';
import { createInertState, type ControllableState } from '../../behaviors/controllable.js';

/** One boxed child, as the parent box needs it: its value and its input's id. */
export interface CheckboxGroupEntry {
    value(): string;
    id: string;
}

export interface CheckboxGroupContext {
    /** True on the fallback — a `Checkbox.Root` outside any group. */
    inert: boolean;
    state: ControllableState<string[]>;
    /** The group's `name` / `form`: every child input posts under them. */
    name(): string | undefined;
    form(): string | undefined;
    defaultValue(): string[];
    disabled(): boolean;
    invalid(): boolean;
    required(): boolean;
    readonly(): boolean;
    /**
     * What a parent box selects and derives from: the group's `allValues`,
     * else every registered (non-parent) child's value, in order.
     */
    allValues(): string[];
    /** The input ids of the registered children a parent box controls. */
    controls(): string[];
    /**
     * A child box registers on setup and withdraws on unmount — both
     * deferred a microtask (a write made during a render pass is invisible
     * to the pass rendering the parent box). Returns the withdrawal.
     */
    register(entry: CheckboxGroupEntry): () => void;
    /** The Label's own id — referenced by the root only while it is mounted. */
    labelId: string;
    setLabelPresent(present: boolean): void;
}

/** The registry half of the context — the root owns one per instance. */
export function createEntryRegistry(): {
    entries(): CheckboxGroupEntry[];
    register(entry: CheckboxGroupEntry): () => void;
} {
    const list = signal({ items: [] as CheckboxGroupEntry[] });
    return {
        entries: () => list.items,
        register: (entry) => {
            let alive = true;
            let added = false;
            queueMicrotask(() => {
                if (!alive) return;
                added = true;
                list.items = [...list.items, entry];
            });
            return () => {
                alive = false;
                if (added) queueMicrotask(() => { list.items = list.items.filter((e) => e.id !== entry.id); });
            };
        },
    };
}

function makeInert(): CheckboxGroupContext {
    return {
        inert: true,
        state: createInertState<string[]>([]),
        name: () => undefined,
        form: () => undefined,
        defaultValue: () => [],
        disabled: () => false,
        invalid: () => false,
        required: () => false,
        readonly: () => false,
        allValues: () => [],
        controls: () => [],
        register: () => () => {},
        labelId: 'zx-checkbox-group-inert-label',
        setLabelPresent: () => {},
    };
}

export const useCheckboxGroupContext = defineInjectable<CheckboxGroupContext>(() => makeInert());
