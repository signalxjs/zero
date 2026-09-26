/**
 * Form-field wiring — label/description/error ids shared between a
 * `Field.Root` and whatever control sits inside it.
 *
 * Controls inject the context and, when a real provider exists, adopt its
 * ids and flags — so `<Field.Root><Field.Label/><Checkbox.Root/></Field.Root>`
 * wires `for`/`aria-describedby`/`data-invalid` automatically, and a bare
 * control still works against the inert fallback. The Field's `size` rides
 * along the same way: a control with no `size` of its own renders the
 * Field's, so `<Field.Root size="xs">` is a compact field, control included.
 *
 * A `Fieldset.Root` (#285) provides the group-level half: its effective
 * disabled/readonly/invalid, which a Field and a bare control both OR in.
 */
import { defineInjectable, defineProvide } from 'sigx';

/** The `ValidityState` flags, by name — `valid` included. */
export type ValidityKey =
    | 'badInput'
    | 'customError'
    | 'patternMismatch'
    | 'rangeOverflow'
    | 'rangeUnderflow'
    | 'stepMismatch'
    | 'tooLong'
    | 'tooShort'
    | 'typeMismatch'
    | 'valid'
    | 'valueMissing';

/**
 * A plain copy of an element's `ValidityState` — what `Field.Root`'s
 * `validate` receives and what `Field.Error`'s `match` reads. Structural,
 * so this module stays on the portable (`lib.dom`-free) surface; a real
 * `ValidityState` satisfies it.
 */
export type FieldValidity = { readonly [K in ValidityKey]: boolean };

/** The constraint-validation surface of a native control, structurally. */
export interface ValidatableElement {
    readonly validity: FieldValidity;
    readonly validationMessage: string;
    readonly willValidate: boolean;
    setCustomValidity(message: string): void;
}

/**
 * What a control reports to its Field for validation (#284): the element
 * the platform's constraint validation runs on — the control itself, or
 * the hidden `<select>`/`<input>` a composed control posts through — the
 * value `validate` receives, and where focus goes when this control is the
 * first invalid one after a failed submit.
 */
export interface FieldValidityReport {
    /** `null` when nothing validates natively (an unnamed Select renders no hidden control). */
    element(): ValidatableElement | null;
    /** The control's model value — read reactively. */
    value(): unknown;
    /** Focus the control the user fixes (the trigger, not a hidden `<select>`). */
    focus(): void;
}

export interface FieldContext {
    /** True on the fallback — controls skip adoption. */
    inert: boolean;
    ids: { control: string; label: string; description: string; error: string };
    disabled(): boolean;
    invalid(): boolean;
    required(): boolean;
    readonly(): boolean;
    /** The Field's `size` — a control without its own renders this one. */
    size(): string | undefined;
    /**
     * Space-separated ids of the Description and Error that are rendered,
     * for `aria-describedby` — `undefined` when neither is, so no IDREF
     * dangles. Both until the Field has mounted (the server's markup).
     */
    describedBy(): string | undefined;
    /**
     * Field.Description's presence report (`reportPresence`). Optional so a
     * hand-provided context keeps compiling; without it the provider's own
     * `describedBy` is all there is.
     */
    setDescriptionPresent?(present: boolean): void;
    /**
     * Field.Error's presence report — optional, as above. `id` is the
     * rendered Error's own (a `match`-keyed Error has one per key); omitted,
     * it is `ids.error`.
     */
    setErrorPresent?(present: boolean, id?: string): void;
    /**
     * Register the control's validation surface (#284) — optional, so a
     * hand-provided context keeps compiling and the inert fallback ignores
     * it. Returns the detach. The first report registered wins.
     */
    report?(report: FieldValidityReport): () => void;
}

const INERT_FIELD: FieldContext = {
    inert: true,
    ids: { control: '', label: '', description: '', error: '' },
    disabled: () => false,
    invalid: () => false,
    required: () => false,
    readonly: () => false,
    size: () => undefined,
    describedBy: () => undefined,
};

export const useFieldContext = defineInjectable<FieldContext>(() => INERT_FIELD);

export function provideFieldContext(ctx: FieldContext): void {
    defineProvide(useFieldContext, () => ctx);
}

/**
 * What a `Fieldset.Root` tells the controls inside it (#285): its EFFECTIVE
 * flags — its own prop OR the nearest enclosing fieldset's, so nested
 * fieldsets chain up. `createFormControl` and `Field.Root` OR these into
 * their own, which is what reaches the controls zero renders as non-native
 * elements (a Slider thumb, a RadioGroup item, a Select trigger's
 * `aria-disabled`) — the platform's `<fieldset disabled>` only disables
 * native form controls.
 *
 * `Fieldset.Legend` re-provides the OUTER fieldset's context to its
 * children, the platform's rule: controls inside a disabled fieldset's
 * first `<legend>` are not disabled by it (the "enable this section"
 * checkbox pattern).
 */
export interface FieldsetContext {
    /** True on the fallback — no fieldset encloses the reader. */
    inert: boolean;
    disabled(): boolean;
    readonly(): boolean;
    invalid(): boolean;
}

const INERT_FIELDSET: FieldsetContext = {
    inert: true,
    disabled: () => false,
    readonly: () => false,
    invalid: () => false,
};

export const useFieldsetContext = defineInjectable<FieldsetContext>(() => INERT_FIELDSET);

export function provideFieldsetContext(ctx: FieldsetContext): void {
    defineProvide(useFieldsetContext, () => ctx);
}
