/**
 * CheckboxGroup — a labelled `role="group"` of checkboxes under one
 * `string[]` model, with an optional derived tri-state parent box.
 *
 * ```tsx
 * <CheckboxGroup.Root model={() => state.toppings} name="toppings" allValues={['ham', 'olives', 'basil']}>
 *     <CheckboxGroup.Label>Toppings</CheckboxGroup.Label>
 *     <Checkbox.Root parent>All toppings</Checkbox.Root>
 *     <Checkbox.Root value="ham">Ham</Checkbox.Root>
 *     <Checkbox.Root value="olives">Olives</Checkbox.Root>
 *     <Checkbox.Root value="basil">Basil</Checkbox.Root>
 * </CheckboxGroup.Root>
 * ```
 *
 * A `Checkbox.Root` inside the group needs a `value`: it is checked while
 * the group's model includes it, and toggling it writes the group model (its
 * own model is not needed). Every child's hidden input posts under the
 * group's `name`, and the group's `disabled` / `invalid` / `readonly` — the
 * prop OR an enclosing Field's — reach every child. `required` means "at
 * least one": the children carry the native `required` only while nothing
 * is checked, so the platform blocks the submit and reports on the first
 * box, and stops the moment one is checked.
 *
 * A `parent` box derives its state from `allValues` (else every child's
 * value): `checked` when all are selected, `unchecked` when none,
 * `indeterminate` when some. Toggling it selects all or none of them, and
 * its `aria-controls` lists the child inputs it drives.
 *
 * Inside a `Field.Root` the ROOT adopts the field — its label joins the
 * root's `aria-labelledby`, its description and error the root's
 * `aria-describedby` — and the children keep ids of their own, so no two
 * inputs claim the field's control id.
 */
import { component, compound, defineProvide } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState } from '../../behaviors/controllable.js';
import { provideFieldContext } from '../../behaviors/field.js';
import { createFormControl } from '../../behaviors/form-control.js';
import { countPresence, reportPresence, settleAfterMount } from '../../behaviors/part-presence.js';
import { dataAttr, type Orientation } from '../../contract/data-attrs.js';
import { htmlAttrs } from '../../contract/props.js';
import type { WithClass, WithFormControl, WithHtmlAttrs, WithOrientation, WithReadonly, WithVariantAxes } from '../../contract/props.js';
import { checkboxGroupAnatomy } from './anatomy.js';
import { createEntryRegistry, useCheckboxGroupContext, type CheckboxGroupContext } from './context.js';

export { useCheckboxGroupContext };
export type { CheckboxGroupContext };

const SCOPE = checkboxGroupAnatomy.scope;

// ── Root ──

export type CheckboxGroupRootProps =
    & Define.Model<string[]>
    & Define.Prop<'defaultValue', string[], false>
    & Define.Event<'valueChange', string[]>
    /**
     * The values a `parent` box selects and derives its state from. Default:
     * the values of every child box rendered in the group.
     */
    & Define.Prop<'allValues', string[], false>
    & WithFormControl
    /**
     * Read-only: every box stays focusable and announced, but none toggles.
     * The prop OR the Field's.
     */
    & WithReadonly
    & WithOrientation
    & WithVariantAxes<'checkbox-group'>
    & WithClass
    /**
     * Not `role`: the root is the `group`. An app `aria-labelledby` /
     * `aria-describedby` joins the Field's.
     */
    & Omit<WithHtmlAttrs, 'role'>
    & Define.Slot<'default'>;

const CheckboxGroupRoot = component<CheckboxGroupRootProps>(({ props, slots, emit, signal, onMounted }) => {
    const state = createControllableState<string[]>(
        () => props.model,
        props.defaultValue ?? [],
        (v) => emit('valueChange', v),
    );
    const fc = createFormControl({ props: () => props, idBase: 'zx-checkbox-group' });
    // Reported by CheckboxGroup.Label, so the reference never dangles (#169).
    const present = signal({ label: 0, settled: false });
    settleAfterMount(onMounted, () => { present.settled = true; });
    const labelId = `${fc.baseId}-label`;
    const registry = createEntryRegistry();

    const allValues = (): string[] => props.allValues ?? registry.entries().map((e) => e.value());

    const ctx: CheckboxGroupContext = {
        inert: false,
        state,
        name: fc.name,
        form: fc.form,
        defaultValue: () => props.defaultValue ?? [],
        disabled: fc.disabled,
        invalid: fc.invalid,
        required: fc.required,
        readonly: fc.readonly,
        allValues,
        controls: () => {
            const all = allValues();
            return registry.entries().filter((e) => all.includes(e.value())).map((e) => e.id);
        },
        members: () => registry.entries().map((e) => e.value()),
        register: registry.register,
        labelId,
        setLabelPresent: (p) => { present.label = countPresence(present.label, p); },
    };
    defineProvide(useCheckboxGroupContext, () => ctx);
    // The ROOT is the field's control; the boxes inside must not each claim
    // its control id and description. They see a field of their own —
    // inert, so their ids are their own — that still hands down the size.
    const field = fc.field;
    provideFieldContext({
        inert: true,
        ids: { control: '', label: '', description: '', error: '' },
        disabled: () => false,
        invalid: () => false,
        required: () => false,
        readonly: () => false,
        size: () => props.size ?? field.size(),
        describedBy: () => undefined,
    });

    const orientation = (): Orientation => props.orientation ?? 'vertical';

    return () => {
        const attrs = htmlAttrs(props);
        return (
            <div
                {...attrs}
                role="group"
                data-scope={SCOPE}
                data-part="root"
                data-orientation={orientation()}
                data-disabled={dataAttr(ctx.disabled())}
                data-invalid={dataAttr(ctx.invalid())}
                data-required={dataAttr(ctx.required())}
                data-readonly={dataAttr(ctx.readonly())}
                aria-labelledby={[
                    field.inert ? undefined : fc.labelId(),
                    !present.settled || present.label > 0 ? labelId : undefined,
                    attrs['aria-labelledby'],
                ].filter(Boolean).join(' ') || undefined}
                aria-describedby={[fc.describedBy(), attrs['aria-describedby']].filter(Boolean).join(' ') || undefined}
                {...fc.axisAttrs()}
                class={props.class}
            >
                {slots.default?.()}
            </div>
        );
    };
}, { name: 'CheckboxGroup.Root' });

// ── Label ──

/** Not `id`: the group is labelled by the Label's own. */
export type CheckboxGroupLabelProps = WithClass & Omit<WithHtmlAttrs, 'id'> & Define.Slot<'default'>;

/**
 * The group's visible name: the root's `aria-labelledby` references it
 * (joined with a Field's label and any app value) while it is mounted.
 */
const CheckboxGroupLabel = component<CheckboxGroupLabelProps>(({ props, slots, onUnmounted }) => {
    const group = useCheckboxGroupContext();
    reportPresence(group.setLabelPresent, onUnmounted);
    return () => (
        <div
            {...htmlAttrs(props)}
            id={group.labelId}
            data-scope={SCOPE}
            data-part="label"
            data-disabled={dataAttr(group.disabled())}
            data-invalid={dataAttr(group.invalid())}
            data-required={dataAttr(group.required())}
            class={props.class}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'CheckboxGroup.Label' });

export const CheckboxGroup = compound(CheckboxGroupRoot, {
    Root: CheckboxGroupRoot,
    Label: CheckboxGroupLabel,
});
