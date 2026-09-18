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
 * The top layer replaces any Portal: the server renders the popup closed in
 * place, and `showModal()` gives focus trapping, Escape, inert background
 * and focus restore natively. State flows one way — the model opens/closes
 * the element in an effect, and native `close` events sync back.
 */
import { component, compound, defineInjectable, defineProvide, effect } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState, createInertState, type ControllableState } from '../../behaviors/controllable.js';
import { createId } from '../../behaviors/create-id.js';
import { createDismissable } from '../../behaviors/dismiss.js';
import { createFocusRestore } from '../../behaviors/focus.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { dataAttr, stateAttr } from '../../contract/data-attrs.js';
import { renderAsChild } from '../../contract/as-child.js';
import { variantAttrs } from '../../contract/props.js';
import type { PartProps, WithAsChild, WithClass, WithDisabled, WithVariantAxes } from '../../contract/props.js';
import { dialogAnatomy } from './anatomy.js';

const SCOPE = dialogAnatomy.scope;

interface DialogContext {
    state: ControllableState<boolean>;
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
    return {
        state: createInertState<boolean>(false),
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
    const ctx: DialogContext = {
        state,
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

export type DialogPopupProps = WithClass & Define.Slot<'default'>;

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
        dismiss: () => { dialog.state.value = false; },
        outsidePress: false,
    });

    onMounted(() => {
        effect(() => {
            const open = dialog.state.value;
            const node = el;
            if (!node || typeof node.showModal !== 'function') return;
            if (open && !node.open) {
                if (dialog.modal()) node.showModal();
                else node.show();
            } else if (!open && node.open) {
                node.close();
            }
        });
    });

    return () => (
        <dialog
            id={dialog.ids.popup}
            data-scope={SCOPE}
            data-part="popup"
            data-state={stateAttr(dialog.state.value, 'open', 'closed')}
            role={dialog.role() === 'alertdialog' ? 'alertdialog' : undefined}
            aria-labelledby={dialog.titlePresent() ? dialog.ids.title : undefined}
            aria-describedby={dialog.descriptionPresent() ? dialog.ids.description : undefined}
            class={props.class}
            ref={(node: HTMLDialogElement | null) => { el = node; }}
            onClose={() => { dialog.state.value = false; }}
            onCancel={(e: Event) => {
                // Native Escape: let the model decide. Prevent the default
                // close and route through state so non-dismissible dialogs
                // stay open and controlled parents stay authoritative.
                e.preventDefault();
                if (dialog.dismissible()) dialog.state.value = false;
            }}
            onClick={(e: MouseEvent) => {
                // A ::backdrop click targets the <dialog> element itself —
                // but so does a click on the dialog's own padding. Geometry
                // decides: only a pointer position outside the dialog's box
                // can be the backdrop. Modal only — a non-modal dialog has
                // no backdrop at all. An alertdialog never light-dismisses:
                // the pattern exists to interrupt, so the answer has to be
                // one of its actions (APG; Radix AlertDialog behaves the
                // same). Escape stays live via `cancel` above.
                if (dialog.role() === 'alertdialog') return;
                if (!dialog.modal() || !dialog.dismissible()) return;
                if (!el || e.target !== el) return;
                // A keyboard-synthesized click carries no geometry.
                if (e.detail === 0) return;
                const rect = el.getBoundingClientRect();
                const inside = e.clientX >= rect.left && e.clientX <= rect.right
                    && e.clientY >= rect.top && e.clientY <= rect.bottom;
                if (!inside) dialog.state.value = false;
            }}
        >
            {slots.default?.()}
        </dialog>
    );
}, { name: 'Dialog.Popup' });

// ── Title / Description ──

export type DialogTitleProps = WithClass & Define.Slot<'default'>;

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
        <h2 id={dialog.ids.title} data-scope={SCOPE} data-part="title" class={props.class}>
            {slots.default?.()}
        </h2>
    );
}, { name: 'Dialog.Title' });

export type DialogDescriptionProps = WithClass & Define.Slot<'default'>;

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
        <p id={dialog.ids.description} data-scope={SCOPE} data-part="description" class={props.class}>
            {slots.default?.()}
        </p>
    );
}, { name: 'Dialog.Description' });

// ── Footer ──

export type DialogFooterProps = WithClass & Define.Slot<'default'>;

/** The action row — the shared `footer` part every platform's dialog has. */
const DialogFooter = component<DialogFooterProps>(({ props, slots }) => (
    () => (
        <footer data-scope={SCOPE} data-part="footer" class={props.class}>
            {slots.default?.()}
        </footer>
    )
), { name: 'Dialog.Footer' });

// ── Close ──

export type DialogCloseProps =
    & WithDisabled
    & WithClass
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
        'data-scope': SCOPE,
        'data-part': 'close',
        'data-disabled': dataAttr(props.disabled),
        'data-focus-visible': dataAttr(focus.visible),
        onClick: () => {
            if (!props.disabled) dialog.state.value = false;
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
        'data-scope': SCOPE,
        'data-part': 'cancel',
        'data-disabled': dataAttr(props.disabled),
        'data-focus-visible': dataAttr(focus.visible),
        autofocus: dialog.role() === 'alertdialog' ? true : undefined,
        onClick: () => {
            if (!props.disabled) dialog.state.value = false;
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
