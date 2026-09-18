/**
 * Alert — a message that announces itself, and can be dismissed.
 *
 * ```tsx
 * <Alert.Root model={() => state.showQuotaWarning} color="warning">
 *     <Alert.Icon>⚠</Alert.Icon>
 *     <Alert.Title>Approaching your quota</Alert.Title>
 *     <Alert.Description>You have used 92% of this month's allowance.</Alert.Description>
 *     <Alert.Close aria-label="Dismiss" />
 * </Alert.Root>
 * ```
 *
 * The model is the alert's presence and defaults to open — an alert is
 * rendered because there is something to say, so the useful default is the
 * opposite of Dialog's. `Alert.Close` sets it false; the runtime then sets
 * `hidden` on the root, which is what `hiddenIn: ['closed']` in the anatomy
 * declares and what lets the design systems leave `closed` unpainted.
 *
 * Uncontrolled it still works: `defaultOpen` seeds an internal signal, so a
 * bare `<Alert.Root>` with a Close button dismisses itself.
 */
import { component, compound, defineInjectable, defineProvide } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState, createInertState, type ControllableState } from '../../behaviors/controllable.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { dataAttr, stateAttr } from '../../contract/data-attrs.js';
import { renderAsChild } from '../../contract/as-child.js';
import { variantAttrs } from '../../contract/props.js';
import type {
    PartProps,
    WithAsChild,
    WithClass,
    WithDisabled,
    WithVariantAxes,
} from '../../contract/props.js';
import { alertAnatomy } from './anatomy.js';

const SCOPE = alertAnatomy.scope;

interface AlertContext {
    state: ControllableState<boolean>;
}

function makeInert(): AlertContext {
    return {
        state: createInertState<boolean>(true),
    };
}

export const useAlertContext = defineInjectable<AlertContext>(() => makeInert());

// ── Root ──

export type AlertRootProps =
    & Define.Model<boolean>
    & Define.Prop<'defaultOpen', boolean, false>
    & Define.Event<'openChange', boolean>
    & WithVariantAxes<'alert'>
    & WithClass
    & Define.Slot<'default'>;

const AlertRoot = component<AlertRootProps>(({ props, slots, emit }) => {
    const state = createControllableState<boolean>(
        () => props.model,
        props.defaultOpen ?? true,
        (v) => emit('openChange', v),
    );
    defineProvide(useAlertContext, () => ({ state }));

    return () => (
        <div
            role="alert"
            data-scope={SCOPE}
            data-part="root"
            data-state={stateAttr(state.value, 'open', 'closed')}
            hidden={!state.value}
            {...variantAttrs(props)}
            class={props.class}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Alert.Root' });

// ── Icon ──

export type AlertIconProps = WithClass & Define.Slot<'default'>;

const AlertIcon = component<AlertIconProps>(({ props, slots }) => () => (
    // Decorative: the severity it paints is already carried by the text, and
    // a glyph that announced itself would say it twice.
    <span aria-hidden="true" data-scope={SCOPE} data-part="icon" class={props.class}>
        {slots.default?.()}
    </span>
), { name: 'Alert.Icon' });

// ── Title / Description ──

export type AlertTitleProps = WithClass & Define.Slot<'default'>;

const AlertTitle = component<AlertTitleProps>(({ props, slots }) => () => (
    <div data-scope={SCOPE} data-part="title" class={props.class}>
        {slots.default?.()}
    </div>
), { name: 'Alert.Title' });

export type AlertDescriptionProps = WithClass & Define.Slot<'default'>;

const AlertDescription = component<AlertDescriptionProps>(({ props, slots }) => () => (
    <div data-scope={SCOPE} data-part="description" class={props.class}>
        {slots.default?.()}
    </div>
), { name: 'Alert.Description' });

// ── Close ──

export type AlertCloseProps =
    & Define.Prop<'label', string, false>
    & WithDisabled
    & WithClass
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const AlertClose = component<AlertCloseProps>(({ props, slots, signal }) => {
    const ctx = useAlertContext();
    let el: HTMLElement | null = null;
    const focus = signal({ visible: false });
    const press = createPressFeedback({
        getElement: () => el,
        isDisabled: () => !!props.disabled,
    });

    const bag = (): PartProps => ({
        'data-scope': SCOPE,
        'data-part': 'close',
        'data-disabled': dataAttr(props.disabled),
        'data-focus-visible': dataAttr(focus.visible),
        // The button's own content is usually a glyph, so it needs a name of
        // its own; "Close" is the conventional one and `label` overrides it.
        'aria-label': props.label ?? 'Close',
        onClick: () => {
            if (!props.disabled) ctx.state.value = false;
        },
        onFocus: () => { focus.visible = isFocusVisible(el); },
        onBlur: (e: FocusEvent) => {
            press.onBlur(e);
            focus.visible = false;
        },
        onKeydown: press.onKeydown,
        onKeyup: press.onKeyup,
        onPointerdown: press.onPointerdown,
        onPointerup: press.onPointerup,
        onPointercancel: press.onPointercancel,
        onPointerleave: press.onPointerleave,
        ref: (node: HTMLElement | null) => { el = node; },
    });

    return () => {
        const b = bag();
        if (props.asChild) return renderAsChild(slots.default, b);
        return (
            <button type="button" class={props.class} {...b} disabled={props.disabled}>
                {slots.default?.(b)}
            </button>
        );
    };
}, { name: 'Alert.Close' });

export const Alert = compound(AlertRoot, {
    Root: AlertRoot,
    Icon: AlertIcon,
    Title: AlertTitle,
    Description: AlertDescription,
    Close: AlertClose,
});
