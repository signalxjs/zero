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
