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
 */
import { component, compound, defineInjectable, defineProvide } from 'sigx';
import type { Define, JSXElement } from 'sigx';
import type { FactoryBrands, JsxProps } from '../../contract/generic.js';
import { createControllableState, createInertState, type ControllableState } from '../../behaviors/controllable.js';
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
    & WithDisabled
    & WithClass
    & Define.Slot<'default'>;

const ToggleGroupRootImpl = component<ToggleGroupRootProps>(({ props, slots, emit }) => {
    const state = createControllableState<string | string[]>(
        () => props.model,
        props.defaultValue !== undefined ? props.defaultValue : props.multiple ? [] : '',
        (v) => emit('valueChange', v),
    );
    // The pressed values under either shape — a string model reads as a
    // one-element list (empty when '').
    const selected = (): string[] => {
        const v = state.value;
        if (Array.isArray(v)) return v;
        return v !== '' ? [v] : [];
    };
    const list = createListController();
    let rootEl: HTMLElement | null = null;
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
        list,
        orientation,
        disabled: () => !!props.disabled,
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

    return () => (
        <div
            role="group"
            aria-label={props.label}
            data-scope={SCOPE}
            data-part="root"
            data-orientation={orientation()}
            data-disabled={dataAttr(props.disabled)}
            {...variantAttrs(props)}
            class={props.class}
            ref={(node: HTMLElement | null) => { rootEl = node; }}
        >
            {slots.default?.()}
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
