/**
 * Autosize — the runtime half of a textarea that grows with its content (#88).
 *
 * The growing itself is CSS: `css/base.css` gives an autosizing textarea
 * (`[data-autosize]`) `field-sizing: content` and row bounds in `lh`, so on
 * an engine that supports it the box is right from the first paint, SSR
 * included, and nothing here runs per keystroke. What CSS cannot do is read
 * the recipe's padding and border, which a `border-box` element's bounds
 * have to add to its rows — so this measures them and publishes the sum as
 * `--textarea-block-chrome`.
 *
 * Where `field-sizing` is not supported it is also the fallback: collapse
 * the box, read `scrollHeight`, write the height inline. The CSS bounds still
 * clamp that height, and past the upper one the textarea scrolls as usual.
 *
 * Client-only — call it from `onMounted`, dispose it in `onUnmounted`.
 */

/** The custom property the base.css bounds add to their rows. */
export const AUTOSIZE_CHROME_PROPERTY = '--textarea-block-chrome';

export interface Autosize {
    /**
     * Re-measure after the value changed from outside an `input` event (a
     * model write, a form reset). Coalesced to one measurement per task.
     */
    refresh(): void;
    /** Stop observing and remove everything this wrote on the element. */
    dispose(): void;
}

const px = (value: string): number => Number.parseFloat(value) || 0;

/** Whether the engine grows a textarea with `field-sizing: content` itself. */
export function supportsFieldSizing(): boolean {
    return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('field-sizing', 'content');
}

export function createAutosize(el: HTMLTextAreaElement): Autosize {
    const native = supportsFieldSizing();
    let lastWidth = -1;
    let queued = false;
    let disposed = false;

    const fit = (): void => {
        queued = false;
        if (disposed) return;
        const cs = getComputedStyle(el);
        const padding = px(cs.paddingTop) + px(cs.paddingBottom);
        const border = px(cs.borderTopWidth) + px(cs.borderBottomWidth);
        const borderBox = cs.boxSizing === 'border-box';
        const chrome = `${borderBox ? padding + border : 0}px`;
        if (el.style.getPropertyValue(AUTOSIZE_CHROME_PROPERTY) !== chrome) {
            el.style.setProperty(AUTOSIZE_CHROME_PROPERTY, chrome);
        }
        if (native) return;
        // Collapse first, or `scrollHeight` can never report LESS than the
        // current box and the textarea would only ever grow. The min bound
        // keeps the collapsed box at its floor; `scrollHeight` is content +
        // padding either way.
        el.style.height = '0px';
        const content = el.scrollHeight - padding;
        el.style.height = `${borderBox ? content + padding + border : content}px`;
    };

    const refresh = (): void => {
        if (queued || disposed) return;
        queued = true;
        queueMicrotask(fit);
    };

    // The skin's padding can change with its size axis, which re-measures
    // the chrome; in the fallback a width change rewraps the text. Deferred
    // a frame, because resizing the box from inside its own observer
    // callback is the "ResizeObserver loop" error — and in the fallback
    // filtered to width, since every height change there is our own.
    const observer = typeof ResizeObserver === 'function'
        ? new ResizeObserver((entries) => {
            const width = entries[entries.length - 1]!.contentRect.width;
            if (!native && width === lastWidth) return;
            lastWidth = width;
            requestAnimationFrame(fit);
        })
        : null;
    observer?.observe(el);

    const onInput = (): void => { if (!native) fit(); };
    el.addEventListener('input', onInput);
    // A leaf part mounts before its parent inserts the subtree, and a
    // detached element measures as nothing — in the fallback that would
    // write `height: 0px`. By the next microtask it is in the document.
    if (el.isConnected) fit();
    else refresh();

    return {
        refresh,
        dispose() {
            disposed = true;
            observer?.disconnect();
            el.removeEventListener('input', onInput);
            el.style.removeProperty(AUTOSIZE_CHROME_PROPERTY);
            if (!native) el.style.removeProperty('height');
        },
    };
}
