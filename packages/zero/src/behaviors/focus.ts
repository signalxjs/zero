/**
 * Focus management utilities.
 *
 * Native `<dialog>` traps and restores focus by itself — these helpers cover
 * the surfaces the platform doesn't: popover panels that should return focus
 * to their trigger, and initial-focus placement.
 */
import { watch } from 'sigx';

const TABBABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
].join(',');

export function getTabbables(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR))
        .filter((el) => !el.hasAttribute('hidden') && el.tabIndex !== -1);
}

/** Focus the first tabbable inside `container`, or the container itself. */
export function focusFirst(container: HTMLElement | null): void {
    if (!container) return;
    const first = getTabbables(container)[0];
    (first ?? container).focus?.();
}

/**
 * Capture `document.activeElement` when `isOpen()` flips true and restore it
 * when it flips false. Call from component setup.
 */
export function createFocusRestore(isOpen: () => boolean): void {
    if (typeof document === 'undefined') return;

    let previous: HTMLElement | null = null;
    watch(
        () => isOpen(),
        (open) => {
            if (open) {
                const active = document.activeElement;
                previous = active instanceof HTMLElement ? active : null;
            } else if (previous) {
                previous.focus?.();
                previous = null;
            }
        },
    );
}
