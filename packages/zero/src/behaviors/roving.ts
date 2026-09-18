/**
 * Roving-focus keyboard navigation (WAI-ARIA APG list patterns).
 *
 * Arrow keys move focus through the enabled items in DOM order (Home/End
 * jump to the edges); the container keeps exactly one item tabbable. The
 * caller decides what "activate" means — Tabs selects on focus in automatic
 * mode, Menu highlights, Select moves `aria-activedescendant`.
 */
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
