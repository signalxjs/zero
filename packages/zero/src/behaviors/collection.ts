/**
 * Collection — the DATA behind a listbox, and the source of truth for it.
 *
 * Items used to be DOM registrations: a label was read off the mounted
 * element, so a value chosen before its item existed had no label until a
 * microtask later, and nothing could filter because nothing held the list.
 * A collection holds the items as data — keys, labels, values, disabled
 * state and groups resolve from it before anything mounts — and JSX-written
 * items register INTO it, so both authoring modes are one list.
 *
 * Two identities per item, kept apart on purpose (#438):
 * - the KEY is the string identity — the DOM id, the typeahead target, and
 *   what a form posts (`itemKey`, default: a primitive's string form, or an
 *   object's `value`/`id`);
 * - the VALUE is what the model holds (`itemValue`, default: the item
 *   itself). A key model is `itemValue: (c) => c.code`; an object model
 *   omits it.
 *
 * DOM-free by design: on `@sigx/zero/behaviors/core`, the list controller
 * (`list-core.ts`) stays the element registry beside it.
 */
import { signal } from 'sigx';

export interface CollectionOptions<T, V = T> {
    /** The data items, read reactively. Absent → JSX mode (items register). */
    items?: () => ReadonlyArray<T> | undefined;
    /** String identity: DOM id, typeahead, form value. */
    itemKey?: (item: T) => string;
    /** Display text and typeahead text. */
    itemLabel?: (item: T) => string;
    /**
     * What the model holds for this item (default: the item). Return a
     * PRIMITIVE (a code, an id): a value is matched back to its item with
     * `Object.is`, and an object's identity does not survive a sigx model
     * (signals deep-proxy what they store). For an object model omit it —
     * the item itself is matched by KEY, which does survive.
     */
    itemValue?: (item: T) => V;
    itemDisabled?: (item: T) => boolean;
    /** Group heading; items sharing one render together, first-appearance order. */
    itemGroup?: (item: T) => string | undefined;
}

/** A JSX-written item, registered at setup. */
export interface CollectionEntry {
    key: string;
    label(): string;
    disabled(): boolean;
}

/** A run rendered together: one ungrouped item, or every item of one group. */
export interface CollectionSegment<T> {
    group?: string;
    items: T[];
}

export interface Collection<T = unknown, V = T> {
    /** `data` when `items` are supplied, else `jsx`. */
    mode(): 'data' | 'jsx';
    /** The data items, data order. Empty in JSX mode. */
    items(): ReadonlyArray<T>;
    /** Every key: data keys in data order, then JSX-registered keys in registration order. */
    keys(): string[];
    has(key: string): boolean;
    keyOf(item: T): string;
    labelOf(item: T): string;
    valueOf(item: T): V;
    groupOf(item: T): string | undefined;
    isItemDisabled(item: T): boolean;
    /** The data item for a key (JSX entries have no item). */
    byKey(key: string): T | undefined;
    /** The data item a model value stands for. */
    byValue(value: V): T | undefined;
    /** The key a model value posts as — through `itemValue` when given, else the value's own key. */
    keyForValue(value: V): string;
    /** The model value a key stands for — a data item's value, else the key itself. */
    valueForKey(key: string): V;
    /** Display text for a key: data, then the JSX registry, then the key. */
    label(key: string): string;
    isDisabled(key: string): boolean;
    /** The first-appearance grouping walk over the data items. */
    segments(): CollectionSegment<T>[];
    /** JSX mode: an item declares itself. Returns the unregister. */
    register(entry: CollectionEntry): () => void;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** The default key: a primitive's string form, or an object's `value` / `id`. */
export function defaultItemKey(item: unknown): string {
    if (isRecord(item)) {
        if (item.value != null) return String(item.value);
        if (item.id != null) return String(item.id);
    }
    return String(item);
}

/** The default label: an object's string `label`, else its key. */
export function defaultItemLabel(item: unknown, key: string): string {
    if (isRecord(item) && typeof item.label === 'string') return item.label;
    return key;
}

/**
 * Fold items into render segments, preserving first-appearance order: each
 * distinct group becomes one segment at the position its first member
 * appeared, collecting every later member (contiguous or not); ungrouped
 * items keep their own positions as single-item segments.
 */
export function segmentBy<T>(items: ReadonlyArray<T>, groupOf: (item: T) => string | undefined): CollectionSegment<T>[] {
    const segments: CollectionSegment<T>[] = [];
    const byGroup = new Map<string, CollectionSegment<T>>();
    for (const item of items) {
        const group = groupOf(item);
        if (group === undefined) {
            segments.push({ items: [item] });
            continue;
        }
        let segment = byGroup.get(group);
        if (!segment) {
            segment = { group, items: [] };
            byGroup.set(group, segment);
            segments.push(segment);
        }
        segment.items.push(item);
    }
    return segments;
}

export function createCollection<T, V = T>(opts: CollectionOptions<T, V> = {}): Collection<T, V> {
    // A key model's value IS a string identity: without an explicit itemKey,
    // the key is the value's string form rather than the object's fallback.
    const itemValueOpt = opts.itemValue;
    const keyOf = opts.itemKey ?? (itemValueOpt ? (item: T) => String(itemValueOpt(item)) : (item: T) => defaultItemKey(item));
    const labelOf = opts.itemLabel ?? ((item: T) => defaultItemLabel(item, keyOf(item)));
    const valueOf = opts.itemValue ?? ((item: T) => item as unknown as V);
    const isItemDisabled = opts.itemDisabled ?? ((item: T) => isRecord(item) && item.disabled === true);
    const groupOf = opts.itemGroup ?? ((item: T) => (isRecord(item) && typeof item.group === 'string' ? item.group : undefined));

    // The JSX registry is replaced, never mutated, so readers re-run. Each
    // registration gets a number: a signal deep-proxies what it stores, so
    // the entry read back is never identical to the one registered.
    let seq = 0;
    const registry = signal({ entries: [] as { id: number; entry: CollectionEntry }[] });

    const items = (): ReadonlyArray<T> => opts.items?.() ?? [];
    // The ACCESSOR decides the mode, not what it returns right now: a data
    // list that is still loading (undefined) is still a data list.
    const mode = (): 'data' | 'jsx' => (opts.items ? 'data' : 'jsx');
    const byKey = (key: string): T | undefined => items().find((item) => keyOf(item) === key);
    const entryFor = (key: string): CollectionEntry | undefined => registry.entries.find((e) => e.entry.key === key)?.entry;

    return {
        mode,
        items,
        keys: () => {
            const data = items().map(keyOf);
            const seen = new Set(data);
            for (const e of registry.entries) if (!seen.has(e.entry.key)) { seen.add(e.entry.key); data.push(e.entry.key); }
            return data;
        },
        has: (key) => byKey(key) !== undefined || entryFor(key) !== undefined,
        keyOf,
        labelOf,
        valueOf,
        groupOf,
        isItemDisabled,
        byKey,
        byValue: (value) => {
            // itemValue returns a primitive (see its doc), so identity is the match.
            if (opts.itemValue) return items().find((item) => Object.is(valueOf(item), value));
            // The value IS an item (or its key form); match on identity.
            const key = keyOf(value as unknown as T);
            return byKey(key);
        },
        keyForValue: (value) => {
            if (opts.itemValue) {
                const item = items().find((i) => Object.is(valueOf(i), value));
                // No item: a primitive is its own key; an object keys by
                // value/id rather than degrading to '[object Object]'.
                return item !== undefined ? keyOf(item) : defaultItemKey(value);
            }
            return keyOf(value as unknown as T);
        },
        valueForKey: (key) => {
            const item = byKey(key);
            return item !== undefined ? valueOf(item) : (key as unknown as V);
        },
        label: (key) => {
            const item = byKey(key);
            if (item !== undefined) return labelOf(item);
            return entryFor(key)?.label() ?? key;
        },
        isDisabled: (key) => {
            const item = byKey(key);
            if (item !== undefined) return isItemDisabled(item);
            return entryFor(key)?.disabled() ?? false;
        },
        segments: () => segmentBy(items(), groupOf),
        register: (entry) => {
            const id = ++seq;
            registry.entries = [...registry.entries, { id, entry }];
            return () => {
                registry.entries = registry.entries.filter((e) => e.id !== id);
            };
        },
    };
}
