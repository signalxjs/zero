import { describe, it, expect, vi } from 'vitest';
import { signal } from 'sigx';
import { createModel } from '@sigx/runtime-core';
import {
    createCollection, createListbox, createListboxCore, createListboxItem, createListController,
    createGroupPresence, announceGroupLabel, stepKeys,
} from '@sigx/zero';
import type { Collection, ListItem } from '@sigx/zero';

interface Fruit { value: string; label: string; disabled?: boolean }
const FRUITS: Fruit[] = [
    { value: 'apple', label: 'Apple' },
    { value: 'banana', label: 'Banana' },
    { value: 'cherry', label: 'Cherry', disabled: true },
    { value: 'date', label: 'Date' },
];

function model<T>(initial: T) {
    const backing = signal({ v: initial });
    return { backing, m: createModel<T>([backing, 'v'], (v) => { backing.v = v; }) };
}

const fruits = (): Collection<Fruit, unknown> => createCollection<Fruit>({ items: () => FRUITS });

describe('createListboxCore — visibility', () => {
    it('data mode: the default filter is a contains-match on the label', () => {
        const query = signal({ q: '' });
        const lb = createListboxCore({ collection: fruits(), selection: model('').m, idBase: 'x', query: () => query.q });
        expect(lb.visibleKeys()).toEqual(['apple', 'banana', 'cherry', 'date']);
        query.q = 'AN';
        expect(lb.visibleKeys()).toEqual(['banana']);
        expect(lb.isEmpty()).toBe(false);
        query.q = 'zzz';
        expect(lb.isEmpty()).toBe(true);
    });

    it('filter: false shows everything (a server-filtered list); a function replaces the default', () => {
        const q = signal({ q: 'e' });
        const all = createListboxCore({ collection: fruits(), selection: model('').m, idBase: 'x', query: () => q.q, filter: false });
        expect(all.visibleKeys()).toHaveLength(4);
        const starts = createListboxCore({
            collection: fruits(), selection: model('').m, idBase: 'x', query: () => q.q,
            filter: (item, query) => item.label.toLowerCase().startsWith(query),
        });
        expect(starts.visibleKeys()).toEqual([]);
        q.q = 'd';
        expect(starts.visibleKeys()).toEqual(['date']);
    });

    it('JSX mode: what is registered is visible, in the element registry\'s DOM order', () => {
        const c = createCollection<string>();
        const list = createListController();
        const host = document.createElement('div');
        document.body.appendChild(host);
        const els = ['b', 'a'].map((k) => { const el = document.createElement('div'); host.appendChild(el); return el; });
        const item = (key: string, el: HTMLElement): ListItem => ({ id: key, value: key, disabled: () => false, el: () => el, textValue: () => key });
        // Registered a then b; rendered b before a.
        c.register({ key: 'a', label: () => 'A', disabled: () => false });
        c.register({ key: 'b', label: () => 'B', disabled: () => false });
        list.register(item('a', els[1]!));
        list.register(item('b', els[0]!));
        const lb = createListboxCore({ collection: c, selection: model('').m, idBase: 'x', list, query: () => 'zzz' });
        // No query filtering in JSX mode — the consumer renders the match.
        expect(lb.visibleKeys()).toEqual(['b', 'a']);
        host.remove();
    });
});

describe('createListboxCore — selection', () => {
    it('single: select replaces the model value and reports the key', () => {
        const { backing, m } = model('');
        const onSelect = vi.fn();
        const lb = createListboxCore({ collection: fruits(), selection: m, idBase: 'x', onSelect });
        lb.select('banana');
        // Object model by default: the value is the item (read back through
        // the signal's proxy, so structural equality is the right check).
        expect(backing.v).toEqual(FRUITS[1]);
        expect(lb.selectedKeys()).toEqual(['banana']);
        expect(lb.isSelected('banana')).toBe(true);
        expect(onSelect).toHaveBeenCalledWith('banana');
        expect(lb.displayText()).toBe('Banana');
        lb.clear();
        expect(backing.v).toBe('');
        expect(lb.selectedKeys()).toEqual([]);
    });

    it('key model: itemValue makes the model a string', () => {
        const { backing, m } = model('');
        const c = createCollection<Fruit, string>({ items: () => FRUITS, itemValue: (f) => f.value });
        const lb = createListboxCore({ collection: c, selection: m, idBase: 'x' });
        lb.select('date');
        expect(backing.v).toBe('date');
        expect(lb.displayText()).toBe('Date');
    });

    it('multiple: select toggles membership; clear empties', () => {
        const { backing, m } = model<string[]>([]);
        const c = createCollection<Fruit, string>({ items: () => FRUITS, itemValue: (f) => f.value });
        const lb = createListboxCore({ collection: c, selection: m, idBase: 'x', multiple: () => true });
        lb.select('apple');
        lb.select('date');
        expect(backing.v).toEqual(['apple', 'date']);
        expect(lb.displayText()).toBe('Apple, Date');
        lb.select('apple');
        expect(backing.v).toEqual(['date']);
        lb.clear();
        expect(backing.v).toEqual([]);
    });

    it('multiple: toggling one key leaves values the collection cannot resolve untouched', () => {
        const paged = { value: 'zeta', label: 'Zeta (not loaded)' };
        const { backing, m } = model<unknown[]>([paged]);
        const lb = createListboxCore({ collection: fruits(), selection: m, idBase: 'x', multiple: () => true });
        lb.select('apple');
        expect(backing.v).toEqual([paged, FRUITS[0]]);
        lb.select('apple');
        expect(backing.v).toEqual([paged]);
    });

    it('JSX mode with no items: the value is the key', () => {
        const { backing, m } = model('');
        const c = createCollection<string>();
        c.register({ key: 'x', label: () => 'X', disabled: () => false });
        const lb = createListboxCore({ collection: c, selection: m, idBase: 'x' });
        lb.select('x');
        expect(backing.v).toBe('x');
        expect(lb.displayText()).toBe('X');
    });

    it('a disabled key is never selected, however the call arrived', () => {
        const { backing, m } = model('');
        const onSelect = vi.fn();
        const lb = createListboxCore({ collection: fruits(), selection: m, idBase: 'x', onSelect });
        lb.select('cherry');
        expect(backing.v).toBe('');
        expect(lb.selectedKeys()).toEqual([]);
        expect(onSelect).not.toHaveBeenCalled();
    });

    it('emptyValue is the single-select sentinel: read as empty, written by clear()', () => {
        const { backing, m } = model<unknown>(null);
        const lb = createListboxCore({ collection: fruits(), selection: m, idBase: 'x', emptyValue: null });
        expect(lb.selectedKeys()).toEqual([]);
        expect(lb.displayText()).toBe('');
        lb.select('apple');
        expect(lb.selectedKeys()).toEqual(['apple']);
        lb.clear();
        expect(backing.v).toBeNull();
        expect(lb.selectedKeys()).toEqual([]);
    });

    it("'' reads as empty under ANY single-select sentinel (it is the reserved key); under multiple it is a real key", () => {
        const c = createCollection<{ value: string; label: string }, string>({
            items: () => [{ value: '', label: 'None' }, { value: 'a', label: 'A' }],
            itemValue: (i) => i.value,
        });
        const single = createListboxCore({ collection: c, selection: model<unknown>('').m, idBase: 'x', emptyValue: null });
        expect(single.selectedKeys()).toEqual([]);
        expect(single.displayText()).toBe('');
        const multi = createListboxCore({ collection: c, selection: model<unknown>(['']).m, idBase: 'y', multiple: () => true });
        expect(multi.selectedKeys()).toEqual(['']);
        expect(multi.displayText()).toBe('None');
    });

    it('a preset object model resolves its key before anything mounts', () => {
        const { m } = model<unknown>(FRUITS[3]);
        const lb = createListboxCore({ collection: fruits(), selection: m, idBase: 'x' });
        expect(lb.selectedKeys()).toEqual(['date']);
        expect(lb.displayText()).toBe('Date');
    });
});

describe('createListboxCore — highlight', () => {
    it('steps over enabled visible keys, clamping at the edges, and skips disabled', () => {
        const lb = createListboxCore({ collection: fruits(), selection: model('').m, idBase: 'x' });
        lb.move('first');
        expect(lb.highlighted.value).toBe('apple');
        lb.move(1); lb.move(1);
        // cherry is disabled — skipped
        expect(lb.highlighted.value).toBe('date');
        lb.move(1);
        expect(lb.highlighted.value).toBe('date');
        lb.move('last');
        expect(lb.highlighted.value).toBe('date');
        lb.move(-1);
        expect(lb.highlighted.value).toBe('banana');
    });

    it('highlightSelectedOrFirst prefers a visible selection; prune clears a vanished key', () => {
        const q = signal({ q: '' });
        const { m } = model<unknown>(FRUITS[1]);
        const lb = createListboxCore({ collection: fruits(), selection: m, idBase: 'x', query: () => q.q });
        lb.highlightSelectedOrFirst();
        expect(lb.highlighted.value).toBe('banana');
        q.q = 'd';
        lb.highlightSelectedOrFirst();
        expect(lb.highlighted.value).toBe('date');
        // A filter change that hides the highlighted key drops the reference
        // before any item unmounts.
        q.q = 'apple';
        expect(lb.highlighted.value).toBe('date');
        expect(lb.activeDescendant(true)).toBeUndefined();
        q.q = 'd';
        expect(lb.activeDescendant(true)).toBe('x-option-date');
        lb.pruneHighlight('date');
        expect(lb.highlighted.value).toBeNull();
        expect(lb.activeDescendant(true)).toBeUndefined();
        lb.move('first');
        expect(lb.optionId('date')).toBe('x-option-date');
        expect(lb.activeDescendant(true)).toBe('x-option-date');
        expect(lb.activeDescendant(false)).toBeUndefined();
    });

    it('stepKeys is the pure step', () => {
        expect(stepKeys(['a', 'b'], null, 1)).toBe('a');
        expect(stepKeys(['a', 'b'], 'a', 1)).toBe('b');
        expect(stepKeys(['a', 'b'], 'b', 1)).toBe('b');
        expect(stepKeys([], null, 'first')).toBeNull();
    });
});

describe('createListbox (web)', () => {
    const key = (k: string) => new KeyboardEvent('keydown', { key: k, cancelable: true });

    it('typeahead matches the visible labels, from after the current key, skipping disabled', () => {
        // The typeahead buffer accumulates for a second; step the clock past it.
        vi.useFakeTimers();
        const q = signal({ q: '' });
        const lb = createListbox({ collection: fruits(), selection: model('').m, idBase: 'x', query: () => q.q });
        const matches: string[] = [];
        lb.typeahead(key('d'), null, (k) => matches.push(k));
        expect(matches).toEqual(['date']);
        vi.advanceTimersByTime(1100);
        lb.typeahead(key('c'), null, (k) => matches.push(k));
        // cherry is disabled — no match
        expect(matches).toEqual(['date']);
        vi.advanceTimersByTime(1100);
        q.q = 'an';
        lb.typeahead(key('a'), null, (k) => matches.push(k));
        // Only "Banana" is visible; "Apple" is filtered out.
        expect(matches).toEqual(['date']);
        vi.advanceTimersByTime(1100);
        lb.typeahead(key('b'), null, (k) => matches.push(k));
        expect(matches).toEqual(['date', 'banana']);
        vi.useRealTimers();
    });

    it('a keyboard highlight scrolls its element into view', () => {
        const list = createListController();
        const el = document.createElement('div');
        document.body.appendChild(el);
        const scroll = vi.fn();
        (el as HTMLElement & { scrollIntoView: unknown }).scrollIntoView = scroll;
        list.register({ id: 'banana', value: 'banana', disabled: () => false, el: () => el, textValue: () => 'Banana' });
        const lb = createListbox({ collection: fruits(), selection: model('').m, idBase: 'x', list });
        lb.highlighted.value = 'banana';
        expect(scroll).toHaveBeenCalledWith({ block: 'nearest' });
        el.remove();
    });
});

describe('createListboxItem', () => {
    it('registers into the collection and the element registry, renders the option bag, selects on click', () => {
        const c = createCollection<string>();
        const list = createListController();
        const { backing, m } = model('');
        const lb = createListboxCore({ collection: c, selection: m, idBase: 'sel', list });
        const el = document.createElement('div');
        el.textContent = 'Apple';
        const after = vi.fn();
        const item = createListboxItem({
            listbox: lb, collection: c, list, scope: 'select',
            key: () => 'apple', disabled: () => false, getEl: () => el, afterSelect: after,
        });
        expect(c.keys()).toEqual(['apple']);
        expect(c.label('apple')).toBe('Apple');
        expect(list.find('apple')?.textValue()).toBe('Apple');

        const bag = item.bag();
        expect(bag.id).toBe('sel-option-apple');
        expect(bag.role).toBe('option');
        expect(bag['aria-selected']).toBe('false');
        expect(bag['data-part']).toBe('item');

        (bag.onPointerenter as () => void)();
        expect(lb.highlighted.value).toBe('apple');
        (bag.onClick as () => void)();
        expect(backing.v).toBe('apple');
        expect(after).toHaveBeenCalled();
        expect(item.bag()['aria-selected']).toBe('true');
        expect(item.bag()['data-selected']).toBe('');

        item.unregister();
        expect(c.keys()).toEqual([]);
        expect(list.find('apple')).toBeUndefined();
        expect(lb.highlighted.value).toBeNull();
    });

    it('a disabled item neither selects nor highlights', () => {
        const c = createCollection<string>();
        const { backing, m } = model('');
        const lb = createListboxCore({ collection: c, selection: m, idBase: 'sel' });
        const item = createListboxItem({ listbox: lb, collection: c, scope: 'select', key: () => 'x', disabled: () => true, getEl: () => null });
        const bag = item.bag();
        expect(bag['aria-disabled']).toBe('true');
        (bag.onClick as () => void)();
        (bag.onPointerenter as () => void)();
        expect(backing.v).toBe('');
        expect(lb.highlighted.value).toBeNull();
    });
});

describe('group presence', () => {
    it('the label names the group only while rendered, announced after the render pass', async () => {
        const present = signal({ label: false });
        const group = createGroupPresence('g-label', present);
        expect(group.labelPresent()).toBe(false);
        const withdraw = announceGroupLabel(group);
        expect(group.labelPresent()).toBe(false);
        await Promise.resolve();
        expect(group.labelPresent()).toBe(true);
        withdraw();
        expect(group.labelPresent()).toBe(false);
    });
});
