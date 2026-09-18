/**
 * Slider — a number (or number[]) model with two web projections.
 *
 * Single value, native projection (unchanged since v1):
 * ```tsx
 * <Slider.Root model={() => state.volume} min={0} max={100}>
 *     <Slider.Label>Volume</Slider.Label>
 *     <Slider.Control />
 *     <Slider.ValueText />
 * </Slider.Root>
 * ```
 * The platform supplies keyboard behavior, form participation and a11y;
 * design systems style the input's track/thumb pseudo-elements against
 * `[data-scope="slider"][data-part="control"]`. The current fraction is
 * exposed as `--slider-percent` for track-fill styling.
 *
 * Range / multi-thumb, composed projection (#325): `model` accepts
 * `number[]`, and the consumer composes the real parts —
 * ```tsx
 * <Slider.Root model={() => state.price} min={0} max={500} marks={[0, 250, 500]}>
 *     <Slider.Label>Price</Slider.Label>
 *     <Slider.Track>
 *         <Slider.Range />
 *         <Slider.Thumb label="Minimum price" />
 *         <Slider.Thumb label="Maximum price" />
 *     </Slider.Track>
 *     <Slider.ValueText />
 * </Slider.Root>
 * ```
 * One `Slider.Thumb` per value, in order (thumbs claim their index by
 * registration order; an explicit `index` prop pins one). Each thumb is an
 * APG `role="slider"` tab stop: arrows/PageUp/PageDown step it (RTL-aware),
 * Home/End go to its ALLOWED bounds — thumbs cannot cross, so a thumb clamps
 * at its neighbor and announces that clamp as `aria-valuemin`/`aria-valuemax`.
 * `Slider.Range` spans lowest → highest (min → value when single). Pointer
 * presses on the track move the nearest thumb and start a drag. `marks`
 * renders one positioned `mark` part per entry inside the track.
 *
 * Zero positions the moving parts structurally (absolute + logical
 * `inset-inline-start` percentages, so RTL mirrors for free) and paints
 * nothing: a recipe centers the thumb on its position with a negative
 * `margin-inline-start` of half its own width, and owns every color.
 */
import { component, compound, defineInjectable, defineProvide } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState, createInertState, type ControllableState } from '../../behaviors/controllable.js';
import { derivedModel } from '../../behaviors/derived-model.js';
import { createFormControl } from '../../behaviors/form-control.js';
import { onFormReset } from '../../behaviors/form-reset.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { dataAttr } from '../../contract/data-attrs.js';
import { variantAttrs } from '../../contract/props.js';
import type { WithClass, WithDisabled, WithForm, WithInvalid, WithName, WithVariantAxes } from '../../contract/props.js';
import { sliderAnatomy } from './anatomy.js';

const SCOPE = sliderAnatomy.scope;

/** A tick on the track: a bare value, or a value with a rendered label. */
export type SliderMark = number | { value: number; label?: string };

/** What a Thumb registers so the root can index and focus it. */
interface ThumbEntry {
    el(): HTMLElement | null;
}

interface SliderContext {
    state: ControllableState<number | number[]>;
    /** The model, normalized to an array (a scalar model is `[value]`). */
    values(): number[];
    /**
     * The first value as a Model — what the native range binds (the binding
     * law): reads `values()[0]`, writes through `setValueAt(0, …)` so the
     * quantizing and clamping hold for a platform write too.
     */
    scalar: ControllableState<number>;
    /**
     * Write one value: quantized to `step`, clamped to `[min, max]` AND at
     * the neighboring thumbs (thumbs cannot cross). Emission preserves the
     * model's shape — scalar in, scalar out.
     */
    setValueAt(index: number, value: number): void;
    min(): number;
    max(): number;
    step(): number;
    disabled(): boolean;
    invalid(): boolean;
    name(): string | undefined;
    form(): string | undefined;
    /** The scalar projection's default; null under a range model. */
    defaultScalar(): number | null;
    percent(): number;
    percentOf(value: number): number;
    valueTextFor(value: number, index: number): string | undefined;
    marks(): readonly SliderMark[];
    ids: { control: string; label: string };
    focusVisible: { visible: boolean };
    registerThumb(entry: ThumbEntry): () => void;
    thumbIndex(entry: ThumbEntry): number;
    focusThumb(index: number): void;
    /** Map a pointer position to a value through the track's box (RTL-aware). */
    trackToValue(e: { clientX: number }): number;
    /** Start dragging one thumb; window listeners follow the pointer out. */
    beginDrag(index: number): void;
    setTrack(el: HTMLElement | null): void;
}

function makeInert(): SliderContext {
    return {
        state: createInertState<number | number[]>(0),
        values: () => [0],
        scalar: createInertState<number>(0),
        setValueAt: () => {},
        min: () => 0,
        max: () => 100,
        step: () => 1,
        disabled: () => false,
        invalid: () => false,
        name: () => undefined,
        form: () => undefined,
        defaultScalar: () => null,
        percent: () => 0,
        percentOf: () => 0,
        valueTextFor: () => undefined,
        marks: () => [],
        ids: { control: 'zx-slider-inert-control', label: 'zx-slider-inert-label' },
        focusVisible: { visible: false },
        registerThumb: () => () => {},
        thumbIndex: () => 0,
        focusThumb: () => {},
        trackToValue: () => 0,
        beginDrag: () => {},
        setTrack: () => {},
    };
}

export const useSliderContext = defineInjectable<SliderContext>(() => makeInert());

/** `:dir(rtl)` with the computed-style fallback — the shape Menu.tsx uses. */
function isRtl(el: HTMLElement | null): boolean {
    if (!el) return false;
    try {
        if (el.matches(':dir(rtl)')) return true;
    } catch {
        // :dir() unsupported — fall through to computed style.
    }
    return typeof getComputedStyle === 'function' && getComputedStyle(el).direction === 'rtl';
}

/** Digits after the decimal point — what `quantize` rounds float drift to. */
function decimalsOf(n: number): number {
    const s = String(n);
    const dot = s.indexOf('.');
    return dot === -1 ? 0 : s.length - dot - 1;
}

export type SliderRootProps =
    & Define.Model<number | number[]>
    & Define.Prop<'defaultValue', number | number[], false>
    & Define.Event<'valueChange', number | number[]>
    & Define.Prop<'min', number, false>
    & Define.Prop<'max', number, false>
    & Define.Prop<'step', number, false>
    & WithName
    & WithForm
    & WithInvalid
    /** Ticks rendered as `mark` parts inside `Slider.Track`. */
    & Define.Prop<'marks', readonly SliderMark[], false>
    /** Per-thumb `aria-valuetext` — "$40", "40 percent". */
    & Define.Prop<'getValueText', (value: number, index: number) => string, false>
    & WithDisabled
    & WithVariantAxes<'slider'>
    & WithClass
    & Define.Slot<'default'>;

const SliderRoot = component<SliderRootProps>(({ props, slots, emit, signal, onMounted, onUnmounted }) => {
    const min = () => props.min ?? 0;
    const max = () => props.max ?? 100;
    const step = () => props.step ?? 1;
    const state = createControllableState<number | number[]>(
        () => props.model,
        props.defaultValue ?? min(),
        (v) => emit('valueChange', v),
    );
    const fc = createFormControl({ props: () => props, idBase: 'zx-slider' });
    const focusVisible = signal({ visible: false });
    const thumbs: ThumbEntry[] = [];
    let track: HTMLElement | null = null;
    let dragIndex: number | null = null;
    let detachDrag: (() => void) | null = null;
    const hiddenEls: (HTMLInputElement | null)[] = [];

    // The range projection posts through hidden inputs; reset restores the
    // default array and re-syncs them (the scalar projection's native range
    // handles its own reset in Slider.Control).
    let detachReset = (): void => {};
    onMounted(() => {
        detachReset = onFormReset(() => hiddenEls[0] ?? null, () => {
            const def = props.defaultValue ?? min();
            if (!Array.isArray(def)) return;
            state.value = def;
            def.forEach((v, i) => { const el = hiddenEls[i]; if (el) el.value = String(v); });
        });
    });
    onUnmounted(() => detachReset());

    const values = (): number[] => (Array.isArray(state.value) ? state.value : [state.value]);

    const quantize = (raw: number): number => {
        const s = step();
        const snapped = Math.round((raw - min()) / s) * s + min();
        // `0.2 + 0.1` is 0.30000000000000004 — round to the step's own
        // precision so keyboard steps stay presentable.
        const precision = Math.min(20, Math.max(decimalsOf(s), decimalsOf(min())));
        const clean = Number(snapped.toFixed(precision));
        return Math.min(max(), Math.max(min(), clean));
    };

    const setValueAt = (index: number, raw: number): void => {
        const vals = values();
        if (index < 0 || index >= vals.length) return;
        let v = quantize(raw);
        // Thumbs cannot cross: clamp at the neighbors.
        const lo = index > 0 ? vals[index - 1]! : min();
        const hi = index < vals.length - 1 ? vals[index + 1]! : max();
        v = Math.min(hi, Math.max(lo, v));
        if (v === vals[index]) return;
        if (Array.isArray(state.value)) {
            const next = [...vals];
            next[index] = v;
            state.value = next;
        } else {
            state.value = v;
        }
    };

    const percentOf = (v: number): number => {
        const span = max() - min();
        if (span <= 0) return 0;
        return Math.min(100, Math.max(0, ((v - min()) / span) * 100));
    };

    const endDrag = (): void => {
        dragIndex = null;
        detachDrag?.();
    };
    onUnmounted(() => detachDrag?.());

    const ctx: SliderContext = {
        state,
        values,
        scalar: derivedModel<number>(() => values()[0]!, (v) => setValueAt(0, v)),
        setValueAt,
        min,
        max,
        step,
        disabled: fc.disabled,
        invalid: fc.invalid,
        name: fc.name,
        form: fc.form,
        defaultScalar: () => (Array.isArray(props.defaultValue) ? null : props.defaultValue ?? min()),
        // The highest value's fraction — identical to v1 for a scalar model.
        percent: () => percentOf(Math.max(...values())),
        percentOf,
        valueTextFor: (v, i) => props.getValueText?.(v, i),
        marks: () => props.marks ?? [],
        ids: {
            control: fc.controlId(),
            label: fc.labelId(),
        },
        focusVisible,
        registerThumb(entry) {
            thumbs.push(entry);
            return () => {
                const i = thumbs.indexOf(entry);
                if (i !== -1) thumbs.splice(i, 1);
            };
        },
        thumbIndex: (entry) => Math.max(0, thumbs.indexOf(entry)),
        focusThumb: (index) => { thumbs[index]?.el()?.focus(); },
        trackToValue(e) {
            const rect = track?.getBoundingClientRect();
            if (!rect || rect.width <= 0) return min();
            let ratio = (e.clientX - rect.left) / rect.width;
            if (isRtl(track)) ratio = 1 - ratio;
            ratio = Math.min(1, Math.max(0, ratio));
            return min() + ratio * (max() - min());
        },
        beginDrag(index) {
            if (ctx.disabled()) return;
            detachDrag?.();
            dragIndex = index;
            const onMove = (e: PointerEvent): void => {
                if (dragIndex != null) setValueAt(dragIndex, ctx.trackToValue(e));
            };
            const onEnd = (): void => endDrag();
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onEnd);
            window.addEventListener('pointercancel', onEnd);
            detachDrag = () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onEnd);
                window.removeEventListener('pointercancel', onEnd);
                detachDrag = null;
            };
        },
        setTrack: (el) => { track = el; },
    };
    defineProvide(useSliderContext, () => ctx);

    return () => (
        <div
            data-scope={SCOPE}
            data-part="root"
            data-disabled={dataAttr(ctx.disabled())}
            data-invalid={dataAttr(ctx.invalid())}
            data-focus-visible={dataAttr(focusVisible.visible)}
            style={{ '--slider-percent': `${ctx.percent()}%` }}
            {...variantAttrs(props)}
            class={props.class}
        >
            {slots.default?.()}
            {/*
              * The native control posts a scalar itself; a range has no native
              * widget, so the composed projection posts through hidden inputs —
              * one per value, sharing the name (how multi-value fields post).
              */}
            {Array.isArray(state.value) && fc.hasName()
                ? values().map((v, i) => (
                    <input
                        type="hidden"
                        data-scope={SCOPE}
                        data-part="hidden-input"
                        key={`v${i}`}
                        {...fc.hiddenAttrs()}
                        value={String(v)}
                        ref={(node: HTMLInputElement | null) => { hiddenEls[i] = node; }}
                    />
                ))
                : null}
        </div>
    );
}, { name: 'Slider.Root' });

export type SliderLabelProps = WithClass & Define.Slot<'default'>;

const SliderLabel = component<SliderLabelProps>(({ props, slots }) => {
    const slider = useSliderContext();
    return () => (
        <label
            id={slider.ids.label}
            for={slider.ids.control}
            data-scope={SCOPE}
            data-part="label"
            data-disabled={dataAttr(slider.disabled())}
            class={props.class}
        >
            {slots.default?.()}
        </label>
    );
}, { name: 'Slider.Label' });

export type SliderControlProps = WithClass;

/** The single-value native projection — an `<input type="range">`. */
const SliderControl = component<SliderControlProps>(({ props, onMounted, onUnmounted }) => {
    const slider = useSliderContext();
    let el: HTMLInputElement | null = null;

    // The native range resets to its attribute default (the midpoint when
    // none) — restore the component default into the model and the element.
    let detachReset = (): void => {};
    onMounted(() => {
        detachReset = onFormReset(() => el, () => {
            const def = slider.defaultScalar();
            if (def == null) return;
            slider.state.value = def;
            if (el) el.value = String(def);
        });
    });
    onUnmounted(() => detachReset());
    // A drag is a long press, so the press must survive leaving the box:
    // no pointerleave handler is spread below, and the behavior's window
    // release listener ends the press wherever the pointer lets go. No key
    // handlers either — arrow keys are value changes, not presses — and no
    // one-shot: a drag has no ripple.
    const press = createPressFeedback({
        getElement: () => el,
        isDisabled: () => slider.disabled(),
        oneShot: false,
    });

    return () => (
        <input
            type="range"
            id={slider.ids.control}
            data-scope={SCOPE}
            data-part="control"
            data-disabled={dataAttr(slider.disabled())}
            data-invalid={dataAttr(slider.invalid())}
            data-focus-visible={dataAttr(slider.focusVisible.visible)}
            min={slider.min()}
            max={slider.max()}
            step={slider.step()}
            model={slider.scalar}
            // The range reports a string; the number transform hands the
            // scalar model a number (the processor owns `value` itself).
            modelModifiers={{ number: true }}
            disabled={slider.disabled()}
            name={slider.name()}
            form={slider.form()}
            aria-invalid={slider.invalid() ? 'true' : undefined}
            class={props.class}
            ref={(node: HTMLInputElement | null) => { el = node; }}
            onPointerdown={press.onPointerdown}
            onPointerup={press.onPointerup}
            onPointercancel={press.onPointercancel}
            onFocus={() => { slider.focusVisible.visible = isFocusVisible(el); }}
            onBlur={(e: FocusEvent) => {
                press.onBlur(e);
                slider.focusVisible.visible = false;
            }}
        />
    );
}, { name: 'Slider.Control' });

// ── Track / Range / Thumb / marks — the composed projection ──

export type SliderTrackProps = WithClass & Define.Slot<'default'>;

/**
 * The rail. Positions its children (structural inline styles); a pointer
 * press moves the NEAREST thumb to the pressed value and starts a drag —
 * ties break toward the thumb that can travel that way, so two stacked
 * thumbs separate instead of jamming.
 */
const SliderTrack = component<SliderTrackProps>(({ props, slots }) => {
    const slider = useSliderContext();

    return () => (
        <div
            data-scope={SCOPE}
            data-part="track"
            data-disabled={dataAttr(slider.disabled())}
            style={{ position: 'relative' }}
            class={props.class}
            ref={(node: HTMLElement | null) => { slider.setTrack(node); }}
            onPointerdown={(e: PointerEvent) => {
                if (slider.disabled() || e.button !== 0) return;
                // The value under the pointer decides which thumb answers.
                e.preventDefault();
                const v = slider.trackToValue(e);
                const vals = slider.values();
                let index = 0;
                let best = Infinity;
                vals.forEach((val, i) => {
                    const d = Math.abs(val - v);
                    if (d < best || (d === best && v > val)) {
                        best = d;
                        index = i;
                    }
                });
                slider.setValueAt(index, v);
                slider.focusThumb(index);
                slider.beginDrag(index);
            }}
        >
            {slider.marks().map((mark) => {
                const value = typeof mark === 'number' ? mark : mark.value;
                const label = typeof mark === 'number' ? undefined : mark.label;
                return (
                    <span
                        data-scope={SCOPE}
                        data-part="mark"
                        data-disabled={dataAttr(slider.disabled())}
                        key={`m${value}`}
                        style={{ position: 'absolute', insetInlineStart: `${slider.percentOf(value)}%` }}
                    >
                        {label}
                    </span>
                );
            })}
            {slots.default?.()}
        </div>
    );
}, { name: 'Slider.Track' });

export type SliderRangeProps = WithClass;

/** The filled span: lowest → highest thumb; min → value when single. */
const SliderRange = component<SliderRangeProps>(({ props }) => {
    const slider = useSliderContext();
    return () => {
        const vals = slider.values();
        const lo = vals.length > 1 ? Math.min(...vals) : slider.min();
        const hi = vals.length > 0 ? Math.max(...vals) : slider.min();
        const start = slider.percentOf(lo);
        return (
            <div
                data-scope={SCOPE}
                data-part="range"
                data-disabled={dataAttr(slider.disabled())}
                style={{
                    position: 'absolute',
                    insetInlineStart: `${start}%`,
                    inlineSize: `${slider.percentOf(hi) - start}%`,
                }}
                class={props.class}
            />
        );
    };
}, { name: 'Slider.Range' });

export type SliderThumbProps =
    /** Which value this thumb drives; defaults to registration order. */
    & Define.Prop<'index', number, false>
    /** Accessible name — a multi-thumb slider must name each thumb. */
    & Define.Prop<'label', string, false>
    & WithClass
    & Define.Slot<'default'>;

const SliderThumb = component<SliderThumbProps>(({ props, slots, signal, onUnmounted }) => {
    const slider = useSliderContext();
    let el: HTMLElement | null = null;
    const entry: ThumbEntry = { el: () => el };
    const unregister = slider.registerThumb(entry);
    onUnmounted(() => unregister());
    const focus = signal({ visible: false });
    // A drag is a long press — same shape as Control: no pointerleave, no
    // one-shot, the behavior's window release ends it wherever it ends.
    const press = createPressFeedback({
        getElement: () => el,
        isDisabled: () => slider.disabled(),
        oneShot: false,
    });

    const index = (): number => props.index ?? slider.thumbIndex(entry);
    const bounds = (): { lo: number; hi: number } => {
        const vals = slider.values();
        const i = index();
        return {
            lo: i > 0 ? vals[i - 1]! : slider.min(),
            hi: i < vals.length - 1 ? vals[i + 1]! : slider.max(),
        };
    };

    return () => {
        const i = index();
        const value = slider.values()[i] ?? slider.min();
        const { lo, hi } = bounds();
        const disabled = slider.disabled();
        return (
            <div
                data-scope={SCOPE}
                data-part="thumb"
                data-disabled={dataAttr(disabled)}
                data-focus-visible={dataAttr(focus.visible)}
                role="slider"
                tabIndex={disabled ? undefined : 0}
                aria-label={props.label}
                aria-orientation="horizontal"
                // The ALLOWED range, not the rail's: the clamp at the
                // neighbor is announced, per APG multi-thumb.
                aria-valuemin={lo}
                aria-valuemax={hi}
                aria-valuenow={value}
                aria-valuetext={slider.valueTextFor(value, i)}
                aria-disabled={disabled ? 'true' : undefined}
                style={{ position: 'absolute', insetInlineStart: `${slider.percentOf(value)}%` }}
                class={props.class}
                ref={(node: HTMLElement | null) => { el = node; }}
                onKeydown={(e: KeyboardEvent) => {
                    if (disabled) return;
                    const s = slider.step();
                    const rtl = isRtl(el);
                    let delta: number | null = null;
                    switch (e.key) {
                        case 'ArrowRight': delta = rtl ? -s : s; break;
                        case 'ArrowLeft': delta = rtl ? s : -s; break;
                        case 'ArrowUp': delta = s; break;
                        case 'ArrowDown': delta = -s; break;
                        case 'PageUp': delta = s * 10; break;
                        case 'PageDown': delta = -s * 10; break;
                        case 'Home':
                            e.preventDefault();
                            slider.setValueAt(i, slider.min());
                            return;
                        case 'End':
                            e.preventDefault();
                            slider.setValueAt(i, slider.max());
                            return;
                        default: return;
                    }
                    e.preventDefault();
                    slider.setValueAt(i, value + delta);
                }}
                onPointerdown={(e: PointerEvent) => {
                    if (disabled || e.button !== 0) return;
                    // The track's nearest-thumb pick must not run — a press ON
                    // a thumb drags THAT thumb, even with both stacked.
                    e.stopPropagation();
                    e.preventDefault();
                    press.onPointerdown(e);
                    el?.focus();
                    slider.beginDrag(i);
                }}
                onPointerup={press.onPointerup}
                onPointercancel={press.onPointercancel}
                onFocus={() => { focus.visible = isFocusVisible(el); }}
                onBlur={(e: FocusEvent) => {
                    press.onBlur(e);
                    focus.visible = false;
                }}
            >
                {slots.default?.()}
            </div>
        );
    };
}, { name: 'Slider.Thumb' });

export type SliderValueTextProps = WithClass & Define.Slot<'default', { value: number | number[]; values: number[] }>;

const SliderValueText = component<SliderValueTextProps>(({ props, slots }) => {
    const slider = useSliderContext();
    return () => {
        const value = slider.state.value;
        const values = slider.values();
        return (
            <output data-scope={SCOPE} data-part="value-text" for={slider.ids.control} class={props.class}>
                {slots.default?.({ value, values })
                    ?? (Array.isArray(value) ? values.join(' – ') : String(value))}
            </output>
        );
    };
}, { name: 'Slider.ValueText' });

export const Slider = compound(SliderRoot, {
    Root: SliderRoot,
    Label: SliderLabel,
    Control: SliderControl,
    Track: SliderTrack,
    Range: SliderRange,
    Thumb: SliderThumb,
    ValueText: SliderValueText,
});
