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
 */
import { component, compound, defineInjectable, defineProvide } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState, createInertState, type ControllableState } from '../../behaviors/controllable.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { dataAttr } from '../../contract/data-attrs.js';
import { variantAttrs } from '../../contract/props.js';
import type { WithClass, WithVariantAxes } from '../../contract/props.js';
import { diffAnatomy } from './anatomy.js';

const SCOPE = diffAnatomy.scope;

interface DiffContext {
    state: ControllableState<number>;
    value(): number;
    set(value: number): void;
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

const clamp = (v: number): number => Math.min(100, Math.max(0, Math.round(v)));

export type DiffRootProps =
    & Define.Model<number>
    & Define.Prop<'defaultValue', number, false>
    & Define.Event<'valueChange', number>
    & WithVariantAxes<'diff'>
    & WithClass
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
        rootToValue(e) {
            const rect = root?.getBoundingClientRect();
            if (!rect || rect.width <= 0) return ctx.value();
            let ratio = (e.clientX - rect.left) / rect.width;
            if (isRtl(root)) ratio = 1 - ratio;
            return clamp(ratio * 100);
        },
        beginDrag() {
            detachDrag?.();
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
            data-scope={SCOPE}
            data-part="root"
            style={{ position: 'relative', '--diff-percent': `${ctx.value()}%` }}
            {...variantAttrs(props)}
            class={props.class}
            ref={(node: HTMLElement | null) => ctx.setRoot(node)}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Diff.Root' });

export type DiffPaneProps = WithClass & Define.Slot<'default'>;

/** The full image — content, not a control. */
const DiffBefore = component<DiffPaneProps>(({ props, slots }) => {
    return () => (
        <div data-scope={SCOPE} data-part="before" class={props.class}>
            {slots.default?.()}
        </div>
    );
}, { name: 'Diff.Before' });

/** The revealed overlay — recipes clip it to `--diff-percent` logically. */
const DiffAfter = component<DiffPaneProps>(({ props, slots }) => {
    return () => (
        <div data-scope={SCOPE} data-part="after" class={props.class}>
            {slots.default?.()}
        </div>
    );
}, { name: 'Diff.After' });

export type DiffHandleProps =
    /** Accessible name — the handle is a glyph; "Comparison" by default. */
    & Define.Prop<'label', string, false>
    & WithClass
    & Define.Slot<'default'>;

const DiffHandle = component<DiffHandleProps>(({ props, slots, signal }) => {
    const diff = useDiffContext();
    let el: HTMLElement | null = null;
    const focus = signal({ visible: false });
    // A drag is a long press — Slider's shape: no pointerleave handler, no
    // one-shot, the window release ends it wherever it ends.
    const press = createPressFeedback({
        getElement: () => el,
        isDisabled: () => false,
        oneShot: false,
    });

    return () => {
        const value = diff.value();
        return (
            <div
                data-scope={SCOPE}
                data-part="handle"
                data-focus-visible={dataAttr(focus.visible)}
                role="slider"
                tabIndex={0}
                aria-label={props.label ?? 'Comparison'}
                aria-orientation="horizontal"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={value}
                style={{ position: 'absolute', insetInlineStart: `${value}%` }}
                class={props.class}
                ref={(node: HTMLElement | null) => { el = node; }}
                onKeydown={(e: KeyboardEvent) => {
                    const rtl = isRtl(el);
                    let delta: number | null = null;
                    switch (e.key) {
                        case 'ArrowRight': delta = rtl ? -1 : 1; break;
                        case 'ArrowLeft': delta = rtl ? 1 : -1; break;
                        case 'ArrowUp': delta = 1; break;
                        case 'ArrowDown': delta = -1; break;
                        case 'PageUp': delta = 10; break;
                        case 'PageDown': delta = -10; break;
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
                    if (e.button !== 0) return;
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
