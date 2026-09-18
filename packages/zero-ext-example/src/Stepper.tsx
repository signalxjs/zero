/**
 * Stepper — a wizard-step selector, and the acceptance test that a component
 * zero doesn't ship can be built ENTIRELY from zero's public surface.
 *
 * ```tsx
 * <Stepper.Root defaultStep="details" label="Checkout">
 *     <Stepper.Item value="cart">Cart</Stepper.Item>
 *     <Stepper.Item value="details">Details</Stepper.Item>
 *     <Stepper.Item value="pay">Pay</Stepper.Item>
 * </Stepper.Root>
 * ```
 *
 * Every import below is `sigx` or `@sigx/zero`'s public API — never a path
 * into zero's src. Arrow keys rove focus without changing the step (the
 * Tabs/ToggleGroup convention); click/Space/Enter select. A step BEFORE the
 * current one renders `data-state="complete"`, derived from registration
 * order, which is DOM order.
 */
import { component, compound, defineInjectable, defineProvide } from 'sigx';
import type { Define } from 'sigx';
import {
    createControllableState,
    createInertState,
    createListController,
    createPressFeedback,
    createRovingKeydown,
    dataAttr,
    isFocusVisible,
    renderAsChild,
    synthesizesClickFrom,
    variantAttrs,
} from '@sigx/zero';
import type {
    ControllableState,
    ListController,
    ListItem,
    PartProps,
    WithAsChild,
    WithClass,
    WithDisabled,
    WithVariantAxesOpen,
} from '@sigx/zero';
import { stepperAnatomy } from './anatomy.js';

const SCOPE = stepperAnatomy.scope;

interface StepperContext {
    state: ControllableState<string>;
    list: ListController;
    disabled(): boolean;
    select(value: string): void;
    keydown(e: KeyboardEvent, value: string): void;
}

function makeInert(): StepperContext {
    return {
        state: createInertState<string>(''),
        list: createListController(),
        disabled: () => false,
        select: () => {},
        keydown: () => {},
    };
}

export const useStepperContext = defineInjectable<StepperContext>(() => makeInert());

// ── Root ──

export type StepperRootProps =
    & Define.Model<string>
    & Define.Prop<'defaultStep', string, false>
    & Define.Event<'stepChange', string>
    & Define.Prop<'loop', boolean, false>
    /** Accessible name for the `role="group"` container (`aria-label`). */
    & Define.Prop<'label', string, false>
    & WithVariantAxesOpen<'ext-stepper'>
    & WithDisabled
    & WithClass
    & Define.Slot<'default'>;

const StepperRoot = component<StepperRootProps>(({ props, slots, emit }) => {
    const state = createControllableState<string>(
        () => props.model,
        props.defaultStep ?? '',
        (v) => emit('stepChange', v),
    );
    const list = createListController();

    const roving = createRovingKeydown({
        list,
        orientation: () => 'horizontal',
        loop: () => props.loop ?? false,
        // Focus moves, the step doesn't: selection is click/Space/Enter only.
        onMove: () => {},
    });

    const ctx: StepperContext = {
        state,
        list,
        disabled: () => !!props.disabled,
        select: (value) => { state.value = value; },
        keydown: roving,
    };
    defineProvide(useStepperContext, () => ctx);

    return () => (
        <div
            role="group"
            aria-label={props.label}
            data-scope={SCOPE}
            data-part="root"
            data-disabled={dataAttr(props.disabled)}
            {...variantAttrs(props)}
            class={props.class}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Stepper.Root' });

// ── Item ──

export type StepperItemProps =
    & Define.Prop<'value', string, true>
    & WithDisabled
    & WithClass
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const StepperItem = component<StepperItemProps>(({ props, slots, onUnmounted, signal }) => {
    const stepper = useStepperContext();
    let el: HTMLElement | null = null;
    const focus = signal({ visible: false });

    const disabled = (): boolean => !!props.disabled || stepper.disabled();
    const press = createPressFeedback({
        getElement: () => el,
        isDisabled: () => disabled(),
    });

    const item: ListItem = {
        id: `step-${props.value}`,
        get value() { return props.value; },
        disabled: () => disabled(),
        el: () => el,
        textValue: () => el?.textContent?.trim() ?? props.value,
    };
    const unregister = stepper.list.register(item);
    onUnmounted(() => unregister());

    const phase = (): 'active' | 'complete' | 'inactive' => {
        const current = stepper.state.value;
        // No step set (uncontrolled, no defaultStep): nothing is active and
        // nothing has been walked past — the same "no active step" reading
        // isTabbable takes, which otherwise diverges here into every item
        // claiming complete via the indexOf(-1) path below.
        if (!current) return 'inactive';
        if (props.value === current) return 'active';
        // Registration isn't reactive, so at first render an item may only
        // depend on items registered BEFORE it (DOM order) plus the model.
        // That is enough: the active step absent from the list means it
        // registers after me — I am before it, hence complete. Once it is
        // registered (every later recompute — phases re-derive when the
        // model changes, and by then the list is full), plain index order
        // decides.
        const values = stepper.list.items().map((i) => i.value);
        const active = values.indexOf(current);
        if (active === -1) return 'complete';
        const mine = values.indexOf(props.value);
        return mine !== -1 && mine < active ? 'complete' : 'inactive';
    };

    const isTabbable = (): boolean => {
        // One tab stop: the active step, else the first enabled item. Decided
        // from the model FIRST (same registration constraint as `phase`): a
        // set model names the tab stop by value, no list lookup needed.
        if (disabled()) return false;
        const current = stepper.state.value;
        if (current) return props.value === current;
        return stepper.list.enabledItems()[0]?.value === props.value;
    };

    const bag = (): PartProps => ({
        'data-scope': SCOPE,
        'data-part': 'item',
        'data-state': phase(),
        'data-disabled': dataAttr(disabled()),
        'data-focus-visible': dataAttr(focus.visible),
        tabIndex: isTabbable() ? 0 : -1,
        'aria-current': phase() === 'active' ? 'step' : undefined,
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
            stepper.select(props.value);
        },
        onKeydown: (e: KeyboardEvent) => {
            if (disabled()) return;
            press.onKeydown(e);
            stepper.keydown(e, props.value);
            // Keyboard activation for asChild elements where the platform
            // won't synthesize a click from this key; where it will, ours
            // stays out of the way (double activation is the failure mode
            // `synthesizesClickFrom` exists to remove).
            if (props.asChild && !e.repeat && (e.key === 'Enter' || e.key === ' ') && !synthesizesClickFrom(e.currentTarget, e.key)) {
                e.preventDefault();
                stepper.select(props.value);
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
}, { name: 'Stepper.Item' });

export const Stepper = compound(StepperRoot, {
    Root: StepperRoot,
    Item: StepperItem,
});
