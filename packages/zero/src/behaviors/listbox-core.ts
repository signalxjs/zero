/**
 * Listbox core — selection, visibility and highlight over a collection.
 *
 * The one layer Select and Combobox never had: both drove a highlight, a
 * selection and an option-id scheme from their own keyboard handlers, 426
 * identical lines apart. This is that layer, written once, DOM-free (on
 * `@sigx/zero/behaviors/core`); the web view (`listbox.ts`) adds typeahead,
 * scroll-into-view and the option bag.
 *
 * Keys are the working currency (the collection's string identities); the
 * MODEL holds values (`Collection.valueForKey` / `keyForValue` translate),
 * so a key model and an object model drive the same core.
 */
import { signal } from 'sigx';
import type { Collection } from './collection.js';
import type { HighlightStep, ListController } from './list-core.js';

export interface ListboxOptions<T> {
    collection: Collection<T, unknown>;
    /**
     * The selection model: one value, or an array of values under `multiple`.
     * Structural on purpose — a `Model<string>` or `Model<Country[]>` both
     * fit (only `.value` is read and written here).
     */
    selection: { value: unknown };
    multiple?: () => boolean;
    /** The element registry — DOM order for JSX-mode keys, elements for scrolling. */
    list?: ListController;
    /** Option ids are `${idBase}-option-${key}`. */
    idBase: string;
    /** The filter query (Combobox's input text). */
    query?: () => string;
    /**
     * Data-mode visibility: the default is a case-insensitive contains-match
     * on the label; a function replaces it; `false` shows every item (a
     * server-filtered list). JSX mode is always consumer-filtered — what is
     * rendered is what is visible.
     */
    filter?: false | ((item: T, query: string) => boolean);
    /**
     * The single-select "nothing chosen" value, written by `clear()` and
     * read as empty. Defaults to `''` (a key model's empty); a data-driven
     * root PASSES `null` — nothing infers it. Nullish, this value AND `''`
     * read as empty under any sentinel: `''` is reserved in single mode, so
     * an item whose model value is `''` can never be selected there — the
     * roots refuse such an item at render rather than let it sit unpickable.
     */
    emptyValue?: unknown;
    /** After a selection lands (Select closes; Combobox closes and fills its input). */
    onSelect?: (key: string) => void;
}

export interface ListboxCore<T> {
    highlighted: { value: string | null };
    multiple(): boolean;
    /** Visible keys in order: data order in data mode, DOM order in JSX mode. */
    visibleKeys(): string[];
    visibleItems(): T[];
    isVisible(key: string): boolean;
    isEmpty(): boolean;
    selectedKeys(): string[];
    isSelected(key: string): boolean;
    /** Single: replace; multiple: toggle membership. */
    select(key: string): void;
    clear(): void;
    /** The selected labels, joined — what a Select.Value shows. */
    displayText(): string;
    move(step: HighlightStep): void;
    highlightSelectedOrFirst(): void;
    /** Clear the highlight when the highlighted item goes away (filtering). */
    pruneHighlight(key: string): void;
    optionId(key: string): string;
    activeDescendant(open: boolean): string | undefined;
}

export function defaultFilter<T>(collection: Collection<T, unknown>): (item: T, query: string) => boolean {
    return (item, query) => collection.labelOf(item).toLowerCase().includes(query.toLowerCase());
}

/** One step through `keys`: relative steps clamp at the edges (APG listbox: no wrap). */
export function stepKeys(keys: readonly string[], current: string | null, step: HighlightStep): string | null {
    if (keys.length === 0) return null;
    if (step === 'first') return keys[0]!;
    if (step === 'last') return keys[keys.length - 1]!;
    const index = current === null ? -1 : keys.indexOf(current);
    const next = Math.min(keys.length - 1, Math.max(0, index === -1 ? 0 : index + step));
    return keys[next]!;
}

export function createListboxCore<T>(opts: ListboxOptions<T>): ListboxCore<T> {
    const { collection, selection } = opts;
    const multiple = (): boolean => opts.multiple?.() ?? false;
    // `undefined` means the default; `null` is a real sentinel, so no `??`.
    const emptyValue = opts.emptyValue === undefined ? '' : opts.emptyValue;
    const highlighted = signal({ value: null as string | null });

    const visibleItems = (): T[] => {
        const query = opts.query?.() ?? '';
        const filter = opts.filter === false ? null : (opts.filter ?? defaultFilter(collection));
        const items = collection.items();
        if (!filter || query === '') return [...items];
        return items.filter((item) => filter(item, query));
    };

    const visibleKeys = (): string[] => {
        if (collection.mode() === 'data') return visibleItems().map((item) => collection.keyOf(item));
        // JSX mode: the rendered items, in DOM order when the registry knows it.
        const registered = collection.keys();
        if (!opts.list) return registered;
        const known = new Set(registered);
        const ordered = opts.list.items().map((i) => i.value).filter((k) => known.has(k));
        const placed = new Set(ordered);
        for (const k of registered) if (!placed.has(k)) ordered.push(k);
        return ordered;
    };

    const enabledVisibleKeys = (): string[] => visibleKeys().filter((k) => !collection.isDisabled(k));

    const selectedKeys = (): string[] => {
        const v = selection.value;
        if (multiple()) return Array.isArray(v) ? v.map((x) => collection.keyForValue(x)) : [];
        // Empty is nullish, the configured sentinel, or '' under any sentinel:
        // '' is reserved as the single-select empty sentinel for every model
        // shape, a string value model included (no item may carry the '' key
        // in single mode), so a `signal({ code: '' })` has nothing selected.
        if (v === undefined || v === null || v === '' || Object.is(v, emptyValue)) return [];
        return [collection.keyForValue(v)];
    };

    const select = (key: string): void => {
        // The core keeps the invariant the bag and the highlight step keep:
        // a disabled option is never selected, however the call arrived.
        if (collection.isDisabled(key)) return;
        if (multiple()) {
            // Toggle ONE entry and keep the rest as they are: a value whose
            // item is not in the collection right now (paged or async data)
            // must not be round-tripped into a key string.
            const current = Array.isArray(selection.value) ? selection.value : [];
            const keys = current.map((x) => collection.keyForValue(x));
            selection.value = keys.includes(key)
                ? current.filter((_, i) => keys[i] !== key)
                : [...current, collection.valueForKey(key)];
        } else {
            selection.value = collection.valueForKey(key);
        }
        opts.onSelect?.(key);
    };

    return {
        highlighted,
        multiple,
        visibleKeys,
        visibleItems,
        isVisible: (key) => visibleKeys().includes(key),
        isEmpty: () => visibleKeys().length === 0,
        selectedKeys,
        isSelected: (key) => selectedKeys().includes(key),
        select,
        clear: () => { selection.value = multiple() ? [] : emptyValue; },
        displayText: () => selectedKeys().map((k) => collection.label(k)).join(', '),
        move: (step) => { highlighted.value = stepKeys(enabledVisibleKeys(), highlighted.value, step); },
        highlightSelectedOrFirst: () => {
            const visible = enabledVisibleKeys();
            const selected = selectedKeys().find((k) => visible.includes(k));
            highlighted.value = selected ?? visible[0] ?? null;
        },
        pruneHighlight: (key) => { if (highlighted.value === key) highlighted.value = null; },
        optionId: (key) => `${opts.idBase}-option-${key}`,
        // Never name a key that filtering has hidden — a dangling reference is
        // invalid ARIA (the item's unmount prunes it, but a data-mode filter
        // change can precede the unmount).
        activeDescendant: (open) => {
            const key = highlighted.value;
            return open && key !== null && visibleKeys().includes(key) ? `${opts.idBase}-option-${key}` : undefined;
        },
    };
}
