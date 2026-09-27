/**
 * Modal `<dialog>` dismissal guards — the backdrop press and the Escape close
 * request, shared by Dialog's popup and Drawer's modal panel (#260).
 *
 * **Backdrop.** A `::backdrop` click targets the `<dialog>` itself — but so
 * does a click on the dialog's own padding, and so does a click whose press
 * started on text inside the dialog and was released over the backdrop (a
 * click targets the nearest common ancestor of the press and the release).
 * So a click dismisses only when the press ALSO started on the element itself
 * outside its box (#324's geometry, applied at both ends): selecting text by
 * dragging past the edge never closes the dialog, which is what Radix, Base UI
 * and React Aria do.
 *
 * **Escape.** Chromium's close watchers fire a cancelable `cancel` only while
 * the page holds a fresh user activation; a second Escape with none in
 * between fires a `cancel` that cannot be prevented, and the dialog closes
 * whatever the model says. So when Escape must not close — `dismissible` off —
 * the keydown's default is prevented, which keeps the close request from ever
 * being sent. As a guard for close requests that arrive with no keydown (the
 * Android back gesture), a non-cancelable `cancel` is remembered, and the
 * `close` it causes reopens the dialog if the model still says open.
 *
 * **Preventable Escape** (#277). An Escape that would dismiss goes to
 * `onEscapeKeyDown` first, on the keydown: prevented there, it never becomes
 * a close request, so no `cancel` fires at all. A `cancel` that arrives with
 * no keydown seen (focus on `<body>`, the Android back gesture) asks the
 * handler with a synthesized Escape keydown instead — `escapeAllowed()`.
 *
 * Internal: not exported from the behaviors barrel.
 */
import { askToPrevent, hasInnerCloseWatcher } from './dismiss.js';


/** Whether a viewport point lies outside the element's border box. */
export function pointOutside(el: Element, x: number, y: number): boolean {
    const rect = el.getBoundingClientRect();
    return x < rect.left || x > rect.right || y < rect.top || y > rect.bottom;
}

export interface ModalDismissOptions {
    getElement(): HTMLDialogElement | null;
    /** A modal that is showing — the only state with a backdrop or a close watcher. */
    isModalOpen(): boolean;
    /** May a backdrop press dismiss (dismissible, and not an alertdialog)? */
    backdropDismisses(): boolean;
    /** May Escape dismiss? */
    escapeDismisses(): boolean;
    /** The model still says open — a forced native close must be undone. */
    shouldStayOpen(): boolean;
    /** Dismiss for a backdrop click — the `click` itself, for `interactOutside`. */
    dismissBackdrop(e: MouseEvent): void;
    /**
     * Called for an Escape that would dismiss; `preventDefault()` on it keeps
     * the dialog open.
     */
    onEscapeKeyDown?(e: KeyboardEvent): void;
}

export interface ModalDismissHandlers {
    onPointerdown(e: PointerEvent): void;
    onPointercancel(): void;
    onClick(e: MouseEvent): void;
    onKeydown(e: KeyboardEvent): void;
    /** Call from the `cancel` handler with the event, before routing Escape. */
    noteCancel(e: Event): void;
    /**
     * Call from the `cancel` handler of a dismissible modal: whether this
     * close request may dismiss. True for one whose keydown already passed
     * `onEscapeKeyDown`; otherwise asks it with a synthesized Escape.
     */
    escapeAllowed(): boolean;
    /**
     * Call first thing in the `close` handler: true when it reopened a modal
     * a forced close request took down, and the handler must stop there.
     */
    reopenIfForced(): boolean;
}

export function createModalDismiss(opts: ModalDismissOptions): ModalDismissHandlers {
    let pressStartedOutside = false;
    let forced = false;
    // An Escape keydown `onEscapeKeyDown` let through: the `cancel` it
    // becomes is already answered. Cleared a task later — the close request
    // follows the keydown within its own task, or not at all.
    let escapeSeen = false;
    let escapeTimer: ReturnType<typeof setTimeout> | undefined;

    return {
        onPointerdown(e) {
            const el = opts.getElement();
            pressStartedOutside = !!el && e.target === el && pointOutside(el, e.clientX, e.clientY);
        },
        onPointercancel() {
            pressStartedOutside = false;
        },
        onClick(e) {
            const started = pressStartedOutside;
            pressStartedOutside = false;
            const el = opts.getElement();
            if (!el || e.target !== el) return;
            if (!opts.isModalOpen() || !opts.backdropDismisses()) return;
            // A keyboard-synthesized click carries no geometry.
            if (e.detail === 0) return;
            if (started && pointOutside(el, e.clientX, e.clientY)) opts.dismissBackdrop(e);
        },
        onKeydown(e) {
            if (e.key !== 'Escape' || e.defaultPrevented) return;
            const el = opts.getElement();
            if (!el || !opts.isModalOpen()) return;
            if (hasInnerCloseWatcher(el)) return;
            if (!opts.escapeDismisses()) {
                e.preventDefault();
                return;
            }
            if (askToPrevent(e, opts.onEscapeKeyDown)) return;
            escapeSeen = true;
            clearTimeout(escapeTimer);
            escapeTimer = setTimeout(() => { escapeSeen = false; }, 0);
        },
        noteCancel(e) {
            forced = !e.cancelable;
        },
        escapeAllowed() {
            if (escapeSeen) {
                escapeSeen = false;
                clearTimeout(escapeTimer);
                return true;
            }
            const synthetic = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
            return !askToPrevent(synthetic, opts.onEscapeKeyDown);
        },
        reopenIfForced() {
            const wasForced = forced;
            forced = false;
            const el = opts.getElement();
            if (!wasForced || !el || el.open || !el.isConnected) return false;
            if (!opts.shouldStayOpen()) return false;
            el.showModal();
            return true;
        },
    };
}
