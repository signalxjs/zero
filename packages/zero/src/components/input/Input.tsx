/**
 * Input — a single-line text field.
 *
 * ```tsx
 * <Input.Root model={() => state.email} type="email" name="email">
 *     <Input.Label>Email</Input.Label>
 *     <Input.Control>
 *         <Input.Input placeholder="you@example.com" />
 *     </Input.Control>
 * </Input.Root>
 * ```
 *
 * The model is a plain `string` and it writes through on every keystroke —
 * there is no draft/commit split. NumberInput needs one because half-typed
 * text (`-`, `1e`) is not a number; a string always is itself, so deferring
 * the write would only make the model lag the field for no gain. When an app
 * does want to defer, that is sigx's `modelModifiers` (`lazy`, `debounce`,
 * `trim`), which reach the native input exactly as they would without zero.
 *
 * Inside a `Field.Root` the control adopts the field's id, its
 * disabled/invalid/required flags and its `aria-describedby`, so `Input.Label`
 * becomes optional there. Standalone it wires its own label.
 */
import { component, compound, defineInjectable, defineProvide } from 'sigx';
import type { Define, ModelModifiers } from 'sigx';
import { createControllableState, createInertState, type ControllableState } from '../../behaviors/controllable.js';
import { createFormControl } from '../../behaviors/form-control.js';
import { onFormReset } from '../../behaviors/form-reset.js';
import { timingModifiers } from '../../behaviors/model-modifiers.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { dataAttr } from '../../contract/data-attrs.js';
import { variantAttrs } from '../../contract/props.js';
import type { WithClass, WithFormControl, WithModelModifiers, WithReadonly, WithVariantAxes } from '../../contract/props.js';
import { inputAnatomy } from './anatomy.js';

const SCOPE = inputAnatomy.scope;

/**
 * The text-shaped `input` types, and only those. `number` is NumberInput's
 * job; the selection types (`checkbox`, `radio`, `file`, `range`, `color`)
 * are different components wearing the same tag name; the date/time types
 * render browser chrome no recipe can style, so a design system could not
 * honour the anatomy for them.
 */
export type InputType = 'text' | 'email' | 'password' | 'search' | 'tel' | 'url';

interface InputContext {
    state: ControllableState<string>;
    type(): InputType;
    /** Timing modifiers for the native input (transforms are applied at the boundary). */
    modifiers(): ModelModifiers | undefined;
    name(): string | undefined;
    form(): string | undefined;
    defaultValue(): string;
    autocomplete(): string | undefined;
    maxlength(): number | undefined;
    inputId(): string;
    labelId(): string | undefined;
    describedBy(): string | undefined;
    disabled(): boolean;
    invalid(): boolean;
    required(): boolean;
    readonly(): boolean;
    focusVisible: { value: boolean };
}

function makeInert(): InputContext {
    return {
        state: createInertState<string>(''),
        type: () => 'text',
        modifiers: () => undefined,
        name: () => undefined,
        form: () => undefined,
        defaultValue: () => '',
        autocomplete: () => undefined,
        maxlength: () => undefined,
        inputId: () => 'zx-input-inert',
        labelId: () => undefined,
        describedBy: () => undefined,
        disabled: () => false,
        invalid: () => false,
        required: () => false,
        readonly: () => false,
        focusVisible: { value: false },
    };
}

export const useInputContext = defineInjectable<InputContext>(() => makeInert());

// ── Root ──

export type InputRootProps =
    & Define.Model<string>
    & Define.Prop<'defaultValue', string, false>
    & Define.Event<'valueChange', string>
    & Define.Prop<'type', InputType, false>
    /** Native autofill hint — `email`, `current-password`, `off`, … */
    & Define.Prop<'autocomplete', string, false>
    & Define.Prop<'maxlength', number, false>
    & WithFormControl
    & WithReadonly
    & WithModelModifiers
    & WithVariantAxes<'input'>
    & WithClass
    & Define.Slot<'default'>;

const InputRoot = component<InputRootProps>(({ props, slots, emit, signal }) => {
    const state = createControllableState<string>(
        () => props.model,
        props.defaultValue ?? '',
        (v) => emit('valueChange', v),
        { modifiers: () => props.modelModifiers },
    );
    const fc = createFormControl({ props: () => props, idBase: 'zx-input', controlPart: 'input' });
    const focusVisible = signal({ value: false });

    const ctx: InputContext = {
        state,
        type: () => props.type ?? 'text',
        modifiers: () => timingModifiers(props.modelModifiers),
        name: fc.name,
        form: fc.form,
        defaultValue: () => props.defaultValue ?? '',
        autocomplete: () => props.autocomplete,
        maxlength: () => props.maxlength,
        // Inside a Field the field owns the id, so its `<label for>` lands on
        // this input; standalone we mint our own.
        inputId: fc.controlId,
        labelId: fc.labelId,
        describedBy: fc.describedBy,
        disabled: fc.disabled,
        invalid: fc.invalid,
        required: fc.required,
        readonly: fc.readonly,
        focusVisible,
    };
    defineProvide(useInputContext, () => ctx);

    return () => (
        <div
            data-scope={SCOPE}
            data-part="root"
            {...fc.flags()}
            data-readonly={dataAttr(fc.readonly())}
            {...variantAttrs(props)}
            class={props.class}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Input.Root' });

// ── Label ──

export type InputLabelProps = WithClass & Define.Slot<'default'>;

const InputLabel = component<InputLabelProps>(({ props, slots }) => {
    const ctx = useInputContext();
    return () => (
        <label
            id={ctx.labelId()}
            for={ctx.inputId()}
            data-scope={SCOPE}
            data-part="label"
            data-disabled={dataAttr(ctx.disabled())}
            data-invalid={dataAttr(ctx.invalid())}
            data-required={dataAttr(ctx.required())}
            class={props.class}
        >
            {slots.default?.()}
        </label>
    );
}, { name: 'Input.Label' });

// ── Control ──

export type InputControlProps = WithClass & Define.Slot<'default'>;

const InputControl = component<InputControlProps>(({ props, slots }) => {
    const ctx = useInputContext();
    return () => (
        <div
            data-scope={SCOPE}
            data-part="control"
            data-disabled={dataAttr(ctx.disabled())}
            data-invalid={dataAttr(ctx.invalid())}
            data-readonly={dataAttr(ctx.readonly())}
            data-focus-visible={dataAttr(ctx.focusVisible.value)}
            class={props.class}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Input.Control' });

// ── Input ──

export type InputInputProps =
    & Define.Prop<'placeholder', string, false>
    & WithClass;

const InputInput = component<InputInputProps>(({ props, onMounted, onUnmounted }) => {
    const ctx = useInputContext();
    let el: HTMLInputElement | null = null;

    // Reset restores the default into the model, then the element — see
    // onFormReset for why the element needs it too.
    let detachReset = (): void => {};
    onMounted(() => {
        detachReset = onFormReset(() => el, () => {
            ctx.state.value = ctx.defaultValue();
            if (el) el.value = ctx.state.value;
        });
    });
    onUnmounted(() => detachReset());

    return () => (
        <input
            id={ctx.inputId()}
            type={ctx.type()}
            name={ctx.name()}
            form={ctx.form()}
            autoComplete={ctx.autocomplete()}
            maxLength={ctx.maxlength()}
            data-scope={SCOPE}
            data-part="input"
            data-disabled={dataAttr(ctx.disabled())}
            data-invalid={dataAttr(ctx.invalid())}
            data-required={dataAttr(ctx.required())}
            data-readonly={dataAttr(ctx.readonly())}
            data-focus-visible={dataAttr(ctx.focusVisible.value)}
            model={ctx.state}
            modelModifiers={ctx.modifiers()}
            placeholder={props.placeholder}
            disabled={ctx.disabled()}
            readOnly={ctx.readonly()}
            required={ctx.required()}
            aria-invalid={ctx.invalid() ? 'true' : undefined}
            aria-describedby={ctx.describedBy()}
            class={props.class}
            ref={(node: HTMLInputElement | null) => { el = node; }}
            onFocus={() => { ctx.focusVisible.value = isFocusVisible(el); }}
            onBlur={() => { ctx.focusVisible.value = false; }}
        />
    );
}, { name: 'Input.Input' });

export const Input = compound(InputRoot, {
    Root: InputRoot,
    Label: InputLabel,
    Control: InputControl,
    Input: InputInput,
});
