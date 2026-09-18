/**
 * First-character typeahead over a list (WAI-ARIA APG menus/listboxes).
 * Printable keys accumulate into a buffer (1s window); the first enabled
 * item whose text starts with the buffer — searching from after the current
 * item — wins.
 */
import type { ListController, ListItem } from './list.js';

export interface TypeaheadOptions {
    list: ListController;
    onMatch(item: ListItem): void;
}

export function createTypeahead(opts: TypeaheadOptions): (e: KeyboardEvent, currentValue: string | null) => void {
    let buffer = '';
    let lastTime = 0;

    return (e, currentValue) => {
        if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
        // Space activates, it does not search — unless a search is running.
        if (e.key === ' ' && buffer === '') return;

        const now = Date.now();
        if (now - lastTime > 1000) buffer = '';
        lastTime = now;
        buffer += e.key.toLowerCase();

        const items = opts.list.enabledItems();
        if (items.length === 0) return;
        const start = currentValue == null ? 0 : items.findIndex((i) => i.value === currentValue) + 1;
        const rotated = [...items.slice(start), ...items.slice(0, start)];
        const match = rotated.find((i) => i.textValue().toLowerCase().startsWith(buffer));
        if (match) {
            e.preventDefault();
            opts.onMatch(match);
        }
    };
}
