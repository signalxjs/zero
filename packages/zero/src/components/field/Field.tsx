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
 * invalid/required flags and `aria-describedby` automatically.
 */
import { component, compound } from 'sigx';
import type { Define } from 'sigx';
import { createId } from '../../behaviors/create-id.js';
import { provideFieldContext, useFieldContext, type FieldContext } from '../../behaviors/field.js';
import { dataAttr } from '../../contract/data-attrs.js';
import { variantAttrs } from '../../contract/props.js';
import type { WithClass, WithDisabled, WithInvalid, WithReadonly, WithRequired, WithVariantAxes } from '../../contract/props.js';
import { fieldAnatomy } from './anatomy.js';

const SCOPE = fieldAnatomy.scope;

export type FieldRootProps =
    & WithDisabled
    & WithInvalid
    & WithRequired
    & WithReadonly
    & WithVariantAxes<'field'>
    & WithClass
    & Define.Slot<'default'>;

const FieldRoot = component<FieldRootProps>(({ props, slots }) => {
    const baseId = createId('zx-field');
    const ctx: FieldContext = {
        inert: false,
        ids: {
            control: `${baseId}-control`,
            label: `${baseId}-label`,
            description: `${baseId}-desc`,
            error: `${baseId}-error`,
        },
        disabled: () => !!props.disabled,
        invalid: () => !!props.invalid,
        required: () => !!props.required,
        readonly: () => !!props.readonly,
        describedBy: () => `${baseId}-desc ${baseId}-error`,
    };
    provideFieldContext(ctx);

    return () => (
        <div
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

export type FieldLabelProps = WithClass & Define.Slot<'default'>;

const FieldLabel = component<FieldLabelProps>(({ props, slots }) => {
    const field = useFieldContext();
    return () => (
        <label
            id={field.ids.label}
            for={field.ids.control}
            data-scope={SCOPE}
            data-part="label"
            data-disabled={dataAttr(field.disabled())}
            data-invalid={dataAttr(field.invalid())}
            data-required={dataAttr(field.required())}
            class={props.class}
        >
            {slots.default?.()}
        </label>
    );
}, { name: 'Field.Label' });

export type FieldDescriptionProps = WithClass & Define.Slot<'default'>;

const FieldDescription = component<FieldDescriptionProps>(({ props, slots }) => {
    const field = useFieldContext();
    return () => (
        <p id={field.ids.description} data-scope={SCOPE} data-part="description" class={props.class}>
            {slots.default?.()}
        </p>
    );
}, { name: 'Field.Description' });

export type FieldErrorProps = WithClass & Define.Slot<'default'>;

const FieldError = component<FieldErrorProps>(({ props, slots }) => {
    const field = useFieldContext();
    return () => (
        <p
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
