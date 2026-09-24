/**
 * Typeahead over a list (WAI-ARIA APG menus/listboxes). Printable keys
 * accumulate into a buffer (1s window); the first enabled item whose text
 * starts with the buffer wins. The FIRST character searches from after the
 * current item (so a single letter pressed again once the 1s window has
 * lapsed steps through the matches — within the window "ss" is a two-letter
 * buffer); a longer buffer searches from the current item itself, so typing "sav"
 * refines "Save" instead of bouncing between "Save" and "Save As".
 *
 * Space activates, it does not search — unless a search is running, in which
 * case it continues it ("Save As"). A caller that routes Space to activation
 * asks `searching()` first and hands Space to the typeahead while it is true.
 */
import type { ListController, ListItem } from './list.js';

export interface TypeaheadOptions {
    list: ListController;
    onMatch(item: ListItem): void;
}

/** The keydown handler, plus whether a search is running (buffer live within the 1s window). */
export interface Typeahead {
    (e: KeyboardEvent, currentValue: string | null): void;
    searching(): boolean;
}

const WINDOW_MS = 1000;

export function createTypeahead(opts: TypeaheadOptions): Typeahead {
    let buffer = '';
    let lastTime = 0;

    const searching = (): boolean => buffer !== '' && Date.now() - lastTime <= WINDOW_MS;

    const run = (e: KeyboardEvent, currentValue: string | null): void => {
        if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
        // Expire a stale buffer BEFORE the Space guard: a leftover buffer
        // from minutes ago must not turn Space into a search.
        const now = Date.now();
        if (now - lastTime > WINDOW_MS) buffer = '';
        // Space activates, it does not search — unless a search is running.
        if (e.key === ' ' && buffer === '') return;
        lastTime = now;
        buffer += e.key.toLowerCase();

        const items = opts.list.enabledItems();
        if (items.length === 0) return;
        const at = currentValue == null ? -1 : items.findIndex((i) => i.value === currentValue);
        // One character steps past the current item; more refine it in place.
        let start = 0;
        if (at >= 0) start = buffer.length === 1 ? at + 1 : at;
        const rotated = [...items.slice(start), ...items.slice(0, start)];
        const match = rotated.find((i) => i.textValue().toLowerCase().startsWith(buffer));
        if (match) {
            e.preventDefault();
            opts.onMatch(match);
        } else if (e.key === ' ') {
            // A Space that continued a search is still the search's key —
            // never let it fall through to page scroll or activation.
            e.preventDefault();
        }
    };
    return Object.assign(run, { searching });
}
