/**
 * Dismissal layering — outside-press and Escape for overlay surfaces.
 *
 * A module-scoped layer stack (client-only; never touched during SSR) keeps
 * nested overlays dismissing innermost-first on Escape. Where the platform
 * already dismisses (modal `<dialog>` Escape, `popover="auto"` light
 * dismiss) the component syncs the native event back into its model instead
 * of calling this.
 *
 * Escape yields (#261) in two cases, as every reference dismissable layer
 * does: an event an inner widget already handled (`defaultPrevented` — a
 * combobox or a select closing its list), and an event from
 * inside an open native top-layer surface nested within this layer's own
 * surface (a Menu, Select or Popover popup inside a non-modal Dialog or an
 * inline Drawer). The browser closes that inner `popover="auto"` itself;
 * dismissing the outer layer too would take the whole stack down at once.
 *
 * Both dismissals are preventable (#277): `onEscapeKeyDown` and
 * `onInteractOutside` run before the layer dismisses, and a handler that
 * calls `preventDefault()` keeps it open. That is what a component's
 * `escapeKeyDown` / `interactOutside` events are wired to.
 *
 * Call from component setup; listeners are wired lazily while `isOpen()` is
 * true and removed on close/unmount.
 */
import { watch } from 'sigx';

/**
 * What an `interactOutside` event carries: the pointer event of a press
 * outside the surface (for a modal's backdrop, the `click` — a
 * `PointerEvent` in current engines, a `MouseEvent` in older ones), or the
 * `focusin` that moved focus outside it (Menu).
 */
export type InteractOutsideEvent = PointerEvent | MouseEvent | FocusEvent;

/**
 * Run `handler` with `e` and report whether it called `preventDefault()`.
 * `defaultPrevented` alone cannot say for an event that is not cancelable —
 * a `focusin`, a click a script synthesized — so the call is observed on
 * the instance (and still forwarded, so a cancelable event's default is
 * really prevented); inside the handler `defaultPrevented` reads the veto.
 */
export function askToPrevent<E extends Event>(e: E, handler: ((e: E) => void) | undefined): boolean {
    if (!handler) return false;
    let vetoed = false;
    // An enclosing ask may already observe this event: chain to it, and put
    // it back afterwards.
    const ownCall = Object.getOwnPropertyDescriptor(e, 'preventDefault');
    const ownFlag = Object.getOwnPropertyDescriptor(e, 'defaultPrevented');
    const forward = e.preventDefault;
    Object.defineProperty(e, 'preventDefault', {
        configurable: true,
        value: () => {
            vetoed = true;
            forward.call(e);
        },
    });
    Object.defineProperty(e, 'defaultPrevented', {
        configurable: true,
        get: () => vetoed || (ownFlag?.get ? ownFlag.get.call(e) as boolean : nativePrevented(e)),
    });
    try {
        handler(e);
    } finally {
        restore(e, 'preventDefault', ownCall);
        restore(e, 'defaultPrevented', ownFlag);
    }
    return vetoed;
}

function nativePrevented(e: Event): boolean {
    return Object.getOwnPropertyDescriptor(Event.prototype, 'defaultPrevented')!.get!.call(e) as boolean;
}

function restore(e: Event, key: string, own: PropertyDescriptor | undefined): void {
    if (own) Object.defineProperty(e, key, own);
    else delete (e as unknown as Record<string, unknown>)[key];
}

export interface DismissableOptions {
    /** The overlay surface element. */
    getElement(): HTMLElement | null;
    isOpen(): boolean;
    dismiss(): void;
    /** Dismiss on pointerdown outside the surface (default true). */
    outsidePress?: boolean | ((e: PointerEvent) => boolean);
    /** Dismiss on Escape (default true). */
    escape?: boolean;
    /** Extra elements that count as "inside" (e.g. the trigger). */
    getExtraTargets?(): (HTMLElement | null)[];
    /**
     * Called before an Escape dismissal, with the keydown. A handler that
     * calls `preventDefault()` keeps the layer open.
     */
    onEscapeKeyDown?(e: KeyboardEvent): void;
    /**
     * Called before an outside-press dismissal, with the pointerdown. A
     * handler that calls `preventDefault()` keeps the layer open.
     */
    onInteractOutside?(e: PointerEvent): void;
}

interface Layer {
    dismiss(): void;
}

const layerStack: Layer[] = [];

/**
 * True when `target` sits inside an open native top-layer surface nested
 * WITHIN `surface` (and not `surface` itself): that inner surface owns the
 * Escape. Without the Popover API (happy-dom, a legacy engine) nothing can
 * open a popover, so a `[popover]` holding focus is one shown by other
 * means — it stands for the layer all the same. A target that is not an
 * element, or an engine that cannot parse the selector, throws: no yield.
 */
function insideNestedTopLayer(target: EventTarget | null, surface: HTMLElement | null): boolean {
    let inner: Element | null = null;
    try {
        inner = (target as Element).closest(
            typeof HTMLElement.prototype.showPopover === 'function'
                ? ':popover-open,dialog:modal'
                : '[popover],dialog:modal',
        );
    } catch { /* see above */ }
    return !!inner && inner !== surface && !!surface?.contains(inner);
}

export function createDismissable(opts: DismissableOptions): void {
    if (typeof document === 'undefined') return;

    watch(
        () => opts.isOpen(),
        (open, _prev, onCleanup) => {
            if (!open) return;

            const layer: Layer = { dismiss: () => opts.dismiss() };
            layerStack.push(layer);

            const onPointerdown = (e: PointerEvent) => {
                const allow = opts.outsidePress ?? true;
                if (allow === false) return;
                if (typeof allow === 'function' && !allow(e)) return;
                // Only the topmost layer light-dismisses.
                if (layerStack[layerStack.length - 1] !== layer) return;
                const target = e.target as Node | null;
                if (!target) return;
                const surface = opts.getElement();
                if (surface?.contains(target)) return;
                for (const extra of opts.getExtraTargets?.() ?? []) {
                    if (extra?.contains(target)) return;
                }
                if (askToPrevent(e, opts.onInteractOutside)) return;
                opts.dismiss();
            };

            const onKeydown = (e: KeyboardEvent) => {
                if ((opts.escape ?? true) === false) return;
                if (e.key !== 'Escape') return;
                // An inner widget already consumed this Escape.
                if (e.defaultPrevented) return;
                if (layerStack[layerStack.length - 1] !== layer) return;
                // A nested popup (native popover / modal dialog) inside this
                // surface closes itself; this layer waits for the next one.
                if (insideNestedTopLayer(e.target, opts.getElement())) return;
                // The app's veto: prevented, the Escape is spent and the
                // layer stays.
                if (askToPrevent(e, opts.onEscapeKeyDown)) return;
                e.preventDefault();
                opts.dismiss();
            };

            document.addEventListener('pointerdown', onPointerdown, { capture: true });
            document.addEventListener('keydown', onKeydown);

            onCleanup(() => {
                document.removeEventListener('pointerdown', onPointerdown, { capture: true });
                document.removeEventListener('keydown', onKeydown);
                const idx = layerStack.indexOf(layer);
                if (idx !== -1) layerStack.splice(idx, 1);
            });
        },
        { immediate: true },
    );
}

/**
 * Whether something inside `el` owns Escape before it does: an open nested
 * `<dialog>` or a light-dismiss popover (Menu, Select, Popover), each the
 * platform's topmost close watcher.
 */
export function hasInnerCloseWatcher(el: Element): boolean {
    try {
        return el.querySelector('dialog[open], [popover]:not([popover="manual"]):popover-open') !== null;
    } catch {
        // An engine without `:popover-open` has no light-dismiss popovers.
        return el.querySelector('dialog[open]') !== null;
    }
}

export interface LightDismissGuardOptions {
    /** The `popover="auto"` surface. */
    getElement(): HTMLElement | null;
    isOpen(): boolean;
    /** Extra elements that count as "inside" (the trigger — its own click toggles). */
    getExtraTargets?(): (HTMLElement | null)[];
    /** Called for an Escape that would close the surface; `preventDefault()` keeps it open. */
    onEscapeKeyDown?(e: KeyboardEvent): void;
    /** Called for a pointerdown outside the surface; `preventDefault()` keeps it open. */
    onInteractOutside?(e: PointerEvent): void;
}

export interface LightDismissGuard {
    /**
     * Ask from the `toggle` handler of a surface that just closed natively:
     * true when that close was one the app prevented, and the surface must
     * show again (the model never changed). Consumes the answer.
     */
    keepOpen(): boolean;
}

/**
 * The preventable-dismissal seam for a `popover="auto"` surface (#277) —
 * Popover and Menu. The platform owns both dismissals there, so the guard
 * watches the gestures that cause them and asks the app first:
 *
 * - **Escape** — a document keydown the surface would close on (not one an
 *   inner widget already handled, and not while a close watcher nested
 *   inside owns it) goes to `onEscapeKeyDown`. A prevented keydown never
 *   becomes a close request, so the popover simply stays.
 * - **Light dismiss** — a pointerdown outside the surface and the extra
 *   targets goes to `onInteractOutside`. The platform's light dismiss cannot
 *   be cancelled (`beforetoggle` is cancelable only when opening), so a
 *   prevented press is remembered, and the `toggle` that reports the close
 *   asks `keepOpen()` and shows the popover again. The answer is re-armed by
 *   every outside press, Escape and open, so a stale veto does not outlive
 *   its gesture by more than a press that never closed anything.
 *
 * Call from component setup; listeners live while `isOpen()` is true.
 */
export function createLightDismissGuard(opts: LightDismissGuardOptions): LightDismissGuard {
    let prevented = false;
    if (typeof document !== 'undefined') {
        watch(
            () => opts.isOpen(),
            (open, _prev, onCleanup) => {
                prevented = false;
                if (!open) return;
                const onKeydown = (e: KeyboardEvent): void => {
                    if (e.key !== 'Escape' || e.defaultPrevented) return;
                    const el = opts.getElement();
                    if (!el || hasInnerCloseWatcher(el)) return;
                    prevented = askToPrevent(e, opts.onEscapeKeyDown);
                };
                const onPointerdown = (e: PointerEvent): void => {
                    prevented = false;
                    const target = e.target as Node | null;
                    const el = opts.getElement();
                    if (!target || !el || el.contains(target)) return;
                    for (const extra of opts.getExtraTargets?.() ?? []) {
                        if (extra?.contains(target)) return;
                    }
                    prevented = askToPrevent(e, opts.onInteractOutside);
                };
                document.addEventListener('keydown', onKeydown);
                document.addEventListener('pointerdown', onPointerdown, { capture: true });
                onCleanup(() => {
                    document.removeEventListener('keydown', onKeydown);
                    document.removeEventListener('pointerdown', onPointerdown, { capture: true });
                });
            },
            { immediate: true },
        );
    }
    return {
        keepOpen() {
            const keep = prevented;
            prevented = false;
            return keep && opts.isOpen();
        },
    };
}
