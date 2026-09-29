/**
 * The axis mirror (#514) — how a part that declares `mirrorsAxes` in its
 * anatomy renders the carrier's axis attributes.
 *
 * The fragment-rooted scopes (dialog, popover, tooltip, menu, hover-card,
 * drawer) carry their axis props on the TRIGGER, and the popup is a
 * top-layer sibling no selector rooted on the trigger can reach. So the
 * trigger publishes what it renders — `variantAttrs(props)`: `data-color`,
 * `data-size`, `data-variant`, each custom `data-<axis>` and each
 * `data-mod-*` — and the popup spreads the same bag on itself. One source,
 * read reactively: the popup re-renders when a trigger prop changes, and
 * the two can never disagree, because there is no second prop surface.
 *
 * Setup-safe and SSR-safe: nothing here touches the DOM, and the state is
 * per root instance (created in the Root's setup), never module-global.
 * With no trigger rendered — a dialog opened only through its model — the
 * popup mirrors nothing and renders no axis attribute.
 */
import { signal } from 'sigx';

/** An axis bag as `variantAttrs` returns it — unset keys hold `undefined`. */
export type AxisAttrs = Record<string, string | undefined>;

export interface AxisMirror {
    /**
     * Called by the carrier part from its setup: publish a reader of its
     * axis attributes. The reader is called inside the mirroring part's
     * render, so the props it reads are tracked there. Returns the
     * unpublish, for the carrier's `onUnmounted` — a later publish replaces
     * an earlier one, and an unpublish only retracts its own.
     */
    publish(read: () => AxisAttrs): () => void;
    /** The attributes to spread on the mirroring part (reactive). */
    attrs(): AxisAttrs;
}

const NONE: AxisAttrs = {};

export function createAxisMirror(): AxisMirror {
    // The reader itself is not reactive state — a function in a signal
    // would be read as a value — so a version counter carries the change.
    let reader: (() => AxisAttrs) | null = null;
    const version = signal({ value: 0 });
    return {
        publish(read) {
            reader = read;
            version.value += 1;
            return () => {
                if (reader !== read) return;
                reader = null;
                version.value += 1;
            };
        },
        attrs() {
            void version.value;
            return reader ? reader() : NONE;
        },
    };
}

/** The mirror an out-of-root part gets from an inert context: nothing to copy. */
export const INERT_AXIS_MIRROR: AxisMirror = {
    publish: () => () => {},
    attrs: () => NONE,
};
