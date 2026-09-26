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
 *
 * The root is named by its Title (`aria-labelledby`) and described by its
 * Description (`aria-describedby`), each referenced only while rendered.
 * `live` picks the politeness: `assertive` (default, `role="alert"`)
 * interrupts, `polite` (`role="status"`) waits its turn — the right one for
 * an alert that confirms rather than warns. Closing an alert that holds
 * focus (its Close button, usually) would drop focus on `<body>`; instead it
 * goes to `finalFocus()`, else the nearest focusable element before the
 * alert among its siblings, else it is left alone (#274).
 */
import { component, compound, defineInjectable, defineProvide, watch } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState, createInertState, type ControllableState } from '../../behaviors/controllable.js';
import { createId } from '../../behaviors/create-id.js';
import { getTabbables, isFocusable } from '../../behaviors/focus.js';
import { countPresence, reportPresence, settleAfterMount } from '../../behaviors/part-presence.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { dataAttr, stateAttr } from '../../contract/data-attrs.js';
import { renderAsChild } from '../../contract/as-child.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type {
    PartProps,
    WithAsChild,
    WithClass,
    WithDisabled,
    WithHtmlAttrs,
    WithVariantAxes,
} from '../../contract/props.js';
import { alertAnatomy } from './anatomy.js';

const SCOPE = alertAnatomy.scope;

interface AlertContext {
    state: ControllableState<boolean>;
    ids: { title: string; description: string };
    /** Title and Description report their presence so the root's references never dangle. */
    setTitlePresent(present: boolean): void;
    setDescriptionPresent(present: boolean): void;
}

function makeInert(): AlertContext {
    return {
        state: createInertState<boolean>(true),
        ids: { title: 'zx-alert-inert-title', description: 'zx-alert-inert-description' },
        setTitlePresent: () => {},
        setDescriptionPresent: () => {},
    };
}

/**
 * Where focus goes when a closing alert held it: the last tabbable element
 * before `root` among its siblings (a sibling itself, or the last tabbable
 * inside one). Null when there is none — the caller then leaves focus alone.
 */
function previousFocusable(root: HTMLElement): HTMLElement | null {
    for (let el = root.previousElementSibling; el; el = el.previousElementSibling) {
        if (!(el instanceof HTMLElement)) continue;
        const inside = getTabbables(el);
        if (inside.length) return inside[inside.length - 1];
        // A sibling that is itself a Tab stop: focusable and not opted out
        // with a negative tabindex (a `tabindex="-1"` target is reachable by
        // script only, so parking focus there strands a keyboard user).
        if (isFocusable(el) && !(Number(el.getAttribute('tabindex') ?? 0) < 0)) return el;
    }
    return null;
}

export const useAlertContext = defineInjectable<AlertContext>(() => makeInert());

// ── Root ──

export type AlertRootProps =
    & Define.Model<boolean>
    & Define.Prop<'defaultOpen', boolean, false>
    & Define.Event<'openChange', boolean>
    /**
     * Politeness: `assertive` (default) renders `role="alert"` and
     * interrupts; `polite` renders `role="status"` and waits.
     */
    & Define.Prop<'live', 'assertive' | 'polite', false>
    /**
     * Where focus goes when the alert closes while holding it. Falls back to
     * the nearest focusable element before the alert, then to leaving focus
     * where it is.
     */
    & Define.Prop<'finalFocus', () => HTMLElement | null | undefined, false>
    & WithVariantAxes<'alert'>
    & WithClass
    /**
     * Not `role`: the root is the live region (`live`). An app
     * `aria-labelledby` / `aria-describedby` joins the Title's / the
     * Description's rather than replacing it.
     */
    & Omit<WithHtmlAttrs, 'role'>
    & Define.Slot<'default'>;

const AlertRoot = component<AlertRootProps>(({ props, slots, emit, signal, onMounted }) => {
    const state = createControllableState<boolean>(
        () => props.model,
        props.defaultOpen ?? true,
        (v) => emit('openChange', v),
    );
    const baseId = createId('zx-alert');
    // Reported by Title/Description (`reportPresence`): optimistic until
    // settled after mount, so server markup keeps the references.
    const present = signal({ title: 0, description: 0, settled: false });
    settleAfterMount(onMounted, () => { present.settled = true; });
    const ctx: AlertContext = {
        state,
        ids: { title: `${baseId}-title`, description: `${baseId}-description` },
        setTitlePresent: (p) => { present.title = countPresence(present.title, p); },
        setDescriptionPresent: (p) => { present.description = countPresence(present.description, p); },
    };
    defineProvide(useAlertContext, () => ctx);

    let el: HTMLElement | null = null;
    if (typeof document !== 'undefined') {
        // Hiding the root would strand focus that sits inside it (the Close
        // button that just closed it) on <body>. Checked as the model flips —
        // before the browser's focus fixup — so "inside" is still readable.
        watch(
            () => state.value,
            (open, wasOpen) => {
                if (open || !wasOpen || !el) return;
                if (!el.contains(document.activeElement)) return;
                const requested = props.finalFocus?.() ?? null;
                const target = isFocusable(requested) ? requested : previousFocusable(el);
                target?.focus();
            },
        );
    }

    return () => {
        const attrs = htmlAttrs(props);
        const refs = (own: string | undefined, app: unknown) =>
            [own, app].filter(Boolean).join(' ') || undefined;
        return (
            <div
                {...attrs}
                role={props.live === 'polite' ? 'status' : 'alert'}
                aria-labelledby={refs(
                    !present.settled || present.title > 0 ? ctx.ids.title : undefined,
                    attrs['aria-labelledby'],
                )}
                aria-describedby={refs(
                    !present.settled || present.description > 0 ? ctx.ids.description : undefined,
                    attrs['aria-describedby'],
                )}
                data-scope={SCOPE}
                data-part="root"
                data-state={stateAttr(state.value, 'open', 'closed')}
                hidden={!state.value}
                {...variantAttrs(props)}
                class={props.class}
                ref={(node: HTMLElement | null) => { el = node; }}
            >
                {slots.default?.()}
            </div>
        );
    };
}, { name: 'Alert.Root' });

// ── Icon ──

export type AlertIconProps = WithClass & WithHtmlAttrs & Define.Slot<'default'>;

const AlertIcon = component<AlertIconProps>(({ props, slots }) => () => (
    // Decorative: the severity it paints is already carried by the text, and
    // a glyph that announced itself would say it twice.
    <span {...htmlAttrs(props)} aria-hidden="true" data-scope={SCOPE} data-part="icon" class={props.class}>
        {slots.default?.()}
    </span>
), { name: 'Alert.Icon' });

// ── Title / Description ──

/** Not `id`: the root is labelled by the Title's own. */
export type AlertTitleProps = WithClass & Omit<WithHtmlAttrs, 'id'> & Define.Slot<'default'>;

const AlertTitle = component<AlertTitleProps>(({ props, slots, onUnmounted }) => {
    const alert = useAlertContext();
    reportPresence(alert.setTitlePresent, onUnmounted);
    return () => (
        <div {...htmlAttrs(props)} id={alert.ids.title} data-scope={SCOPE} data-part="title" class={props.class}>
            {slots.default?.()}
        </div>
    );
}, { name: 'Alert.Title' });

/** Not `id`: the root is described by the Description's own. */
export type AlertDescriptionProps = WithClass & Omit<WithHtmlAttrs, 'id'> & Define.Slot<'default'>;

const AlertDescription = component<AlertDescriptionProps>(({ props, slots, onUnmounted }) => {
    const alert = useAlertContext();
    reportPresence(alert.setDescriptionPresent, onUnmounted);
    return () => (
        <div
            {...htmlAttrs(props)}
            id={alert.ids.description}
            data-scope={SCOPE}
            data-part="description"
            class={props.class}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Alert.Description' });

// ── Close ──

export type AlertCloseProps =
    & Define.Prop<'label', string, false>
    & WithDisabled
    & WithClass
    & WithHtmlAttrs
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

    const bag = (): PartProps => {
        const attrs = htmlAttrs(props);
        return {
            ...attrs,
            'data-scope': SCOPE,
            'data-part': 'close',
            'data-disabled': dataAttr(props.disabled),
            'data-focus-visible': dataAttr(focus.visible),
            // The button's own content is usually a glyph, so it needs a name of
            // its own; "Close" is the conventional one, and `label` (or an app
            // `aria-label`) overrides it.
            'aria-label': props.label ?? attrs['aria-label'] ?? 'Close',
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
        };
    };

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
