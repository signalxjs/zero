/**
 * ToggleGroup — a set of two-state buttons under one value model.
 *
 * ```tsx
 * <ToggleGroup.Root model={() => state.align} label="Text alignment">
 *     <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
 *     <ToggleGroup.Item value="center">Center</ToggleGroup.Item>
 *     <ToggleGroup.Item value="right">Right</ToggleGroup.Item>
 * </ToggleGroup.Root>
 * ```
 *
 * The model follows `multiple`, Select's rule: single mode holds the pressed
 * value as a `string` (`''` when none), `multiple` holds a `string[]` — the
 * exported root is typed through the overload cast (#443), so a string
 * signal binds a single-select group and an array a multiple one, never
 * the other way round. Arrow keys rove focus (orientation-aware, RTL-aware)
 * without changing the selection; Space/Enter/click toggle.
 *
 * Items do not wrap the standalone Toggle: group items need list
 * registration and group value semantics Toggle doesn't have. They share the
 * `on|off` visual contract instead, so recipes can mirror styles.
 *
 * FORM PARTICIPATION is Select's: a real, visually-hidden `<select>`
 * (`hidden-input`) rendered only while `name` is set — one field in single
 * mode, a repeated field per pressed value under `multiple` — so the group
 * posts before hydration, `required` is a platform constraint (the invalid
 * focus lands on the group's tab stop) and a form `reset()` restores the
 * default.
 */
import { component, compound, defineInjectable, defineProvide, effect } from 'sigx';
import type { Define, JSXElement } from 'sigx';
import type { FactoryBrands, JsxProps } from '../../contract/generic.js';
import { createControllableState, createInertState, type ControllableState } from '../../behaviors/controllable.js';
import { createFormControl } from '../../behaviors/form-control.js';
import { onFormReset } from '../../behaviors/form-reset.js';
import { VISUALLY_HIDDEN_STYLE } from '../../behaviors/visually-hidden.js';
import { createListController, type ListController, type ListItem } from '../../behaviors/list.js';
import { createRovingKeydown } from '../../behaviors/roving.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { dataAttr, stateAttr, type Orientation } from '../../contract/data-attrs.js';
import { renderAsChild, synthesizesClickFrom } from '../../contract/as-child.js';
import { variantAttrs } from '../../contract/props.js';
import type {
    PartProps,
    WithAsChild,
    WithClass,
    WithDisabled,
    WithFormControl,
    WithOrientation,
    WithVariantAxes,
} from '../../contract/props.js';
import { toggleGroupAnatomy } from './anatomy.js';

const SCOPE = toggleGroupAnatomy.scope;

interface ToggleGroupContext {
    /** The model: a `string` in single mode, a `string[]` under `multiple`. */
    state: ControllableState<string | string[]>;
    /** The pressed values, whatever the model's shape. */
    selected(): string[];
    multiple(): boolean;
    list: ListController;
    orientation(): Orientation;
    disabled(): boolean;
    toggle(value: string): void;
    keydown(e: KeyboardEvent, value: string): void;
}

function makeInert(): ToggleGroupContext {
    return {
        state: createInertState<string | string[]>(''),
        selected: () => [],
        multiple: () => false,
        list: createListController(),
        orientation: () => 'horizontal',
        disabled: () => false,
        toggle: () => {},
        keydown: () => {},
    };
}

export const useToggleGroupContext = defineInjectable<ToggleGroupContext>(() => makeInert());

// ── Root ──

/**
 * The props, generic over the model `M`: `string` in single mode, `string[]`
 * under `multiple` — the exported `ToggleGroup.Root` narrows it from
 * `multiple`.
 */
export type ToggleGroupRootProps<M = string | string[]> =
    & Define.Model<M>
    & Define.Prop<'defaultValue', M, false>
    & Define.Event<'valueChange', M>
    /** Allow more than one item on at a time (default false). */
    & Define.Prop<'multiple', boolean, false>
    /** In single mode, clicking the on item turns it off (default true). */
    & Define.Prop<'deselectable', boolean, false>
    & Define.Prop<'loop', boolean, false>
    /** Accessible name for the `role="group"` container (`aria-label`). */
    & Define.Prop<'label', string, false>
    & WithOrientation
    & WithVariantAxes<'toggle-group'>
    & WithFormControl
    & WithClass
    & Define.Slot<'default'>;

const ToggleGroupRootImpl = component<ToggleGroupRootProps>(({ props, slots, emit, onMounted, onUnmounted }) => {
    const seed = (): string | string[] => (props.defaultValue !== undefined ? props.defaultValue : props.multiple ? [] : '');
    const state = createControllableState<string | string[]>(
        () => props.model,
        seed(),
        (v) => emit('valueChange', v),
    );
    const fc = createFormControl({ props: () => props, idBase: 'zx-toggle-group' });
    // The pressed values under either shape — a string model reads as a
    // one-element list (empty when ''); a consumer-written array is
    // de-duplicated, so the hidden select never posts a value twice.
    const selected = (): string[] => {
        const v = state.value;
        if (Array.isArray(v)) return [...new Set(v)];
        return v !== '' ? [v] : [];
    };
    const list = createListController();
    let rootEl: HTMLElement | null = null;
    let hidden: HTMLSelectElement | null = null;
    const orientation = (): Orientation => props.orientation ?? 'horizontal';

    const isRtl = (): boolean => {
        const el = rootEl;
        if (!el) return false;
        try {
            if (el.matches(':dir(rtl)')) return true;
        } catch {
            // :dir() unsupported — fall through to computed style.
        }
        return typeof getComputedStyle === 'function' && getComputedStyle(el).direction === 'rtl';
    };

    const roving = createRovingKeydown({
        list,
        orientation,
        loop: () => props.loop ?? true,
        rtl: isRtl,
        // Focus moves, selection doesn't: toggles activate on click/Space/
        // Enter, never on focus — roving here is pure navigation.
        onMove: () => {},
    });

    const ctx: ToggleGroupContext = {
        state,
        selected,
        multiple: () => !!props.multiple,
        list,
        orientation,
        disabled: fc.disabled,
        toggle: (value) => {
            const current = selected();
            const on = current.includes(value);
            if (props.multiple) {
                state.value = on ? current.filter((v) => v !== value) : [...current, value];
            } else if (on) {
                if (props.deselectable ?? true) state.value = '';
            } else {
                state.value = value;
            }
        },
        keydown: roving,
    };
    defineProvide(useToggleGroupContext, () => ctx);

    // The hidden select holds only the pressed values (items are hand-written
    // and register after this root renders, so a registry read here would be
    // stale) and follows the model a microtask later — after the render has
    // inserted the options, and after a form reset has deselected them.
    const syncHidden = (): void => {
        queueMicrotask(() => {
            if (!hidden) return;
            // Only the single-mode placeholder carries the empty key; under
            // `multiple` an empty-string value is a real one.
            const on = new Set(selected());
            for (const o of Array.from(hidden.options)) o.selected = (!!props.multiple || o.value !== '') && on.has(o.value);
            if (!props.multiple && on.size === 0) hidden.value = '';
        });
    };
    // The group's one tab stop — where the invalid focus lands.
    const tabStop = (): HTMLElement | null => {
        const on = selected();
        const enabled = list.enabledItems();
        return (enabled.find((i) => on.includes(i.value)) ?? enabled[0])?.el() ?? null;
    };
    let detachReset = (): void => {};
    onMounted(() => {
        effect(() => { selected(); syncHidden(); });
        // Without a name there is no hidden select — an item is a <button>,
        // form-associated like any control, so reset still restores.
        detachReset = onFormReset(() => hidden ?? (list.items()[0]?.el() as HTMLButtonElement | null) ?? null, () => {
            state.value = seed();
            syncHidden();
        });
    });
    onUnmounted(() => detachReset());

    return () => (
        <div
            role="group"
            aria-label={props.label}
            aria-labelledby={fc.field.inert || props.label !== undefined ? undefined : fc.labelId()}
            aria-describedby={fc.describedBy()}
            data-scope={SCOPE}
            data-part="root"
            data-orientation={orientation()}
            {...fc.flags()}
            {...variantAttrs(props)}
            class={props.class}
            ref={(node: HTMLElement | null) => { rootEl = node; }}
        >
            {slots.default?.()}
            {fc.hasName()
                ? (
                    <select
                        data-scope={SCOPE}
                        data-part="hidden-input"
                        style={VISUALLY_HIDDEN_STYLE}
                        {...fc.hiddenAttrs()}
                        multiple={!!props.multiple}
                        required={fc.required()}
                        tabIndex={-1}
                        aria-hidden="true"
                        ref={(node: HTMLSelectElement | null) => { hidden = node; }}
                        // The platform's bubble would anchor to a 1px element:
                        // cancel it and land focus where the user can act.
                        onInvalid={(e: Event) => { e.preventDefault(); tabStop()?.focus(); }}
                        // The platform writes the hidden select itself (form
                        // restoration): its selection flows back into the model.
                        onChange={() => {
                            if (!hidden) return;
                            const on = Array.from(hidden.options)
                                .filter((o) => o.selected && (props.multiple || o.value !== ''))
                                .map((o) => o.value);
                            state.value = props.multiple ? on : on[0] ?? '';
                        }}
                    >
                        {props.multiple ? null : <option value="" selected={selected().length === 0} />}
                        {selected().map((v) => <option value={v} selected key={v}>{v}</option>)}
                    </select>
                )
                : null}
        </div>
    );
}, { name: 'ToggleGroup.Root' });

/** The exported root: the model's shape follows `multiple`. */
export type ToggleGroupRoot = {
    (props: JsxProps<ToggleGroupRootProps<string>> & { multiple?: false }): JSXElement;
    (props: JsxProps<ToggleGroupRootProps<string[]>> & { multiple: true }): JSXElement;
} & FactoryBrands;

const ToggleGroupRoot = ToggleGroupRootImpl as unknown as ToggleGroupRoot;

// ── Item ──

export type ToggleGroupItemProps =
    & Define.Prop<'value', string, true>
    & WithDisabled
    & WithClass
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const ToggleGroupItem = component<ToggleGroupItemProps>(({ props, slots, onUnmounted, signal }) => {
    const group = useToggleGroupContext();
    let el: HTMLElement | null = null;
    const focus = signal({ visible: false });
    // '' is the single-mode model's "nothing pressed" (and the hidden
    // select's placeholder): an item carrying it could never read as on.
    if (props.value === '' && !group.multiple()) {
        throw new Error('[zero] ToggleGroup: an item valued "" is reserved for "nothing pressed" in single mode — give it a non-empty value');
    }

    const disabled = (): boolean => !!props.disabled || group.disabled();
    const press = createPressFeedback({
        getElement: () => el,
        isDisabled: () => disabled(),
    });

    const item: ListItem = {
        id: `toggle-${props.value}`,
        get value() { return props.value; },
        disabled: () => disabled(),
        el: () => el,
        textValue: () => el?.textContent?.trim() ?? props.value,
    };
    const unregister = group.list.register(item);
    onUnmounted(() => unregister());

    const isOn = (): boolean => group.selected().includes(props.value);

    const isTabbable = (): boolean => {
        // One tab stop: the first enabled on item, else the first enabled
        // item (Tabs' rule, generalized to a set). Decided from the model
        // first and the list second — registration isn't reactive, so an
        // item may only depend on items registered BEFORE it (render order),
        // which both list lookups below satisfy.
        if (disabled()) return false;
        const selected = group.selected();
        if (selected.includes(props.value)) {
            const firstOn = group.list.items().find((i) => selected.includes(i.value) && !i.disabled());
            return firstOn?.value === props.value;
        }
        if (selected.length > 0) return false;
        return group.list.enabledItems()[0]?.value === props.value;
    };

    const bag = (): PartProps => ({
        'data-scope': SCOPE,
        'data-part': 'item',
        'data-state': stateAttr(isOn(), 'on', 'off'),
        'data-selected': dataAttr(isOn()),
        'data-disabled': dataAttr(disabled()),
        'data-focus-visible': dataAttr(focus.visible),
        'data-orientation': group.orientation(),
        tabIndex: isTabbable() ? 0 : -1,
        'aria-pressed': isOn() ? 'true' : 'false',
        // asChild elements get the button contract supplied by hand: the
        // native <button> below carries these itself.
        'aria-disabled': props.asChild && disabled() ? 'true' : undefined,
        role: props.asChild ? 'button' : undefined,
        ref: (node: HTMLElement | null) => { el = node; },
        onClick: (e: MouseEvent) => {
            if (disabled()) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            group.toggle(props.value);
        },
        onKeydown: (e: KeyboardEvent) => {
            if (disabled()) return;
            press.onKeydown(e);
            group.keydown(e, props.value);
            // Keyboard activation for asChild elements where the platform
            // won't synthesize a click from this key (a span always; an
            // anchor on Space); where it will, ours stays out of the way.
            // `!e.repeat`: a held key must flip once per press, not strobe.
            if (props.asChild && !e.repeat && (e.key === 'Enter' || e.key === ' ') && !synthesizesClickFrom(e.currentTarget, e.key)) {
                e.preventDefault();
                group.toggle(props.value);
            }
        },
        onKeyup: press.onKeyup,
        onFocus: () => { focus.visible = isFocusVisible(el); },
        onBlur: (e: FocusEvent) => {
            press.onBlur(e);
            focus.visible = false;
        },
        onPointerdown: press.onPointerdown,
        onPointerup: press.onPointerup,
        onPointercancel: press.onPointercancel,
        onPointerleave: press.onPointerleave,
    });

    return () => {
        const b = bag();
        if (props.asChild) return renderAsChild(slots.default, b);
        return (
            <button type="button" class={props.class} disabled={disabled()} {...b}>
                {slots.default?.(b)}
            </button>
        );
    };
}, { name: 'ToggleGroup.Item' });

export const ToggleGroup = compound(ToggleGroupRoot, {
    Root: ToggleGroupRoot,
    Item: ToggleGroupItem,
});
