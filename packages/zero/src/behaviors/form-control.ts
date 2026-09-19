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
 * - A control's `size` is the prop, else the Field's (`axisAttrs()`): the
 *   Field's size means the whole field, so the control's chrome follows its
 *   label rather than staying at the base step beside a shrunken one.
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
import type { ColorValue, SizeScale } from '../contract/tokens.js';
import { variantAttrs } from '../contract/variant-attrs.js';

export interface FormControlProps {
    name?: string;
    form?: string;
    disabled?: boolean;
    invalid?: boolean;
    required?: boolean;
    readonly?: boolean;
    color?: ColorValue;
    size?: SizeScale;
    variant?: string;
    axes?: Record<string, string | undefined>;
    mods?: Record<string, boolean | undefined>;
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
    /** The Root's variant attributes (`variantAttrs`), `size` falling back to the Field's. */
    axisAttrs(): Record<string, string | undefined>;
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
        axisAttrs: () => {
            const own = p();
            return variantAttrs({
                color: own.color,
                size: own.size ?? field.size(),
                variant: own.variant,
                axes: own.axes,
                mods: own.mods,
            });
        },
        hiddenAttrs: () => ({
            name: name(),
            form: form(),
            disabled: disabled(),
        }),
    };
}

/**
 * Settle a hidden `<select>`'s selectedness after a render (#145): every
 * option's `selected` PROPERTY is written to match `keys` — the single-mode
 * placeholder (value `''`) selected while nothing is.
 *
 * The rendered `<option selected>` attributes say the same thing, and in
 * every real engine they are enough: inserting an option with the
 * attribute runs the selectedness-setting algorithm, which deselects its
 * siblings. A simulated DOM does not run it, so a patch order that clears
 * the placeholder before the chosen option arrives leaves BOTH selected
 * and `select.value` reading `''` — which is what sigx 1.0's patch order
 * does under happy-dom. Writing the property is the one path every DOM
 * agrees on, and it is idempotent: call it from `onUpdated`, once the
 * options exist.
 */
export function settleHiddenSelect(
    // Structural rather than `HTMLSelectElement`: this module is on the
    // portable (`lib.dom`-free) surface, like `synthesizesClickFrom`.
    node: { options: ArrayLike<{ value: string; selected: boolean }> } | null,
    keys: readonly string[],
    multiple: boolean,
): void {
    if (!node) return;
    for (const option of Array.from(node.options)) {
        const want = option.value === '' && !multiple ? keys.length === 0 : keys.includes(option.value);
        if (option.selected !== want) option.selected = want;
    }
}
