/**
 * Form participation — ONE contract for every control that carries `name`.
 *
 * Twelve components used to hand-repeat the same three things: the Field
 * adoption triad (`!!props.disabled || field.disabled()` for each flag), the
 * standalone-vs-field id fallback (`field.inert ? own : field.ids.control`),
 * and a hidden control whose attribute set drifted per component (a disabled
 * Select still posted; no control took `form`). This module owns all three,
 * plus the one thing no component did: restoring the model on the owning
 * form's `reset` (`onFormReset`, in `form-reset.ts` — the web half; this
 * module stays DOM-free for `@sigx/zero/behaviors/core`).
 *
 * The regime, stated once:
 * - A control's flags are the prop OR the Field's (`disabled`, `invalid`,
 *   `required`, `readonly`); the Field supplies ids and `aria-describedby`.
 * - A hidden control renders ONLY when `name` is set and carries `disabled`
 *   and `form` (`hiddenAttrs()`), so a disabled control never posts and the
 *   `form` attribute associates from outside the form's subtree. A hidden
 *   `<select>` adds `required` itself — `type="hidden"` inputs are barred
 *   from constraint validation, a `<select>` is not.
 * - Reset restores the component's default into the model and the element
 *   (`onFormReset`).
 */
import { createId } from './create-id.js';
import { useFieldContext, type FieldContext } from './field.js';
import { dataAttr } from '../contract/data-attrs.js';

export interface FormControlProps {
    name?: string;
    form?: string;
    disabled?: boolean;
    invalid?: boolean;
    required?: boolean;
    readonly?: boolean;
}

export interface FormControlOptions {
    /** The Root's props, read reactively. */
    props: () => FormControlProps;
    /** `createId` prefix for the standalone ids (`zx-input`). */
    idBase: string;
    /** The part the standalone control id names (default `control`). */
    controlPart?: string;
    /** Component-computed invalidity ORed in (NumberInput's out-of-range). */
    invalid?: () => boolean;
}

export interface FormControlFlags {
    'data-disabled': '' | undefined;
    'data-invalid': '' | undefined;
    'data-required': '' | undefined;
}

export interface FormControl {
    field: FieldContext;
    /** The standalone id base — parts mint `${baseId}-<part>` from it. */
    baseId: string;
    /** The labelable control's id: the Field's when wrapped, else standalone. */
    controlId(): string;
    labelId(): string;
    describedBy(): string | undefined;
    name(): string | undefined;
    form(): string | undefined;
    hasName(): boolean;
    disabled(): boolean;
    invalid(): boolean;
    required(): boolean;
    readonly(): boolean;
    /** The three flags every form-control root declares. */
    flags(): FormControlFlags;
    /** A hidden control's wiring: name, form, disabled. Render it only when `hasName()`. */
    hiddenAttrs(): { name: string | undefined; form: string | undefined; disabled: boolean };
}

export function createFormControl(opts: FormControlOptions): FormControl {
    const field = useFieldContext();
    const baseId = createId(opts.idBase);
    const part = opts.controlPart ?? 'control';
    const p = opts.props;

    const disabled = (): boolean => !!p().disabled || field.disabled();
    const invalid = (): boolean => !!p().invalid || field.invalid() || !!opts.invalid?.();
    const required = (): boolean => !!p().required || field.required();
    const readonly = (): boolean => !!p().readonly || field.readonly();
    const controlId = (): string => (field.inert ? `${baseId}-${part}` : field.ids.control);
    const labelId = (): string => (field.inert ? `${baseId}-label` : field.ids.label);
    const describedBy = (): string | undefined => (field.inert ? undefined : field.describedBy());
    const name = (): string | undefined => p().name;
    const form = (): string | undefined => p().form;

    return {
        field,
        baseId,
        controlId,
        labelId,
        describedBy,
        name,
        form,
        hasName: () => name() !== undefined,
        disabled,
        invalid,
        required,
        readonly,
        flags: () => ({
            'data-disabled': dataAttr(disabled()),
            'data-invalid': dataAttr(invalid()),
            'data-required': dataAttr(required()),
        }),
        hiddenAttrs: () => ({
            name: name(),
            form: form(),
            disabled: disabled(),
        }),
    };
}
