/**
 * Form-field wiring — label/description/error ids shared between a
 * `Field.Root` and whatever control sits inside it.
 *
 * Controls inject the context and, when a real provider exists, adopt its
 * ids and flags — so `<Field.Root><Field.Label/><Checkbox.Root/></Field.Root>`
 * wires `for`/`aria-describedby`/`data-invalid` automatically, and a bare
 * control still works against the inert fallback.
 */
import { defineInjectable, defineProvide } from 'sigx';

export interface FieldContext {
    /** True on the fallback — controls skip adoption. */
    inert: boolean;
    ids: { control: string; label: string; description: string; error: string };
    disabled(): boolean;
    invalid(): boolean;
    required(): boolean;
    readonly(): boolean;
    /** Space-separated description/error ids for `aria-describedby`. */
    describedBy(): string | undefined;
}

const INERT_FIELD: FieldContext = {
    inert: true,
    ids: { control: '', label: '', description: '', error: '' },
    disabled: () => false,
    invalid: () => false,
    required: () => false,
    readonly: () => false,
    describedBy: () => undefined,
};

export const useFieldContext = defineInjectable<FieldContext>(() => INERT_FIELD);

export function provideFieldContext(ctx: FieldContext): void {
    defineProvide(useFieldContext, () => ctx);
}
