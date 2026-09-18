/**
 * NumberInput — WAI-ARIA spinbutton over a real text input.
 *
 * ```tsx
 * <NumberInput.Root model={() => state.qty} min={0} max={99}>
 *     <NumberInput.Label>Quantity</NumberInput.Label>
 *     <NumberInput.Control>
 *         <NumberInput.DecrementTrigger>−</NumberInput.DecrementTrigger>
 *         <NumberInput.Input />
 *         <NumberInput.IncrementTrigger>+</NumberInput.IncrementTrigger>
 *     </NumberInput.Control>
 * </NumberInput.Root>
 * ```
 *
 * The model is `number | null` (null = empty — an empty field is not 0).
 * Typing edits an UNCOMMITTED draft; the draft commits on blur and Enter
 * (parse → clamp → snap), so half-typed entries like `-` or `1e` never
 * reach the model and unparseable text reverts to the last committed value.
 * Stepping (arrows, PageUp/Down, Home/End, the spin triggers, opt-in wheel)
 * commits immediately.
 *
 * The visible input is `type="text" inputmode="decimal"` — `type="number"`
 * would fight the draft model with its own parsing, spinner chrome and
 * scroll-to-change. Form participation goes through `hidden-input`, which
 * posts the canonical `String(value)`; the visible input never carries
 * `name`, so a custom display `format` can't corrupt form data.
 */
import { component, compound, defineInjectable, defineProvide } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState, createInertState, type ControllableState } from '../../behaviors/controllable.js';
import { derivedModel } from '../../behaviors/derived-model.js';
import { createFormControl } from '../../behaviors/form-control.js';
import { onFormReset } from '../../behaviors/form-reset.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { createSpinPress } from '../../behaviors/spin.js';
import { dataAttr } from '../../contract/data-attrs.js';
import { renderAsChild } from '../../contract/as-child.js';
import { variantAttrs } from '../../contract/props.js';
import type { PartProps, WithAsChild, WithClass, WithDisabled, WithFormControl, WithReadonly, WithVariantAxes } from '../../contract/props.js';
import { clamp, snapToStep } from './number.js';
import { numberInputAnatomy } from './anatomy.js';

const SCOPE = numberInputAnatomy.scope;

interface NumberInputContext {
    state: ControllableState<number | null>;
    /** Uncommitted text while typing; null = mirror the model. */
    draft: { current: string | null };
    /**
     * The text the input binds (the binding law): reads the display value
     * (the draft while typing, the formatted model otherwise) and writes the
     * draft — the model is not touched until `commit()`.
     */
    text: ControllableState<string>;
    inputId(): string;
    disabled(): boolean;
    invalid(): boolean;
    required(): boolean;
    readonly(): boolean;
    min(): number | undefined;
    max(): number | undefined;
    step(): number;
    allowWheel(): boolean;
    displayValue(): string;
    describedBy(): string | undefined;
    labelId(): string | undefined;
    focusVisible: { value: boolean };
    canStep(direction: 1 | -1): boolean;
    stepBy(multiplier: number): void;
    stepTo(edge: 'min' | 'max'): boolean;
    commit(): void;
    inputKeydown(e: KeyboardEvent): void;
    setInput(el: HTMLInputElement | null): void;
    focusInput(): void;
}

function makeInert(): NumberInputContext {
    return {
        state: createInertState<number | null>(null),
        draft: { current: null },
        text: createInertState<string>(''),
        inputId: () => 'zx-number-inert',
        disabled: () => false,
        invalid: () => false,
        required: () => false,
        readonly: () => false,
        min: () => undefined,
        max: () => undefined,
        step: () => 1,
        allowWheel: () => false,
        displayValue: () => '',
        describedBy: () => undefined,
        labelId: () => undefined,
        focusVisible: { value: false },
        canStep: () => false,
        stepBy: () => {},
        stepTo: () => false,
        commit: () => {},
        inputKeydown: () => {},
        setInput: () => {},
        focusInput: () => {},
    };
}

export const useNumberInputContext = defineInjectable<NumberInputContext>(() => makeInert());

// ── Root ──

export type NumberInputRootProps =
    & Define.Model<number | null>
    & Define.Prop<'defaultValue', number | null, false>
    & Define.Event<'valueChange', number | null>
    & Define.Prop<'min', number, false>
    & Define.Prop<'max', number, false>
    & Define.Prop<'step', number, false>
    /** Wheel over the FOCUSED input steps the value (default false). */
    & Define.Prop<'allowWheel', boolean, false>
    /** Clamp an out-of-range commit into [min, max] (default true). */
    & Define.Prop<'clampOnBlur', boolean, false>
    /** Display formatting for the committed value (default `String`). */
    & Define.Prop<'format', (value: number) => string, false>
    /** Parse typed text; return null for "not a number" (default lenient decimal). */
    & Define.Prop<'parse', (text: string) => number | null, false>
    & WithFormControl
    & WithReadonly
    & WithDisabled
    & WithVariantAxes<'number-input'>
    & WithClass
    & Define.Slot<'default'>;

// Decimal syntax only — bare Number() would also accept 0x10/0b10/0o10,
// which is not what "type a number" means in a form field.
const DECIMAL_RE = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;

const defaultParse = (text: string): number | null => {
    const t = text.trim();
    if (!DECIMAL_RE.test(t)) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
};

const NumberInputRoot = component<NumberInputRootProps>(({ props, slots, emit, signal, onMounted, onUnmounted }) => {
    const state = createControllableState<number | null>(
        () => props.model,
        props.defaultValue ?? null,
        (v) => emit('valueChange', v),
    );
    const draft = signal({ current: null as string | null });
    const focusVisible = signal({ value: false });
    let inputEl: HTMLInputElement | null = null;
    let hiddenEl: HTMLInputElement | null = null;

    const outOfRange = (): boolean => {
        const v = state.value;
        if (v == null) return false;
        return (props.min !== undefined && v < props.min) || (props.max !== undefined && v > props.max);
    };
    const fc = createFormControl({ props: () => props, idBase: 'zx-number', controlPart: 'input', invalid: outOfRange });
    const disabled = fc.disabled;
    const readonly = fc.readonly;
    // Coerced, not trusted: snapToStep divides by this, so step={0} (or a
    // non-finite value) would poison the model and ARIA with NaN/Infinity.
    const step = (): number => {
        const s = props.step;
        return typeof s === 'number' && Number.isFinite(s) && s > 0 ? s : 1;
    };
    const format = (v: number): string => (props.format ? props.format(v) : String(v));
    const parse = (t: string): number | null => (props.parse ? props.parse(t) : defaultParse(t));

    const invalid = fc.invalid;

    const settle = (v: number): number => clamp(snapToStep(v, step(), props.min), props.min, props.max);

    const commit = (): void => {
        const text = draft.current;
        if (text === null) return;
        draft.current = null;
        const trimmed = text.trim();
        if (trimmed === '') {
            state.value = null;
            return;
        }
        const parsed = parse(trimmed);
        // Unparseable → revert to the last committed value (draft is gone,
        // the display falls back to the model). The finite check also guards
        // a custom `parse` leaking NaN/Infinity into the model and ARIA.
        if (parsed === null || !Number.isFinite(parsed)) return;
        state.value = (props.clampOnBlur ?? true) ? settle(parsed) : snapToStep(parsed, step(), props.min);
    };

    const canStep = (direction: 1 | -1): boolean => {
        if (disabled() || readonly()) return false;
        const v = state.value;
        if (v == null) return true;
        return direction > 0
            ? !(props.max !== undefined && v >= props.max)
            : !(props.min !== undefined && v <= props.min);
    };

    const stepBy = (multiplier: number): void => {
        if (disabled() || readonly()) return;
        commit();
        const current = state.value;
        // From empty, the first step lands on the floor of the range (or 0),
        // not one step past it — matching native spinbuttons.
        state.value = current == null ? settle(props.min ?? 0) : settle(current + step() * multiplier);
    };

    const stepTo = (edge: 'min' | 'max'): boolean => {
        const target = edge === 'min' ? props.min : props.max;
        if (target === undefined || disabled() || readonly()) return false;
        draft.current = null;
        // The edge itself, NOT settle(): max may sit off the step grid
        // (step 4, max 5) and Home/End promise the documented bound, the
        // way a clamped commit can already land there.
        state.value = target;
        return true;
    };

    const displayValue = (): string => {
        if (draft.current !== null) return draft.current;
        const v = state.value;
        return v == null ? '' : format(v);
    };

    const ctx: NumberInputContext = {
        state,
        draft,
        text: derivedModel<string>(displayValue, (v) => { draft.current = v; }),
        inputId: fc.controlId,
        disabled,
        invalid,
        required: fc.required,
        readonly,
        min: () => props.min,
        max: () => props.max,
        step,
        allowWheel: () => props.allowWheel ?? false,
        displayValue,
        describedBy: fc.describedBy,
        labelId: fc.labelId,
        focusVisible,
        canStep,
        stepBy,
        stepTo,
        commit,
        inputKeydown: (e: KeyboardEvent) => {
            // readonly must not swallow the keys either: preventDefault on a
            // no-op Arrow/Home/End would block normal caret navigation in a
            // readable field.
            if (disabled() || readonly()) return;
            switch (e.key) {
                case 'ArrowUp':
                    e.preventDefault();
                    stepBy(1);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    stepBy(-1);
                    break;
                case 'PageUp':
                    e.preventDefault();
                    stepBy(10);
                    break;
                case 'PageDown':
                    e.preventDefault();
                    stepBy(-10);
                    break;
                case 'Home':
                    // Only intercept when there is an edge to jump to; a
                    // boundless spinbutton leaves Home/End to the text caret.
                    if (stepTo('min')) e.preventDefault();
                    break;
                case 'End':
                    if (stepTo('max')) e.preventDefault();
                    break;
                case 'Enter':
                    commit();
                    break;
            }
        },
        setInput: (el) => { inputEl = el; },
        focusInput: () => inputEl?.focus(),
    };
    defineProvide(useNumberInputContext, () => ctx);

    let detachReset = (): void => {};
    onMounted(() => {
        detachReset = onFormReset(() => hiddenEl ?? inputEl, () => {
            draft.current = null;
            state.value = props.defaultValue ?? null;
            if (hiddenEl) hiddenEl.value = state.value == null ? '' : String(state.value);
            if (inputEl) inputEl.value = ctx.displayValue();
        });
    });
    onUnmounted(() => detachReset());

    return () => (
        <div
            data-scope={SCOPE}
            data-part="root"
            data-disabled={dataAttr(disabled())}
            data-invalid={dataAttr(invalid())}
            data-required={dataAttr(ctx.required())}
            data-readonly={dataAttr(readonly())}
            {...variantAttrs(props)}
            class={props.class}
        >
            {slots.default?.()}
            {fc.hasName()
                ? (
                    <input
                        type="hidden"
                        data-scope={SCOPE}
                        data-part="hidden-input"
                        {...fc.hiddenAttrs()}
                        value={state.value == null ? '' : String(state.value)}
                        ref={(node: HTMLInputElement | null) => { hiddenEl = node; }}
                    />
                )
                : null}
        </div>
    );
}, { name: 'NumberInput.Root' });

// ── Label ──

export type NumberInputLabelProps = WithClass & Define.Slot<'default'>;

const NumberInputLabel = component<NumberInputLabelProps>(({ props, slots }) => {
    const ctx = useNumberInputContext();
    return () => (
        <label
            id={ctx.labelId()}
            for={ctx.inputId()}
            data-scope={SCOPE}
            data-part="label"
            data-disabled={dataAttr(ctx.disabled())}
            data-invalid={dataAttr(ctx.invalid())}
            data-required={dataAttr(ctx.required())}
            class={props.class}
        >
            {slots.default?.()}
        </label>
    );
}, { name: 'NumberInput.Label' });

// ── Control ──

export type NumberInputControlProps = WithClass & Define.Slot<'default'>;

const NumberInputControl = component<NumberInputControlProps>(({ props, slots }) => {
    const ctx = useNumberInputContext();
    return () => (
        <div
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
}, { name: 'NumberInput.Control' });

// ── Input ──

export type NumberInputInputProps =
    & Define.Prop<'placeholder', string, false>
    & WithClass;

const NumberInputInput = component<NumberInputInputProps>(({ props }) => {
    const ctx = useNumberInputContext();
    let el: HTMLInputElement | null = null;

    return () => (
        <input
            id={ctx.inputId()}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            role="spinbutton"
            data-scope={SCOPE}
            data-part="input"
            data-disabled={dataAttr(ctx.disabled())}
            data-invalid={dataAttr(ctx.invalid())}
            data-required={dataAttr(ctx.required())}
            data-readonly={dataAttr(ctx.readonly())}
            data-focus-visible={dataAttr(ctx.focusVisible.value)}
            model={ctx.text}
            placeholder={props.placeholder}
            disabled={ctx.disabled()}
            readOnly={ctx.readonly()}
            required={ctx.required()}
            aria-valuemin={ctx.min()}
            aria-valuemax={ctx.max()}
            /* While a draft is being typed the committed value is stale —
               announcing it against the visible draft text would read as two
               different numbers. The draft rides valuetext alone until commit. */
            aria-valuenow={ctx.draft.current === null ? ctx.state.value ?? undefined : undefined}
            aria-valuetext={ctx.draft.current !== null
                ? (ctx.draft.current || undefined)
                : (ctx.state.value != null ? ctx.displayValue() : undefined)}
            aria-invalid={ctx.invalid() ? 'true' : undefined}
            aria-describedby={ctx.describedBy()}
            class={props.class}
            ref={(node: HTMLInputElement | null) => {
                el = node;
                ctx.setInput(node);
            }}
            onKeydown={(e: KeyboardEvent) => ctx.inputKeydown(e)}
            onWheel={(e: WheelEvent) => {
                // Focus-gated: a wheel over an unfocused input keeps
                // scrolling the page.
                // deltaY 0 is a horizontal scroll — not a step in either
                // direction.
                if (!ctx.allowWheel() || e.deltaY === 0 || document.activeElement !== el) return;
                e.preventDefault();
                ctx.stepBy(e.deltaY < 0 ? 1 : -1);
            }}
            onFocus={() => { ctx.focusVisible.value = isFocusVisible(el); }}
            onBlur={() => {
                ctx.focusVisible.value = false;
                ctx.commit();
            }}
        />
    );
}, { name: 'NumberInput.Input' });

// ── Triggers ──

export type NumberInputTriggerProps =
    & Define.Prop<'label', string, false>
    & WithClass
    & WithAsChild
    & Define.Slot<'default', PartProps>;

function makeTrigger(direction: 1 | -1, part: 'increment-trigger' | 'decrement-trigger', name: string) {
    return component<NumberInputTriggerProps>(({ props, slots, onUnmounted }) => {
        const ctx = useNumberInputContext();
        let el: HTMLElement | null = null;

        const triggerDisabled = (): boolean => ctx.disabled() || ctx.readonly() || !ctx.canStep(direction);
        const press = createPressFeedback({
            getElement: () => el,
            isDisabled: () => triggerDisabled(),
        });
        const spin = createSpinPress({
            onSpin: () => ctx.stepBy(direction),
            isDisabled: () => triggerDisabled(),
        });
        onUnmounted(() => spin.stop());

        const bag = (): PartProps => ({
            'data-scope': SCOPE,
            'data-part': part,
            'data-disabled': dataAttr(triggerDisabled()),
            // Satellites of the input, not tab stops of their own (APG):
            // keyboard stepping lives on the spinbutton itself.
            tabIndex: -1,
            'aria-label': props.label ?? (direction > 0 ? 'Increment' : 'Decrement'),
            'aria-controls': ctx.inputId(),
            'aria-disabled': props.asChild && triggerDisabled() ? 'true' : undefined,
            ref: (node: HTMLElement | null) => { el = node; },
            onPointerdown: (e: PointerEvent) => {
                press.onPointerdown(e);
                spin.onPointerdown(e);
                // The spin's preventDefault keeps native focus from moving —
                // hand it to the spinbutton instead (Combobox.Trigger's
                // satellite semantics), so keyboard stepping continues where
                // the pointer left off.
                if (!triggerDisabled()) ctx.focusInput();
            },
            onPointerup: (e: PointerEvent) => {
                press.onPointerup(e);
                spin.onPointerup(e);
            },
            onPointercancel: (e: PointerEvent) => {
                press.onPointercancel(e);
                spin.onPointercancel(e);
            },
            onPointerleave: (e: PointerEvent) => {
                press.onPointerleave(e);
                spin.onPointerleave(e);
            },
            // No onClick stepping: the spin press already stepped on
            // pointerdown; a click handler would double-step every tap.
        });

        return () => {
            const b = bag();
            if (props.asChild) return renderAsChild(slots.default, b);
            return (
                <button type="button" class={props.class} disabled={triggerDisabled()} {...b}>
                    {slots.default?.(b)}
                </button>
            );
        };
    }, { name });
}

const NumberInputIncrementTrigger = makeTrigger(1, 'increment-trigger', 'NumberInput.IncrementTrigger');
const NumberInputDecrementTrigger = makeTrigger(-1, 'decrement-trigger', 'NumberInput.DecrementTrigger');

export const NumberInput = compound(NumberInputRoot, {
    Root: NumberInputRoot,
    Label: NumberInputLabel,
    Control: NumberInputControl,
    Input: NumberInputInput,
    IncrementTrigger: NumberInputIncrementTrigger,
    DecrementTrigger: NumberInputDecrementTrigger,
});
