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
 * Call from component setup; listeners are wired lazily while `isOpen()` is
 * true and removed on close/unmount.
 */
import { watch } from 'sigx';

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
