/**
 * RatingGroup — radio semantics over a row of symbols (stars, hearts, …),
 * with hover preview and optional half values.
 *
 * ```tsx
 * <RatingGroup.Root model={() => state.stars} allowHalf>
 *     <RatingGroup.Label>Rating</RatingGroup.Label>
 *     <RatingGroup.Control>
 *         {[1, 2, 3, 4, 5].map((i) => <RatingGroup.Item index={i} key={i} />)}
 *     </RatingGroup.Control>
 * </RatingGroup.Root>
 * ```
 *
 * The model is a plain number (0 = no rating). Items are explicit children
 * (zero owns no iteration — the Combobox philosophy); each renders
 * `data-state="full|half|empty"` from the DISPLAYED value — the hover
 * preview while the pointer is over the control, the committed value
 * otherwise — so recipes style fills without distinguishing preview from
 * commit. Symbols are the consumer's: the default slot receives
 * `{ state, highlighted }` for SVG swapping. Without a slot each item renders
 * a bare text `★`/`★`/`☆` — see `defaultSymbol` for why `half` is a full star
 * and why the default must not become an element.
 *
 * Keyboard moves the VALUE, not focus-among-elements — with `allowHalf`
 * two values share one element, so element roving cannot express the step.
 * One tab stop (the item for ceil(value), or item 1); arrows step by 0.5
 * or 1, Home is the smallest non-zero value, End is `count` (APG rating).
 */
import { component, compound, defineInjectable, defineProvide } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState, createInertState, type ControllableState } from '../../behaviors/controllable.js';
import { createFormControl } from '../../behaviors/form-control.js';
import { onFormReset } from '../../behaviors/form-reset.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { dataAttr } from '../../contract/data-attrs.js';
import { variantAttrs } from '../../contract/props.js';
import type { WithClass, WithFormControl, WithReadonly, WithVariantAxes } from '../../contract/props.js';
import { ratingGroupAnatomy } from './anatomy.js';

const SCOPE = ratingGroupAnatomy.scope;

export interface RatingItemSlotProps {
    state: 'full' | 'half' | 'empty';
    highlighted: boolean;
}

interface RatingGroupContext {
    state: ControllableState<number>;
    hover: { current: number | null };
    focus: { visible: boolean };
    count(): number;
    step(): number;
    displayed(): number;
    disabled(): boolean;
    invalid(): boolean;
    required(): boolean;
    readonly(): boolean;
    labelId(): string | undefined;
    controlId(): string;
    describedBy(): string | undefined;
    /** The item's accessible name — the `itemLabel` prop or the "N of M" default. */
    itemLabel(index: number): string;
    isRtl(): boolean;
    setControl(el: HTMLElement | null): void;
    registerItem(index: number, el: HTMLElement | null): void;
    commit(value: number): void;
    keydown(e: KeyboardEvent): void;
}

function makeInert(): RatingGroupContext {
    return {
        state: createInertState<number>(0),
        hover: { current: null },
        focus: { visible: false },
        count: () => 5,
        step: () => 1,
        displayed: () => 0,
        disabled: () => false,
        invalid: () => false,
        required: () => false,
        readonly: () => false,
        labelId: () => undefined,
        controlId: () => 'zx-rating-inert',
        describedBy: () => undefined,
        itemLabel: (index) => `${index} of 5`,
        isRtl: () => false,
        setControl: () => {},
        registerItem: () => {},
        commit: () => {},
        keydown: () => {},
    };
}

export const useRatingGroupContext = defineInjectable<RatingGroupContext>(() => makeInert());

// ── Root ──

export type RatingGroupRootProps =
    & Define.Model<number>
    & Define.Prop<'defaultValue', number, false>
    & Define.Event<'valueChange', number>
    /** How many items the consumer renders (default 5) — End jumps here. */
    & Define.Prop<'count', number, false>
    /** Half-value granularity: pointer halves and 0.5 keyboard steps. */
    & Define.Prop<'allowHalf', boolean, false>
    /** Clicking the current value clears to 0 (default false). */
    & Define.Prop<'deselectable', boolean, false>
    & WithFormControl
    & WithReadonly
    /** Per-item accessible name (default `${index} of ${count}`) — the localization seam. */
    & Define.Prop<'itemLabel', (index: number, count: number) => string, false>
    & WithVariantAxes<'rating-group'>
    & WithClass
    & Define.Slot<'default'>;

const RatingGroupRoot = component<RatingGroupRootProps>(({ props, slots, emit, signal, onMounted, onUnmounted }) => {
    const state = createControllableState<number>(
        () => props.model,
        props.defaultValue ?? 0,
        (v) => emit('valueChange', v),
    );
    const fc = createFormControl({ props: () => props, idBase: 'zx-rating' });
    const hover = signal({ current: null as number | null });
    const focus = signal({ visible: false });
    let controlEl: HTMLElement | null = null;
    let hiddenEl: HTMLInputElement | null = null;
    const items = new Map<number, HTMLElement>();

    let detachReset = (): void => {};
    onMounted(() => {
        detachReset = onFormReset(() => hiddenEl, () => {
            state.value = props.defaultValue ?? 0;
            if (hiddenEl) hiddenEl.value = state.value === 0 ? '' : String(state.value);
        });
    });
    onUnmounted(() => detachReset());

    const disabled = fc.disabled;
    const readonly = fc.readonly;
    const count = (): number => props.count ?? 5;
    const step = (): number => (props.allowHalf ? 0.5 : 1);

    const isRtl = (): boolean => {
        const el = controlEl;
        if (!el) return false;
        try {
            if (el.matches(':dir(rtl)')) return true;
        } catch {
            // :dir() unsupported — fall through to computed style.
        }
        return typeof getComputedStyle === 'function' && getComputedStyle(el).direction === 'rtl';
    };

    const clampValue = (v: number): number => Math.min(Math.max(v, 0), count());

    const focusTabbable = (): void => {
        const index = Math.max(1, Math.ceil(state.value));
        items.get(index)?.focus();
    };

    const commit = (value: number): void => {
        if (disabled() || readonly()) return;
        const next = clampValue(value);
        state.value = props.deselectable && next === state.value ? 0 : next;
        // The tab stop follows the value; a click may have focused an item
        // that just went tabIndex=-1 (deselect clears to item 1) — park
        // focus on the stop so Tab order stays coherent.
        focusTabbable();
    };

    const ctx: RatingGroupContext = {
        state,
        hover,
        focus,
        count,
        step,
        displayed: () => hover.current ?? state.value,
        disabled,
        invalid: fc.invalid,
        required: fc.required,
        readonly,
        labelId: fc.labelId,
        controlId: fc.controlId,
        describedBy: fc.describedBy,
        itemLabel: (index) => (props.itemLabel ?? ((i, c) => `${i} of ${c}`))(index, count()),
        isRtl,
        setControl: (el) => { controlEl = el; },
        registerItem: (index, el) => {
            if (el) items.set(index, el);
            else items.delete(index);
        },
        commit,
        keydown(e) {
            if (disabled() || readonly()) return;
            // A lingering hover preview would mask the keyboard commit —
            // displayed() prefers the preview.
            hover.current = null;
            const rtl = isRtl();
            let next: number | null = null;
            switch (e.key) {
                case 'ArrowRight':
                    next = state.value + (rtl ? -step() : step());
                    break;
                case 'ArrowLeft':
                    next = state.value + (rtl ? step() : -step());
                    break;
                case 'ArrowUp':
                    next = state.value + step();
                    break;
                case 'ArrowDown':
                    next = state.value - step();
                    break;
                case 'Home':
                    next = step();
                    break;
                case 'End':
                    next = count();
                    break;
                default:
                    return;
            }
            e.preventDefault();
            state.value = clampValue(next);
            // The tab stop follows the value; keep focus on it.
            focusTabbable();
        },
    };
    defineProvide(useRatingGroupContext, () => ctx);

    return () => (
        <div
            data-scope={SCOPE}
            data-part="root"
            data-disabled={dataAttr(disabled())}
            data-invalid={dataAttr(ctx.invalid())}
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
                        value={state.value === 0 ? '' : String(state.value)}
                        ref={(node: HTMLInputElement | null) => { hiddenEl = node; }}
                    />
                )
                : null}
        </div>
    );
}, { name: 'RatingGroup.Root' });

// ── Label ──

export type RatingGroupLabelProps = WithClass & Define.Slot<'default'>;

const RatingGroupLabel = component<RatingGroupLabelProps>(({ props, slots }) => {
    const ctx = useRatingGroupContext();
    return () => (
        <div
            id={ctx.labelId()}
            data-scope={SCOPE}
            data-part="label"
            data-disabled={dataAttr(ctx.disabled())}
            data-invalid={dataAttr(ctx.invalid())}
            data-required={dataAttr(ctx.required())}
            class={props.class}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'RatingGroup.Label' });

// ── Control ──

export type RatingGroupControlProps = WithClass & Define.Slot<'default'>;

const RatingGroupControl = component<RatingGroupControlProps>(({ props, slots }) => {
    const ctx = useRatingGroupContext();
    return () => (
        <div
            id={ctx.controlId()}
            role="radiogroup"
            data-scope={SCOPE}
            data-part="control"
            data-disabled={dataAttr(ctx.disabled())}
            data-readonly={dataAttr(ctx.readonly())}
            data-focus-visible={dataAttr(ctx.focus.visible)}
            aria-labelledby={ctx.labelId()}
            aria-describedby={ctx.describedBy()}
            class={props.class}
            ref={(node: HTMLElement | null) => ctx.setControl(node)}
            onPointerleave={() => { ctx.hover.current = null; }}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'RatingGroup.Control' });

// ── Item ──

/**
 * The default symbol, used when the consumer supplies no slot content.
 *
 * `half` renders a FULL star on purpose. The obvious codepoint — `⯪`
 * (U+2BEA STAR WITH LEFT HALF BLACK) — has essentially no coverage in the
 * macOS/Chromium sans stacks and resolves to the last-resort tofu box, so it
 * stated the value less accurately than a star does (#222). Drawing a *distinct*
 * half is the design system's job, and every skin already does it: some draw
 * their own geometry, and `@sigx/zero-daisyui` / `@sigx/zero-material` halve
 * THIS glyph (a `mask-size: 50% 100%` and a hard-stop gradient under
 * `background-clip: text`) — both of which need a full-width star in all three
 * states to cut in two. Nothing is lost to assistive tech either way: the value
 * lives on the hidden input, and each item carries its own aria-label.
 *
 * It must stay a bare TEXT node. A consumer symbol arrives as an ELEMENT, and
 * design systems gate their drawn geometry on exactly that difference —
 * `:not(:has(> *))` in `@sigx/zero-basic`, the inverse `:has(*)` in
 * `@sigx/zero-heroui`. Wrapping the default in an element would silently
 * disable their stars.
 */
const defaultSymbol = (state: RatingItemSlotProps['state']): string =>
    (state === 'empty' ? '☆' : '★');

export type RatingGroupItemProps =
    & Define.Prop<'index', number, true>
    & WithClass
    & Define.Slot<'default', RatingItemSlotProps>;

const RatingGroupItem = component<RatingGroupItemProps>(({ props, slots, onUnmounted, signal }) => {
    const ctx = useRatingGroupContext();
    let el: HTMLElement | null = null;
    const focus = signal({ visible: false });
    onUnmounted(() => ctx.registerItem(props.index, null));

    const itemState = (): 'full' | 'half' | 'empty' => {
        const displayed = ctx.displayed();
        if (displayed >= props.index) return 'full';
        if (displayed >= props.index - 0.5) return 'half';
        return 'empty';
    };

    const isHighlighted = (): boolean =>
        ctx.hover.current !== null && props.index <= Math.ceil(ctx.hover.current);

    const isTabbable = (): boolean => {
        if (ctx.disabled()) return false;
        return props.index === Math.max(1, Math.ceil(ctx.state.value));
    };

    /** index or index − 0.5 from the pointer x, RTL-flipped. */
    const valueAt = (e: PointerEvent | MouseEvent): number => {
        if (!ctx.step() || ctx.step() === 1 || !el) return props.index;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0) return props.index;
        const inStart = (e.clientX - rect.left) / rect.width < 0.5;
        const startIsLow = !ctx.isRtl();
        return (inStart === startIsLow) ? props.index - 0.5 : props.index;
    };

    return () => {
        const state = itemState();
        const slotProps: RatingItemSlotProps = { state, highlighted: isHighlighted() };
        return (
            <span
                role="radio"
                data-scope={SCOPE}
                data-part="item"
                data-state={state}
                data-highlighted={dataAttr(isHighlighted())}
                data-disabled={dataAttr(ctx.disabled())}
                data-readonly={dataAttr(ctx.readonly())}
                data-focus-visible={dataAttr(focus.visible)}
                tabIndex={isTabbable() ? 0 : -1}
                aria-checked={ctx.state.value > 0 && Math.ceil(ctx.state.value) === props.index ? 'true' : 'false'}
                aria-label={ctx.itemLabel(props.index)}
                aria-disabled={ctx.disabled() ? 'true' : undefined}
                class={props.class}
                ref={(node: HTMLElement | null) => {
                    el = node;
                    ctx.registerItem(props.index, node);
                }}
                onPointermove={(e: PointerEvent) => {
                    if (ctx.disabled() || ctx.readonly()) return;
                    ctx.hover.current = valueAt(e);
                }}
                onClick={(e: MouseEvent) => {
                    if (ctx.disabled() || ctx.readonly()) return;
                    // Touch has no hover: the tap's own x decides the half.
                    ctx.commit(valueAt(e));
                    ctx.hover.current = null;
                }}
                onKeydown={(e: KeyboardEvent) => ctx.keydown(e)}
                onFocus={() => { focus.visible = isFocusVisible(el); ctx.focus.visible = focus.visible; }}
                onBlur={() => { focus.visible = false; ctx.focus.visible = false; }}
            >
                {slots.default
                    ? slots.default(slotProps)
                    : defaultSymbol(state)}
            </span>
        );
    };
}, { name: 'RatingGroup.Item' });

export const RatingGroup = compound(RatingGroupRoot, {
    Root: RatingGroupRoot,
    Label: RatingGroupLabel,
    Control: RatingGroupControl,
    Item: RatingGroupItem,
});
