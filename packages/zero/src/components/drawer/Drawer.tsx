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
 */
import { component, compound, defineInjectable, defineProvide, effect, watch } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState, createInertState, type ControllableState } from '../../behaviors/controllable.js';
import { createId } from '../../behaviors/create-id.js';
import { createDismissable } from '../../behaviors/dismiss.js';
import { createFocusRestore } from '../../behaviors/focus.js';
import { breakpointQuery, useMediaQuery } from '../../behaviors/media-query.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { dataAttr, stateAttr } from '../../contract/data-attrs.js';
import { renderAsChild } from '../../contract/as-child.js';
import type { LayoutProp } from '../../contract/layout-attrs.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type { PartProps, WithAsChild, WithClass, WithDisabled, WithHtmlAttrs, WithVariantAxes, WithVisuallyHidden } from '../../contract/props.js';
import type { ZeroBreakpointName } from '../../contract/vocabulary.js';
import { drawerAnatomy } from './anatomy.js';

const SCOPE = drawerAnatomy.scope;

/** Which reading edge the panel sits on — the logical pair. */
export type DrawerPlacement = 'start' | 'end';

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
    /** The responsive drawer's breakpoint, fixed at setup; `undefined` otherwise. */
    dock: string | undefined;
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
}

function makeInert(): DrawerContext {
    const state = createInertState<boolean>(false);
    return {
        state,
        requestClose: () => { state.value = false; },
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
    };
}

export const useDrawerContext = defineInjectable<DrawerContext>(() => makeInert());

/**
 * `data-l-<bp>-dock="inline"` on a responsive drawer's trigger, panel and
 * close; nothing otherwise. Written directly rather than through
 * `layoutAttrs` for `measure`'s reason (the value set is one literal), and
 * the breakpoint needs no grammar check here: `useMediaQuery` already threw
 * at setup for a name the design system did not declare, and the kit holds
 * declared names to kebab-case.
 */
const dockAttrs = (drawer: DrawerContext): Record<string, string> =>
    drawer.dock === undefined ? {} : { [`data-l-${drawer.dock}-dock`]: 'inline' };

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
     * form is read once, at setup.
     */
    & Define.Prop<'modal', boolean | DrawerModalRange, false>
    & Define.Prop<'dismissible', boolean, false>
    /** Which reading edge the panel sits on. Default `start`. */
    & Define.Prop<'placement', DrawerPlacement, false>
    /** Accessible name of the panel when no `Drawer.Title` renders. */
    & Define.Prop<'label', string, false>
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
    const dock = typeof range === 'object' && range !== null ? range.below : undefined;
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
        requestClose,
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
    };
    defineProvide(useDrawerContext, () => ctx);

    // `showModal()` restores focus natively on close; `show()` does not —
    // cover the inline path so Escape/Close never strand focus.
    // Docked is neither: nothing opened it, so there is nothing to restore.
    createFocusRestore(() => state.value && !ctx.modal() && !docked());

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
    const sheetOpen = (): boolean => drawer.state.value && !drawer.docked();
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

const DrawerPanel = component<DrawerPanelProps>(({ props, slots, onMounted }) => {
    const drawer = useDrawerContext();
    let el: HTMLDialogElement | null = null;

    // A non-modal <dialog> fires no cancel event, so `dismissible` would be
    // a silent no-op without this fallback. Escape only — an inline drawer
    // is furniture that survives clicks elsewhere, and it has no backdrop.
    createDismissable({
        getElement: () => el,
        isOpen: () => drawer.state.value && !drawer.modal() && !drawer.docked() && drawer.dismissible(),
        dismiss: () => drawer.requestClose('escape'),
        outsidePress: false,
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

    onMounted(() => {
        // Up through showModal() — the one open state a regime switch has to
        // take down with close() rather than by the attribute.
        let sheet = false;
        effect(() => {
            const docked = drawer.docked();
            const open = drawer.state.value;
            const node = el;
            if (!node || typeof node.showModal !== 'function') return;
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
                // A stale result from the last close must not read as this
                // one's (`close` reports a non-empty returnValue).
                node.returnValue = '';
                if (drawer.modal()) {
                    node.showModal();
                    sheet = true;
                } else {
                    node.show();
                }
            } else if (!open && node.open) {
                sheet = false;
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
                // Docked is open whatever the model says.
                data-state={stateAttr(drawer.docked() || drawer.state.value, 'open', 'closed')}
                open={openInMarkup}
                {...dockAttrs(drawer)}
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
                    if (!matchMedia(drawer.dockQuery).matches) drawer.trigger.el?.focus({ preventScroll: true });
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
        // Hidden while docked (the kit's per-breakpoint structure): a docked
        // panel does not close, so a Close there would be a dead control.
        ...dockAttrs(drawer),
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
