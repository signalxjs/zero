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
 * Internal: not exported from the behaviors barrel.
 */

/** Whether a viewport point lies outside the element's border box. */
export function pointOutside(el: Element, x: number, y: number): boolean {
    const rect = el.getBoundingClientRect();
    return x < rect.left || x > rect.right || y < rect.top || y > rect.bottom;
}

/**
 * Whether something inside the dialog owns Escape before it does: an open
 * nested `<dialog>` or a light-dismiss popover (Menu, Select, Popover), each
 * the platform's topmost close watcher. Preventing the keydown then would
 * strand them open.
 */
function innerCloseWatcher(el: Element): boolean {
    try {
        return el.querySelector('dialog[open], [popover]:not([popover="manual"]):popover-open') !== null;
    } catch {
        // An engine without `:popover-open` has no light-dismiss popovers.
        return el.querySelector('dialog[open]') !== null;
    }
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
    dismissBackdrop(): void;
}

export interface ModalDismissHandlers {
    onPointerdown(e: PointerEvent): void;
    onPointercancel(): void;
    onClick(e: MouseEvent): void;
    onKeydown(e: KeyboardEvent): void;
    /** Call from the `cancel` handler with the event, before routing Escape. */
    noteCancel(e: Event): void;
    /**
     * Call first thing in the `close` handler: true when it reopened a modal
     * a forced close request took down, and the handler must stop there.
     */
    reopenIfForced(): boolean;
}

export function createModalDismiss(opts: ModalDismissOptions): ModalDismissHandlers {
    let pressStartedOutside = false;
    let forced = false;

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
            if (started && pointOutside(el, e.clientX, e.clientY)) opts.dismissBackdrop();
        },
        onKeydown(e) {
            if (e.key !== 'Escape' || e.defaultPrevented) return;
            const el = opts.getElement();
            if (!el || !opts.isModalOpen() || opts.escapeDismisses()) return;
            if (innerCloseWatcher(el)) return;
            e.preventDefault();
        },
        noteCancel(e) {
            forced = !e.cancelable;
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
