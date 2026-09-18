/**
 * Switch — an on/off toggle over a visually-hidden native checkbox with
 * `role="switch"`. The native input gives form participation, labeling and
 * platform keyboard behavior for free; the visible control/thumb are pure
 * styling surfaces.
 *
 * ```tsx
 * <Switch.Root model={() => state.enabled} color="primary">Notifications</Switch.Root>
 * ```
 */
import { component, compound } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState } from '../../behaviors/controllable.js';
import { createFormControl } from '../../behaviors/form-control.js';
import { onFormReset } from '../../behaviors/form-reset.js';
import { timingModifiers } from '../../behaviors/model-modifiers.js';
import { VISUALLY_HIDDEN_STYLE } from '../../behaviors/visually-hidden.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { dataAttr, stateAttr } from '../../contract/data-attrs.js';
import { variantAttrs } from '../../contract/props.js';
import type { WithClass, WithFormControl, WithModelModifiers, WithVariantAxes } from '../../contract/props.js';
import { switchAnatomy } from './anatomy.js';

const SCOPE = switchAnatomy.scope;

export type SwitchRootProps =
    & Define.Model<boolean>
    & Define.Prop<'defaultChecked', boolean, false>
    & Define.Event<'checkedChange', boolean>
    & Define.Prop<'value', string, false>
    & WithFormControl
    & WithModelModifiers
    & WithVariantAxes<'switch'>
    & WithClass
    & Define.Slot<'default'>;

const SwitchRoot = component<SwitchRootProps>(({ props, slots, emit, signal, onMounted, onUnmounted }) => {
    const state = createControllableState<boolean>(
        () => props.model,
        props.defaultChecked ?? false,
        (v) => emit('checkedChange', v),
    );
    const fc = createFormControl({ props: () => props, idBase: 'zx-switch' });
    let inputEl: HTMLInputElement | null = null;
    let controlEl: HTMLElement | null = null;
    const focus = signal({ visible: false });

    let detachReset = (): void => {};
    onMounted(() => {
        detachReset = onFormReset(() => inputEl, () => {
            state.value = props.defaultChecked ?? false;
            if (inputEl) inputEl.checked = state.value;
        });
    });
    onUnmounted(() => detachReset());

    // A Switch inside a Field answers to it, exactly as Checkbox does — the
    // prop wins when set, the Field supplies the rest (#269).
    const disabled = fc.disabled;
    const invalid = fc.invalid;
    const required = fc.required;
    // Cross-element press: the row (label) is the pointer target and the
    // hidden input is the keyboard target, but the feedback lands on the
    // visible control — coordinates are computed against getElement's rect.
    const press = createPressFeedback({
        getElement: () => controlEl,
        isDisabled: () => disabled(),
    });

    const checkedState = () => stateAttr(state.value, 'checked', 'unchecked');

    return () => (
        <label
            data-scope={SCOPE}
            data-part="root"
            data-state={checkedState()}
            data-disabled={dataAttr(disabled())}
            data-focus-visible={dataAttr(focus.visible)}
            data-invalid={dataAttr(invalid())}
            data-required={dataAttr(required())}
            {...variantAttrs(props)}
            class={props.class}
            onPointerdown={press.onPointerdown}
            onPointerup={press.onPointerup}
            onPointercancel={press.onPointercancel}
            onPointerleave={press.onPointerleave}
        >
            <input
                type="checkbox"
                role="switch"
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
                value={props.value ?? 'on'}
                aria-invalid={invalid() ? 'true' : undefined}
                aria-describedby={fc.describedBy()}
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
                    data-part="thumb"
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
                    >
                        {slots.default()}
                    </span>
                )
                : null}
        </label>
    );
}, { name: 'Switch.Root' });

export const Switch = compound(SwitchRoot, {
    Root: SwitchRoot,
});
