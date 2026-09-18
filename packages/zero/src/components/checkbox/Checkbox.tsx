/**
 * Checkbox — tri-state over a visually-hidden native checkbox.
 *
 * ```tsx
 * <Checkbox.Root model={() => state.agreed} color="primary">Accept the terms</Checkbox.Root>
 * ```
 *
 * The model is the native checkbox's: a `boolean`, or — bound to a `string[]`
 * — sigx's ARRAY MODE, where several boxes sharing one model toggle their
 * own `value`'s membership (`<Checkbox.Root model={() => state.tags}
 * value="news">`). Zero adds nothing here; the hidden input binds with
 * `model=` and the platform processor does what it does for a raw checkbox.
 * `checkedChange` always reports THIS box's state.
 *
 * Inside a `Field.Root`, the input adopts the field's control id and
 * disabled/invalid/required flags automatically.
 */
import { component, compound, effect } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState } from '../../behaviors/controllable.js';
import { createFormControl } from '../../behaviors/form-control.js';
import { onFormReset } from '../../behaviors/form-reset.js';
import { timingModifiers } from '../../behaviors/model-modifiers.js';
import { VISUALLY_HIDDEN_STYLE } from '../../behaviors/visually-hidden.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { dataAttr } from '../../contract/data-attrs.js';
import { htmlAttrs } from '../../contract/props.js';
import type { HtmlAttrValue, WithClass, WithFormControl, WithHtmlAttrs, WithModelModifiers, WithVariantAxes } from '../../contract/props.js';
import { checkboxAnatomy } from './anatomy.js';

const SCOPE = checkboxAnatomy.scope;

export type CheckboxRootProps =
    & Define.Model<boolean | string[]>
    & Define.Prop<'defaultChecked', boolean, false>
    & Define.Event<'checkedChange', boolean>
    & Define.Prop<'indeterminate', boolean, false>
    & Define.Prop<'value', string, false>
    & WithFormControl
    & WithModelModifiers
    & WithVariantAxes<'checkbox'>
    & WithClass
    /**
     * Forwarded attributes, split: `aria-*` goes to the hidden input (the
     * control assistive tech reads; an app `aria-describedby` joins the
     * Field's), `id`, `title` and `data-*` to the root. Not `role`: the
     * input is a native checkbox.
     */
    & Omit<WithHtmlAttrs, 'role'>
    /**
     * Hide the label from sight and keep it as the control's name — for a
     * checkbox whose row, not its own text, says what it is. Renders the
     * `label` part with `data-visually-hidden` (see `WithVisuallyHidden`).
     */
    & Define.Prop<'hideLabel', boolean, false>
    & Define.Slot<'default'>;

const CheckboxRoot = component<CheckboxRootProps>(({ props, slots, emit, signal, onMounted, onUnmounted }) => {
    // The posted value; also the membership key in array mode.
    const itemValue = (): string => props.value ?? 'on';
    const checkedOf = (v: boolean | string[]): boolean => (Array.isArray(v) ? v.includes(itemValue()) : v);
    const state = createControllableState<boolean | string[]>(
        () => props.model,
        props.defaultChecked ?? false,
        (v) => emit('checkedChange', checkedOf(v)),
    );
    const fc = createFormControl({ props: () => props, idBase: 'zx-checkbox' });
    let inputEl: HTMLInputElement | null = null;
    const focus = signal({ visible: false });

    let detachReset = (): void => {};
    onMounted(() => {
        effect(() => {
            const indeterminate = !!props.indeterminate;
            if (inputEl) inputEl.indeterminate = indeterminate;
        });
        detachReset = onFormReset(() => inputEl, () => {
            const def = props.defaultChecked ?? false;
            const current = state.value;
            // Array mode: this box restores its OWN membership, not the array.
            state.value = Array.isArray(current)
                ? (def ? (current.includes(itemValue()) ? current : [...current, itemValue()]) : current.filter((v) => v !== itemValue()))
                : def;
            if (inputEl) inputEl.checked = checkedOf(state.value);
        });
    });
    onUnmounted(() => detachReset());

    const disabled = fc.disabled;
    const invalid = fc.invalid;
    const required = fc.required;
    const checkedState = (): string =>
        props.indeterminate ? 'indeterminate' : checkedOf(state.value) ? 'checked' : 'unchecked';

    let controlEl: HTMLElement | null = null;
    // Cross-element press: pointer on the row, keyboard on the hidden input,
    // feedback on the visible control.
    const press = createPressFeedback({
        getElement: () => controlEl,
        isDisabled: () => disabled(),
    });

    return () => {
        // Split like Table.Root's: `aria-*` names the control — the input
        // assistive tech reads — and `id`, `title` and `data-*` land on the
        // root the app addresses.
        const rootAttrs: Record<string, HtmlAttrValue> = {};
        const inputAttrs: Record<string, HtmlAttrValue> = {};
        for (const [key, value] of Object.entries(htmlAttrs(props))) {
            (key.startsWith('aria-') ? inputAttrs : rootAttrs)[key] = value;
        }
        return (
            <label
                {...rootAttrs}
                data-scope={SCOPE}
                data-part="root"
                data-state={checkedState()}
                data-disabled={dataAttr(disabled())}
                data-focus-visible={dataAttr(focus.visible)}
                data-invalid={dataAttr(invalid())}
                data-required={dataAttr(required())}
                {...fc.axisAttrs()}
                class={props.class}
                onPointerdown={press.onPointerdown}
                onPointerup={press.onPointerup}
                onPointercancel={press.onPointercancel}
                onPointerleave={press.onPointerleave}
            >
                <input
                    {...inputAttrs}
                    type="checkbox"
                    id={fc.field.inert ? undefined : fc.controlId()}
                    data-scope={SCOPE}
                    data-part="hidden-input"
                    style={VISUALLY_HIDDEN_STYLE}
                    model={state}
                    modelModifiers={timingModifiers(props.modelModifiers)}
                    disabled={disabled()}
                    required={required()}
                    name={fc.name()}
                    form={fc.form()}
                    value={itemValue()}
                    aria-invalid={invalid() ? 'true' : undefined}
                    aria-describedby={[fc.describedBy(), inputAttrs['aria-describedby']].filter(Boolean).join(' ') || undefined}
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
                    data-part="control"
                    data-state={checkedState()}
                    data-disabled={dataAttr(disabled())}
                    data-focus-visible={dataAttr(focus.visible)}
                    data-invalid={dataAttr(invalid())}
                    ref={(node: HTMLElement | null) => { controlEl = node; }}
                >
                    <span
                        data-scope={SCOPE}
                        data-part="indicator"
                        data-state={checkedState()}
                    />
                </span>
                {slots.default
                    ? (
                        <span
                            data-scope={SCOPE}
                            data-part="label"
                            data-state={checkedState()}
                            data-disabled={dataAttr(disabled())}
                            data-visually-hidden={dataAttr(props.hideLabel)}
                        >
                            {slots.default()}
                        </span>
                    )
                    : null}
            </label>
        );
    };
}, { name: 'Checkbox.Root' });

export const Checkbox = compound(CheckboxRoot, {
    Root: CheckboxRoot,
});
