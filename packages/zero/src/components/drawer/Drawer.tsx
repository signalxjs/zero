/**
 * Drawer — the edge panel on the native `<dialog>`.
 *
 * ```tsx
 * <Drawer.Root model={() => state.open} label="Site navigation">
 *     <Drawer.Trigger>Menu</Drawer.Trigger>
 *     <Drawer.Panel>
 *         <Drawer.Title>Navigation</Drawer.Title>
 *         <nav>…links…</nav>
 *         <Drawer.Close>Close</Drawer.Close>
 *     </Drawer.Panel>
 * </Drawer.Root>
 * ```
 *
 * Modal by default — `showModal()` gives focus trapping, Escape, inert
 * background and focus restore natively, and the scrim dismisses by the
 * same click geometry Dialog uses (a `::backdrop` click targets the
 * `<dialog>` element itself; only a pointer outside the panel's box can be
 * the backdrop). `modal={false}` is the INLINE mode: the panel renders in
 * flow via `show()`, keeps no dismiss trap (outside clicks are a
 * non-event for furniture), closes on Escape through the dismissable
 * behavior, and covers focus restore itself since `show()` provides
 * neither. See `anatomy.ts` for the placement and labelling decisions.
 *
 * Every close is reported with its reason on the `close` event, after
 * `openChange(false)` — Dialog's contract, minus the `cancel` part a drawer
 * does not have.
 */
import { component, compound, defineInjectable, defineProvide, effect, watch } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState, createInertState, type ControllableState } from '../../behaviors/controllable.js';
import { createId } from '../../behaviors/create-id.js';
import { createDismissable } from '../../behaviors/dismiss.js';
import { createFocusRestore } from '../../behaviors/focus.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { dataAttr, stateAttr } from '../../contract/data-attrs.js';
import { renderAsChild } from '../../contract/as-child.js';
import type { LayoutProp } from '../../contract/layout-attrs.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type { PartProps, WithAsChild, WithClass, WithDisabled, WithHtmlAttrs, WithVariantAxes, WithVisuallyHidden } from '../../contract/props.js';
import { drawerAnatomy } from './anatomy.js';

const SCOPE = drawerAnatomy.scope;

/** Which reading edge the panel sits on — the logical pair. */
export type DrawerPlacement = 'start' | 'end';

/**
 * What closed the drawer — Dialog's reasons without `cancel`: `close` the
 * `Drawer.Close` part, `escape` the native `cancel` or the inline dismiss
 * layer, `backdrop` a scrim click, and `programmatic` every close zero did
 * not initiate (a model write, a native `close()`, a `<form method="dialog">`).
 */
export type DrawerCloseReason = 'close' | 'escape' | 'backdrop' | 'programmatic';

/** The `close` event's detail — why the drawer closed, and with what value. */
export interface DrawerCloseDetail {
    reason: DrawerCloseReason;
    /**
     * The closing `Drawer.Close`'s `value`, or — for a native close zero did
     * not initiate — the element's non-empty `returnValue`. Absent otherwise.
     */
    value?: string;
}

interface DrawerContext {
    state: ControllableState<boolean>;
    /** Close for a reason: the one write path every zero-owned close takes. */
    requestClose(reason: DrawerCloseReason, value?: string): void;
    modal(): boolean;
    dismissible(): boolean;
    placement(): DrawerPlacement;
    label(): string | undefined;
    ids: { panel: string; title: string };
    /** Title reports its presence so the panel's ARIA ref never dangles. */
    titlePresent(): boolean;
    setTitlePresent(present: boolean): void;
}

function makeInert(): DrawerContext {
    const state = createInertState<boolean>(false);
    return {
        state,
        requestClose: () => { state.value = false; },
        modal: () => true,
        dismissible: () => true,
        placement: () => 'start',
        label: () => undefined,
        ids: { panel: 'zx-drawer-inert', title: 'zx-drawer-inert-title' },
        titlePresent: () => false,
        setTitlePresent: () => {},
    };
}

export const useDrawerContext = defineInjectable<DrawerContext>(() => makeInert());

// ── Root ──

export type DrawerRootProps =
    & Define.Model<boolean>
    & Define.Prop<'defaultOpen', boolean, false>
    & Define.Event<'openChange', boolean>
    /**
     * Fires once per close, after `openChange(false)`, with the reason and
     * the closing control's `value` — see `DrawerCloseDetail`.
     */
    & Define.Event<'close', DrawerCloseDetail>
    & Define.Prop<'modal', boolean, false>
    & Define.Prop<'dismissible', boolean, false>
    /** Which reading edge the panel sits on. Default `start`. */
    & Define.Prop<'placement', DrawerPlacement, false>
    /** Accessible name of the panel when no `Drawer.Title` renders. */
    & Define.Prop<'label', string, false>
    & Define.Slot<'default'>;

const DrawerRoot = component<DrawerRootProps>(({ props, slots, emit, signal }) => {
    const state = createControllableState<boolean>(
        () => props.model,
        props.defaultOpen ?? false,
        (v) => emit('openChange', v),
    );
    const baseId = createId('zx-drawer');
    // Written from Title one microtask after its setup — a write made during
    // the render pass is invisible to the already-rendered panel (the same
    // deferral Dialog documents on its `present` signal).
    const present = signal({ title: false });

    // Dialog's close hand-off, verbatim: a requested close reports its own
    // reason, any other open → closed flip is `programmatic` (see Dialog.Root).
    let requested = false;
    const requestClose = (reason: DrawerCloseReason, value?: string): void => {
        if (!state.value) return;
        requested = true;
        state.value = false;
        if (state.value) {
            requested = false;
            return;
        }
        emit('close', value === undefined ? { reason } : { reason, value });
    };
    watch(
        () => state.value,
        (open, wasOpen) => {
            if (open || !wasOpen) return;
            if (requested) requested = false;
            else emit('close', { reason: 'programmatic' });
        },
    );

    const ctx: DrawerContext = {
        state,
        requestClose,
        modal: () => props.modal ?? true,
        dismissible: () => props.dismissible ?? true,
        placement: () => props.placement ?? 'start',
        label: () => props.label,
        ids: {
            panel: `${baseId}-panel`,
            title: `${baseId}-title`,
        },
        titlePresent: () => present.title,
        setTitlePresent: (p) => { present.title = p; },
    };
    defineProvide(useDrawerContext, () => ctx);

    // `showModal()` restores focus natively on close; `show()` does not —
    // cover the inline path so Escape/Close never strand focus.
    createFocusRestore(() => state.value && !(props.modal ?? true));

    return () => <>{slots.default?.()}</>;
}, { name: 'Drawer.Root' });

// ── Trigger ──

export type DrawerTriggerProps =
    & WithDisabled
    & WithClass
    & WithHtmlAttrs
    & WithVariantAxes<'drawer'>
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const DrawerTrigger = component<DrawerTriggerProps>(({ props, slots, signal }) => {
    const drawer = useDrawerContext();
    let el: HTMLElement | null = null;
    const focus = signal({ visible: false });
    const press = createPressFeedback({
        getElement: () => el,
        isDisabled: () => !!props.disabled,
    });

    const bag = (): PartProps => ({
        ...htmlAttrs(props),
        'data-scope': SCOPE,
        'data-part': 'trigger',
        ...variantAttrs(props),
        'data-state': stateAttr(drawer.state.value, 'open', 'closed'),
        'data-disabled': dataAttr(props.disabled),
        'data-focus-visible': dataAttr(focus.visible),
        'aria-haspopup': 'dialog',
        'aria-expanded': drawer.state.value ? 'true' : 'false',
        'aria-controls': drawer.ids.panel,
        onClick: () => {
            if (!props.disabled) drawer.state.value = true;
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
}, { name: 'Drawer.Trigger' });

// ── Panel ──

export type DrawerPanelProps =
    & WithClass
    /**
     * The panel's width cap, from the design system's `--measure-*` ramp:
     * the panel fills its container (inline) or the viewport (modal) up to
     * it, so `full` is a full-screen sheet. Unset, the design system's own
     * drawer width.
     */
    & Define.Prop<'measure', LayoutProp<'measure'>, false>
    /** Not `id`: the Trigger points at the panel's own. */
    & Omit<WithHtmlAttrs, 'id'>
    & Define.Slot<'default'>;

const DrawerPanel = component<DrawerPanelProps>(({ props, slots, onMounted }) => {
    const drawer = useDrawerContext();
    let el: HTMLDialogElement | null = null;

    // A non-modal <dialog> fires no cancel event, so `dismissible` would be
    // a silent no-op without this fallback. Escape only — an inline drawer
    // is furniture that survives clicks elsewhere, and it has no backdrop.
    createDismissable({
        getElement: () => el,
        isOpen: () => drawer.state.value && !drawer.modal() && drawer.dismissible(),
        dismiss: () => drawer.requestClose('escape'),
        outsidePress: false,
    });

    // An inline drawer open on first render is plain markup: emit `open` so
    // the server paints it open instead of flashing open at hydration (#38).
    // Captured once, so the render never patches it again — show()/close()
    // stay its only writers after mount (a render writing `el.open = false`
    // would close the element without a close event). Modal stays a
    // client call: the top layer cannot be expressed in markup.
    const openInMarkup = !drawer.modal() && drawer.state.value ? true : undefined;

    onMounted(() => {
        effect(() => {
            const open = drawer.state.value;
            const node = el;
            if (!node || typeof node.showModal !== 'function') return;
            if (open && !node.open) {
                // A stale result from the last close must not read as this
                // one's (`close` reports a non-empty returnValue).
                node.returnValue = '';
                if (drawer.modal()) node.showModal();
                else node.show();
            } else if (!open && node.open) {
                node.close();
            }
        });
    });

    return () => {
        const attrs = htmlAttrs(props);
        return (
            <dialog
                {...attrs}
                id={drawer.ids.panel}
                data-scope={SCOPE}
                data-part="panel"
                data-state={stateAttr(drawer.state.value, 'open', 'closed')}
                open={openInMarkup}
                data-placement={drawer.placement()}
                // Written directly rather than through `layoutAttrs`: `measure`
                // is not responsive, so the type already closes the value set,
                // and the helper's vocabulary table would triple this entry.
                data-l-measure={props.measure}
                // An app's own references join the Title's; an app
                // `aria-label` stands in for `label`.
                aria-labelledby={[
                    drawer.titlePresent() ? drawer.ids.title : undefined,
                    attrs['aria-labelledby'],
                ].filter(Boolean).join(' ') || undefined}
                aria-label={drawer.titlePresent() ? undefined : drawer.label() ?? attrs['aria-label']}
                class={props.class}
                ref={(node: HTMLDialogElement | null) => { el = node; }}
                onClose={() => {
                    // Still open in the model means zero did not start this
                    // close: a native close() or a <form method="dialog">.
                    drawer.requestClose('programmatic', el?.returnValue || undefined);
                }}
                onCancel={(e: Event) => {
                    // Native Escape: let the model decide. Prevent the default
                    // close and route through state so non-dismissible drawers
                    // stay open and controlled parents stay authoritative.
                    e.preventDefault();
                    if (drawer.dismissible()) drawer.requestClose('escape');
                }}
                onClick={(e: MouseEvent) => {
                    // A ::backdrop click targets the <dialog> element itself —
                    // but so does a click on the panel's own padding. Geometry
                    // decides: only a pointer position outside the panel's box
                    // can be the scrim. Modal only — an inline drawer has no
                    // backdrop at all.
                    if (!drawer.modal() || !drawer.dismissible()) return;
                    if (!el || e.target !== el) return;
                    // A keyboard-synthesized click carries no geometry.
                    if (e.detail === 0) return;
                    const rect = el.getBoundingClientRect();
                    const inside = e.clientX >= rect.left && e.clientX <= rect.right
                        && e.clientY >= rect.top && e.clientY <= rect.bottom;
                    if (!inside) drawer.requestClose('backdrop');
                }}
            >
                {slots.default?.()}
            </dialog>
        );
    };
}, { name: 'Drawer.Panel' });

// ── Title ──

/**
 * `visuallyHidden` keeps the title as the drawer's accessible name while
 * something else carries the visible heading — a brand row, an icon bar.
 */
export type DrawerTitleProps =
    & WithClass
    & WithVisuallyHidden
    /** Not `id`: the panel is labelled by the Title's own. */
    & Omit<WithHtmlAttrs, 'id'>
    & Define.Slot<'default'>;

const DrawerTitle = component<DrawerTitleProps>(({ props, slots, onUnmounted }) => {
    const drawer = useDrawerContext();
    // Deferred past the render pass — see the note on `present` in Root.
    let alive = true;
    queueMicrotask(() => { if (alive) drawer.setTitlePresent(true); });
    onUnmounted(() => {
        alive = false;
        drawer.setTitlePresent(false);
    });
    return () => (
        <h2
            {...htmlAttrs(props)}
            id={drawer.ids.title}
            data-scope={SCOPE}
            data-part="title"
            data-visually-hidden={dataAttr(props.visuallyHidden)}
            class={props.class}
        >
            {slots.default?.()}
        </h2>
    );
}, { name: 'Drawer.Title' });

// ── Close ──

export type DrawerCloseProps =
    /** Reported as the `close` event's `value` when this button closes the drawer. */
    & Define.Prop<'value', string, false>
    & WithDisabled
    & WithClass
    & WithHtmlAttrs
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const DrawerClose = component<DrawerCloseProps>(({ props, slots, signal }) => {
    const drawer = useDrawerContext();
    let el: HTMLElement | null = null;
    const focus = signal({ visible: false });
    const press = createPressFeedback({
        getElement: () => el,
        isDisabled: () => !!props.disabled,
    });

    const bag = (): PartProps => ({
        ...htmlAttrs(props),
        'data-scope': SCOPE,
        'data-part': 'close',
        // The native spelling rides along too: an asChild <button> keeps
        // `<form method="dialog">` semantics without re-threading it.
        value: props.value,
        'data-disabled': dataAttr(props.disabled),
        'data-focus-visible': dataAttr(focus.visible),
        onClick: () => {
            if (!props.disabled) drawer.requestClose('close', props.value);
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
}, { name: 'Drawer.Close' });

export const Drawer = compound(DrawerRoot, {
    Root: DrawerRoot,
    Trigger: DrawerTrigger,
    Panel: DrawerPanel,
    Title: DrawerTitle,
    Close: DrawerClose,
});
