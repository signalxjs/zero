/**
 * Field — the wiring hub for a labeled form control.
 *
 * ```tsx
 * <Field.Root invalid={!!error}>
 *     <Field.Label>Email</Field.Label>
 *     <Checkbox.Root>Subscribe</Checkbox.Root>
 *     <Field.Description>We never spam.</Field.Description>
 *     {error && <Field.Error>{error}</Field.Error>}
 * </Field.Root>
 * ```
 *
 * Any zero form control inside adopts the field's control id, disabled/
 * invalid/required flags and `aria-describedby` automatically — and its
 * `size`, when the control sets none of its own, so a compact field is
 * `<Field.Root size="xs">` rather than a size on every part.
 */
import { component, compound } from 'sigx';
import type { Define } from 'sigx';
import { createId } from '../../behaviors/create-id.js';
import { countPresence, reportPresence, settleAfterMount } from '../../behaviors/part-presence.js';
import { provideFieldContext, useFieldContext, type FieldContext } from '../../behaviors/field.js';
import { dataAttr } from '../../contract/data-attrs.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type { WithClass, WithDisabled, WithHtmlAttrs, WithInvalid, WithReadonly, WithRequired, WithVariantAxes, WithVisuallyHidden } from '../../contract/props.js';
import { fieldAnatomy } from './anatomy.js';

const SCOPE = fieldAnatomy.scope;

export type FieldRootProps =
    & WithDisabled
    & WithInvalid
    & WithRequired
    & WithReadonly
    & WithVariantAxes<'field'>
    & WithClass
    & WithHtmlAttrs
    & Define.Slot<'default'>;

const FieldRoot = component<FieldRootProps>(({ props, slots, signal, onMounted }) => {
    const baseId = createId('zx-field');
    // Reported by Field.Description and Field.Error (`reportPresence`), so a
    // control's `aria-describedby` names only what is rendered and never
    // dangles — optimistic until settled after mount, so server markup (and
    // the hydrating first render) keeps both ids.
    const present = signal({ description: 0, error: 0, settled: false });
    settleAfterMount(onMounted, () => { present.settled = true; });
    const ids = {
        control: `${baseId}-control`,
        label: `${baseId}-label`,
        description: `${baseId}-desc`,
        error: `${baseId}-error`,
    };
    const ctx: FieldContext = {
        inert: false,
        ids,
        disabled: () => !!props.disabled,
        invalid: () => !!props.invalid,
        required: () => !!props.required,
        readonly: () => !!props.readonly,
        size: () => props.size,
        describedBy: () => {
            if (!present.settled) return `${ids.description} ${ids.error}`;
            return [
                present.description > 0 ? ids.description : undefined,
                present.error > 0 ? ids.error : undefined,
            ].filter(Boolean).join(' ') || undefined;
        },
        setDescriptionPresent: (p) => { present.description = countPresence(present.description, p); },
        setErrorPresent: (p) => { present.error = countPresence(present.error, p); },
    };
    provideFieldContext(ctx);

    return () => (
        <div
            {...htmlAttrs(props)}
            data-scope={SCOPE}
            data-part="root"
            data-disabled={dataAttr(props.disabled)}
            data-invalid={dataAttr(props.invalid)}
            data-required={dataAttr(props.required)}
            data-readonly={dataAttr(props.readonly)}
            {...variantAttrs(props)}
            class={props.class}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Field.Root' });

export type FieldLabelProps =
    & WithClass
    & WithVisuallyHidden
    /** Not `id`: the control is labelled by the Label's own. */
    & Omit<WithHtmlAttrs, 'id'>
    & Define.Slot<'default'>;

const FieldLabel = component<FieldLabelProps>(({ props, slots }) => {
    const field = useFieldContext();
    return () => (
        <label
            {...htmlAttrs(props)}
            id={field.ids.label}
            for={field.ids.control}
            data-scope={SCOPE}
            data-part="label"
            data-disabled={dataAttr(field.disabled())}
            data-invalid={dataAttr(field.invalid())}
            data-required={dataAttr(field.required())}
            data-visually-hidden={dataAttr(props.visuallyHidden)}
            class={props.class}
        >
            {slots.default?.()}
        </label>
    );
}, { name: 'Field.Label' });

/** Not `id`: the control's `aria-describedby` points at the Description's own. */
export type FieldDescriptionProps = WithClass & Omit<WithHtmlAttrs, 'id'> & Define.Slot<'default'>;

const FieldDescription = component<FieldDescriptionProps>(({ props, slots, onUnmounted }) => {
    const field = useFieldContext();
    reportPresence((p) => field.setDescriptionPresent?.(p), onUnmounted);
    return () => (
        <p {...htmlAttrs(props)} id={field.ids.description} data-scope={SCOPE} data-part="description" class={props.class}>
            {slots.default?.()}
        </p>
    );
}, { name: 'Field.Description' });

/** Not `id` (the control's `aria-describedby` points at it) nor `role` (an `alert`). */
export type FieldErrorProps = WithClass & Omit<WithHtmlAttrs, 'id' | 'role'> & Define.Slot<'default'>;

const FieldError = component<FieldErrorProps>(({ props, slots, onUnmounted }) => {
    const field = useFieldContext();
    reportPresence((p) => field.setErrorPresent?.(p), onUnmounted);
    return () => (
        <p
            {...htmlAttrs(props)}
            id={field.ids.error}
            data-scope={SCOPE}
            data-part="error"
            data-invalid={dataAttr(field.invalid())}
            role="alert"
            class={props.class}
        >
            {slots.default?.()}
        </p>
    );
}, { name: 'Field.Error' });

export const Field = compound(FieldRoot, {
    Root: FieldRoot,
    Label: FieldLabel,
    Description: FieldDescription,
    Error: FieldError,
});
