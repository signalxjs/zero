/**
 * Roving-focus keyboard navigation (WAI-ARIA APG list patterns).
 *
 * Arrow keys move focus through the enabled items in DOM order (Home/End
 * jump to the edges); the container keeps exactly one item tabbable. The
 * caller decides what "activate" means — Tabs selects on focus in automatic
 * mode, Menu highlights, Select moves `aria-activedescendant`.
 */
import { signal } from 'sigx';
import type { ListController, ListItem } from './list.js';
import type { Orientation } from '../contract/data-attrs.js';

export interface RovingOptions {
    list: ListController;
    orientation?: () => Orientation;
    /** Wrap from last to first (default true). */
    loop?: () => boolean;
    /** Right-to-left flips horizontal arrows. */
    rtl?: () => boolean;
    /** Called with the item the keyboard moved to. */
    onMove(item: ListItem): void;
}

const HORIZONTAL_KEYS = ['ArrowLeft', 'ArrowRight'];
const VERTICAL_KEYS = ['ArrowUp', 'ArrowDown'];

/**
 * Returns a keydown handler. `currentValue` identifies the item the event
 * fired on (usually the part's own `value`).
 */
export function createRovingKeydown(opts: RovingOptions): (e: KeyboardEvent, currentValue: string) => void {
    return (e, currentValue) => {
        const orientation = opts.orientation?.() ?? 'horizontal';
        const loop = opts.loop?.() ?? true;
        const rtl = opts.rtl?.() ?? false;
        const primary = orientation === 'horizontal' ? HORIZONTAL_KEYS : VERTICAL_KEYS;

        let delta = 0;
        let edge: 'first' | 'last' | null = null;

        if (e.key === primary[0]) delta = -1;
        else if (e.key === primary[1]) delta = 1;
        else if (e.key === 'Home') edge = 'first';
        else if (e.key === 'End') edge = 'last';
        else return;

        if (orientation === 'horizontal' && rtl && delta !== 0) delta = -delta;

        const items = opts.list.enabledItems();
        if (items.length === 0) return;

        e.preventDefault();

        let target: ListItem | undefined;
        if (edge) {
            target = edge === 'first' ? items[0] : items[items.length - 1];
        } else {
            const current = items.findIndex((i) => i.value === currentValue);
            let next = current === -1 ? (delta > 0 ? 0 : items.length - 1) : current + delta;
            if (next < 0) next = loop ? items.length - 1 : 0;
            if (next >= items.length) next = loop ? 0 : items.length - 1;
            target = items[next];
        }

        if (!target || target.value === currentValue) return;
        target.el()?.focus();
        opts.onMove(target);
    };
}

/**
 * The ONE tab stop of a roving group (#165): the first enabled item whose
 * value is selected, else the first enabled item — so a selection that names
 * nothing (a typo, a removed item) or only disabled items never leaves the
 * group unreachable by keyboard.
 *
 * Registration isn't reactive, and during the first render an item can only
 * see the items registered before it. Until the root settles, a selected
 * value that is not registered yet is taken to register later this pass —
 * the claim stands and nobody else takes the stop, or the first item would
 * briefly hold a second one. The root calls `settle()` once mounted (the
 * registry is complete), items call `changed()` on mount/unmount so a later
 * add or removal re-derives the stop, and `isTabStop` reads the reactive
 * version so every item recomputes.
 */
export interface RovingTabStop {
    /** From the root's `onMounted`: every first-render item has registered. */
    settle(): void;
    /** From an item's `onMounted`/`onUnmounted`: the registry changed. */
    changed(): void;
    /** Is `value` the group's tab stop, given the selected values? */
    isTabStop(value: string, selected: readonly string[]): boolean;
}

export function createRovingTabStop(list: ListController): RovingTabStop {
    const registry = signal({ settled: false, version: 0 });
    return {
        settle() {
            registry.settled = true;
            registry.version++;
        },
        changed() {
            if (registry.settled) registry.version++;
        },
        isTabStop(value, selected) {
            void registry.version;
            const enabled = list.enabledItems();
            if (selected.length > 0) {
                const hit = enabled.find((i) => selected.includes(i.value));
                if (hit) return hit.value === value;
                if (!registry.settled && selected.some((v) => !list.find(v))) return false;
            }
            return enabled[0]?.value === value;
        },
    };
}
