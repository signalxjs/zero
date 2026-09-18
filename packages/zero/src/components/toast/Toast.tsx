/**
 * Toast — transient notifications from an imperative queue.
 *
 * ```tsx
 * <Toast.Viewport placement="bottom-end" />   // once, near the app root
 * toast({ title: 'Saved', color: 'success' }) // from anywhere, browser-only
 * ```
 *
 * Or compose per toast:
 * ```tsx
 * <Toast.Viewport>
 *     {(t) => (
 *         <Toast.Root toast={t} key={t.id}>
 *             <Toast.Title>{t.title}</Toast.Title>
 *             <Toast.Close>Dismiss</Toast.Close>
 *         </Toast.Root>
 *     )}
 * </Toast.Viewport>
 * ```
 *
 * Presence is runtime-managed — the one deliberate exception to zero's
 * "presence is declarative CSS" rule, because toasts must eventually
 * UNMOUNT (popups never do). A toast enters `closed` and flips to `open` a
 * frame later; `dismiss()` flips it back and the root stays mounted until
 * its longest transition/animation finishes (instantly when there is none,
 * reduced motion included). Recipes therefore style the plain two-state
 * transition and must NOT use `@starting-style`/`allow-discrete` here.
 *
 * The viewport is a `popover="manual"` top layer: no z-index, no portal, no
 * light dismiss, and it stays out of the way when empty. Placement is data
 * (`data-placement` on viewport and root); stacking is data too —
 * `--toast-index` / `--toast-count` on each root.
 */
import { component, compound, defineInjectable, defineProvide, effect } from 'sigx';
import type { Define } from 'sigx';
import { createId } from '../../behaviors/create-id.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { dataAttr, stateAttr } from '../../contract/data-attrs.js';
import { renderAsChild } from '../../contract/as-child.js';
import { variantAttrs } from '../../contract/props.js';
import type { PartProps, WithAsChild, WithClass, WithDisabled, WithVariantAxes } from '../../contract/props.js';
import { toastAnatomy } from './anatomy.js';
import { createToaster, useToaster, type Toaster, type ToastData } from './toaster.js';

const SCOPE = toastAnatomy.scope;

export type ToastPlacement =
    | 'top-start' | 'top' | 'top-end'
    | 'bottom-start' | 'bottom' | 'bottom-end';

interface ToastViewportContext {
    toaster(): Toaster;
    placement(): ToastPlacement;
}

function makeInertViewport(): ToastViewportContext {
    let inert: Toaster | null = null;
    return {
        toaster: () => (inert ??= createToaster()),
        placement: () => 'bottom-end',
    };
}

interface ToastItemContext {
    toast(): ToastData;
    ids: { title: string; description: string };
    dismiss(): void;
    /** Title/Description report their presence so the root's ARIA refs never dangle. */
    setTitlePresent(present: boolean): void;
    setDescriptionPresent(present: boolean): void;
}

function makeInertItem(): ToastItemContext {
    return {
        toast: () => ({ id: 'zx-toast-inert', open: false, role: 'status', duration: Infinity }),
        ids: { title: 'zx-toast-inert-title', description: 'zx-toast-inert-desc' },
        dismiss: () => {},
        setTitlePresent: () => {},
        setDescriptionPresent: () => {},
    };
}

export const useToastViewportContext = defineInjectable<ToastViewportContext>(() => makeInertViewport());
export const useToastItemContext = defineInjectable<ToastItemContext>(() => makeInertItem());

/** Longest computed transition/animation on the element, in ms. */
function longestAnimationMs(el: Element): number {
    if (typeof getComputedStyle !== 'function') return 0;
    const style = getComputedStyle(el);
    const times = (value: string): number[] =>
        value.split(',').map((raw) => {
            const s = raw.trim();
            if (s.endsWith('ms')) return parseFloat(s) || 0;
            if (s.endsWith('s')) return (parseFloat(s) || 0) * 1000;
            return 0;
        });
    const longest = (durations: string, delays: string): number => {
        const d = times(durations || '0s');
        const dl = times(delays || '0s');
        return Math.max(0, ...d.map((v, i) => v + (dl[i % dl.length] ?? 0)));
    };
    return Math.max(
        longest(style.transitionDuration, style.transitionDelay),
        longest(style.animationDuration, style.animationDelay),
    );
}

/**
 * Sigx passes function children through uncalled (the same reason
 * `renderAsChild` exists): the slot accessor yields the raw function child,
 * which must then be called with the scoped toast.
 */
function renderToastSlot(slot: (data: ToastData) => unknown, data: ToastData): unknown {
    const out = slot(data);
    if (out == null) return null;
    const items = Array.isArray(out) ? out : [out];
    const rendered = items.map((item) => (typeof item === 'function' ? (item as (d: ToastData) => unknown)(data) : item));
    return rendered.length === 1 ? rendered[0] : rendered;
}

// ── Viewport ──

export type ToastViewportProps =
    & Define.Prop<'placement', ToastPlacement, false>
    & Define.Prop<'label', string, false>
    & Define.Prop<'toaster', Toaster, false>
    & WithClass
    & Define.Slot<'default', ToastData>;

const ToastViewport = component<ToastViewportProps>(({ props, slots, onMounted }) => {
    const injected = useToaster();
    const manager = (): Toaster => props.toaster ?? injected;
    const placement = (): ToastPlacement => props.placement ?? 'bottom-end';

    const ctx: ToastViewportContext = { toaster: manager, placement };
    defineProvide(useToastViewportContext, () => ctx);

    let el: HTMLElement | null = null;

    onMounted(() => {
        effect(() => {
            const showing = manager().count() > 0;
            const node = el as (HTMLElement & { showPopover?(): void; hidePopover?(): void; matches(s: string): boolean }) | null;
            if (!node || typeof node.showPopover !== 'function') return;
            const isShowing = node.matches(':popover-open');
            if (showing && !isShowing) node.showPopover();
            else if (!showing && isShowing) node.hidePopover!();
        });
    });

    return () => (
        <ol
            data-scope={SCOPE}
            data-part="viewport"
            data-placement={placement()}
            popover="manual"
            role="region"
            aria-label={props.label ?? 'Notifications'}
            tabIndex={-1}
            class={props.class}
            ref={(node: HTMLElement | null) => { el = node; }}
            onPointerenter={() => manager().pause()}
            onPointerleave={() => manager().resume()}
            onFocusin={() => manager().pause()}
            onFocusout={(e: FocusEvent) => {
                if (!el?.contains(e.relatedTarget as Node | null)) manager().resume();
            }}
        >
            {manager().toasts().map((t) =>
                slots.default
                    ? renderToastSlot(slots.default, t)
                    : (
                        <ToastRoot toast={t} key={t.id}>
                            {t.title ? <ToastTitle>{t.title}</ToastTitle> : null}
                            {t.description ? <ToastDescription>{t.description}</ToastDescription> : null}
                            {t.action ? <ToastAction onClick={() => t.action?.onClick?.()}>{t.action.label}</ToastAction> : null}
                            <ToastClose>✕</ToastClose>
                        </ToastRoot>
                    ))}
        </ol>
    );
}, { name: 'Toast.Viewport' });

// ── Root ──

export type ToastRootProps =
    & Define.Prop<'toast', ToastData, true>
    & WithVariantAxes<'toast'>
    & WithClass
    & Define.Slot<'default'>;

const ToastRoot = component<ToastRootProps>(({ props, slots, signal, onMounted, onUnmounted }) => {
    const viewport = useToastViewportContext();
    const baseId = createId('zx-toast');
    const ids = { title: `${baseId}-title`, description: `${baseId}-desc` };
    // Written from Title/Description setup; the initial render misses the
    // write (it is still executing) but the enter flip re-renders one frame
    // later, before the toast is announced.
    const present = signal({ title: false, description: false });

    let el: HTMLElement | null = null;
    let seenOpen = false;
    let exiting = false;
    let fallbackHandle: ReturnType<typeof setTimeout> | null = null;

    const finish = (): void => {
        if (fallbackHandle != null) clearTimeout(fallbackHandle);
        fallbackHandle = null;
        el?.removeEventListener('transitionend', onEnd);
        el?.removeEventListener('animationend', onEnd);
        viewport.toaster().remove(props.toast.id);
    };
    // Child transitions bubble the same events — only the root's own count.
    const onEnd = (e: Event): void => { if (e.target === el) finish(); };

    const beginExit = (): void => {
        if (exiting) return;
        exiting = true;
        const node = el;
        if (!node) return finish();
        const total = longestAnimationMs(node);
        if (total <= 0) return finish();
        node.addEventListener('transitionend', onEnd);
        node.addEventListener('animationend', onEnd);
        // The exit must never wedge: whichever of the end event and the
        // computed-duration timeout fires first wins.
        fallbackHandle = setTimeout(finish, total + 50);
    };

    onMounted(() => {
        effect(() => {
            if (props.toast.open) {
                seenOpen = true;
                return;
            }
            if (seenOpen) beginExit();
        });
    });
    onUnmounted(() => {
        if (fallbackHandle != null) clearTimeout(fallbackHandle);
    });

    const ctx: ToastItemContext = {
        toast: () => props.toast,
        ids,
        dismiss: () => viewport.toaster().dismiss(props.toast.id),
        setTitlePresent: (p) => { present.title = p; },
        setDescriptionPresent: (p) => { present.description = p; },
    };
    defineProvide(useToastItemContext, () => ctx);

    const index = (): number => viewport.toaster().toasts().findIndex((t) => t.id === props.toast.id);

    // The queue's per-toast colour is the common path (`toast({ color })`);
    // an explicit prop on a composed root wins over it, and both flow through
    // the shared `variantAttrs` guard rather than a hand-rolled attribute.
    return () => (
        <li
            data-scope={SCOPE}
            data-part="root"
            data-state={stateAttr(props.toast.open, 'open', 'closed')}
            {...variantAttrs({
                color: props.color ?? props.toast.color,
                size: props.size,
                variant: props.variant,
                axes: props.axes,
                mods: props.mods,
            })}
            data-placement={viewport.placement()}
            role={props.toast.role === 'alert' ? 'alert' : 'status'}
            aria-atomic="true"
            aria-labelledby={present.title ? ids.title : undefined}
            aria-describedby={present.description ? ids.description : undefined}
            style={{
                '--toast-index': String(Math.max(0, index())),
                '--toast-count': String(viewport.toaster().toasts().length),
            }}
            class={props.class}
            ref={(node: HTMLElement | null) => { el = node; }}
        >
            {slots.default?.()}
        </li>
    );
}, { name: 'Toast.Root' });

// ── Title / Description ──

export type ToastTitleProps = WithClass & Define.Slot<'default'>;

const ToastTitle = component<ToastTitleProps>(({ props, slots, onUnmounted }) => {
    const item = useToastItemContext();
    item.setTitlePresent(true);
    onUnmounted(() => item.setTitlePresent(false));
    return () => (
        <div id={item.ids.title} data-scope={SCOPE} data-part="title" class={props.class}>
            {slots.default?.()}
        </div>
    );
}, { name: 'Toast.Title' });

export type ToastDescriptionProps = WithClass & Define.Slot<'default'>;

const ToastDescription = component<ToastDescriptionProps>(({ props, slots, onUnmounted }) => {
    const item = useToastItemContext();
    item.setDescriptionPresent(true);
    onUnmounted(() => item.setDescriptionPresent(false));
    return () => (
        <div id={item.ids.description} data-scope={SCOPE} data-part="description" class={props.class}>
            {slots.default?.()}
        </div>
    );
}, { name: 'Toast.Description' });

// ── Action ──

export type ToastActionProps =
    & Define.Event<'click', MouseEvent>
    & WithDisabled
    & WithClass
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const ToastAction = component<ToastActionProps>(({ props, slots, emit, signal }) => {
    let el: HTMLElement | null = null;
    const focus = signal({ visible: false });
    const press = createPressFeedback({
        getElement: () => el,
        isDisabled: () => !!props.disabled,
    });

    const bag = (): PartProps => ({
        'data-scope': SCOPE,
        'data-part': 'action',
        'data-disabled': dataAttr(props.disabled),
        'data-focus-visible': dataAttr(focus.visible),
        onClick: (e: MouseEvent) => {
            if (!props.disabled) emit('click', e);
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
}, { name: 'Toast.Action' });

// ── Close ──

export type ToastCloseProps =
    /** Accessible name for the close button (default "Close"). */
    & Define.Prop<'label', string, false>
    & WithDisabled
    & WithClass
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const ToastClose = component<ToastCloseProps>(({ props, slots, signal }) => {
    const item = useToastItemContext();
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
        // its own; "Close" is the conventional one and `label` overrides it
        // (Alert.Close's pattern).
        'aria-label': props.label ?? 'Close',
        onClick: () => {
            if (!props.disabled) item.dismiss();
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
}, { name: 'Toast.Close' });

export const Toast = compound(ToastViewport, {
    Viewport: ToastViewport,
    Root: ToastRoot,
    Title: ToastTitle,
    Description: ToastDescription,
    Action: ToastAction,
    Close: ToastClose,
});
