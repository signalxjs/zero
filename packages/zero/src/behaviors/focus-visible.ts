/**
 * `data-focus-visible` tracking.
 *
 * CSS `:focus-visible` works on the focused element itself, but design
 * systems usually want to style a *wrapper* (the switch root, the field
 * control) when the inner native input has visible focus. This helper turns
 * the platform heuristic into a data flag the DS can target anywhere.
 */

/**
 * Returns whether the element currently matches `:focus-visible`. Guarded:
 * simulated DOM environments without the pseudo-class report false.
 */
export function isFocusVisible(el: Element | null): boolean {
    if (!el) return false;
    try {
        return el.matches(':focus-visible');
    } catch {
        return false;
    }
}
