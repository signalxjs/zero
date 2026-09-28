// Thin wrapper over the published conformance helper — zero's own components
// are held to the contract through the exact assertion ecosystem components
// get from `@sigx/zero/testing`.
export { expectAnatomy } from '@sigx/zero/testing';

/**
 * A mouse press on a native `<dialog>` (Dialog's popup, Drawer's panel): the
 * pointerdown at `down` and the click at `up`, both targeting the element
 * itself — which is what a `::backdrop` press and a press on the element's
 * own padding both look like. The backdrop guard (#260) reads both ends.
 */
export function pressDialog(
    el: HTMLElement,
    down: { x: number; y: number; target?: HTMLElement },
    up: { x: number; y: number } = down,
): void {
    (down.target ?? el).dispatchEvent(
        new PointerEvent('pointerdown', { clientX: down.x, clientY: down.y, bubbles: true }),
    );
    el.dispatchEvent(new MouseEvent('click', { clientX: up.x, clientY: up.y, detail: 1, bubbles: true }));
}

/**
 * Teach happy-dom `hidden="until-found"` (#453). The HTML setter keeps the
 * string `"until-found"` and coerces anything else to a boolean; happy-dom
 * coerces everything, so a vdom write of `hidden="until-found"` lands as
 * `hidden=""` and the test would read a different attribute than a browser
 * renders. Idempotent; call it at the top of a suite that renders one.
 */
export function supportUntilFound(): void {
    const proto = HTMLElement.prototype as HTMLElement & { __untilFound?: true };
    if (proto.__untilFound) return;
    Object.defineProperty(proto, 'hidden', {
        configurable: true,
        get(this: HTMLElement) {
            const value = this.getAttribute('hidden');
            if (value === null) return false;
            return value.toLowerCase() === 'until-found' ? 'until-found' : true;
        },
        set(this: HTMLElement, value: unknown) {
            if (typeof value === 'string' && value.toLowerCase() === 'until-found') this.setAttribute('hidden', 'until-found');
            else if (value) this.setAttribute('hidden', '');
            else this.removeAttribute('hidden');
        },
    });
    proto.__untilFound = true;
}
