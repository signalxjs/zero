/**
 * Keep a native `[popover]` element's shown state equal to a model.
 *
 * The same effect lived in Select.Popup and Combobox.Popup byte for byte.
 * Call from `onMounted` — the element must exist, and `showPopover` is a
 * platform method that a simulated DOM may lack (then the popup is a plain
 * element whose `data-state` the recipe styles).
 *
 * Returns the stopper. A mount hook has no effect scope of its own, so the
 * caller owns the effect's lifetime: run the call inside a `mountScope()`
 * (or call the stopper from `onUnmounted`) — otherwise it outlives the popup
 * and stays subscribed to the model (#163).
 */
import { effect } from 'sigx';

type PopoverElement = HTMLElement & { showPopover?(): void; hidePopover?(): void };

export function syncPopover(getEl: () => HTMLElement | null, isOpen: () => boolean): () => void {
    const runner = effect(() => {
        const open = isOpen();
        const node = getEl() as PopoverElement | null;
        if (!node || typeof node.showPopover !== 'function' || typeof node.hidePopover !== 'function') return;
        const showing = node.matches(':popover-open');
        if (open && !showing) node.showPopover();
        else if (!open && showing) node.hidePopover();
    });
    return () => runner.stop();
}
