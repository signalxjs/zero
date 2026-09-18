/**
 * Steps — a wizard's step rail.
 *
 * ```tsx
 * <Steps.Root defaultStep="details" label="Checkout">
 *     <Steps.Item value="cart">
 *         <Steps.Indicator>1</Steps.Indicator>
 *         <Steps.Title>Cart</Steps.Title>
 *         <Steps.Separator />
 *     </Steps.Item>
 *     <Steps.Item value="details">
 *         <Steps.Indicator>2</Steps.Indicator>
 *         <Steps.Title>Details</Steps.Title>
 *     </Steps.Item>
 * </Steps.Root>
 * ```
 *
 * The behavior is the promoted ext-stepper pattern verbatim: arrow keys
 * rove focus without changing the step (the Tabs/ToggleGroup convention,
 * here orientation-aware), click/Space/Enter select, one tab stop on the
 * active step, and `complete` derives from registration order — DOM order.
 * See `anatomy.ts` for the promotion notes and the state decisions.
 */
import { component, compound, defineInjectable, defineProvide } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState, createInertState, type ControllableState } from '../../behaviors/controllable.js';
import { createListController, type ListController, type ListItem } from '../../behaviors/list.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { createRovingKeydown } from '../../behaviors/roving.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { dataAttr } from '../../contract/data-attrs.js';
import type { Orientation } from '../../contract/data-attrs.js';
import { renderAsChild, synthesizesClickFrom } from '../../contract/as-child.js';
import { variantAttrs } from '../../contract/props.js';
import type { PartProps, WithAsChild, WithClass, WithDisabled, WithOrientation, WithVariantAxes } from '../../contract/props.js';
import { stepsAnatomy } from './anatomy.js';

const SCOPE = stepsAnatomy.scope;

export type StepsPhase = 'active' | 'complete' | 'inactive';

interface StepsContext {
    state: ControllableState<string>;
    list: ListController;
    orientation(): Orientation;
    disabled(): boolean;
    select(value: string): void;
    keydown(e: KeyboardEvent, value: string): void;
}

interface StepsItemContext {
    phase(): StepsPhase;
}

function makeInert(): StepsContext {
    return {
        state: createInertState<string>(''),
        list: createListController(),
        orientation: () => 'horizontal',
        disabled: () => false,
        select: () => {},
        keydown: () => {},
    };
}

export const useStepsContext = defineInjectable<StepsContext>(() => makeInert());
export const useStepsItemContext = defineInjectable<StepsItemContext>(() => ({
    phase: () => 'inactive',
}));

// ── Root ──

export type StepsRootProps =
    & Define.Model<string>
    & Define.Prop<'defaultStep', string, false>
    & Define.Event<'stepChange', string>
    & Define.Prop<'loop', boolean, false>
    /** Accessible name for the `role="group"` container (`aria-label`). */
    & Define.Prop<'label', string, false>
    & WithOrientation
    & WithVariantAxes<'steps'>
    & WithDisabled
    & WithClass
    & Define.Slot<'default'>;

const StepsRoot = component<StepsRootProps>(({ props, slots, emit }) => {
    const state = createControllableState<string>(
        () => props.model,
        props.defaultStep ?? '',
        (v) => emit('stepChange', v),
    );
    const list = createListController();
    const orientation = (): Orientation => props.orientation ?? 'horizontal';

    const roving = createRovingKeydown({
        list,
        orientation,
        loop: () => props.loop ?? false,
        // Focus moves, the step doesn't: selection is click/Space/Enter only.
        onMove: () => {},
    });

    const ctx: StepsContext = {
        state,
        list,
        orientation,
        disabled: () => !!props.disabled,
        select: (value) => { state.value = value; },
        keydown: roving,
    };
    defineProvide(useStepsContext, () => ctx);

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
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Steps.Root' });

// ── Item ──

export type StepsItemProps =
    & Define.Prop<'value', string, true>
    & WithDisabled
    & WithClass
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const StepsItem = component<StepsItemProps>(({ props, slots, onUnmounted, signal }) => {
    const steps = useStepsContext();
    let el: HTMLElement | null = null;
    const focus = signal({ visible: false });

    const disabled = (): boolean => !!props.disabled || steps.disabled();
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
    const unregister = steps.list.register(item);
    onUnmounted(() => unregister());

    const phase = (): StepsPhase => {
        const current = steps.state.value;
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
        const values = steps.list.items().map((i) => i.value);
        const active = values.indexOf(current);
        if (active === -1) return 'complete';
        const mine = values.indexOf(props.value);
        return mine !== -1 && mine < active ? 'complete' : 'inactive';
    };
    defineProvide(useStepsItemContext, () => ({ phase }));

    const isTabbable = (): boolean => {
        // One tab stop: the active step, else the first enabled item.
        if (disabled()) return false;
        const current = steps.state.value;
        if (current) return props.value === current;
        return steps.list.enabledItems()[0]?.value === props.value;
    };

    const bag = (): PartProps => ({
        'data-scope': SCOPE,
        'data-part': 'item',
        'data-state': phase(),
        'data-orientation': steps.orientation(),
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
            steps.select(props.value);
        },
        onKeydown: (e: KeyboardEvent) => {
            if (disabled()) return;
            press.onKeydown(e);
            steps.keydown(e, props.value);
            // Keyboard activation for asChild elements where the platform
            // won't synthesize a click from this key; where it will, ours
            // stays out of the way (double activation is the failure mode
            // `synthesizesClickFrom` exists to remove).
            if (props.asChild && !e.repeat && (e.key === 'Enter' || e.key === ' ') && !synthesizesClickFrom(e.currentTarget, e.key)) {
                e.preventDefault();
                steps.select(props.value);
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
}, { name: 'Steps.Item' });

// ── Bands ──

export type StepsPartProps = WithClass & Define.Slot<'default'>;

// NOT aria-hidden, unlike the separator: the indicator's content is the
// step's number, which is information ("step 2"), and for an item rendered
// with only an indicator it is the button's entire accessible name — hiding
// it would leave that button nameless. A consumer whose indicator is purely
// decorative wraps the decoration in its own aria-hidden element.
const StepsIndicator = component<StepsPartProps>(({ props, slots }) => {
    const item = useStepsItemContext();
    return () => (
        <span
            data-scope={SCOPE}
            data-part="indicator"
            data-state={item.phase()}
            class={props.class}
        >
            {slots.default?.()}
        </span>
    );
}, { name: 'Steps.Indicator' });

const StepsSeparator = component<WithClass>(({ props }) => {
    const steps = useStepsContext();
    const item = useStepsItemContext();
    return () => (
        <span
            aria-hidden="true"
            data-scope={SCOPE}
            data-part="separator"
            data-state={item.phase() === 'complete' ? 'complete' : 'inactive'}
            data-orientation={steps.orientation()}
            class={props.class}
        />
    );
}, { name: 'Steps.Separator' });

const StepsTitle = component<StepsPartProps>(({ props, slots }) => (
    () => (
        <span data-scope={SCOPE} data-part="title" class={props.class}>
            {slots.default?.()}
        </span>
    )
), { name: 'Steps.Title' });

const StepsDescription = component<StepsPartProps>(({ props, slots }) => (
    () => (
        <span data-scope={SCOPE} data-part="description" class={props.class}>
            {slots.default?.()}
        </span>
    )
), { name: 'Steps.Description' });

export const Steps = compound(StepsRoot, {
    Root: StepsRoot,
    Item: StepsItem,
    Indicator: StepsIndicator,
    Separator: StepsSeparator,
    Title: StepsTitle,
    Description: StepsDescription,
});
