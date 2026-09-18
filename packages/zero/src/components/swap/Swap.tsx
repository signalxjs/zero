/**
 * Swap — a boolean with two faces.
 *
 * ```tsx
 * // Display: follows external state, no semantics of its own.
 * <Swap.Root model={() => state.dark}>
 *     <Swap.On>🌙</Swap.On>
 *     <Swap.Off>☀️</Swap.Off>
 * </Swap.Root>
 *
 * // Interactive: a real toggle button, faces as content.
 * <Swap.Root interactive label="Toggle theme" model={() => state.dark}>
 *     <Swap.On>🌙</Swap.On>
 *     <Swap.Off>☀️</Swap.Off>
 * </Swap.Root>
 * ```
 *
 * See `anatomy.ts` for the display-by-default and both-faces-rendered
 * decisions. Interactive mode is a native `<button aria-pressed>` — the
 * platform supplies Enter/Space activation.
 */
import { component, compound } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState, createInertState, type ControllableState } from '../../behaviors/controllable.js';
import { defineInjectable, defineProvide } from 'sigx';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { dataAttr, stateAttr } from '../../contract/data-attrs.js';
import { variantAttrs } from '../../contract/props.js';
import type { WithClass, WithDisabled, WithVariantAxes } from '../../contract/props.js';
import { swapAnatomy } from './anatomy.js';

const SCOPE = swapAnatomy.scope;

interface SwapContext {
    state: ControllableState<boolean>;
}

export const useSwapContext = defineInjectable<SwapContext>(() => ({
    state: createInertState<boolean>(false),
}));

export type SwapRootProps =
    /** Active shows the `on` face. The concept is daisy's own (`swap-active`); the faces keep `data-state on|off`. */
    & Define.Model<boolean>
    & Define.Prop<'defaultActive', boolean, false>
    & Define.Event<'activeChange', boolean>
    /**
     * Make the swap a control: renders a `<button aria-pressed>` that
     * toggles on click (the platform supplies Enter/Space). Off by
     * default — a display element must not claim button semantics.
     */
    & Define.Prop<'interactive', boolean, false>
    /** Accessible name for the interactive form — the faces are usually glyphs. */
    & Define.Prop<'label', string, false>
    & WithDisabled
    & WithVariantAxes<'swap'>
    & WithClass
    & Define.Slot<'default'>;

const SwapRoot = component<SwapRootProps>(({ props, slots, emit, signal }) => {
    const state = createControllableState<boolean>(
        () => props.model,
        props.defaultActive ?? false,
        (v) => emit('activeChange', v),
    );
    defineProvide(useSwapContext, () => ({ state }));
    let el: HTMLElement | null = null;
    const focus = signal({ visible: false });
    const press = createPressFeedback({
        getElement: () => el,
        isDisabled: () => !props.interactive || !!props.disabled,
    });

    return () => {
        const swapState = stateAttr(state.value, 'on', 'off');
        if (!props.interactive) {
            return (
                <span
                    data-scope={SCOPE}
                    data-part="root"
                    data-state={swapState}
                    // A display swap cannot be operated, but `disabled` is
                    // still a styling fact — the faces fade like the button
                    // form's would.
                    data-disabled={dataAttr(props.disabled)}
                    {...variantAttrs(props)}
                    class={props.class}
                >
                    {slots.default?.()}
                </span>
            );
        }
        return (
            <button
                type="button"
                data-scope={SCOPE}
                data-part="root"
                data-state={swapState}
                data-disabled={dataAttr(props.disabled)}
                data-focus-visible={dataAttr(focus.visible)}
                disabled={props.disabled}
                aria-pressed={state.value ? 'true' : 'false'}
                aria-label={props.label}
                {...variantAttrs(props)}
                class={props.class}
                ref={(node: HTMLElement | null) => { el = node; }}
                onClick={() => {
                    if (!props.disabled) state.value = !state.value;
                }}
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
                {slots.default?.()}
            </button>
        );
    };
}, { name: 'Swap.Root' });

export type SwapFaceProps = WithClass & Define.Slot<'default'>;

const face = (partName: 'on' | 'off', name: string) =>
    component<SwapFaceProps>(({ props, slots }) => {
        const swap = useSwapContext();
        return () => {
            const on = swap.state.value;
            const isActive = partName === 'on' ? on : !on;
            return (
                <span
                    data-scope={SCOPE}
                    data-part={partName}
                    data-state={stateAttr(on, 'on', 'off')}
                    // Painted for the cross-fade, absent for AT when inactive.
                    aria-hidden={isActive ? undefined : 'true'}
                    class={props.class}
                >
                    {slots.default?.()}
                </span>
            );
        };
    }, { name });

const SwapOn = face('on', 'Swap.On');
const SwapOff = face('off', 'Swap.Off');

export const Swap = compound(SwapRoot, {
    Root: SwapRoot,
    On: SwapOn,
    Off: SwapOff,
});
