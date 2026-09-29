/**
 * ChipGroup — a set of chips with one tab stop and an optional value model.
 *
 * ```tsx
 * <ChipGroup.Root label="Filters" selectable multiple model={() => state.filters}>
 *     <Chip.Root value="open"><Chip.Action>Open</Chip.Action></Chip.Root>
 *     <Chip.Root value="mine"><Chip.Action>Assigned to me</Chip.Action></Chip.Root>
 * </ChipGroup.Root>
 * ```
 *
 * Most chip sets select nothing: the chips act or remove, and there is no
 * model. `selectable` makes every chip a toggle under one value model, whose
 * shape follows `multiple` — ToggleGroup's and Select's rule: a `string`
 * (`''` while nothing is chosen), or a `string[]` under `multiple`. Arrow keys rove focus across the chips'
 * actions — orientation- and RTL-aware, wrapping unless `loop={false}` —
 * without changing the value; Space/Enter/click select.
 *
 * A chip removed from the group (its Remove, or Backspace/Delete on its
 * action) first hands focus to the next enabled chip, else the previous one,
 * so focus never falls back to `<body>` when the app drops it from the list.
 *
 * FORM PARTICIPATION is ToggleGroup's: a real, visually-hidden `<select>`
 * (`hidden-input`) while `name` is set and the group is `selectable`.
 */
import { component, compound, defineInjectable, defineProvide, effect } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState, type ControllableState } from '../../behaviors/controllable.js';
import { createFormControl, settleHiddenSelect } from '../../behaviors/form-control.js';
import { onFormReset } from '../../behaviors/form-reset.js';
import { VISUALLY_HIDDEN_STYLE } from '../../behaviors/visually-hidden.js';
import { createListController, type ListController } from '../../behaviors/list.js';
import { createRovingKeydown, createRovingTabStop, type RovingTabStop } from '../../behaviors/roving.js';
import { isRtl } from '../../behaviors/direction.js';
import { type Orientation } from '../../contract/data-attrs.js';
import { htmlAttrs } from '../../contract/props.js';
import type { WithClass, WithFormControl, WithHtmlAttrs, WithOrientation, WithVariantAxes } from '../../contract/props.js';
import { chipGroupAnatomy } from './anatomy.js';
import { mountScope } from '../../behaviors/mount-scope.js';

const SCOPE = chipGroupAnatomy.scope;

export type ChipSelection = 'none' | 'single' | 'multiple';

export interface ChipGroupContext {
    /** False for the inert default: a standalone chip reads no group. */
    inGroup: boolean;
    selection(): ChipSelection;
    /** The chosen values, whatever the model's shape. */
    selected(): string[];
    list: ListController;
    rovingStop: RovingTabStop;
    orientation(): Orientation;
    disabled(): boolean;
    toggle(value: string): void;
    keydown(e: KeyboardEvent, value: string): void;
    /** Focus the next enabled chip after `value`, else the previous one. */
    focusNeighbour(value: string): void;
}

function makeInert(): ChipGroupContext {
    const inertList = createListController();
    return {
        inGroup: false,
        selection: () => 'none',
        selected: () => [],
        list: inertList,
        rovingStop: createRovingTabStop(inertList),
        orientation: () => 'horizontal',
        disabled: () => false,
        toggle: () => {},
        keydown: () => {},
        focusNeighbour: () => {},
    };
}

export const useChipGroupContext = defineInjectable<ChipGroupContext>(() => makeInert());

export type ChipGroupRootProps =
    & Define.Model<string | string[]>
    & Define.Prop<'defaultValue', string | string[], false>
    & Define.Event<'valueChange', string | string[]>
    /** The chips select, under one value model (default false). */
    & Define.Prop<'selectable', boolean, false>
    /** More than one chip at a time: the model is a `string[]` (default false). */
    & Define.Prop<'multiple', boolean, false>
    /** In single mode, pressing the chosen chip clears the choice (default true). */
    & Define.Prop<'deselectable', boolean, false>
    & Define.Prop<'loop', boolean, false>
    /** Accessible name for the `role="group"` container (`aria-label`). */
    & Define.Prop<'label', string, false>
    & WithOrientation
    & WithVariantAxes<'chip-group'>
    & WithFormControl
    & WithClass
    /** Not `role`: the root is the `group`. */
    & Omit<WithHtmlAttrs, 'role'>
    & Define.Slot<'default'>;

const ChipGroupRoot = component<ChipGroupRootProps>(({ props, slots, emit, onMounted, onUnmounted, onUpdated }) => {
    const selection = (): ChipSelection => (!props.selectable ? 'none' : props.multiple ? 'multiple' : 'single');
    const multiple = (): boolean => selection() === 'multiple';
    const seed = (): string | string[] => (props.defaultValue !== undefined ? props.defaultValue : multiple() ? [] : '');
    const state: ControllableState<string | string[]> = createControllableState<string | string[]>(
        () => props.model,
        seed(),
        (v) => emit('valueChange', v),
    );
    const fc = createFormControl({ props: () => props, idBase: 'zx-chip-group' });
    const selected = (): string[] => {
        if (selection() === 'none') return [];
        const v = state.value;
        if (Array.isArray(v)) return [...new Set(v)];
        return v ? [v] : [];
    };
    const list = createListController();
    let rootEl: HTMLElement | null = null;
    let hidden: HTMLSelectElement | null = null;
    onUpdated(() => settleHiddenSelect(hidden, selected(), multiple()));
    const orientation = (): Orientation => props.orientation ?? 'horizontal';

    const rovingStop = createRovingTabStop(list);
    onMounted(() => rovingStop.settle());

    const roving = createRovingKeydown({
        list,
        orientation,
        loop: () => props.loop ?? true,
        rtl: () => isRtl(rootEl),
        // Focus moves, the value doesn't: chips select on press, never on focus.
        onMove: () => {},
    });

    const ctx: ChipGroupContext = {
        inGroup: true,
        selection,
        selected,
        list,
        rovingStop,
        orientation,
        disabled: fc.disabled,
        toggle: (value) => {
            if (selection() === 'none') return;
            const current = selected();
            const on = current.includes(value);
            if (multiple()) {
                state.value = on ? current.filter((v) => v !== value) : [...current, value];
            } else if (on) {
                if (props.deselectable ?? true) state.value = '';
            } else {
                state.value = value;
            }
        },
        keydown: roving,
        focusNeighbour: (value) => {
            const enabled = list.enabledItems();
            const i = enabled.findIndex((item) => item.value === value);
            const next = enabled[i + 1] ?? enabled[i - 1];
            next?.el()?.focus();
        },
    };
    defineProvide(useChipGroupContext, () => ctx);

    const syncHidden = (): void => {
        queueMicrotask(() => {
            if (!hidden) return;
            const on = new Set(selected());
            for (const o of Array.from(hidden.options)) o.selected = (multiple() || o.value !== '') && on.has(o.value);
            if (!multiple() && on.size === 0) hidden.value = '';
        });
    };
    // The group's one tab stop — where the invalid focus lands.
    const tabStop = (): HTMLElement | null => {
        const on = selected();
        const enabled = list.enabledItems();
        return (enabled.find((i) => on.includes(i.value)) ?? enabled[0])?.el() ?? null;
    };
    let detachReset = (): void => {};
    const scoped = mountScope();
    onMounted(() => scoped(() => {
        effect(() => { selected(); syncHidden(); });
        detachReset = onFormReset(() => hidden ?? (list.items()[0]?.el() as HTMLButtonElement | null) ?? null, () => {
            state.value = seed();
            syncHidden();
        });
    }));
    onUnmounted(() => detachReset());

    return () => {
        const attrs = htmlAttrs(props);
        const posts = fc.hasName() && selection() !== 'none';
        return (
            <div
                {...attrs}
                role="group"
                aria-label={props.label ?? attrs['aria-label']}
                aria-labelledby={[fc.field.inert || props.label !== undefined ? undefined : fc.labelId(), attrs['aria-labelledby']].filter(Boolean).join(' ') || undefined}
                aria-describedby={[fc.describedBy(), attrs['aria-describedby']].filter(Boolean).join(' ') || undefined}
                data-scope={SCOPE}
                data-part="root"
                data-orientation={orientation()}
                {...fc.flags()}
                {...fc.axisAttrs()}
                class={props.class}
                ref={(node: HTMLElement | null) => { rootEl = node; }}
            >
                {slots.default?.()}
                {posts
                    ? (
                        <select
                            data-scope={SCOPE}
                            data-part="hidden-input"
                            style={VISUALLY_HIDDEN_STYLE}
                            {...fc.hiddenAttrs()}
                            multiple={multiple()}
                            required={fc.required()}
                            tabIndex={-1}
                            aria-hidden="true"
                            ref={(node: HTMLSelectElement | null) => { hidden = node; }}
                            onInvalid={(e: Event) => { e.preventDefault(); tabStop()?.focus(); }}
                            onChange={() => {
                                if (!hidden) return;
                                const on = Array.from(hidden.options)
                                    .filter((o) => o.selected && (multiple() || o.value !== ''))
                                    .map((o) => o.value);
                                state.value = multiple() ? on : on[0] ?? '';
                            }}
                        >
                            {multiple() ? null : <option value="" selected={selected().length === 0} />}
                            {selected().map((v) => <option value={v} selected key={v}>{v}</option>)}
                        </select>
                    )
                    : null}
            </div>
        );
    };
}, { name: 'ChipGroup.Root' });

export const ChipGroup = compound(ChipGroupRoot, { Root: ChipGroupRoot });
