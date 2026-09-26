/**
 * Fieldset — a labelled group of form controls whose disabled, read-only
 * and invalid flags reach every control inside (#285).
 *
 * ```tsx
 * <Fieldset.Root disabled={!editing}>
 *     <Fieldset.Legend>Shipping address</Fieldset.Legend>
 *     <Field.Root>
 *         <Field.Label>Street</Field.Label>
 *         <Input.Root name="street">…</Input.Root>
 *     </Field.Root>
 *     <Select.Root name="country" items={countries}>…</Select.Root>
 *     <Slider.Root name="priority" />
 * </Fieldset.Root>
 * ```
 *
 * The root is a native `<fieldset>`, so the platform does the grouping, the
 * naming (from the Legend) and — for native controls — the disabling.
 * Everything else zero renders reads the Fieldset's context through
 * `createFormControl` / `Field.Root`: a Slider thumb or a RadioGroup item
 * gets `data-disabled` + `aria-disabled` and stops taking input, and
 * `readonly` / `invalid`, which a native fieldset cannot say, reach every
 * control the same way. Nested fieldsets chain up.
 *
 * The Legend hands its children the OUTER fieldset's flags, the platform's
 * own exemption for the first `<legend>`: a checkbox there can re-enable
 * the section it captions.
 */
import { component, compound, defineInjectable, defineProvide } from 'sigx';
import type { Define } from 'sigx';
import { provideFieldsetContext, useFieldsetContext, type FieldsetContext } from '../../behaviors/field.js';
import { dataAttr } from '../../contract/data-attrs.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type { WithClass, WithDisabled, WithHtmlAttrs, WithInvalid, WithReadonly, WithVariantAxes } from '../../contract/props.js';
import { fieldsetAnatomy } from './anatomy.js';

const SCOPE = fieldsetAnatomy.scope;

/** The Root's own context and the one it shadows — private: the Legend's view. */
interface FieldsetScope {
    self: FieldsetContext;
    outer: FieldsetContext;
}

const useFieldsetScope = defineInjectable<FieldsetScope | null>(() => null);

// ── Root ──

export type FieldsetRootProps =
    /** Disables the group: the native attribute, and every zero control inside. */
    & WithDisabled
    /** Every zero control inside is read-only (no native fieldset spelling — context only). */
    & WithReadonly
    /** Marks the group and every zero control inside invalid (context only). */
    & WithInvalid
    & WithVariantAxes<'fieldset'>
    & WithClass
    & WithHtmlAttrs
    & Define.Slot<'default'>;

const FieldsetRoot = component<FieldsetRootProps>(({ props, slots }) => {
    const outer = useFieldsetContext();
    const self: FieldsetContext = {
        inert: false,
        disabled: () => !!props.disabled || outer.disabled(),
        readonly: () => !!props.readonly || outer.readonly(),
        invalid: () => !!props.invalid || outer.invalid(),
    };
    provideFieldsetContext(self);
    const scope: FieldsetScope = { self, outer };
    defineProvide(useFieldsetScope, () => scope);

    return () => (
        <fieldset
            {...htmlAttrs(props)}
            // The effective flag: an enclosing fieldset already disables the
            // native controls, so repeating it here only keeps the attribute
            // and `data-disabled` saying the same thing.
            disabled={self.disabled()}
            data-scope={SCOPE}
            data-part="root"
            data-disabled={dataAttr(self.disabled())}
            data-readonly={dataAttr(self.readonly())}
            data-invalid={dataAttr(self.invalid())}
            {...variantAttrs(props)}
            class={props.class}
        >
            {slots.default?.()}
        </fieldset>
    );
}, { name: 'Fieldset.Root' });

// ── Legend ──

/** Render it as the Root's first child — that is the `<legend>` the platform names the group from. */
export type FieldsetLegendProps = WithClass & WithHtmlAttrs & Define.Slot<'default'>;

const FieldsetLegend = component<FieldsetLegendProps>(({ props, slots }) => {
    const scope = useFieldsetScope();
    // The platform's exemption: what sits in the legend answers to the
    // fieldsets OUTSIDE this one, not to it.
    if (scope) provideFieldsetContext(scope.outer);
    return () => (
        <legend
            {...htmlAttrs(props)}
            data-scope={SCOPE}
            data-part="legend"
            data-disabled={dataAttr(scope?.self.disabled())}
            data-invalid={dataAttr(scope?.self.invalid())}
            class={props.class}
        >
            {slots.default?.()}
        </legend>
    );
}, { name: 'Fieldset.Legend' });

export const Fieldset = compound(FieldsetRoot, {
    Root: FieldsetRoot,
    Legend: FieldsetLegend,
});
