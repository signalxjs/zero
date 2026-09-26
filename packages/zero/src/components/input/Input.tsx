/**
 * Input — a single-line text field.
 *
 * ```tsx
 * <Input.Root model={() => state.email} type="email" name="email">
 *     <Input.Label>Email</Input.Label>
 *     <Input.Control>
 *         <Input.Input placeholder="you@example.com" />
 *     </Input.Control>
 * </Input.Root>
 * ```
 *
 * The model is a plain `string` and it writes through on every keystroke —
 * there is no draft/commit split. NumberInput needs one because half-typed
 * text (`-`, `1e`) is not a number; a string always is itself, so deferring
 * the write would only make the model lag the field for no gain. When an app
 * does want to defer, that is sigx's `modelModifiers` (`lazy`, `debounce`,
 * `trim`), which reach the native input exactly as they would without zero.
 *
 * Inside a `Field.Root` the control adopts the field's id, its
 * disabled/invalid/required flags and its `aria-describedby`, so `Input.Label`
 * becomes optional there. Standalone it wires its own label.
 *
 * The control is also where the three affordances sit (#281):
 *
 * ```tsx
 * <Input.Root type="password" model:visible={() => state.shown}>
 *     <Input.Control>
 *         <Input.Adornment placement="start"><LockIcon /></Input.Adornment>
 *         <Input.Input />
 *         <Input.ClearTrigger />
 *         <Input.VisibilityTrigger />
 *     </Input.Control>
 * </Input.Root>
 * ```
 */
import { component, compound, defineInjectable, defineProvide, watch } from 'sigx';
import type { Define, ModelModifiers } from 'sigx';
import { createControllableState, createInertState, namedModel, type ControllableState } from '../../behaviors/controllable.js';
import { createFormControl } from '../../behaviors/form-control.js';
import { onFormReset } from '../../behaviors/form-reset.js';
import { timingModifiers } from '../../behaviors/model-modifiers.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { useTextControlBinding } from '../../behaviors/text-control-binding.js';
import { dataAttr, stateAttr } from '../../contract/data-attrs.js';
import { nativeTextAttrs } from '../../contract/native-text-attrs.js';
import type { Autocapitalize, EnterKeyHint, InputMode, NativeTextJsx } from '../../contract/native-text-attrs.js';
import { htmlAttrs } from '../../contract/props.js';
import type {
    TextControlHandle,
    WithClass,
    WithFormControl,
    WithHtmlAttrs,
    WithModelModifiers,
    WithReadonly,
    WithTextControlEvents,
    WithVariantAxes,
    WithVisuallyHidden,
} from '../../contract/props.js';
import { inputAnatomy } from './anatomy.js';

const SCOPE = inputAnatomy.scope;

/**
 * The text-shaped `input` types, and only those. `number` is NumberInput's
 * job; the selection types (`checkbox`, `radio`, `file`, `range`, `color`)
 * are different components wearing the same tag name; the date/time types
 * render browser chrome no recipe can style, so a design system could not
 * honour the anatomy for them.
 */
export type InputType = 'text' | 'email' | 'password' | 'search' | 'tel' | 'url';

interface InputContext {
    state: ControllableState<string>;
    type(): InputType;
    /** Timing modifiers for the native input (transforms are applied at the boundary). */
    modifiers(): ModelModifiers | undefined;
    name(): string | undefined;
    form(): string | undefined;
    defaultValue(): string;
    autocomplete(): string | undefined;
    maxlength(): number | undefined;
    /** The native constraint and hint attributes, as JSX props for the input. */
    nativeAttrs(): NativeTextJsx;
    inputId(): string;
    labelId(): string | undefined;
    describedBy(): string | undefined;
    disabled(): boolean;
    invalid(): boolean;
    required(): boolean;
    readonly(): boolean;
    focusVisible: { value: boolean };
    /**
     * What the element shows — the model, or a keystroke the model has not
     * taken yet under `lazy`/`debounce`. What the clear trigger renders from.
     */
    text: { value: string };
    /** `model:visible` — whether a password field shows its characters. */
    visible: ControllableState<boolean>;
    /** The rendered `<input>`, once mounted — what the affordances focus. */
    inputEl(): HTMLInputElement | null;
    setInputEl(el: HTMLInputElement | null): void;
    /** Empty the value the way typing would, then focus the input. */
    clear(): void;
}

function makeInert(): InputContext {
    return {
        state: createInertState<string>(''),
        type: () => 'text',
        modifiers: () => undefined,
        name: () => undefined,
        form: () => undefined,
        defaultValue: () => '',
        autocomplete: () => undefined,
        maxlength: () => undefined,
        nativeAttrs: () => ({}),
        inputId: () => 'zx-input-inert',
        labelId: () => undefined,
        describedBy: () => undefined,
        disabled: () => false,
        invalid: () => false,
        required: () => false,
        readonly: () => false,
        focusVisible: { value: false },
        text: { value: '' },
        visible: createInertState<boolean>(false),
        inputEl: () => null,
        setInputEl: () => {},
        clear: () => {},
    };
}

export const useInputContext = defineInjectable<InputContext>(() => makeInert());

// ── Root ──

export type InputRootProps =
    & Define.Model<string>
    & Define.Prop<'defaultValue', string, false>
    & Define.Event<'valueChange', string>
    & Define.Prop<'type', InputType, false>
    /** Native autofill hint — `email`, `current-password`, `off`, … */
    & Define.Prop<'autocomplete', string, false>
    & Define.Prop<'maxlength', number, false>
    & Define.Prop<'minlength', number, false>
    /** A regular expression the whole value must match (native constraint validation). */
    & Define.Prop<'pattern', string, false>
    /** Which virtual keyboard to show — `numeric` for a code, `email`, … */
    & Define.Prop<'inputmode', InputMode, false>
    /** What the virtual keyboard's Enter key says — `search`, `send`, `next`, … */
    & Define.Prop<'enterkeyhint', EnterKeyHint, false>
    /** Spell-check the value; renders `spellcheck="true"`/`"false"`. Unset leaves the browser's default. */
    & Define.Prop<'spellcheck', boolean, false>
    & Define.Prop<'autocapitalize', Autocapitalize, false>
    /** Safari's autocorrection — `off` for codes, usernames, addresses. */
    & Define.Prop<'autocorrect', 'on' | 'off', false>
    /** Focus the input when the page loads (the native `autofocus`). */
    & Define.Prop<'autofocus', boolean, false>
    /**
     * Whether a `type="password"` field shows its characters — what
     * `Input.VisibilityTrigger` toggles. While true the input renders
     * `type="text"`; on any other type it changes nothing.
     */
    & Define.Model<'visible', boolean>
    & Define.Prop<'defaultVisible', boolean, false>
    & Define.Event<'visibleChange', boolean>
    & WithFormControl
    & WithReadonly
    & WithModelModifiers
    & WithVariantAxes<'input'>
    & WithClass
    & WithHtmlAttrs
    & Define.Slot<'default'>;

const InputRoot = component<InputRootProps>(({ props, slots, emit, signal }) => {
    const state = createControllableState<string>(
        () => props.model,
        props.defaultValue ?? '',
        (v) => emit('valueChange', v),
        { modifiers: () => props.modelModifiers },
    );
    const fc = createFormControl({ props: () => props, idBase: 'zx-input', controlPart: 'input' });
    const focusVisible = signal({ value: false });
    // The model follows the element on every keystroke only without a timing
    // modifier; the element's own input events keep this current either way,
    // and a model write (the app's, or a commit) lands here too.
    const text = signal({ value: state.value ?? '' });
    watch(() => state.value, (v) => { text.value = v ?? ''; });
    const visible = createControllableState<boolean>(
        () => namedModel<boolean>(props.visible),
        props.defaultVisible ?? false,
        (v) => emit('visibleChange', v),
    );
    // Not reactive: nothing renders from it, the affordances only focus it.
    let inputEl: HTMLInputElement | null = null;

    const ctx: InputContext = {
        state,
        // A shown password is a text field for as long as it is shown; no
        // other type has characters to hide.
        type: () => {
            const type = props.type ?? 'text';
            return type === 'password' && visible.value ? 'text' : type;
        },
        modifiers: () => timingModifiers(props.modelModifiers),
        name: fc.name,
        form: fc.form,
        defaultValue: () => props.defaultValue ?? '',
        autocomplete: () => props.autocomplete,
        maxlength: () => props.maxlength,
        nativeAttrs: () => ({
            ...nativeTextAttrs(props),
            pattern: props.pattern,
            inputMode: props.inputmode,
            // Not `autocorrect`: Safari reflects it as a BOOLEAN property,
            // which would read the "off" token as true. The camel spelling
            // is no property anywhere, so sigx writes the attribute (HTML
            // lowercases the name).
            autoCorrect: props.autocorrect,
        }),
        // Inside a Field the field owns the id, so its `<label for>` lands on
        // this input; standalone we mint our own.
        inputId: fc.controlId,
        labelId: fc.labelId,
        describedBy: fc.describedBy,
        disabled: fc.disabled,
        invalid: fc.invalid,
        required: fc.required,
        readonly: fc.readonly,
        focusVisible,
        text,
        visible,
        inputEl: () => inputEl,
        setInputEl: (el) => { inputEl = el; },
        clear: () => {
            // The model first — under `lazy` a native input event would not
            // write it — then the element and an `input` event, so an app's
            // own listeners see a clear exactly as they see a keystroke.
            state.value = '';
            const el = inputEl;
            if (el) {
                el.value = '';
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.focus();
            }
        },
    };
    defineProvide(useInputContext, () => ctx);

    return () => (
        <div
            {...htmlAttrs(props)}
            data-scope={SCOPE}
            data-part="root"
            {...fc.flags()}
            data-readonly={dataAttr(fc.readonly())}
            {...fc.axisAttrs()}
            class={props.class}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Input.Root' });

// ── Label ──

/** Not `id`: the Field's wiring points at the Label's own. */
export type InputLabelProps = WithClass & WithVisuallyHidden & Omit<WithHtmlAttrs, 'id'> & Define.Slot<'default'>;

const InputLabel = component<InputLabelProps>(({ props, slots }) => {
    const ctx = useInputContext();
    return () => (
        <label
            {...htmlAttrs(props)}
            id={ctx.labelId()}
            for={ctx.inputId()}
            data-scope={SCOPE}
            data-part="label"
            data-disabled={dataAttr(ctx.disabled())}
            data-invalid={dataAttr(ctx.invalid())}
            data-required={dataAttr(ctx.required())}
            data-visually-hidden={dataAttr(props.visuallyHidden)}
            class={props.class}
        >
            {slots.default?.()}
        </label>
    );
}, { name: 'Input.Label' });

// ── Control ──

export type InputControlProps = WithClass & WithHtmlAttrs & Define.Slot<'default'>;

const InputControl = component<InputControlProps>(({ props, slots }) => {
    const ctx = useInputContext();
    return () => (
        <div
            {...htmlAttrs(props)}
            data-scope={SCOPE}
            data-part="control"
            data-disabled={dataAttr(ctx.disabled())}
            data-invalid={dataAttr(ctx.invalid())}
            data-readonly={dataAttr(ctx.readonly())}
            data-focus-visible={dataAttr(ctx.focusVisible.value)}
            class={props.class}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Input.Control' });

// ── Input ──

/** What `<Input.Input ref={…}>` receives — the element, and `focus()`. */
export type InputHandle = TextControlHandle<HTMLInputElement>;

export type InputInputProps =
    & Define.Prop<'placeholder', string, false>
    & WithTextControlEvents
    /**
     * Forwarded attributes (`aria-*`, `data-*`, `title`, `role`) — what a
     * combobox-style composer sets on its control. Not `id`: the control's
     * id is the form contract's (the Label and the Field point at it), as is
     * `aria-invalid` (the `invalid` prop). An app `aria-describedby` joins
     * the Field's rather than replacing it.
     */
    & Omit<WithHtmlAttrs, 'id'>
    & WithClass
    & Define.Expose<InputHandle>;

const InputInput = component<InputInputProps>(({ props, expose, onMounted, onUnmounted }) => {
    const ctx = useInputContext();
    // A trigger-mode Combobox above drives this control (#106), as it does
    // a Textarea's: its ARIA, its keys first, and every text or caret change.
    const claim = useTextControlBinding()?.claim() ?? null;
    let el: HTMLInputElement | null = null;

    // The app's onInput is attached at mount, not in the JSX: sigx appends
    // the model's own listener after every declared prop, so a JSX onInput
    // would run BEFORE the model took the value. Registered later, it runs
    // after — but only until the first re-render: sigx re-adds the model's
    // listener on every render (the handler is a new closure each time), and
    // re-added it lands AFTER this one. So this writes the model itself
    // first (the model's own write that follows is then a no-op), and the
    // handler reads the new value from its model on every keystroke. Not
    // under a timing modifier: `lazy` and `debounce` exist precisely to NOT
    // write on each input.
    const onInput = (e: Event): void => {
        if (el) ctx.text.value = el.value;
        if (el && !ctx.modifiers() && ctx.state.value !== el.value) ctx.state.value = el.value;
        claim?.sync(true);
        props.onInput?.(e);
    };
    let detachInput = (): void => {};

    // Reset restores the default into the model, then the element — see
    // onFormReset for why the element needs it too.
    let detachReset = (): void => {};
    onMounted(() => {
        const node = el;
        node?.addEventListener('input', onInput);
        detachInput = () => node?.removeEventListener('input', onInput);
        detachReset = onFormReset(() => el, () => {
            ctx.state.value = ctx.defaultValue();
            if (el) el.value = ctx.state.value;
            ctx.text.value = ctx.state.value ?? '';
        });
    });
    onUnmounted(() => {
        claim?.release();
        detachReset();
        detachInput();
    });

    expose({
        get element() { return el; },
        focus: (options?: FocusOptions) => el?.focus(options),
    });

    return () => {
        const attrs = htmlAttrs(props);
        const describedBy = [ctx.describedBy(), attrs['aria-describedby']].filter(Boolean).join(' ') || undefined;
        return (
            <input
                {...attrs}
                id={ctx.inputId()}
                type={ctx.type()}
                name={ctx.name()}
                form={ctx.form()}
                autoComplete={ctx.autocomplete()}
                maxLength={ctx.maxlength()}
                {...ctx.nativeAttrs()}
                data-scope={SCOPE}
                data-part="input"
                data-disabled={dataAttr(ctx.disabled())}
                data-invalid={dataAttr(ctx.invalid())}
                data-required={dataAttr(ctx.required())}
                data-readonly={dataAttr(ctx.readonly())}
                data-focus-visible={dataAttr(ctx.focusVisible.value)}
                model={ctx.state}
                modelModifiers={ctx.modifiers()}
                placeholder={props.placeholder}
                disabled={ctx.disabled()}
                readOnly={ctx.readonly()}
                required={ctx.required()}
                aria-invalid={ctx.invalid() ? 'true' : undefined}
                aria-describedby={describedBy}
                class={props.class}
                {...claim?.attrs()}
                ref={(node: HTMLInputElement | null) => { el = node; ctx.setInputEl(node); claim?.setElement(node); }}
                onBeforeinput={props.onBeforeinput}
                onKeydown={(e: KeyboardEvent) => {
                    if (claim?.keydown(e)) return;
                    props.onKeydown?.(e);
                    // A search field's platform convention, on every engine:
                    // Escape empties it. Only while there is something to
                    // clear, and cancelled so an enclosing dismiss layer
                    // (dialog, popover) leaves it to the field; an empty
                    // field lets Escape through to close them.
                    if (
                        e.key === 'Escape' && !e.defaultPrevented && ctx.type() === 'search'
                        && el !== null && el.value !== '' && !ctx.disabled() && !ctx.readonly()
                    ) {
                        e.preventDefault();
                        ctx.clear();
                    }
                }}
                onKeyup={claim
                    ? (e: KeyboardEvent) => { claim.sync(); props.onKeyup?.(e); }
                    : props.onKeyup}
                onClick={claim ? () => claim.sync() : undefined}
                onCompositionstart={props.onCompositionstart}
                onCompositionend={props.onCompositionend}
                onFocus={(e: FocusEvent) => {
                    ctx.focusVisible.value = isFocusVisible(el);
                    props.onFocus?.(e);
                }}
                onBlur={(e: FocusEvent) => {
                    ctx.focusVisible.value = false;
                    claim?.blur(e);
                    props.onBlur?.(e);
                }}
            />
        );
    };
}, { name: 'Input.Input' });

// ── Adornment ──

export type InputAdornmentProps =
    /** Which logical edge of the control it sits at; rendered as `data-placement`. */
    & Define.Prop<'placement', 'start' | 'end', true>
    & WithClass
    & WithHtmlAttrs
    & Define.Slot<'default'>;

/** What a press may land on inside an adornment and keep for itself. */
const INTERACTIVE = 'a[href], button, input, select, textarea, label, [tabindex], [contenteditable]';

/**
 * Consumer content at one edge of the control — an icon, a unit, a prefix.
 * `aria-hidden` is not forced: whether it says something is the app's call.
 */
const InputAdornment = component<InputAdornmentProps>(({ props, slots }) => {
    const ctx = useInputContext();
    return () => (
        <span
            {...htmlAttrs(props)}
            data-scope={SCOPE}
            data-part="adornment"
            data-placement={props.placement}
            data-disabled={dataAttr(ctx.disabled())}
            class={props.class}
            onMousedown={(e: MouseEvent) => {
                // The box's own padding focuses the field; so does its
                // decoration. Cancelled so the caret the input already has
                // survives, and so the text under the press is not selected.
                const target = e.target as Element | null;
                const host = e.currentTarget as Element;
                const hit = target?.closest?.(INTERACTIVE);
                if (hit && host.contains(hit)) return;
                const input = ctx.inputEl();
                if (!input || ctx.disabled()) return;
                e.preventDefault();
                input.focus();
            }}
        >
            {slots.default?.()}
        </span>
    );
}, { name: 'Input.Adornment' });

// ── ClearTrigger ──

export type InputClearTriggerProps =
    /** Accessible name override; defaults to `Clear`. */
    & Define.Prop<'label', string, false>
    & WithClass
    & WithHtmlAttrs
    & Define.Slot<'default'>;

/**
 * Empties the value and focuses the input. Renders nothing while the field
 * is empty, and stays out of the tab order: it is a pointer shortcut, the
 * keyboard already has select-all + delete (and Escape in a search field).
 * Disabled with the field, and while it is readonly — clearing is an edit.
 */
const InputClearTrigger = component<InputClearTriggerProps>(({ props, slots, signal }) => {
    const ctx = useInputContext();
    let el: HTMLElement | null = null;
    const focus = signal({ visible: false });
    const inert = (): boolean => ctx.disabled() || ctx.readonly();
    const press = createPressFeedback({ getElement: () => el, isDisabled: inert });

    return () => {
        // The element's text, not the model: under `lazy`/`debounce` the
        // model lags what the field shows.
        if (ctx.text.value === '') return null;
        const attrs = htmlAttrs(props);
        return (
            <button
                {...attrs}
                type="button"
                tabIndex={-1}
                data-scope={SCOPE}
                data-part="clear-trigger"
                data-disabled={dataAttr(inert())}
                data-focus-visible={dataAttr(focus.visible)}
                disabled={inert()}
                aria-label={props.label ?? attrs['aria-label'] ?? 'Clear'}
                aria-controls={ctx.inputId()}
                class={props.class}
                ref={(node: HTMLElement | null) => { el = node; }}
                // Keep focus (and the caret) in the input through the press.
                onMousedown={(e: MouseEvent) => e.preventDefault()}
                onClick={() => ctx.clear()}
                onKeydown={press.onKeydown}
                onKeyup={press.onKeyup}
                onPointerdown={press.onPointerdown}
                onPointerup={press.onPointerup}
                onPointercancel={press.onPointercancel}
                onPointerleave={press.onPointerleave}
                onFocus={() => { focus.visible = isFocusVisible(el); }}
                onBlur={(e: FocusEvent) => {
                    press.onBlur(e);
                    focus.visible = false;
                }}
            >
                {slots.default ? slots.default() : <span aria-hidden="true">×</span>}
            </button>
        );
    };
}, { name: 'Input.ClearTrigger' });

// ── VisibilityTrigger ──

export type InputVisibilityTriggerProps =
    /** Accessible name override; defaults to `Show password`. */
    & Define.Prop<'label', string, false>
    & WithClass
    & WithHtmlAttrs
    /** Receives whether the characters are shown, to swap an icon. */
    & Define.Slot<'default', { visible: boolean }>;

/**
 * Toggles `model:visible`. One constant name and `aria-pressed` — a toggle
 * button's contract — rather than a label that flips between "Show" and
 * "Hide", which AT would announce as a different control.
 */
const InputVisibilityTrigger = component<InputVisibilityTriggerProps>(({ props, slots, signal }) => {
    const ctx = useInputContext();
    let el: HTMLElement | null = null;
    const focus = signal({ visible: false });
    const press = createPressFeedback({ getElement: () => el, isDisabled: () => ctx.disabled() });

    return () => {
        const attrs = htmlAttrs(props);
        const on = ctx.visible.value;
        return (
            <button
                {...attrs}
                type="button"
                data-scope={SCOPE}
                data-part="visibility-trigger"
                data-state={stateAttr(on, 'on', 'off')}
                data-disabled={dataAttr(ctx.disabled())}
                data-focus-visible={dataAttr(focus.visible)}
                disabled={ctx.disabled()}
                aria-pressed={on ? 'true' : 'false'}
                aria-label={props.label ?? attrs['aria-label'] ?? 'Show password'}
                aria-controls={ctx.inputId()}
                class={props.class}
                ref={(node: HTMLElement | null) => { el = node; }}
                onClick={() => { ctx.visible.value = !ctx.visible.value; }}
                onKeydown={press.onKeydown}
                onKeyup={press.onKeyup}
                onPointerdown={press.onPointerdown}
                onPointerup={press.onPointerup}
                onPointercancel={press.onPointercancel}
                onPointerleave={press.onPointerleave}
                onFocus={() => { focus.visible = isFocusVisible(el); }}
                onBlur={(e: FocusEvent) => {
                    press.onBlur(e);
                    focus.visible = false;
                }}
            >
                {slots.default
                    ? slots.default({ visible: on })
                    : <span aria-hidden="true">{on ? '○' : '◉'}</span>}
            </button>
        );
    };
}, { name: 'Input.VisibilityTrigger' });

export const Input = compound(InputRoot, {
    Root: InputRoot,
    Label: InputLabel,
    Control: InputControl,
    Input: InputInput,
    Adornment: InputAdornment,
    ClearTrigger: InputClearTrigger,
    VisibilityTrigger: InputVisibilityTrigger,
});
