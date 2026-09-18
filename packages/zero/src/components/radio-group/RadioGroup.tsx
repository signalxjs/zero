/**
 * RadioGroup — native radios (shared generated `name`) under a value model.
 *
 * ```tsx
 * <RadioGroup.Root model={() => state.plan}>
 *     <RadioGroup.Item value="free">Free</RadioGroup.Item>
 *     <RadioGroup.Item value="pro">Pro</RadioGroup.Item>
 * </RadioGroup.Root>
 * // … or from data — `T` infers from `items`, the model is the posted key:
 * <RadioGroup.Root items={plans} itemKey={(p) => p.id} itemLabel={(p) => p.name} model={() => state.plan} />
 * ```
 *
 * The model is a `string` either way — what a native radio group posts —
 * so `items` needs only the KEY (the posted value, `itemKey`; defaults read
 * `value` / `id` or the primitive), the label and the disabled flag; the
 * `item` slot renders a custom label. Explicit children win entirely over
 * `items`, as on Select.
 *
 * Arrow-key roving comes from the platform (same-name radios); the group id
 * comes from `createId`, never a module counter. Each radio binds the group's
 * model with `model=` — sigx's radio processor checks the one whose `value`
 * matches and writes that value back, exactly as it would for a raw radio.
 */
import { component, compound, defineInjectable, defineProvide } from 'sigx';
import type { Define, JSXElement } from 'sigx';
import { createControllableState, createInertState, type ControllableState } from '../../behaviors/controllable.js';
import { createCollection } from '../../behaviors/collection.js';
import type { FactoryBrands, JsxProps } from '../../contract/generic.js';
import { createFormControl } from '../../behaviors/form-control.js';
import { onFormReset } from '../../behaviors/form-reset.js';
import { VISUALLY_HIDDEN_STYLE } from '../../behaviors/visually-hidden.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { dataAttr, stateAttr, type Orientation } from '../../contract/data-attrs.js';
import { variantAttrs } from '../../contract/props.js';
import type { WithClass, WithDisabled, WithFormControl, WithOrientation, WithVariantAxes } from '../../contract/props.js';
import { radioGroupAnatomy } from './anatomy.js';

const SCOPE = radioGroupAnatomy.scope;

interface RadioGroupContext {
    state: ControllableState<string>;
    name: string;
    form(): string | undefined;
    defaultValue(): string;
    disabled(): boolean;
    invalid(): boolean;
    required(): boolean;
}

function makeInert(): RadioGroupContext {
    return {
        state: createInertState<string>(''),
        name: 'zx-radio-inert',
        form: () => undefined,
        defaultValue: () => '',
        disabled: () => false,
        invalid: () => false,
        required: () => false,
    };
}

export const useRadioGroupContext = defineInjectable<RadioGroupContext>(() => makeInert());

// ── Root ──

/** The props, generic over the item `T` (inferred from `items` by the exported root). */
export type RadioGroupRootProps<T = unknown> =
    & Define.Model<string>
    & Define.Prop<'defaultValue', string, false>
    & Define.Event<'valueChange', string>
    /** The data: one radio per item, in order. Explicit children win entirely. */
    & Define.Prop<'items', ReadonlyArray<T>, false>
    /** The posted value (the model's string). Default: `value` / `id`, or the primitive. */
    & Define.Prop<'itemKey', (item: T) => string, false>
    /** The label text. Default: `label`, or the key. */
    & Define.Prop<'itemLabel', (item: T) => string, false>
    /** Default: `disabled === true`. */
    & Define.Prop<'itemDisabled', (item: T) => boolean, false>
    /** A custom label for a generated item. */
    & Define.Slot<'item', { item: T }>
    & WithFormControl
    & WithOrientation
    & WithVariantAxes<'radio-group'>
    & WithClass
    & Define.Slot<'default'>;

const RadioGroupRootImpl = component<RadioGroupRootProps>(({ props, slots, emit }) => {
    const state = createControllableState<string>(
        () => props.model,
        props.defaultValue ?? '',
        (v) => emit('valueChange', v),
    );
    const fc = createFormControl({ props: () => props, idBase: 'zx-radio' });
    // Data mode exactly when `items` is given and no children are — the
    // accessors and their defaults are the collection's (Select's).
    const items = (): ReadonlyArray<unknown> | undefined => (slots.default || props.items === undefined ? undefined : props.items);
    const collection = createCollection<unknown, string>({
        items: items() ? items : undefined,
        itemKey: props.itemKey,
        itemLabel: props.itemLabel,
        itemDisabled: props.itemDisabled,
    });

    const ctx: RadioGroupContext = {
        state,
        // The generated name is the platform's own roving: same-name radios.
        get name() { return props.name ?? fc.baseId; },
        // An UNNAMED group must not post under that generated name: an empty
        // `form` attribute matches no id, which leaves the radios owned by no
        // form (the platform's own rule) while the grouping name stays.
        form: () => (props.name === undefined ? '' : fc.form()),
        defaultValue: () => props.defaultValue ?? '',
        disabled: fc.disabled,
        invalid: fc.invalid,
        required: fc.required,
    };
    defineProvide(useRadioGroupContext, () => ctx);

    const orientation = (): Orientation => props.orientation ?? 'vertical';

    const dataContent = (): JSXElement[] => collection.items().map((item) => {
        const key = collection.keyOf(item);
        // '' is the model's "nothing chosen": an item posting it could never
        // be told from no selection.
        if (key === '') throw new Error('[zero] RadioGroup: an item keyed "" cannot be selected — give it a non-empty itemKey');
        return (
            <RadioGroupItem value={key} disabled={collection.isItemDisabled(item)} key={key}>
                {slots.item ? slots.item({ item }) : collection.labelOf(item)}
            </RadioGroupItem>
        );
    });

    return () => (
        <div
            role="radiogroup"
            data-scope={SCOPE}
            data-part="root"
            data-orientation={orientation()}
            data-disabled={dataAttr(ctx.disabled())}
            data-invalid={dataAttr(ctx.invalid())}
            data-required={dataAttr(ctx.required())}
            aria-labelledby={fc.field.inert ? undefined : fc.labelId()}
            aria-describedby={fc.describedBy()}
            {...variantAttrs(props)}
            class={props.class}
        >
            {slots.default ? slots.default() : items() ? dataContent() : null}
        </div>
    );
}, { name: 'RadioGroup.Root' });

/** The exported root: `T` infers from `items`; the model stays the posted string. */
export type RadioGroupRoot = {
    <T>(props: JsxProps<RadioGroupRootProps<T>>): JSXElement;
} & FactoryBrands;

const RadioGroupRoot = RadioGroupRootImpl as unknown as RadioGroupRoot;

// ── Item ──

export type RadioGroupItemProps =
    & Define.Prop<'value', string, true>
    & WithDisabled
    & WithClass
    & Define.Slot<'default'>;

const RadioGroupItem = component<RadioGroupItemProps>(({ props, slots, signal, onMounted, onUnmounted }) => {
    const group = useRadioGroupContext();
    let inputEl: HTMLInputElement | null = null;
    const focus = signal({ visible: false });

    // Every item restores the same group default — the same-value guard
    // makes the N writes one — and re-syncs its own radio.
    let detachReset = (): void => {};
    onMounted(() => {
        detachReset = onFormReset(() => inputEl, () => {
            group.state.value = group.defaultValue();
            if (inputEl) inputEl.checked = group.state.value === props.value;
        });
    });
    onUnmounted(() => detachReset());

    const disabled = (): boolean => !!props.disabled || group.disabled();
    const isChecked = (): boolean => group.state.value === props.value;
    const checkedState = () => stateAttr(isChecked(), 'checked', 'unchecked');

    let controlEl: HTMLElement | null = null;
    // Cross-element press: pointer on the row, keyboard on the hidden input,
    // feedback on the visible item-control.
    const press = createPressFeedback({
        getElement: () => controlEl,
        isDisabled: () => disabled(),
    });

    return () => (
        <label
            data-scope={SCOPE}
            data-part="item"
            data-state={checkedState()}
            data-disabled={dataAttr(disabled())}
            data-focus-visible={dataAttr(focus.visible)}
            class={props.class}
            onPointerdown={press.onPointerdown}
            onPointerup={press.onPointerup}
            onPointercancel={press.onPointercancel}
            onPointerleave={press.onPointerleave}
        >
            <input
                type="radio"
                data-scope={SCOPE}
                data-part="hidden-input"
                style={VISUALLY_HIDDEN_STYLE}
                name={group.name}
                form={group.form()}
                value={props.value}
                model={group.state}
                disabled={disabled()}
                required={group.required()}
                aria-invalid={group.invalid() ? 'true' : undefined}
                ref={(node: HTMLInputElement | null) => { inputEl = node; }}
                onFocus={() => { focus.visible = isFocusVisible(inputEl); }}
                onBlur={(e: FocusEvent) => {
                    press.onBlur(e);
                    focus.visible = false;
                }}
                onKeydown={press.onKeydown}
                onKeyup={press.onKeyup}
            />
            <span
                data-scope={SCOPE}
                data-part="item-control"
                data-state={checkedState()}
                data-disabled={dataAttr(disabled())}
                data-focus-visible={dataAttr(focus.visible)}
                ref={(node: HTMLElement | null) => { controlEl = node; }}
            >
                <span
                    data-scope={SCOPE}
                    data-part="item-indicator"
                    data-state={checkedState()}
                />
            </span>
            {slots.default
                ? (
                    <span
                        data-scope={SCOPE}
                        data-part="item-label"
                        data-state={checkedState()}
                        data-disabled={dataAttr(disabled())}
                    >
                        {slots.default()}
                    </span>
                )
                : null}
        </label>
    );
}, { name: 'RadioGroup.Item' });

// ── Label ──

export type RadioGroupLabelProps = WithClass & Define.Slot<'default'>;

const RadioGroupLabel = component<RadioGroupLabelProps>(({ props, slots }) => {
    const group = useRadioGroupContext();
    return () => (
        <div
            data-scope={SCOPE}
            data-part="label"
            data-disabled={dataAttr(group.disabled())}
            data-invalid={dataAttr(group.invalid())}
            data-required={dataAttr(group.required())}
            class={props.class}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'RadioGroup.Label' });

export const RadioGroup = compound(RadioGroupRoot, {
    Root: RadioGroupRoot,
    Item: RadioGroupItem,
    Label: RadioGroupLabel,
});
