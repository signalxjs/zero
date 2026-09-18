import { describe, it, expect } from 'vitest';
import { signal } from 'sigx';
import { createCollection, segmentBy } from '@sigx/zero';

interface Country { code: string; name: string; region?: string; off?: boolean }
const COUNTRIES: Country[] = [
    { code: 'se', name: 'Sweden', region: 'Nordics' },
    { code: 'jp', name: 'Japan', region: 'Asia' },
    { code: 'no', name: 'Norway', region: 'Nordics' },
    { code: 'ch', name: 'Switzerland' },
    { code: 'kr', name: 'Korea', region: 'Asia', off: true },
];

describe('createCollection — data mode', () => {
    it('primitive items: key, label and value are the item itself', () => {
        const c = createCollection<string>({ items: () => ['apple', 'banana'] });
        expect(c.mode()).toBe('data');
        expect(c.keys()).toEqual(['apple', 'banana']);
        expect(c.label('banana')).toBe('banana');
        expect(c.valueForKey('banana')).toBe('banana');
        expect(c.keyForValue('apple')).toBe('apple');
        expect(c.byValue('apple')).toBe('apple');
    });

    it('the { value, label?, disabled?, group? } shape works untouched', () => {
        const c = createCollection({ items: () => [
            { value: 'lemon', label: 'Lemon', group: 'Citrus' },
            { value: 'durian', label: 'Durian', disabled: true },
            { value: 'lime' },
        ] });
        expect(c.keys()).toEqual(['lemon', 'durian', 'lime']);
        expect(c.label('lemon')).toBe('Lemon');
        expect(c.label('lime')).toBe('lime');
        expect(c.isDisabled('durian')).toBe(true);
        expect(c.isDisabled('lime')).toBe(false);
        expect(c.segments().map((s) => [s.group, s.items.map((i) => i.value)])).toEqual([
            ['Citrus', ['lemon']], [undefined, ['durian']], [undefined, ['lime']],
        ]);
    });

    it('object model: the value IS the item; accessors name key, label, group, disabled', () => {
        const c = createCollection<Country>({
            items: () => COUNTRIES,
            itemKey: (x) => x.code,
            itemLabel: (x) => x.name,
            itemGroup: (x) => x.region,
            itemDisabled: (x) => !!x.off,
        });
        expect(c.keys()).toEqual(['se', 'jp', 'no', 'ch', 'kr']);
        expect(c.label('jp')).toBe('Japan');
        expect(c.isDisabled('kr')).toBe(true);
        // The model holds the item; a key resolves to it and back.
        expect(c.valueForKey('se')).toBe(COUNTRIES[0]);
        expect(c.keyForValue(COUNTRIES[1]!)).toBe('jp');
        expect(c.byValue(COUNTRIES[2]!)).toBe(COUNTRIES[2]);
        // Grouping walks first-appearance: Nordics collects Norway later.
        expect(c.segments().map((s) => [s.group, s.items.map((i) => i.code)])).toEqual([
            ['Nordics', ['se', 'no']], ['Asia', ['jp', 'kr']], [undefined, ['ch']],
        ]);
    });

    it('key model: itemValue decides what the model holds, keyForValue finds the key', () => {
        const c = createCollection<Country, string>({
            items: () => COUNTRIES,
            itemKey: (x) => x.code.toUpperCase(),
            itemValue: (x) => x.code,
            itemLabel: (x) => x.name,
        });
        expect(c.valueForKey('SE')).toBe('se');
        expect(c.keyForValue('jp')).toBe('JP');
        expect(c.byValue('no')?.name).toBe('Norway');
        // A value with no item posts as itself; an object with no item keys
        // by its value/id rather than '[object Object]'.
        expect(c.keyForValue('zz')).toBe('zz');
        expect(c.keyForValue({ id: 7 } as unknown as string)).toBe('7');
    });

    it('labels resolve from data before anything mounts — no microtask', () => {
        const c = createCollection<Country>({ items: () => COUNTRIES, itemKey: (x) => x.code, itemLabel: (x) => x.name });
        expect(c.label('ch')).toBe('Switzerland');
        expect(c.label('nope')).toBe('nope');
    });

    it('a data list that is still loading is still a data list', () => {
        const state = signal({ list: undefined as string[] | undefined });
        const c = createCollection<string>({ items: () => state.list });
        expect(c.mode()).toBe('data');
        expect(c.keys()).toEqual([]);
        state.list = ['a'];
        expect(c.keys()).toEqual(['a']);
    });

    it('items are read reactively', () => {
        const state = signal({ list: ['a'] as string[] });
        const c = createCollection<string>({ items: () => state.list });
        expect(c.keys()).toEqual(['a']);
        state.list = ['a', 'b'];
        expect(c.keys()).toEqual(['a', 'b']);
        expect(c.has('b')).toBe(true);
    });
});

describe('createCollection — JSX mode', () => {
    it('items register themselves; labels and disabled come from the entries', () => {
        const c = createCollection<string>();
        expect(c.mode()).toBe('jsx');
        const un = c.register({ key: 'apple', label: () => 'Apple', disabled: () => false });
        c.register({ key: 'durian', label: () => 'Durian', disabled: () => true });
        expect(c.keys()).toEqual(['apple', 'durian']);
        expect(c.label('apple')).toBe('Apple');
        expect(c.isDisabled('durian')).toBe(true);
        expect(c.valueForKey('apple')).toBe('apple');
        un();
        expect(c.keys()).toEqual(['durian']);
        expect(c.has('apple')).toBe(false);
    });

    it('a data item and a JSX entry with the same key are one key', () => {
        const c = createCollection<string>({ items: () => ['apple'] });
        c.register({ key: 'apple', label: () => 'Apple (rendered)', disabled: () => false });
        expect(c.keys()).toEqual(['apple']);
        // Data wins for the label — it is the truth the item was rendered from.
        expect(c.label('apple')).toBe('apple');
    });
});

describe('segmentBy', () => {
    it('folds by first appearance, collecting later members of a group', () => {
        const options = [
            { value: 'a', group: 'G' }, { value: 'b' }, { value: 'c', group: 'G' }, { value: 'd', group: 'H' },
        ];
        expect(segmentBy(options, (o) => o.group).map((s) => [s.group, s.items.map((o) => o.value)])).toEqual([['G', ['a', 'c']], [undefined, ['b']], ['H', ['d']]]);
    });
});
