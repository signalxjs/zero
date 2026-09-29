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
 *
 * `modal={{ below: 'md' }}` is the RESPONSIVE mode (#82): one drawer that is
 * a modal sheet below the breakpoint and docked open inline at or above it.
 * The model governs the sheet only — while docked the panel is pinned open
 * and the model is ignored — and crossing the breakpoint is not a close: no
 * `openChange`, no `close` event, and a sheet still up when the viewport
 * widens goes away silently. The server cannot know the viewport, so the
 * panel renders docked (`open` in markup) and the design system's compiled
 * CSS hides whichever half the viewport disagrees with until the runtime
 * catches up on mount.
 *
 * Focus and scroll (#277), as Dialog: `initialFocus` / `finalFocus` name
 * where focus goes on open and after close, a modal sheet locks the
 * document's scroll while it shows (`preventScroll`, default true — the
 * sheet regime only, never inline or docked), and `escapeKeyDown` /
 * `interactOutside` fire before an Escape or scrim dismissal, which a
 * handler's `preventDefault()` cancels.
 *
 * A dismissible modal sheet swipes back to its edge (#293): the panel is the
 * handle, `createSwipe` publishes the drag, and the close reports `swipe`.
 */
import { component, compound, defineInjectable, defineProvide, effect, watch } from 'sigx';
import type { Define } from 'sigx';
import { createAxisMirror, INERT_AXIS_MIRROR, type AxisMirror } from '../../behaviors/axis-mirror.js';
import { createControllableState, createInertState, type ControllableState } from '../../behaviors/controllable.js';
import { createId } from '../../behaviors/create-id.js';
import { askToPrevent, createDismissable, type InteractOutsideEvent } from '../../behaviors/dismiss.js';
import { createFocusRestore, restoreFocus } from '../../behaviors/focus.js';
import { createModalDismiss } from '../../behaviors/modal-dismiss.js';
import { createScrollLockHold } from '../../behaviors/scroll-lock.js';
import { breakpointQuery, useMediaQuery } from '../../behaviors/media-query.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { createTopLayerExit } from '../../behaviors/top-layer-exit.js';
import { dataAttr, stateAttr } from '../../contract/data-attrs.js';
import { renderAsChild } from '../../contract/as-child.js';
import type { LayoutProp } from '../../contract/layout-attrs.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type { PartProps, WithAsChild, WithClass, WithDisabled, WithHtmlAttrs, WithInteractionHandlers, WithVariantAxes, WithVisuallyHidden } from '../../contract/props.js';
import type { ZeroBreakpointName } from '../../contract/vocabulary.js';
import { drawerAnatomy } from './anatomy.js';
import { mountScope } from '../../behaviors/mount-scope.js';
import { createSwipe, type SwipeDirection } from '../../behaviors/swipe.js';

const SCOPE = drawerAnatomy.scope;

/**
 * Which edge the panel sits on: `start` / `end` are the reading edges (the
 * logical pair, so RTL mirrors them), `top` / `bottom` the block edges — a
 * sheet across the viewport's width, which never mirrors (#291).
 */
export type DrawerPlacement = 'start' | 'end' | 'top' | 'bottom';

/** A block-edge placement: sheet-only — it has no docked regime. */
const isBlockPlacement = (p: DrawerPlacement | undefined): boolean => p === 'top' || p === 'bottom';

/**
 * The responsive form of `modal`: a modal sheet strictly below the named
 * breakpoint (`(width < <bp>)`), the panel docked open inline at or above
 * it — `useMediaQuery`'s `{ below }` boundary, and the compiled CSS's.
 */
export interface DrawerModalRange {
    below: ZeroBreakpointName;
}

/**
 * What closed the drawer — Dialog's reasons without `cancel`: `close` the
 * `Drawer.Close` part, `escape` the native `cancel` or the inline dismiss
 * layer, `backdrop` a scrim click, `swipe` the sheet dragged back to its
 * edge (#293), and `programmatic` every close zero did not initiate (a model
 * write, a native `close()`, a `<form method="dialog">`).
 */
export type DrawerCloseReason = 'close' | 'escape' | 'backdrop' | 'swipe' | 'programmatic';

/** The swipe that takes a sheet back to its edge: toward its placement. */
const SWIPE_TOWARD: Record<DrawerPlacement, SwipeDirection> = {
    start: 'start',
    end: 'end',
    top: 'up',
    bottom: 'down',
};

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
    /** The Trigger's axis attributes, mirrored onto the popup (#514, `mirrorsAxes`). */
    axes: AxisMirror;
    /** Close for a reason: the one write path every zero-owned close takes. */
    requestClose(reason: DrawerCloseReason, value?: string): void;
    modal(): boolean;
    /** The responsive drawer's breakpoint, fixed at setup; `undefined` otherwise. */
    dock: ZeroBreakpointName | undefined;
    /** Its `(min-width: …)` query — what "docked" means, asked of the viewport now. */
    dockQuery: string | undefined;
    /** Docked: a responsive drawer at or above its breakpoint — pinned open inline. */
    docked(): boolean;
    trigger: { el: HTMLElement | null };
    dismissible(): boolean;
    placement(): DrawerPlacement;
    label(): string | undefined;
    ids: { panel: string; title: string };
    /** Title reports its presence so the panel's ARIA ref never dangles. */
    titlePresent(): boolean;
    setTitlePresent(present: boolean): void;
    /** The element to focus once the panel opens; null leaves the platform's choice. */
    initialFocus(): HTMLElement | null;
    /** The element to focus once the panel closes; null leaves the default. */
    finalFocus(): HTMLElement | null;
    /** Lock the document's scroll while the sheet shows. */
    preventScroll(): boolean;
    /** Emit `escapeKeyDown`; true when the app prevented the dismissal. */
    escapeKeyDown(e: KeyboardEvent): boolean;
    /** Emit `interactOutside`; true when the app prevented the dismissal. */
    interactOutside(e: InteractOutsideEvent): boolean;
}

function makeInert(): DrawerContext {
    const state = createInertState<boolean>(false);
    return {
        state,
        requestClose: () => { state.value = false; },
        axes: INERT_AXIS_MIRROR,
        modal: () => true,
        dock: undefined,
        dockQuery: undefined,
        docked: () => false,
        trigger: { el: null },
        dismissible: () => true,
        placement: () => 'start',
        label: () => undefined,
        ids: { panel: 'zx-drawer-inert', title: 'zx-drawer-inert-title' },
        titlePresent: () => false,
        setTitlePresent: () => {},
        initialFocus: () => null,
        finalFocus: () => null,
        preventScroll: () => true,
        escapeKeyDown: () => false,
        interactOutside: () => false,
    };
}

export const useDrawerContext = defineInjectable<DrawerContext>(() => makeInert());

/**
 * `data-l-dock-above="<bp>"` on a responsive drawer's trigger, panel and
 * close; nothing otherwise. The breakpoint is the value (#122), as
 * `Table.Root stack` spells it. Written directly rather than through
 * `layoutAttrs` for `measure`'s reason (a fixed literal), and
 * the breakpoint needs no grammar check here: `useMediaQuery` already threw
 * at setup for a name the design system did not declare, and the kit holds
 * declared names to kebab-case.
 */
const dockAttrs = (drawer: DrawerContext): Record<string, string> =>
    drawer.dock === undefined ? {} : { 'data-l-dock-above': drawer.dock };

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
    /**
     * `true` (default) a modal sheet, `false` inline, or `{ below: bp }` —
     * a sheet below the breakpoint, docked open inline at or above it. The
     * form is read once, at setup. Docking is for the reading edges only: a
     * `top` / `bottom` drawer given a breakpoint warns and stays a sheet.
     */
    & Define.Prop<'modal', boolean | DrawerModalRange, false>
    & Define.Prop<'dismissible', boolean, false>
    /**
     * Which edge the panel sits on — a reading edge (`start` / `end`) or a
     * block edge (`top` / `bottom`, a sheet only). Default `start`.
     */
    & Define.Prop<'placement', DrawerPlacement, false>
    /** Accessible name of the panel when no `Drawer.Title` renders. */
    & Define.Prop<'label', string, false>
    /**
     * The element to focus when the panel opens (sheet or inline — never on
     * docking), over `autofocus` and the platform's first-focusable rule.
     * Returning null keeps the native choice.
     */
    & Define.Prop<'initialFocus', () => HTMLElement | null | undefined, false>
    /**
     * The element to focus when the panel closes. Returning null (or an
     * element that cannot take focus) keeps the default: the element focused
     * before it opened, the trigger of the closed popup that element sat in,
     * then `Drawer.Trigger`.
     */
    & Define.Prop<'finalFocus', () => HTMLElement | null | undefined, false>
    /**
     * Lock the document's scroll while the modal sheet shows. Default true;
     * an inline or docked panel never locks.
     */
    & Define.Prop<'preventScroll', boolean, false>
    /**
     * Fires before Escape dismisses the drawer (only when it would —
     * `dismissible`). `preventDefault()` keeps it open.
     */
    & Define.Event<'escapeKeyDown', KeyboardEvent>
    /**
     * Fires before a scrim press dismisses the sheet, with the `click`.
     * `preventDefault()` keeps it open.
     */
    & Define.Event<'interactOutside', InteractOutsideEvent>
    & Define.Slot<'default'>;

const DrawerRoot = component<DrawerRootProps>(({ props, slots, emit, signal }) => {
    // A regime switch writes the model without reporting it (#82).
    let silent = false;
    const state = createControllableState<boolean>(
        () => props.model,
        props.defaultOpen ?? false,
        (v) => { if (!silent) emit('openChange', v); },
    );
    // Read once: the breakpoint names both the media query subscription and
    // the rendered attribute, and neither can be re-pointed after setup.
    const range = props.modal;
    const requestedDock = typeof range === 'object' && range !== null ? range.below : undefined;
    // A block-edge drawer is sheet-only (#291): docking means pinned open
    // beside the content, which a top or bottom panel has no column for. The
    // placement is read here with the form, so the regime is fixed at setup.
    const blockEdge = isBlockPlacement(props.placement);
    if (requestedDock !== undefined && blockEdge) {
        console.warn(
            `[zero] Drawer.Root placement="${props.placement}" cannot dock: modal={{ below: '${requestedDock}' }} `
            + 'applies to the start/end placements only. The drawer stays a modal sheet at every width.',
        );
    }
    const dock = blockEdge ? undefined : requestedDock;
    // `initial: true` is the server's answer: it cannot see the viewport, so
    // it renders the docked markup and the compiled CSS covers a narrow one.
    const dockQuery = dock === undefined ? undefined : breakpointQuery({ above: dock });
    const wide = dockQuery === undefined ? undefined : useMediaQuery(dockQuery, { initial: true });
    const docked = (): boolean => !!wide?.value;
    const baseId = createId('zx-drawer');
    // Written from Title one microtask after its setup — a write made during
    // the render pass is invisible to the already-rendered panel (the same
    // deferral Dialog documents on its `present` signal).
    const present = signal({ title: false });

    // Dialog's close hand-off, verbatim: a requested close reports its own
    // reason, any other open → closed flip is `programmatic` (see Dialog.Root).
    let requested = false;
    const requestClose = (reason: DrawerCloseReason, value?: string): void => {
        // Docked, there is nothing to close: the model is not what shows.
        if (!state.value || docked()) return;
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
            // Docked, a model write closed nothing that was showing.
            else if (!docked()) emit('close', { reason: 'programmatic' });
        },
    );
    // A sheet still up when the viewport widens goes away with the modal
    // regime, and says nothing: a resize is not a dismissal. `requested`
    // swallows the close event, `silent` the openChange.
    if (wide) {
        watch(
            () => wide.value,
            (isWide) => {
                if (!isWide || !state.value) return;
                requested = true;
                silent = true;
                state.value = false;
                silent = false;
                if (state.value) requested = false;
            },
        );
    }

    const ctx: DrawerContext = {
        state,
        axes: createAxisMirror(),
        requestClose,
        // A block-edge drawer that asked to dock is a sheet (see `dock`):
        // with no breakpoint left, the object form is simply `!== false`.
        modal: () => (dock === undefined ? props.modal !== false : !docked()),
        dock,
        dockQuery,
        docked,
        trigger: { el: null },
        dismissible: () => props.dismissible ?? true,
        placement: () => props.placement ?? 'start',
        label: () => props.label,
        ids: {
            panel: `${baseId}-panel`,
            title: `${baseId}-title`,
        },
        titlePresent: () => present.title,
        setTitlePresent: (p) => { present.title = p; },
        initialFocus: () => props.initialFocus?.() ?? null,
        finalFocus: () => props.finalFocus?.() ?? null,
        preventScroll: () => props.preventScroll ?? true,
        escapeKeyDown: (e) => askToPrevent(e, (ev) => emit('escapeKeyDown', ev)),
        interactOutside: (e) => askToPrevent(e, (ev) => emit('interactOutside', ev)),
    };
    defineProvide(useDrawerContext, () => ctx);

    // `showModal()` restores focus natively on close; `show()` does not —
    // cover the inline path so Escape/Close never strand focus.
    // Docked is neither: nothing opened it, so there is nothing to restore.
    // Only while focus is still the panel's to hand back (#262).
    createFocusRestore(() => state.value && !ctx.modal() && !docked(), {
        getSurface: () => document.getElementById(ctx.ids.panel),
        fallback: () => ctx.trigger.el,
        target: ctx.finalFocus,
    });

    return () => <>{slots.default?.()}</>;
}, { name: 'Drawer.Root' });

// ── Trigger ──

export type DrawerTriggerProps =
    & WithDisabled
    & WithClass
    & WithHtmlAttrs
    & WithVariantAxes<'drawer'>
    & WithAsChild
    /**
     * The app's handlers, run after the part's own (`onClick` after the
     * open, `onKeydown` after the press feedback) and skipped while
     * `disabled`. They reach an `asChild` element through the bag.
     */
    & WithInteractionHandlers
    & Define.Slot<'default', PartProps>;

const DrawerTrigger = component<DrawerTriggerProps>(({ props, slots, signal, onUnmounted }) => {
    const drawer = useDrawerContext();
    // The panel renders the same axis attributes (#514).
    onUnmounted(drawer.axes.publish(() => variantAttrs(props)));
    let el: HTMLElement | null = null;
    const sheetOpen = (): boolean => drawer.state.value && !drawer.docked();
    const focus = signal({ visible: false });
    const press = createPressFeedback({
        owner: { scope: SCOPE, part: 'trigger' },
        getElement: () => el,
        isDisabled: () => !!props.disabled,
    });

    const bag = (): PartProps => ({
        ...htmlAttrs(props),
        'data-scope': SCOPE,
        'data-part': 'trigger',
        ...variantAttrs(props),
        // The SHEET's state: docked, there is no sheet, whatever the model
        // holds — and the server renders docked, so a narrow first paint
        // never shows the trigger pressed open.
        'data-state': stateAttr(sheetOpen(), 'open', 'closed'),
        'data-disabled': dataAttr(props.disabled),
        'data-focus-visible': dataAttr(focus.visible),
        ...dockAttrs(drawer),
        'aria-haspopup': 'dialog',
        'aria-expanded': sheetOpen() ? 'true' : 'false',
        'aria-controls': drawer.ids.panel,
        onClick: (e: MouseEvent) => {
            if (props.disabled) return;
            drawer.state.value = true;
            props.onClick?.(e);
        },
        onFocus: (e: FocusEvent) => {
            focus.visible = isFocusVisible(el);
            if (!props.disabled) props.onFocus?.(e);
        },
        onBlur: (e: FocusEvent) => {
            press.onBlur(e);
            focus.visible = false;
            if (!props.disabled) props.onBlur?.(e);
        },
        onKeydown: (e: KeyboardEvent) => {
            press.onKeydown(e);
            if (!props.disabled) props.onKeydown?.(e);
        },
        onKeyup: press.onKeyup,
        onPointerdown: press.onPointerdown,
        onPointerup: press.onPointerup,
        onPointercancel: press.onPointercancel,
        onPointerleave: press.onPointerleave,
        ref: (node: HTMLElement | null) => {
            el = node;
            // Where focus goes when a docked panel it sat in stops showing.
            drawer.trigger.el = node;
        },
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

const DrawerPanel = component<DrawerPanelProps>(({ props, slots, onMounted, onUnmounted }) => {
    const drawer = useDrawerContext();
    let el: HTMLDialogElement | null = null;
    // Focused before the sheet's `showModal()` — Dialog's bookkeeping.
    let previous: HTMLElement | null = null;
    let sheetOpened = false;
    const scrollLock = createScrollLockHold();
    onUnmounted(() => scrollLock.release());

    // A non-modal <dialog> fires no cancel event, so `dismissible` would be
    // a silent no-op without this fallback. Escape only — an inline drawer
    // is furniture that survives clicks elsewhere, and it has no backdrop.
    createDismissable({
        getElement: () => el,
        isOpen: () => drawer.state.value && !drawer.modal() && !drawer.docked() && drawer.dismissible(),
        dismiss: () => drawer.requestClose('escape'),
        outsidePress: false,
        onEscapeKeyDown: (e) => { drawer.escapeKeyDown(e); },
        // Non-modal: the page stays live; only keys typed inside are ours.
        ownsKeyboard: 'within',
    });

    // An inline drawer open on first render is plain markup: emit `open` so
    // the server paints it open instead of flashing open at hydration (#38).
    // Captured once, so the render never patches it again — show()/close()
    // stay its only writers after mount (a render writing `el.open = false`
    // would close the element without a close event). Modal stays a
    // client call: the top layer cannot be expressed in markup. A
    // responsive drawer always renders docked (`docked()` reads the
    // server's `initial: true` here), so its panel is open in markup too.
    const openInMarkup = drawer.docked() || (!drawer.modal() && drawer.state.value) ? true : undefined;

    // Outside Chromium the native close waits for the exit to play (#17).
    const exit = createTopLayerExit();

    // The scrim press and the Escape close request — Dialog's guards (#260).
    const guard = createModalDismiss({
        getElement: () => el,
        isModalOpen: () => drawer.modal() && !drawer.docked() && drawer.state.value,
        backdropDismisses: () => drawer.dismissible(),
        escapeDismisses: () => drawer.dismissible(),
        shouldStayOpen: () => drawer.modal() && !drawer.docked() && drawer.state.value,
        dismissBackdrop: (e) => {
            if (!drawer.interactOutside(e)) drawer.requestClose('backdrop');
        },
        onEscapeKeyDown: (e) => { drawer.escapeKeyDown(e); },
    });

    /**
     * After the sheet closed by a close (not a regime switch): release the
     * scroll lock and hand focus on — Dialog's `afterClose`.
     */
    const afterClose = (): void => {
        scrollLock.release();
        if (!sheetOpened) return;
        sheetOpened = false;
        const remembered = previous;
        previous = null;
        restoreFocus(remembered, {
            getSurface: () => el,
            target: drawer.finalFocus,
            fallback: () => drawer.trigger.el,
        });
    };

    const scoped = mountScope();
    onMounted(() => scoped(() => {
        // Swipe to dismiss (#293) — the modal sheet only, never inline or
        // docked furniture, and only a dismissible one: toward the edge the
        // panel sits on. The gesture is the whole panel; content that can
        // still scroll the way the drag goes keeps it (see `swipe.ts`).
        const swipe = el
            ? createSwipe({
                el,
                direction: () => SWIPE_TOWARD[drawer.placement()],
                enabled: () => drawer.modal() && !drawer.docked() && drawer.state.value && drawer.dismissible(),
                onDismiss: () => {
                    drawer.requestClose('swipe');
                    // A controlled model that stayed open: back to the edge.
                    if (drawer.state.value) swipe?.reset();
                },
            })
            : null;
        // Up through showModal() — the one open state a regime switch has to
        // take down with close() rather than by the attribute.
        let sheet = false;
        const sync = () => {
            const docked = drawer.docked();
            const open = drawer.state.value;
            const node = el;
            if (!node || typeof node.showModal !== 'function') return;
            // A reopen, or a regime switch, overrides an exit in flight: the
            // branches below then see the panel as it still is (open).
            if (open || docked) exit.cancel();
            if (docked) {
                // Docked is the server's markup exactly: `open` as an
                // attribute. Never show() — that runs the dialog focusing
                // steps and would pull focus into the panel on a resize.
                if (sheet) {
                    // The sheet the viewport just outgrew. Its close event is
                    // stale by the time it fires (onClose ignores a close for
                    // a panel that is open again), and focus stays on the
                    // element it was on — now in the docked panel — instead
                    // of the native restore to a trigger that just hid.
                    const active = document.activeElement as HTMLElement | null;
                    sheet = false;
                    // Not a close: no focus hand-off, but the lock goes with
                    // the modal regime.
                    sheetOpened = false;
                    previous = null;
                    scrollLock.release();
                    node.close();
                    node.setAttribute('open', '');
                    if (active && node.contains(active)) active.focus({ preventScroll: true });
                } else if (!node.open) {
                    node.setAttribute('open', '');
                }
                return;
            }
            if (drawer.dock !== undefined && node.open && !sheet) {
                // Leaving the docked regime (or hydrating into a narrow
                // viewport): opened as markup, so closed as markup —
                // removing the attribute queues no close event. Focus that
                // was inside moves to the trigger, which is what shows now,
                // and which a sheet opened next restores to natively.
                const active = document.activeElement;
                node.removeAttribute('open');
                if (active && node.contains(active)) drawer.trigger.el?.focus({ preventScroll: true });
            }
            if (open && !node.open) {
                // A panel below another element mounts before its parent has
                // inserted the subtree, and `showModal()` on a detached
                // element throws (#102) — Dialog's deferral.
                if (!node.isConnected) {
                    queueMicrotask(() => { if (node.isConnected) sync(); });
                    return;
                }
                // A stale result from the last close must not read as this
                // one's (`close` reports a non-empty returnValue).
                node.returnValue = '';
                // A swipe that closed the sheet left its offset for the exit
                // to start from; the next opening starts from the edge.
                swipe?.reset();
                if (drawer.modal()) {
                    const active = document.activeElement;
                    previous = active instanceof HTMLElement ? active : null;
                    node.showModal();
                    sheet = true;
                    sheetOpened = true;
                    if (drawer.preventScroll()) scrollLock.hold();
                } else {
                    node.show();
                }
                // Over autofocus and the dialog focusing steps, which have
                // just run; null keeps their choice.
                drawer.initialFocus()?.focus();
            } else if (!open && node.open) {
                exit.close(node, () => {
                    if (drawer.state.value || drawer.docked() || !node.open) return;
                    sheet = false;
                    node.close();
                });
            }
        };
        effect(sync);
    }));

    return () => {
        const attrs = htmlAttrs(props);
        return (
            <dialog
                {...attrs}
                {...drawer.axes.attrs()}
                id={drawer.ids.panel}
                data-scope={SCOPE}
                data-part="panel"
                // Docked is open whatever the model says.
                data-state={stateAttr(drawer.docked() || drawer.state.value, 'open', 'closed')}
                open={openInMarkup}
                {...dockAttrs(drawer)}
                // The regime, not the open state — it holds through a sheet's
                // exit, where `:modal` has already stopped matching (#83).
                data-l-dock={drawer.modal() ? 'sheet' : 'inline'}
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
                    // `close` is queued, not synchronous: one that arrives for
                    // a panel open again (a regime switch re-docked it, or a
                    // reopen outran it) is stale, and closing now would take
                    // down the wrong opening.
                    if (el?.open) return;
                    // A close request the platform would not let zero cancel
                    // (see `modal-dismiss`) reopens while the model says open.
                    if (guard.reopenIfForced()) return;
                    afterClose();
                    // Still open in the model means zero did not start this
                    // close: a native close() or a <form method="dialog">.
                    drawer.requestClose('programmatic', el?.returnValue || undefined);
                }}
                onFocusout={(e: FocusEvent) => {
                    // Chromium hides a docked panel (the compiled CSS) and
                    // drops its focus BEFORE the media query's change event
                    // reaches the runtime, so the regime effect finds focus
                    // already on body — and mid-exit, while `display` is still
                    // transitioning, so the box cannot be asked. The viewport
                    // can: focus lost to nothing from a panel that is not a
                    // sheet, below the breakpoint, is the same hand-off.
                    if (!drawer.dockQuery || e.relatedTarget || !el || el.matches(':modal')) return;
                    // Where there is no matchMedia, useMediaQuery never left
                    // its initial answer either: nothing crossed anything.
                    if (typeof matchMedia !== 'function') return;
                    if (!matchMedia(drawer.dockQuery).matches) drawer.trigger.el?.focus({ preventScroll: true });
                }}
                onCancel={(e: Event) => {
                    // Native Escape: let the model decide. Prevent the default
                    // close and route through state so non-dismissible drawers
                    // stay open and controlled parents stay authoritative.
                    guard.noteCancel(e);
                    e.preventDefault();
                    if (drawer.dismissible() && guard.escapeAllowed()) drawer.requestClose('escape');
                }}
                // Escape on a non-dismissible sheet never becomes a close
                // request: Chromium stops letting `cancel` be prevented after
                // the first one without a fresh user activation.
                onKeydown={guard.onKeydown}
                // A ::backdrop click targets the <dialog> element itself — but
                // so does a click on the panel's own padding, and one pressed
                // on text inside and released over the scrim. Geometry
                // decides, at both ends of the press: only a press that starts
                // AND ends outside the panel's box is the scrim. Modal only —
                // an inline drawer has no backdrop at all.
                onPointerdown={guard.onPointerdown}
                onPointercancel={guard.onPointercancel}
                onClick={guard.onClick}
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
    /**
     * The app's handlers, skipped while `disabled` and passed to an
     * `asChild` element through the bag. `onClick` runs BEFORE the close,
     * and `event.preventDefault()` in it vetoes the close (a "save, then
     * close" that fails can keep the drawer open). `onKeydown`, `onFocus` and
     * `onBlur` run after the part's own handling.
     */
    & WithInteractionHandlers
    & Define.Slot<'default', PartProps>;

const DrawerClose = component<DrawerCloseProps>(({ props, slots, signal }) => {
    const drawer = useDrawerContext();
    let el: HTMLElement | null = null;
    const focus = signal({ visible: false });
    const press = createPressFeedback({
        owner: { scope: SCOPE, part: 'close' },
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
        // Hidden while docked (the kit's per-breakpoint structure): a docked
        // panel does not close, so a Close there would be a dead control.
        ...dockAttrs(drawer),
        'data-focus-visible': dataAttr(focus.visible),
        onClick: (e: MouseEvent) => {
            if (props.disabled) return;
            // The app's first, so its preventDefault() can veto the close.
            props.onClick?.(e);
            if (e.defaultPrevented) return;
            drawer.requestClose('close', props.value);
        },
        onFocus: (e: FocusEvent) => {
            focus.visible = isFocusVisible(el);
            if (!props.disabled) props.onFocus?.(e);
        },
        onBlur: (e: FocusEvent) => {
            press.onBlur(e);
            focus.visible = false;
            if (!props.disabled) props.onBlur?.(e);
        },
        onKeydown: (e: KeyboardEvent) => {
            press.onKeydown(e);
            if (!props.disabled) props.onKeydown?.(e);
        },
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
