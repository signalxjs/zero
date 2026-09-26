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
 * disabled/invalid/required/readonly flags automatically.
 *
 * Inside a `CheckboxGroup.Root` the box belongs to the group: give it a
 * `value`, and it is checked while the group's model includes it —
 * toggling writes the group model, posts under the group's `name`, and
 * takes the group's flags (ORed with its own). A `parent` box in a group
 * derives its state from the group instead — `checked` when every one of
 * the group's `allValues` is selected, `unchecked` when none,
 * `indeterminate` when some — and toggling it selects all or none; its
 * `aria-controls` names the child inputs.
 */
import { component, compound, effect } from 'sigx';
import type { Define } from 'sigx';
import { useCheckboxGroupContext } from '../checkbox-group/context.js';
import { createControllableState } from '../../behaviors/controllable.js';
import { createFormControl } from '../../behaviors/form-control.js';
import { onFormReset } from '../../behaviors/form-reset.js';
import { timingModifiers } from '../../behaviors/model-modifiers.js';
import { VISUALLY_HIDDEN_STYLE } from '../../behaviors/visually-hidden.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { dataAttr } from '../../contract/data-attrs.js';
import { htmlAttrs } from '../../contract/props.js';
import type { HtmlAttrValue, WithClass, WithFormControl, WithHtmlAttrs, WithModelModifiers, WithReadonly, WithVariantAxes } from '../../contract/props.js';
import { checkboxAnatomy } from './anatomy.js';
import { mountScope } from '../../behaviors/mount-scope.js';

const SCOPE = checkboxAnatomy.scope;

export type CheckboxRootProps =
    & Define.Model<boolean | string[]>
    & Define.Prop<'defaultChecked', boolean, false>
    & Define.Event<'checkedChange', boolean>
    & Define.Prop<'indeterminate', boolean, false>
    /**
     * The posted value (default `"on"`), and the membership key in array
     * mode and inside a `CheckboxGroup` — where every box needs one.
     */
    & Define.Prop<'value', string, false>
    /**
     * Inside a `CheckboxGroup`: the tri-state "select all" box. Its state is
     * derived from the group (all / none / some of `allValues`), toggling it
     * selects all or none, and it posts nothing of its own unless given a
     * `name`. Outside a group it has no effect.
     */
    & Define.Prop<'parent', boolean, false>
    & WithFormControl
    /**
     * Read-only: focusable and announced, but a click, Space or label press
     * never toggles it (a native checkbox ignores `readonly`, so the
     * activation is cancelled). The prop OR the Field's.
     */
    & WithReadonly
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
    const group = useCheckboxGroupContext();
    const inGroup = !group.inert;
    // The posted value; also the membership key in array mode and in a group.
    const itemValue = (): string => props.value ?? 'on';
    const isParent = (): boolean => inGroup && !!props.parent;
    const checkedOf = (v: boolean | string[]): boolean => (Array.isArray(v) ? v.includes(itemValue()) : v);
    const state = createControllableState<boolean | string[]>(
        () => props.model,
        props.defaultChecked ?? false,
        (v) => emit('checkedChange', checkedOf(v)),
    );
    const fc = createFormControl({ props: () => props, idBase: 'zx-checkbox' });
    let inputEl: HTMLInputElement | null = null;
    const focus = signal({ visible: false });
    // A child box tells the group its value and input id — what a parent
    // box selects and names in `aria-controls`. (Inside a group the Field
    // context is the group's inert one, so the id is the box's own.)
    if (inGroup && !props.parent) {
        onUnmounted(group.register({ value: itemValue, id: fc.controlId() }));
        onMounted(() => {
            if (props.value === undefined) {
                console.warn(
                    '[zero] Checkbox.Root inside a CheckboxGroup has no `value`: it is the membership key and the '
                    + 'posted value, so every such box would share "on". Pass a distinct `value` to each box.',
                );
            }
        });
    }

    /** A parent box's view of the group: how many of `allValues` are selected. */
    const parentState = (): 'checked' | 'unchecked' | 'indeterminate' => {
        const all = group.allValues();
        const selected = group.state.value;
        const count = all.filter((v) => selected.includes(v)).length;
        return count === 0 ? 'unchecked' : count === all.length ? 'checked' : 'indeterminate';
    };
    const checkedState = (): string => {
        if (isParent()) return parentState();
        if (props.indeterminate) return 'indeterminate';
        if (inGroup) return group.state.value.includes(itemValue()) ? 'checked' : 'unchecked';
        return checkedOf(state.value) ? 'checked' : 'unchecked';
    };
    /**
     * Write the native input's `indeterminate` (and, for a parent box, its
     * checkedness) from the derived state. A click on an indeterminate
     * checkbox clears the property before `change` fires, so this runs
     * after every change as well as on every state change — `data-state`
     * and the input never disagree.
     */
    const syncNative = (): void => {
        if (!inputEl) return;
        const s = checkedState();
        inputEl.indeterminate = s === 'indeterminate';
        if (isParent()) inputEl.checked = s === 'checked';
    };

    let detachReset = (): void => {};
    const scoped = mountScope();
    onMounted(() => scoped(() => {
        effect(() => {
            // Read outside `syncNative`'s element guard, so the effect
            // tracks the state even on a pass that finds no input.
            checkedState();
            syncNative();
        });
        detachReset = onFormReset(() => inputEl, () => {
            if (inGroup) {
                // Every box restores the same group default; only the
                // first write changes anything (compared by content — the
                // stored array is the state's proxy, never the prop's).
                const def = group.defaultValue();
                const cur = group.state.value;
                if (cur.length !== def.length || cur.some((v, i) => v !== def[i])) group.state.value = def;
                if (inputEl && !isParent()) inputEl.checked = group.state.value.includes(itemValue());
                syncNative();
                return;
            }
            const def = props.defaultChecked ?? false;
            const current = state.value;
            // Array mode: this box restores its OWN membership, not the array.
            state.value = Array.isArray(current)
                ? (def ? (current.includes(itemValue()) ? current : [...current, itemValue()]) : current.filter((v) => v !== itemValue()))
                : def;
            if (inputEl) inputEl.checked = checkedOf(state.value);
        });
    }));
    onUnmounted(() => detachReset());
    fc.reportValidity({ element: () => inputEl, value: () => checkedOf(state.value), focus: () => inputEl?.focus() }, onUnmounted);

    // A group's flags reach every box, ORed with the box's own.
    const disabled = (): boolean => fc.disabled() || group.disabled();
    const invalid = (): boolean => fc.invalid() || group.invalid();
    const required = (): boolean => fc.required() || group.required();
    const readonly = (): boolean => fc.readonly() || group.readonly();
    /**
     * The native `required`. A readonly box's state is not the user's to
     * fix, so it never blocks the submit (the native rule for readonly
     * controls). A group's `required` means "at least one": its boxes are
     * natively required only while none of its rendered boxes is checked,
     * so the platform blocks the submit and reports on the first box until
     * one is. A model value no box renders does not count; before the boxes
     * have registered (the first pass, SSR) the model stands in.
     */
    const nativeRequired = (): boolean => {
        if (readonly() || isParent()) return false;
        if (fc.required()) return true;
        if (!group.required()) return false;
        const selected = group.state.value;
        const members = group.members();
        return members.length > 0 ? !members.some((v) => selected.includes(v)) : selected.length === 0;
    };

    /** A parent box toggles all or none of the group's `allValues`. */
    const toggleAll = (): void => {
        const all = group.allValues();
        const current = group.state.value;
        group.state.value = parentState() === 'checked'
            ? current.filter((v) => !all.includes(v))
            : [...current, ...all.filter((v) => !current.includes(v))];
    };

    let controlEl: HTMLElement | null = null;
    // Cross-element press: pointer on the row, keyboard on the hidden input,
    // feedback on the visible control.
    const press = createPressFeedback({
        getElement: () => controlEl,
        // A readonly control does not answer a press either — nothing
        // will happen, so nothing should look like it is about to.
        isDisabled: () => disabled() || readonly(),
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
                data-readonly={dataAttr(readonly())}
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
                    // A standalone box needs no id; a Field's control and a
                    // group's child (the parent box's `aria-controls`) do.
                    id={fc.field.inert && !inGroup ? undefined : fc.controlId()}
                    data-scope={SCOPE}
                    data-part="hidden-input"
                    style={VISUALLY_HIDDEN_STYLE}
                    // A parent box binds nothing: its checkedness is derived
                    // (`syncNative`) and its change handler writes the group.
                    // A child binds the group's model in sigx's array mode.
                    {...(isParent()
                        ? { checked: checkedState() === 'checked' }
                        : { model: inGroup ? group.state : state, modelModifiers: timingModifiers(props.modelModifiers) })}
                    disabled={disabled()}
                    required={nativeRequired()}
                    // A parent box posts nothing unless named itself.
                    name={fc.name() ?? (isParent() ? undefined : group.name())}
                    form={fc.form() ?? group.form()}
                    value={itemValue()}
                    aria-controls={[isParent() ? group.controls().join(' ') : undefined, inputAttrs['aria-controls']].filter(Boolean).join(' ') || undefined}
                    aria-invalid={invalid() ? 'true' : undefined}
                    aria-readonly={readonly() ? 'true' : undefined}
                    aria-describedby={[fc.describedBy(), inputAttrs['aria-describedby']].filter(Boolean).join(' ') || undefined}
                    ref={(node: HTMLInputElement | null) => { inputEl = node; }}
                    onFocus={() => { focus.visible = isFocusVisible(inputEl); }}
                    onBlur={(e: FocusEvent) => {
                        press.onBlur(e);
                        focus.visible = false;
                    }}
                    // Click is the one activation path — a pointer on the
                    // box, a press on the label, Space — so cancelling it is
                    // the whole of readonly: the platform restores the
                    // checkedness and fires no change.
                    onClick={(e: MouseEvent) => { if (readonly()) e.preventDefault(); }}
                    onChange={(e: Event) => {
                        if (isParent()) {
                            toggleAll();
                            emit('checkedChange', parentState() === 'checked');
                        } else if (inGroup) {
                            // Standalone, the controllable state reports; in
                            // a group this box's own checkedness is the event.
                            emit('checkedChange', (e.target as HTMLInputElement).checked);
                        }
                        syncNative();
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
                    data-readonly={dataAttr(readonly())}
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
