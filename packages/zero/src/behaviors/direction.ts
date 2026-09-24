/**
 * Reading direction of a mounted element — `:dir(rtl)` where supported (it
 * follows the `dir` attribute through the tree), the computed `direction`
 * otherwise. `false` for no element (SSR, before mount).
 */
export function isRtl(el: Element | null | undefined): boolean {
    if (!el) return false;
    try {
        if (el.matches(':dir(rtl)')) return true;
    } catch {
        // :dir() unsupported — fall through to computed style.
    }
    return typeof getComputedStyle === 'function' && getComputedStyle(el).direction === 'rtl';
}
