/**
 * Diff — a before/after comparison; the divider is an APG slider.
 *
 * ```tsx
 * <Diff.Root defaultValue={50}>
 *     <Diff.Before><img src="original.png" alt="Original" /></Diff.Before>
 *     <Diff.After><img src="edited.png" alt="Edited" /></Diff.After>
 *     <Diff.Handle label="Comparison" />
 * </Diff.Root>
 * ```
 *
 * The model is the reveal percent (0–100). Zero owns the mechanism —
 * `--diff-percent` on the root, the handle's logical position, keyboard
 * and captured pointer drag — and paints nothing; recipes own the clip
 * and every colour. Size pane content to the ROOT (`inline-size: 100%`
 * of the root's width), because the `after` pane clips by width and
 * content sized to the clipped box would squish instead of revealing.
 *
 * The handle speaks its value as `getValueText(value)` (default `"50%"`),
 * steps by `step` on the arrows and `largeStep` on PageUp/PageDown and
 * Shift+Arrow. `disabled` on the root freezes it: `aria-disabled`, out of
 * the tab order, no drag, no keys.
 */
import { component, compound, defineInjectable, defineProvide } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState, createInertState, type ControllableState } from '../../behaviors/controllable.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { dataAttr } from '../../contract/data-attrs.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type { WithClass, WithDisabled, WithHtmlAttrs, WithVariantAxes } from '../../contract/props.js';
import { diffAnatomy } from './anatomy.js';

const SCOPE = diffAnatomy.scope;

interface DiffContext {
    state: ControllableState<number>;
    value(): number;
    set(value: number): void;
    disabled(): boolean;
    /** Map a pointer position to a percent through the root's box (RTL-aware). */
    rootToValue(e: { clientX: number }): number;
    /** Start dragging; window listeners follow the pointer out of the box. */
    beginDrag(): void;
    setRoot(el: HTMLElement | null): void;
    rootEl(): HTMLElement | null;
}

function makeInert(): DiffContext {
    return {
        state: createInertState<number>(50),
        value: () => 50,
        set: () => {},
        disabled: () => false,
        rootToValue: () => 0,
        beginDrag: () => {},
        setRoot: () => {},
        rootEl: () => null,
    };
}

export const useDiffContext = defineInjectable<DiffContext>(() => makeInert());

/** `:dir(rtl)` with the computed-style fallback — the shape Slider uses. */
function isRtl(el: HTMLElement | null): boolean {
    if (!el) return false;
    try {
        if (el.matches(':dir(rtl)')) return true;
    } catch {
        // :dir() unsupported — fall through to computed style.
    }
    return typeof getComputedStyle === 'function' && getComputedStyle(el).direction === 'rtl';
}

/**
 * Into 0–100, with a fractional `step`'s float drift (`50.1 + 0.2`) rounded
 * away. The pointer path rounds to whole percents itself.
 */
const clamp = (v: number): number => Math.min(100, Math.max(0, Number(v.toFixed(6))));

export type DiffRootProps =
    & Define.Model<number>
    & Define.Prop<'defaultValue', number, false>
    & Define.Event<'valueChange', number>
    /** Freeze the handle: `aria-disabled`, no tab stop, no drag, no keys. */
    & WithDisabled
    & WithVariantAxes<'diff'>
    & WithClass
    & WithHtmlAttrs
    & Define.Slot<'default'>;

const DiffRoot = component<DiffRootProps>(({ props, slots, emit, onUnmounted }) => {
    const state = createControllableState<number>(
        () => props.model,
        clamp(props.defaultValue ?? 50),
        (v) => emit('valueChange', v),
    );
    let root: HTMLElement | null = null;
    let detachDrag: (() => void) | null = null;
    onUnmounted(() => detachDrag?.());

    const ctx: DiffContext = {
        state,
        value: () => clamp(state.value),
        set(v) {
            const next = clamp(v);
            if (next !== state.value) state.value = next;
        },
        disabled: () => props.disabled ?? false,
        rootToValue(e) {
            const rect = root?.getBoundingClientRect();
            if (!rect || rect.width <= 0) return ctx.value();
            let ratio = (e.clientX - rect.left) / rect.width;
            if (isRtl(root)) ratio = 1 - ratio;
            return clamp(Math.round(ratio * 100));
        },
        beginDrag() {
            detachDrag?.();
            if (ctx.disabled()) return;
            const onMove = (e: PointerEvent): void => { ctx.set(ctx.rootToValue(e)); };
            const onEnd = (): void => { detachDrag?.(); };
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
        setRoot: (el) => { root = el; },
        rootEl: () => root,
    };
    defineProvide(useDiffContext, () => ctx);

    return () => (
        <div
            {...htmlAttrs(props)}
            data-scope={SCOPE}
            data-part="root"
            data-disabled={dataAttr(ctx.disabled())}
            style={{ position: 'relative', '--diff-percent': `${ctx.value()}%` }}
            {...variantAttrs(props)}
            class={props.class}
            ref={(node: HTMLElement | null) => ctx.setRoot(node)}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Diff.Root' });

export type DiffPaneProps = WithClass & WithHtmlAttrs & Define.Slot<'default'>;

/** The full image — content, not a control. */
const DiffBefore = component<DiffPaneProps>(({ props, slots }) => {
    return () => (
        <div {...htmlAttrs(props)} data-scope={SCOPE} data-part="before" class={props.class}>
            {slots.default?.()}
        </div>
    );
}, { name: 'Diff.Before' });

/** The revealed overlay — recipes clip it to `--diff-percent` logically. */
const DiffAfter = component<DiffPaneProps>(({ props, slots }) => {
    return () => (
        <div {...htmlAttrs(props)} data-scope={SCOPE} data-part="after" class={props.class}>
            {slots.default?.()}
        </div>
    );
}, { name: 'Diff.After' });

export type DiffHandleProps =
    /** Accessible name — the handle is a glyph; "Comparison" by default. */
    & Define.Prop<'label', string, false>
    /** `aria-valuetext` for a value (default `` `${value}%` ``). */
    & Define.Prop<'getValueText', (value: number) => string, false>
    /** Arrow-key delta in percent (default 1). */
    & Define.Prop<'step', number, false>
    /** PageUp/PageDown and Shift+Arrow delta in percent (default 10). */
    & Define.Prop<'largeStep', number, false>
    & WithClass
    /** Not `role`: the handle is the `slider`. */
    & Omit<WithHtmlAttrs, 'role'>
    & Define.Slot<'default'>;

const DiffHandle = component<DiffHandleProps>(({ props, slots, signal }) => {
    const diff = useDiffContext();
    let el: HTMLElement | null = null;
    const focus = signal({ visible: false });
    // A drag is a long press — Slider's shape: no pointerleave handler, no
    // one-shot, the window release ends it wherever it ends.
    const press = createPressFeedback({
        getElement: () => el,
        isDisabled: () => diff.disabled(),
        oneShot: false,
    });
    const positive = (v: number | undefined, fallback: number): number =>
        (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback);

    return () => {
        const value = diff.value();
        const attrs = htmlAttrs(props);
        const disabled = diff.disabled();
        return (
            <div
                {...attrs}
                data-scope={SCOPE}
                data-part="handle"
                data-disabled={dataAttr(disabled)}
                data-focus-visible={dataAttr(focus.visible)}
                role="slider"
                tabIndex={disabled ? undefined : 0}
                aria-label={props.label ?? attrs['aria-label'] ?? 'Comparison'}
                aria-orientation="horizontal"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={value}
                aria-valuetext={props.getValueText ? props.getValueText(value) : `${value}%`}
                aria-disabled={disabled ? 'true' : undefined}
                style={{ position: 'absolute', insetInlineStart: `${value}%` }}
                class={props.class}
                ref={(node: HTMLElement | null) => { el = node; }}
                onKeydown={(e: KeyboardEvent) => {
                    if (disabled) return;
                    const rtl = isRtl(el);
                    const large = positive(props.largeStep, 10);
                    const s = e.shiftKey ? large : positive(props.step, 1);
                    let delta: number | null = null;
                    switch (e.key) {
                        case 'ArrowRight': delta = rtl ? -s : s; break;
                        case 'ArrowLeft': delta = rtl ? s : -s; break;
                        case 'ArrowUp': delta = s; break;
                        case 'ArrowDown': delta = -s; break;
                        case 'PageUp': delta = large; break;
                        case 'PageDown': delta = -large; break;
                        case 'Home':
                            e.preventDefault();
                            diff.set(0);
                            return;
                        case 'End':
                            e.preventDefault();
                            diff.set(100);
                            return;
                        default: return;
                    }
                    e.preventDefault();
                    diff.set(value + delta);
                }}
                onPointerdown={(e: PointerEvent) => {
                    if (disabled || e.button !== 0) return;
                    e.preventDefault();
                    press.onPointerdown(e);
                    el?.focus();
                    diff.beginDrag();
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
}, { name: 'Diff.Handle' });

export const Diff = compound(DiffRoot, {
    Root: DiffRoot,
    Before: DiffBefore,
    After: DiffAfter,
    Handle: DiffHandle,
});
