/**
 * The web view of the listbox core: typeahead over the visible labels,
 * scroll-into-view for a keyboard highlight (aria-activedescendant moves no
 * real focus, so nothing scrolls natively), the option bag a Select.Item /
 * Combobox.Item spreads, and the presence-tracked group label. Everything
 * in `listbox-core.ts` is here too, so web components import from here.
 */
import { watch } from 'sigx';
import type { Collection, CollectionEntry } from './collection.js';
import { createListboxCore, type ListboxCore, type ListboxOptions } from './listbox-core.js';
import type { HighlightStep, ListController, ListItem } from './list.js';
import { optionText } from './list.js';
import { createTypeahead } from './typeahead.js';
import { dataAttr } from '../contract/data-attrs.js';
import type { PartProps } from '../contract/props.js';

export type { ListboxCore, ListboxOptions } from './listbox-core.js';
export { createListboxCore, defaultFilter, stepKeys } from './listbox-core.js';

/** The core's options with the element registry pinned to the web's `HTMLElement` controller. */
export interface WebListboxOptions<T> extends Omit<ListboxOptions<T>, 'list'> {
    list?: ListController;
}

export interface Listbox<T> extends ListboxCore<T> {
    /** First-character typeahead over the ENABLED VISIBLE labels. */
    typeahead(e: KeyboardEvent, current: string | null, onMatch: (key: string) => void): void;
}

/** A `ListController` view of the listbox's enabled visible keys, for the shared typeahead. */
function keysAsList<T>(core: ListboxCore<T>, collection: Collection<T, unknown>, list: ListController | undefined): ListController {
    const toItem = (key: string): ListItem => ({
        id: key,
        value: key,
        disabled: () => collection.isDisabled(key),
        el: () => list?.find(key)?.el() ?? null,
        textValue: () => collection.label(key),
    });
    return {
        register: () => () => {},
        items: () => core.visibleKeys().map(toItem),
        enabledItems: () => core.visibleKeys().filter((k) => !collection.isDisabled(k)).map(toItem),
        find: (key) => (core.isVisible(key) ? toItem(key) : undefined),
    };
}

export function createListbox<T>(opts: WebListboxOptions<T>): Listbox<T> {
    const core = createListboxCore(opts);
    const view = keysAsList(core, opts.collection, opts.list);

    // The shared typeahead wants a fixed onMatch; ours is per call (Select
    // selects when closed, highlights when open), so the match is relayed.
    let relay: ((key: string) => void) | null = null;
    const run = createTypeahead({ list: view, onMatch: (item) => relay?.(item.value) });

    if (opts.list) {
        const list = opts.list;
        watch(
            () => core.highlighted.value,
            (key) => {
                if (key == null) return;
                list.find(key)?.el()?.scrollIntoView?.({ block: 'nearest' });
            },
        );
    }

    return {
        ...core,
        typeahead: (e, current, onMatch) => {
            relay = onMatch;
            try {
                run(e, current);
            } finally {
                relay = null;
            }
        },
    };
}

// ── The option, as a part core ──

export interface ListboxItemOptions<T> {
    listbox: ListboxCore<T>;
    collection: Collection<T, unknown>;
    /** The element registry (DOM order, scrolling); the item registers there too. */
    list?: ListController;
    scope: string;
    key: () => string;
    /** Explicit label text; else the element's text (minus the indicator), else the key. */
    textValue?: () => string | undefined;
    disabled: () => boolean;
    getEl: () => HTMLElement | null;
    /** Runs after a pointer selection (Combobox refocuses its input). */
    afterSelect?: () => void;
}

export interface ListboxItem {
    /** The `role="option"` attribute bag: ids, flags, ARIA, pointer handlers. */
    bag(): PartProps;
    isSelected(): boolean;
    isHighlighted(): boolean;
    /** Unregister from the collection and the element registry. */
    unregister(): void;
}

/**
 * What every Select.Item / Combobox.Item does: register into the collection
 * (label, disabled) and the element registry (order, scrolling), and
 * render the option bag. Press feedback stays with the part — it needs the
 * element and the part's own disabled rule.
 */
export function createListboxItem<T>(opts: ListboxItemOptions<T>): ListboxItem {
    const { listbox, collection, scope } = opts;
    const key = opts.key;
    const label = (): string => opts.textValue?.() ?? optionText(opts.getEl()) ?? key();

    const entry: CollectionEntry = { get key() { return key(); }, label, disabled: opts.disabled };
    const unregisterCollection = collection.register(entry);
    const item: ListItem = {
        id: listbox.optionId(key()),
        get value() { return key(); },
        disabled: opts.disabled,
        el: opts.getEl,
        textValue: label,
    };
    const unregisterList = opts.list?.register(item) ?? (() => {});

    const isSelected = (): boolean => listbox.isSelected(key());
    const isHighlighted = (): boolean => listbox.highlighted.value === key();

    return {
        isSelected,
        isHighlighted,
        unregister: () => {
            unregisterCollection();
            unregisterList();
            listbox.pruneHighlight(key());
        },
        bag: () => ({
            id: listbox.optionId(key()),
            'data-scope': scope,
            'data-part': 'item',
            'data-selected': dataAttr(isSelected()),
            'data-highlighted': dataAttr(isHighlighted()),
            'data-disabled': dataAttr(opts.disabled()),
            role: 'option',
            'aria-selected': isSelected() ? 'true' : 'false',
            'aria-disabled': opts.disabled() ? 'true' : undefined,
            onClick: () => {
                if (opts.disabled()) return;
                listbox.select(key());
                opts.afterSelect?.();
            },
            onPointerenter: () => {
                if (!opts.disabled()) listbox.highlighted.value = key();
            },
        }),
    };
}

// ── The group label, presence-tracked ──

export interface GroupPresence {
    labelId: string;
    labelPresent(): boolean;
    setLabelPresent(present: boolean): void;
}

/**
 * The optgroup equivalent's naming: `role="group"` is named by its label
 * only while one is rendered — an unlabelled group stays anonymous rather
 * than dangling an `aria-labelledby`. The label announces itself one
 * microtask after setup (a write made during the render pass is invisible
 * to the already-rendered group) and withdraws on unmount.
 */
export function createGroupPresence(labelId: string, present: { label: boolean }): GroupPresence {
    return {
        labelId,
        labelPresent: () => present.label,
        setLabelPresent: (p) => { present.label = p; },
    };
}

/** The label's side: announce after the render pass, withdraw on unmount. Returns the unmount hook. */
export function announceGroupLabel(group: GroupPresence): () => void {
    let alive = true;
    queueMicrotask(() => { if (alive) group.setLabelPresent(true); });
    return () => {
        alive = false;
        group.setLabelPresent(false);
    };
}

export type { HighlightStep };
