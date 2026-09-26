/**
 * Presence for a disclosure built on native `<details>` — Collapsible's root
 * and each Accordion item (#276).
 *
 * Two jobs, both web-only DOM work run from the owner's mount scope:
 *
 * - **Size variables.** The panel publishes its measured content size as
 *   `<prefix>-height` / `<prefix>-width` (`scrollHeight`/`scrollWidth`, px)
 *   on itself — on mount, whenever a ResizeObserver sees it change while
 *   open, and once more at the start of every close. `scrollHeight` is the
 *   content's height whatever the panel's own animated block size is, so a
 *   recipe can animate `block-size` from `var(<prefix>-height)` to `0`.
 *
 * - **An animatable close.** Removing `open` from a `<details>` hides its
 *   content at once in every engine, so no recipe can animate the close on
 *   its own. When the model closes, `data-state` flips to `closed`
 *   immediately — that is what starts the recipe's exit — while the element
 *   is held `open` until the panel's own finite animations have played
 *   (`createAnimatedExit`, the machinery the top-layer exit uses). No
 *   animation (a recipe without one, `prefers-reduced-motion: reduce`, a
 *   simulated DOM) closes at once. Reopening during the exit cancels it.
 *
 * The owner renders `open={presence.shown()}` — true while open AND while
 * the exit plays — and keeps its `toggle` handler as it was: the platform's
 * own toggles (find-in-page, fragment navigation, #166) still go through the
 * model, and a close written here arrives already in agreement with it.
 */
import { effect, signal, untrack } from 'sigx';
import { createAnimatedExit, prefersReducedMotion } from './top-layer-exit.js';

export interface DisclosurePresence {
    /** The `<details>` element's rendered `open`: open, or still exiting. */
    shown(): boolean;
    /** The panel's ref: its element, or null when it unmounts. */
    setPanel(el: HTMLElement | null): void;
    /**
     * From the owner's `onMounted`, run through its `mountScope()` — the
     * effect this creates must stop with the owner.
     */
    mount(details: HTMLDetailsElement | null): void;
    /** From the owner's `onUnmounted`: stop observing, drop a pending exit. */
    unmount(): void;
}

export function createDisclosurePresence(opts: {
    isOpen: () => boolean;
    /** `--collapsible-panel` / `--accordion-panel`. */
    prefix: string;
}): DisclosurePresence {
    const presence = signal({ shown: opts.isOpen() });
    const exit = createAnimatedExit({ immediate: prefersReducedMotion });
    let panel: HTMLElement | null = null;
    let details: HTMLDetailsElement | null = null;
    let observer: ResizeObserver | null = null;

    const measure = (): void => {
        // A closed <details> skips its content's layout: nothing to read.
        if (!panel || !details?.open) return;
        panel.style.setProperty(`${opts.prefix}-height`, `${panel.scrollHeight}px`);
        panel.style.setProperty(`${opts.prefix}-width`, `${panel.scrollWidth}px`);
    };

    return {
        shown: () => presence.shown,
        setPanel(el) {
            if (panel && observer) observer.unobserve(panel);
            panel = el;
            if (el && observer) observer.observe(el);
        },
        mount(el) {
            details = el;
            if (typeof ResizeObserver === 'function') {
                // Only while open: during the exit the panel shrinks, and the
                // measurement taken at its start is the one the exit reads.
                observer = new ResizeObserver(() => { if (opts.isOpen()) measure(); });
                if (panel) observer.observe(panel);
            }
            measure();
            effect(() => {
                const open = opts.isOpen();
                untrack(() => {
                    if (open) {
                        exit.cancel();
                        presence.shown = true;
                        return;
                    }
                    if (!presence.shown) return;
                    const node = details;
                    const target = panel;
                    if (!node || !target || !node.open) {
                        presence.shown = false;
                        return;
                    }
                    measure();
                    exit.close(target, () => {
                        if (opts.isOpen()) return;
                        // Written directly as well as through the render: the
                        // exit's last frame and the close must land together,
                        // or the panel paints back at full size in between.
                        node.open = false;
                        presence.shown = false;
                    });
                });
            });
        },
        unmount() {
            observer?.disconnect();
            observer = null;
            exit.cancel();
        },
    };
}
