/**
 * Dialog — modal (and non-modal) overlay on the native `<dialog>` element.
 *
 * ```tsx
 * <Dialog.Root model={() => state.open}>
 *     <Dialog.Trigger>Open</Dialog.Trigger>
 *     <Dialog.Popup>
 *         <Dialog.Title>Title</Dialog.Title>
 *         <Dialog.Description>…</Dialog.Description>
 *         <Dialog.Close>Close</Dialog.Close>
 *     </Dialog.Popup>
 * </Dialog.Root>
 * ```
 *
 * The top layer replaces any Portal: the server renders the popup in place
 * (closed, unless it is non-modal and open — then `open` is plain markup),
 * and `showModal()` gives focus trapping, Escape, inert background
 * and focus restore natively. State flows one way — the model opens/closes
 * the element in an effect, and native `close` events sync back.
 *
 * `openChange(false)` says THAT it closed; the `close` event that follows it
 * says WHY — `{ reason, value }`, the `<dialog>` `close` + `returnValue`
 * pair in model form. A confirm dialog reads `value` off the `Dialog.Close`
 * that closed it (`<Dialog.Close value="confirm">`) instead of keeping a
 * flag beside the model.
 */
import { component, compound, defineInjectable, defineProvide, effect, watch } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState, createInertState, type ControllableState } from '../../behaviors/controllable.js';
import { createId } from '../../behaviors/create-id.js';
import { createDismissable } from '../../behaviors/dismiss.js';
import { createFocusRestore } from '../../behaviors/focus.js';
import { createModalDismiss } from '../../behaviors/modal-dismiss.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { createTopLayerExit } from '../../behaviors/top-layer-exit.js';
import { dataAttr, stateAttr } from '../../contract/data-attrs.js';
import { renderAsChild } from '../../contract/as-child.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type { PartProps, WithAsChild, WithClass, WithDisabled, WithHtmlAttrs, WithVariantAxes, WithVisuallyHidden } from '../../contract/props.js';
import { dialogAnatomy } from './anatomy.js';
import { mountScope } from '../../behaviors/mount-scope.js';

const SCOPE = dialogAnatomy.scope;

/**
 * What closed the dialog. The first four are the parts and gestures zero
 * owns — `close` and `cancel` name the part that was activated, `escape`
 * the native `cancel` (or the non-modal dismiss layer), `backdrop` a click
 * on `::backdrop`. `programmatic` is every close zero did not initiate: the
 * parent writing the model, a native `close()`, a `<form method="dialog">`
 * submission.
 */
export type DialogCloseReason = 'close' | 'cancel' | 'escape' | 'backdrop' | 'programmatic';

/** The `close` event's detail — why the dialog closed, and with what value. */
export interface DialogCloseDetail {
    reason: DialogCloseReason;
    /**
     * The closing `Dialog.Close`'s `value`, or — for a native close zero did
     * not initiate — the element's non-empty `returnValue`. Absent otherwise.
     */
    value?: string;
}

interface DialogContext {
    state: ControllableState<boolean>;
    /** Close for a reason: the one write path every zero-owned close takes. */
    requestClose(reason: DialogCloseReason, value?: string): void;
    modal(): boolean;
    dismissible(): boolean;
    /** `alertdialog` tightens the pattern: no backdrop dismiss, Cancel takes initial focus. */
    role(): 'dialog' | 'alertdialog';
    ids: { popup: string; title: string; description: string };
    /** Title/Description report their presence so the popup's ARIA refs never dangle. */
    titlePresent(): boolean;
    descriptionPresent(): boolean;
    setTitlePresent(present: boolean): void;
    setDescriptionPresent(present: boolean): void;
}

function makeInert(): DialogContext {
    const state = createInertState<boolean>(false);
    return {
        state,
        requestClose: () => { state.value = false; },
        modal: () => true,
        dismissible: () => true,
        role: () => 'dialog',
        ids: { popup: 'zx-dialog-inert', title: 'zx-dialog-inert-title', description: 'zx-dialog-inert-desc' },
        titlePresent: () => false,
        descriptionPresent: () => false,
        setTitlePresent: () => {},
        setDescriptionPresent: () => {},
    };
}

export const useDialogContext = defineInjectable<DialogContext>(() => makeInert());

// ── Root ──

export type DialogRootProps =
    & Define.Model<boolean>
    & Define.Prop<'defaultOpen', boolean, false>
    & Define.Event<'openChange', boolean>
    /**
     * Fires once per close, after `openChange(false)`, with the reason and
     * the closing control's `value` — see `DialogCloseDetail`.
     */
    & Define.Event<'close', DialogCloseDetail>
    & Define.Prop<'modal', boolean, false>
    & Define.Prop<'dismissible', boolean, false>
    /**
     * `alertdialog` is the APG alert-dialog preset on the same anatomy:
     * the popup announces as `role="alertdialog"`, a backdrop click does NOT
     * dismiss (Escape still does, under `dismissible`), and initial focus
     * goes to the least-destructive action — mark it with `Dialog.Cancel`.
     */
    & Define.Prop<'role', 'dialog' | 'alertdialog', false>
    & Define.Slot<'default'>;

const DialogRoot = component<DialogRootProps>(({ props, slots, emit, signal }) => {
    const state = createControllableState<boolean>(
        () => props.model,
        props.defaultOpen ?? false,
        (v) => emit('openChange', v),
    );
    const baseId = createId('zx-dialog');
    // Written from Title/Description one microtask after their setup — a
    // write made during the render pass is invisible to the already-rendered
    // popup (Toast's presence flags heal at the enter flip; a dialog has no
    // such flip, so the write itself is deferred instead).
    const present = signal({ title: false, description: false });

    // A close zero initiates carries its reason through the write; any other
    // open → closed flip (the parent writing the model) is `programmatic`.
    // `requested` is the hand-off that keeps the watch from reporting a
    // requested close a second time — consumed by the watch rather than
    // reset after the write, so it holds whether the watch runs inside the
    // write or after an enclosing batch.
    let requested = false;
    const requestClose = (reason: DialogCloseReason, value?: string): void => {
        if (!state.value) return;
        requested = true;
        state.value = false;
        // A controlled parent may refuse the write; only a close that took
        // reports one.
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

    const ctx: DialogContext = {
        state,
        requestClose,
        modal: () => props.modal ?? true,
        dismissible: () => props.dismissible ?? true,
        role: () => props.role ?? 'dialog',
        ids: {
            popup: `${baseId}-popup`,
            title: `${baseId}-title`,
            description: `${baseId}-desc`,
        },
        titlePresent: () => present.title,
        descriptionPresent: () => present.description,
        setTitlePresent: (p) => { present.title = p; },
        setDescriptionPresent: (p) => { present.description = p; },
    };
    defineProvide(useDialogContext, () => ctx);

    // `showModal()` restores focus natively on close; `show()` does not —
    // cover the non-modal path so Escape/Close never strand focus.
    createFocusRestore(() => state.value && !(props.modal ?? true));

    return () => <>{slots.default?.()}</>;
}, { name: 'Dialog.Root' });

// ── Trigger ──

export type DialogTriggerProps =
    & WithDisabled
    & WithClass
    & WithHtmlAttrs
    & WithVariantAxes<'dialog'>
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const DialogTrigger = component<DialogTriggerProps>(({ props, slots, signal }) => {
    const dialog = useDialogContext();
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
        'data-state': stateAttr(dialog.state.value, 'open', 'closed'),
        'data-disabled': dataAttr(props.disabled),
        'data-focus-visible': dataAttr(focus.visible),
        'aria-haspopup': 'dialog',
        'aria-expanded': dialog.state.value ? 'true' : 'false',
        'aria-controls': dialog.ids.popup,
        onClick: () => {
            if (!props.disabled) dialog.state.value = true;
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
}, { name: 'Dialog.Trigger' });

// ── Popup ──

export type DialogPopupProps =
    & WithClass
    /** Not `id`/`role`: the Trigger points at the popup's id, and `role` is the Root's. */
    & Omit<WithHtmlAttrs, 'id' | 'role'>
    & Define.Slot<'default'>;

const DialogPopup = component<DialogPopupProps>(({ props, slots, onMounted }) => {
    const dialog = useDialogContext();
    let el: HTMLDialogElement | null = null;

    // A non-modal <dialog> fires no cancel event, so `dismissible` would be
    // a silent no-op without this fallback. Escape only — a non-modal dialog
    // (a find bar, a tool palette) is expected to survive clicks elsewhere,
    // and it has no backdrop to click.
    createDismissable({
        getElement: () => el,
        isOpen: () => dialog.state.value && !dialog.modal() && dialog.dismissible(),
        dismiss: () => dialog.requestClose('escape'),
        outsidePress: false,
    });

    // A non-modal dialog open on first render is plain markup: emit `open`
    // so the server paints it open instead of flashing open at hydration
    // (#38). Captured once, so the render never patches it again —
    // show()/close() stay its only writers after mount (a render writing
    // `el.open = false` would close the element without a close event).
    // Modal stays a client call: the top layer cannot be expressed in markup.
    const openInMarkup = !dialog.modal() && dialog.state.value ? true : undefined;

    // Outside Chromium the native close waits for the exit to play (#17).
    const exit = createTopLayerExit();

    // The backdrop press and the Escape close request (#260). An
    // alertdialog never light-dismisses: the pattern exists to interrupt,
    // so the answer has to be one of its actions (APG; Radix AlertDialog
    // behaves the same). Escape stays live via `cancel`, under `dismissible`.
    const guard = createModalDismiss({
        getElement: () => el,
        isModalOpen: () => dialog.modal() && dialog.state.value,
        backdropDismisses: () => dialog.dismissible() && dialog.role() !== 'alertdialog',
        escapeDismisses: () => dialog.dismissible(),
        shouldStayOpen: () => dialog.modal() && dialog.state.value,
        dismissBackdrop: () => dialog.requestClose('backdrop'),
    });

    const scoped = mountScope();
    onMounted(() => scoped(() => {
        const sync = (open: boolean) => {
            const node = el;
            if (!node || typeof node.showModal !== 'function') return;
            if (open) exit.cancel();
            if (open && !node.open) {
                // A popup below another element mounts before its parent
                // has inserted the subtree, and `showModal()` on a detached
                // element throws (#102). By the next microtask it is in the
                // document — autosize's reasoning — so a dialog open at
                // mount opens then, if the model still says so.
                if (!node.isConnected) {
                    queueMicrotask(() => { if (node.isConnected) sync(dialog.state.value); });
                    return;
                }
                // A stale result from the last close must not read as this
                // one's (`close` reports a non-empty returnValue).
                node.returnValue = '';
                if (dialog.modal()) node.showModal();
                else node.show();
            } else if (!open && node.open) {
                exit.close(node, () => {
                    if (!dialog.state.value && node.open) node.close();
                });
            }
        };
        effect(() => sync(dialog.state.value));
    }));

    return () => {
        const attrs = htmlAttrs(props);
        return (
            <dialog
                {...attrs}
                id={dialog.ids.popup}
                data-scope={SCOPE}
                data-part="popup"
                data-state={stateAttr(dialog.state.value, 'open', 'closed')}
                open={openInMarkup}
                role={dialog.role() === 'alertdialog' ? 'alertdialog' : undefined}
                // An app's own references join the Title's and Description's.
                aria-labelledby={[
                    dialog.titlePresent() ? dialog.ids.title : undefined,
                    attrs['aria-labelledby'],
                ].filter(Boolean).join(' ') || undefined}
                aria-describedby={[
                    dialog.descriptionPresent() ? dialog.ids.description : undefined,
                    attrs['aria-describedby'],
                ].filter(Boolean).join(' ') || undefined}
                class={props.class}
                ref={(node: HTMLDialogElement | null) => { el = node; }}
                onClose={() => {
                    // A close request the platform would not let zero cancel
                    // (see `modal-dismiss`) reopens while the model says open.
                    if (guard.reopenIfForced()) return;
                    // Still open in the model means zero did not start this
                    // close: a native close() or a <form method="dialog">.
                    dialog.requestClose('programmatic', el?.returnValue || undefined);
                }}
                onCancel={(e: Event) => {
                    // Native Escape: let the model decide. Prevent the default
                    // close and route through state so non-dismissible dialogs
                    // stay open and controlled parents stay authoritative.
                    guard.noteCancel(e);
                    e.preventDefault();
                    if (dialog.dismissible()) dialog.requestClose('escape');
                }}
                // Escape on a non-dismissible modal never becomes a close
                // request: Chromium stops letting `cancel` be prevented after
                // the first one without a fresh user activation.
                onKeydown={guard.onKeydown}
                // A ::backdrop click targets the <dialog> element itself — but
                // so does a click on the dialog's own padding, and one pressed
                // on text inside and released over the backdrop. Geometry
                // decides, at both ends of the press: only a press that starts
                // AND ends outside the dialog's box is the backdrop. Modal
                // only — a non-modal dialog has no backdrop at all.
                onPointerdown={guard.onPointerdown}
                onPointercancel={guard.onPointercancel}
                onClick={guard.onClick}
            >
                {slots.default?.()}
            </dialog>
        );
    };
}, { name: 'Dialog.Popup' });

// ── Title / Description ──

/**
 * `visuallyHidden` keeps the title as the dialog's accessible name while
 * something else carries the visible heading — a brand row, an icon bar.
 */
export type DialogTitleProps =
    & WithClass
    & WithVisuallyHidden
    /** Not `id`: the popup is labelled by the Title's own. */
    & Omit<WithHtmlAttrs, 'id'>
    & Define.Slot<'default'>;

const DialogTitle = component<DialogTitleProps>(({ props, slots, onUnmounted }) => {
    const dialog = useDialogContext();
    // Deferred past the render pass — see the note on `present` in Root.
    let alive = true;
    queueMicrotask(() => { if (alive) dialog.setTitlePresent(true); });
    onUnmounted(() => {
        alive = false;
        dialog.setTitlePresent(false);
    });
    return () => (
        <h2
            {...htmlAttrs(props)}
            id={dialog.ids.title}
            data-scope={SCOPE}
            data-part="title"
            data-visually-hidden={dataAttr(props.visuallyHidden)}
            class={props.class}
        >
            {slots.default?.()}
        </h2>
    );
}, { name: 'Dialog.Title' });

/** Not `id`: the popup is described by the Description's own. */
export type DialogDescriptionProps = WithClass & Omit<WithHtmlAttrs, 'id'> & Define.Slot<'default'>;

const DialogDescription = component<DialogDescriptionProps>(({ props, slots, onUnmounted }) => {
    const dialog = useDialogContext();
    // Deferred past the render pass — see the note on `present` in Root.
    let alive = true;
    queueMicrotask(() => { if (alive) dialog.setDescriptionPresent(true); });
    onUnmounted(() => {
        alive = false;
        dialog.setDescriptionPresent(false);
    });
    return () => (
        <p {...htmlAttrs(props)} id={dialog.ids.description} data-scope={SCOPE} data-part="description" class={props.class}>
            {slots.default?.()}
        </p>
    );
}, { name: 'Dialog.Description' });

// ── Footer ──

export type DialogFooterProps = WithClass & WithHtmlAttrs & Define.Slot<'default'>;

/** The action row — the shared `footer` part every platform's dialog has. */
const DialogFooter = component<DialogFooterProps>(({ props, slots }) => (
    () => (
        <footer {...htmlAttrs(props)} data-scope={SCOPE} data-part="footer" class={props.class}>
            {slots.default?.()}
        </footer>
    )
), { name: 'Dialog.Footer' });

// ── Close ──

export type DialogCloseProps =
    /**
     * Reported as the `close` event's `value` when this button closes the
     * dialog — `<button value>` inside `<form method="dialog">`, as a prop.
     */
    & Define.Prop<'value', string, false>
    & WithDisabled
    & WithClass
    & WithHtmlAttrs
    & WithAsChild
    & Define.Slot<'default', PartProps>;

const DialogClose = component<DialogCloseProps>(({ props, slots, signal }) => {
    const dialog = useDialogContext();
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
            if (!props.disabled) dialog.requestClose('close', props.value);
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
}, { name: 'Dialog.Close' });

// ── Cancel ──

export type DialogCancelProps =
    & WithDisabled
    & WithClass
    & WithHtmlAttrs
    & WithAsChild
    & Define.Slot<'default', PartProps>;

/**
 * The least-destructive action. Behaviorally a close button; in
 * `role="alertdialog"` mode it additionally carries `autofocus`, which is the
 * platform seam for APG's initial-focus rule — `showModal()`'s focusing steps
 * land on the first autofocus element inside the dialog, on every open.
 */
const DialogCancel = component<DialogCancelProps>(({ props, slots, signal }) => {
    const dialog = useDialogContext();
    let el: HTMLElement | null = null;
    const focus = signal({ visible: false });
    const press = createPressFeedback({
        getElement: () => el,
        isDisabled: () => !!props.disabled,
    });

    const bag = (): PartProps => ({
        ...htmlAttrs(props),
        'data-scope': SCOPE,
        'data-part': 'cancel',
        'data-disabled': dataAttr(props.disabled),
        'data-focus-visible': dataAttr(focus.visible),
        autofocus: dialog.role() === 'alertdialog' ? true : undefined,
        onClick: () => {
            if (!props.disabled) dialog.requestClose('cancel');
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
}, { name: 'Dialog.Cancel' });

export const Dialog = compound(DialogRoot, {
    Root: DialogRoot,
    Trigger: DialogTrigger,
    Popup: DialogPopup,
    Title: DialogTitle,
    Description: DialogDescription,
    Footer: DialogFooter,
    Close: DialogClose,
    Cancel: DialogCancel,
});
