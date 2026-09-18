/**
 * Textarea — a multi-line text field.
 *
 * ```tsx
 * <Textarea.Root model={() => state.bio} name="bio" rows={4}>
 *     <Textarea.Label>Bio</Textarea.Label>
 *     <Textarea.Textarea placeholder="Tell us about yourself" />
 * </Textarea.Root>
 * ```
 *
 * Input's shape minus the `control` box: there is no inside to a textarea for
 * anything to sit in, so the chrome draws on the element itself. Everything
 * else matches — a plain `string` model written through on every keystroke,
 * and the same Field adoption.
 *
 * Resize is left to the design system (`resize: vertical` is the usual
 * choice). Zero does not auto-size the box: growing it means measuring
 * scrollHeight against a collapsed height every keystroke, which is a layout
 * behavior, not an anatomy one.
 */
import { component, compound, defineInjectable, defineProvide } from 'sigx';
import type { Define, ModelModifiers } from 'sigx';
import { createControllableState, createInertState, type ControllableState } from '../../behaviors/controllable.js';
import { createFormControl } from '../../behaviors/form-control.js';
import { onFormReset } from '../../behaviors/form-reset.js';
import { timingModifiers } from '../../behaviors/model-modifiers.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { dataAttr } from '../../contract/data-attrs.js';
import { htmlAttrs } from '../../contract/props.js';
import type {
    TextControlHandle,
    WithClass,
    WithFormControl,
    WithHtmlAttrs,
    WithModelModifiers,
    WithReadonly,
    WithTextControlEvents,
    WithVariantAxes,
    WithVisuallyHidden,
} from '../../contract/props.js';
import { textareaAnatomy } from './anatomy.js';

const SCOPE = textareaAnatomy.scope;

interface TextareaContext {
    state: ControllableState<string>;
    /** Timing modifiers for the native textarea (transforms are applied at the boundary). */
    modifiers(): ModelModifiers | undefined;
    name(): string | undefined;
    form(): string | undefined;
    defaultValue(): string;
    autocomplete(): string | undefined;
    maxlength(): number | undefined;
    rows(): number | undefined;
    controlId(): string;
    labelId(): string | undefined;
    describedBy(): string | undefined;
    disabled(): boolean;
    invalid(): boolean;
    required(): boolean;
    readonly(): boolean;
    focusVisible: { value: boolean };
}

function makeInert(): TextareaContext {
    return {
        state: createInertState<string>(''),
        modifiers: () => undefined,
        name: () => undefined,
        form: () => undefined,
        defaultValue: () => '',
        autocomplete: () => undefined,
        maxlength: () => undefined,
        rows: () => undefined,
        controlId: () => 'zx-textarea-inert',
        labelId: () => undefined,
        describedBy: () => undefined,
        disabled: () => false,
        invalid: () => false,
        required: () => false,
        readonly: () => false,
        focusVisible: { value: false },
    };
}

export const useTextareaContext = defineInjectable<TextareaContext>(() => makeInert());

// ── Root ──

export type TextareaRootProps =
    & Define.Model<string>
    & Define.Prop<'defaultValue', string, false>
    & Define.Event<'valueChange', string>
    /** Native autofill hint — `street-address`, `off`, … */
    & Define.Prop<'autocomplete', string, false>
    & Define.Prop<'maxlength', number, false>
    & Define.Prop<'rows', number, false>
    & WithFormControl
    & WithReadonly
    & WithModelModifiers
    & WithVariantAxes<'textarea'>
    & WithClass
    & Define.Slot<'default'>;

const TextareaRoot = component<TextareaRootProps>(({ props, slots, emit, signal }) => {
    const state = createControllableState<string>(
        () => props.model,
        props.defaultValue ?? '',
        (v) => emit('valueChange', v),
        { modifiers: () => props.modelModifiers },
    );
    const fc = createFormControl({ props: () => props, idBase: 'zx-textarea' });
    const focusVisible = signal({ value: false });

    const ctx: TextareaContext = {
        state,
        modifiers: () => timingModifiers(props.modelModifiers),
        name: fc.name,
        form: fc.form,
        defaultValue: () => props.defaultValue ?? '',
        autocomplete: () => props.autocomplete,
        maxlength: () => props.maxlength,
        rows: () => props.rows,
        controlId: fc.controlId,
        labelId: fc.labelId,
        describedBy: fc.describedBy,
        disabled: fc.disabled,
        invalid: fc.invalid,
        required: fc.required,
        readonly: fc.readonly,
        focusVisible,
    };
    defineProvide(useTextareaContext, () => ctx);

    return () => (
        <div
            data-scope={SCOPE}
            data-part="root"
            {...fc.flags()}
            data-readonly={dataAttr(fc.readonly())}
            {...fc.axisAttrs()}
            class={props.class}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Textarea.Root' });

// ── Label ──

export type TextareaLabelProps = WithClass & WithVisuallyHidden & Define.Slot<'default'>;

const TextareaLabel = component<TextareaLabelProps>(({ props, slots }) => {
    const ctx = useTextareaContext();
    return () => (
        <label
            id={ctx.labelId()}
            for={ctx.controlId()}
            data-scope={SCOPE}
            data-part="label"
            data-disabled={dataAttr(ctx.disabled())}
            data-invalid={dataAttr(ctx.invalid())}
            data-required={dataAttr(ctx.required())}
            data-visually-hidden={dataAttr(props.visuallyHidden)}
            class={props.class}
        >
            {slots.default?.()}
        </label>
    );
}, { name: 'Textarea.Label' });

// ── Textarea ──

/** What `<Textarea.Textarea ref={…}>` receives — the element, and `focus()`. */
export type TextareaHandle = TextControlHandle<HTMLTextAreaElement>;

export type TextareaTextareaProps =
    & Define.Prop<'placeholder', string, false>
    & WithTextControlEvents
    /**
     * Forwarded attributes (`aria-*`, `data-*`, `title`, `role`) — what a
     * combobox-style composer sets on its control. Not `id`: the control's
     * id is the form contract's (the Label and the Field point at it), as is
     * `aria-invalid` (the `invalid` prop). An app `aria-describedby` joins
     * the Field's rather than replacing it.
     */
    & Omit<WithHtmlAttrs, 'id'>
    & WithClass
    & Define.Expose<TextareaHandle>;

const TextareaTextarea = component<TextareaTextareaProps>(({ props, expose, onMounted, onUnmounted }) => {
    const ctx = useTextareaContext();
    let el: HTMLTextAreaElement | null = null;

    // The app's onInput is attached at mount, not in the JSX: sigx appends
    // the model's own listener after every declared prop, so a JSX onInput
    // would run BEFORE the model took the value. Registered later, it runs
    // after — the handler reads the new value from its model.
    const onInput = (e: Event): void => props.onInput?.(e);
    let detachInput = (): void => {};

    let detachReset = (): void => {};
    onMounted(() => {
        const node = el;
        node?.addEventListener('input', onInput);
        detachInput = () => node?.removeEventListener('input', onInput);
        detachReset = onFormReset(() => el, () => {
            ctx.state.value = ctx.defaultValue();
            if (el) el.value = ctx.state.value;
        });
    });
    onUnmounted(() => {
        detachReset();
        detachInput();
    });

    expose({
        get element() { return el; },
        focus: (options?: FocusOptions) => el?.focus(options),
    });

    return () => {
        const attrs = htmlAttrs(props);
        const describedBy = [ctx.describedBy(), attrs['aria-describedby']].filter(Boolean).join(' ') || undefined;
        return (
            <textarea
                {...attrs}
                id={ctx.controlId()}
                name={ctx.name()}
                form={ctx.form()}
                autoComplete={ctx.autocomplete()}
                maxLength={ctx.maxlength()}
                rows={ctx.rows()}
                data-scope={SCOPE}
                data-part="textarea"
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
                aria-describedby={describedBy}
                class={props.class}
                ref={(node: HTMLTextAreaElement | null) => { el = node; }}
                onBeforeinput={props.onBeforeinput}
                onKeydown={props.onKeydown}
                onKeyup={props.onKeyup}
                onCompositionstart={props.onCompositionstart}
                onCompositionend={props.onCompositionend}
                onFocus={(e: FocusEvent) => {
                    ctx.focusVisible.value = isFocusVisible(el);
                    props.onFocus?.(e);
                }}
                onBlur={(e: FocusEvent) => {
                    ctx.focusVisible.value = false;
                    props.onBlur?.(e);
                }}
            />
        );
    };
}, { name: 'Textarea.Textarea' });

export const Textarea = compound(TextareaRoot, {
    Root: TextareaRoot,
    Label: TextareaLabel,
    Textarea: TextareaTextarea,
});
