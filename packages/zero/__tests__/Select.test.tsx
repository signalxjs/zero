import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { signal } from 'sigx';
import { Field, Select, selectAnatomy } from '@sigx/zero';
import { expectAnatomy } from './helpers';

/** watch()-driven syncs settle a microtask after the write. */
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('Select', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    function mount(state: { fruit: string }) {
        render(
            <Select.Root model={[state, 'fruit']} placeholder="Pick a fruit…" name="fruit">
                <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                </Select.Trigger>
                <Select.Popup>
                    <Select.Item value="apple">Apple</Select.Item>
                    <Select.Item value="banana">Banana</Select.Item>
                    <Select.Item value="cherry" disabled>Cherry</Select.Item>
                </Select.Popup>
            </Select.Root>,
            container,
        );
    }

    it('renders anatomy with combobox/listbox semantics and a hidden form select', () => {
        mount(signal({ fruit: '' }));
        expectAnatomy(container, selectAnatomy);
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        expect(trigger.getAttribute('role')).toBe('combobox');
        expect(trigger.getAttribute('aria-haspopup')).toBe('listbox');
        expect(container.querySelector('[data-part="popup"]')!.getAttribute('role')).toBe('listbox');
        expect(container.querySelectorAll('[role="option"]').length).toBe(3);
        const hidden = container.querySelector<HTMLSelectElement>('select[data-part="hidden-input"]')!;
        expect(hidden.name).toBe('fruit');
        expect(trigger.getAttribute('data-placeholder')).toBe('');
        expect(container.querySelector('[data-part="value"]')!.textContent).toBe('Pick a fruit…');
    });

    it('opens, highlights, and selects by click', () => {
        const state = signal({ fruit: '' });
        mount(state);
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        trigger.click();
        expect(trigger.getAttribute('aria-expanded')).toBe('true');

        const items = container.querySelectorAll<HTMLElement>('[data-part="item"]');
        items[1]!.click();
        expect(state.fruit).toBe('banana');
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
        expect(container.querySelector('[data-part="value"]')!.textContent).toBe('Banana');
        expect(container.querySelector<HTMLSelectElement>('select[data-part="hidden-input"]')!.value).toBe('banana');
    });

    it('full keyboard flow: open, arrow, select via activedescendant', () => {
        const state = signal({ fruit: '' });
        mount(state);
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        const key = (k: string) => trigger.dispatchEvent(new KeyboardEvent('keydown', { key: k, cancelable: true, bubbles: true }));

        key('ArrowDown');                 // opens, highlights first enabled
        expect(trigger.getAttribute('aria-expanded')).toBe('true');
        const items = container.querySelectorAll<HTMLElement>('[data-part="item"]');
        expect(items[0]!.getAttribute('data-highlighted')).toBe('');
        expect(trigger.getAttribute('aria-activedescendant')).toBe(items[0]!.id);

        key('ArrowDown');                 // second item (cherry is disabled → not reachable further)
        expect(items[1]!.getAttribute('data-highlighted')).toBe('');

        key('Enter');
        expect(state.fruit).toBe('banana');
        expect(trigger.getAttribute('aria-expanded')).toBe('false');

        // aria-selected sticks on reopen
        key('ArrowDown');
        expect(items[1]!.getAttribute('aria-selected')).toBe('true');
        expect(items[1]!.getAttribute('data-selected')).toBe('');
    });

    it('typeahead while closed selects directly', () => {
        const state = signal({ fruit: '' });
        mount(state);
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', cancelable: true, bubbles: true }));
        expect(state.fruit).toBe('banana');
    });

    it('publishes press feedback on the trigger, by pointer and by Enter', () => {
        mount(signal({ fruit: '' }));
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        trigger.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
        expect(trigger.hasAttribute('data-pressed')).toBe(true);
        trigger.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        expect(trigger.hasAttribute('data-pressed')).toBe(false);

        // triggerKeydown preventDefaults Enter; press composes ahead of it,
        // so the feedback fires regardless.
        trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true }));
        expect(trigger.hasAttribute('data-pressed')).toBe(true);
        trigger.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
        expect(trigger.hasAttribute('data-pressed')).toBe(false);
    });

    it('publishes press feedback on items by pointer, skipping disabled ones', () => {
        mount(signal({ fruit: '' }));
        container.querySelector<HTMLElement>('[data-part="trigger"]')!.click();
        const items = container.querySelectorAll<HTMLElement>('[data-part="item"]');
        items[0]!.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
        expect(items[0]!.hasAttribute('data-pressed')).toBe(true);
        items[0]!.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        expect(items[0]!.hasAttribute('data-pressed')).toBe(false);

        items[2]!.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
        expect(items[2]!.hasAttribute('data-pressed')).toBe(false);
    });

    it('publishes no press feedback while the root is disabled', () => {
        render(
            <Select.Root disabled placeholder="Pick a fruit…">
                <Select.Trigger>
                    <Select.Value />
                </Select.Trigger>
            </Select.Root>,
            container,
        );
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        trigger.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
        expect(trigger.hasAttribute('data-pressed')).toBe(false);
    });

    it('Escape closes without selecting', () => {
        const state = signal({ fruit: '' });
        mount(state);
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }));
        trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
        expect(state.fruit).toBe('');
    });

    it('option groups: role=group named by its label, items keep working, and a valid anatomy', async () => {
        const state = signal({ fruit: '' });
        render(
            <Select.Root model={[state, 'fruit']}>
                <Select.Trigger>
                    <Select.Value />
                </Select.Trigger>
                <Select.Popup>
                    <Select.Group>
                        <Select.GroupLabel>Citrus</Select.GroupLabel>
                        <Select.Item value="lemon">Lemon</Select.Item>
                        <Select.Item value="lime">Lime</Select.Item>
                    </Select.Group>
                    <Select.Group>
                        <Select.GroupLabel>Stone</Select.GroupLabel>
                        <Select.Item value="peach">Peach</Select.Item>
                    </Select.Group>
                </Select.Popup>
            </Select.Root>,
            container,
        );
        await tick();
        expectAnatomy(container, selectAnatomy);
        const groups = container.querySelectorAll<HTMLElement>('[data-part="group"]');
        const labels = container.querySelectorAll<HTMLElement>('[data-part="group-label"]');
        expect(groups.length).toBe(2);
        expect(groups[0]!.getAttribute('role')).toBe('group');
        expect(labels[0]!.id).not.toBe('');
        expect(groups[0]!.getAttribute('aria-labelledby')).toBe(labels[0]!.id);
        expect(groups[1]!.getAttribute('aria-labelledby')).toBe(labels[1]!.id);
        // The label is NOT an option: never highlighted, never selectable —
        // only items register, so the keyboard walks straight through groups.
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true, bubbles: true }));
        trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true, bubbles: true }));
        trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true, bubbles: true }));
        const items = container.querySelectorAll<HTMLElement>('[data-part="item"]');
        expect(items[2]!.hasAttribute('data-highlighted')).toBe(true);
        trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true }));
        expect(state.fruit).toBe('peach');
    });

    it('a group without a label stays anonymous rather than dangling', async () => {
        render(
            <Select.Root>
                <Select.Trigger><Select.Value /></Select.Trigger>
                <Select.Popup>
                    <Select.Group>
                        <Select.Item value="lemon">Lemon</Select.Item>
                    </Select.Group>
                </Select.Popup>
            </Select.Root>,
            container,
        );
        await tick();
        expect(container.querySelector<HTMLElement>('[data-part="group"]')!.hasAttribute('aria-labelledby')).toBe(false);
    });

    it('adopts field wiring: label for, describedby, invalid, required', () => {
        render(
            <Field.Root invalid required>
                <Field.Label>Fruit</Field.Label>
                <Select.Root placeholder="Pick a fruit…">
                    <Select.Trigger>
                        <Select.Value />
                    </Select.Trigger>
                    <Select.Popup>
                        <Select.Item value="apple">Apple</Select.Item>
                    </Select.Popup>
                </Select.Root>
                <Field.Error>Required</Field.Error>
            </Field.Root>,
            container,
        );
        const trigger = container.querySelector<HTMLElement>('[data-scope="select"][data-part="trigger"]')!;
        const label = container.querySelector<HTMLElement>('[data-scope="field"][data-part="label"]')!;
        // The trigger IS the field's control: a button is labelable, so
        // Field.Label names it through `for` exactly like an input.
        expect(label.getAttribute('for')).toBe(trigger.id);
        expect(trigger.getAttribute('aria-invalid')).toBe('true');
        expect(trigger.getAttribute('aria-required')).toBe('true');
        expect(trigger.getAttribute('aria-describedby')).toBeTruthy();
        // The listbox keeps pointing at the trigger under the adopted id.
        expect(container.querySelector('[data-scope="select"][data-part="popup"]')!.getAttribute('aria-labelledby')).toBe(trigger.id);
    });

    it('the trigger label prop names a bare select; without it there is no aria-label', () => {
        // role="combobox" prohibits name-from-content: the value/placeholder
        // text inside the trigger can never name it, so a Select outside a
        // Field needs `label` or it is a nameless button to AT (#326).
        render(
            <Select.Root placeholder="Pick a fruit…">
                <Select.Trigger label="Fruit">
                    <Select.Value />
                </Select.Trigger>
            </Select.Root>,
            container,
        );
        expect(container.querySelector('[data-part="trigger"]')!.getAttribute('aria-label')).toBe('Fruit');

        const c2 = document.createElement('div');
        document.body.appendChild(c2);
        // No label prop: no aria-label — inside a Field it would OVERRIDE
        // the field's visible label, so absence must stay absence.
        render(
            <Select.Root placeholder="Pick a fruit…">
                <Select.Trigger>
                    <Select.Value />
                </Select.Trigger>
            </Select.Root>,
            c2,
        );
        expect(c2.querySelector('[data-part="trigger"]')!.hasAttribute('aria-label')).toBe(false);
    });

    it('a bare select outside a field announces its own invalid/required props', () => {
        render(
            <Select.Root invalid required placeholder="Pick a fruit…">
                <Select.Trigger>
                    <Select.Value />
                </Select.Trigger>
            </Select.Root>,
            container,
        );
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        expect(trigger.getAttribute('aria-invalid')).toBe('true');
        expect(trigger.getAttribute('aria-required')).toBe('true');
    });

    describe('items (the data expansion)', () => {
        const OPTIONS = [
            { value: 'apple' },
            { value: 'banana', label: 'Banana' },
            { value: 'cherry', label: 'Cherry', disabled: true },
        ] as const;

        it('with no children, renders the full default composition from items', () => {
            const state = signal({ fruit: '' });
            render(
                <Select.Root model={[state, 'fruit']} name="fruit" placeholder="Pick a fruit…" items={OPTIONS} />,
                container,
            );
            expectAnatomy(container, selectAnatomy);
            for (const name of ['trigger', 'value', 'indicator', 'popup']) {
                expect(container.querySelector(`[data-scope="select"][data-part="${name}"]`), `select/${name} must render`).toBeTruthy();
            }
            const items = container.querySelectorAll<HTMLElement>('[data-part="item"]');
            expect(items.length).toBe(3);
            // Label defaults to the value when omitted.
            expect(items[0]!.textContent).toBe('apple');
            expect(items[1]!.textContent).toBe('Banana');
            // `disabled` flows onto the generated item.
            expect(items[2]!.getAttribute('data-disabled')).toBe('');
            expect(items[2]!.getAttribute('aria-disabled')).toBe('true');
            // The hidden select still posts.
            expect(container.querySelector<HTMLSelectElement>('select[data-part="hidden-input"]')!.name).toBe('fruit');
        });

        it('groups render per distinct `group` in first-appearance order, ungrouped stay in place', async () => {
            render(
                <Select.Root
                    items={[
                        { value: 'lemon', group: 'Citrus' },
                        { value: 'peach', group: 'Stone' },
                        { value: 'salt' },
                        { value: 'lime', group: 'Citrus' },
                    ]}
                />,
                container,
            );
            await tick();
            const popup = container.querySelector<HTMLElement>('[data-part="popup"]')!;
            const groups = popup.querySelectorAll<HTMLElement>('[data-part="group"]');
            expect(groups.length).toBe(2);
            const labels = [...popup.querySelectorAll<HTMLElement>('[data-part="group-label"]')].map((l) => l.textContent);
            // First-appearance order: Citrus before Stone, and lime folds back
            // into the Citrus group even though it was listed after peach.
            expect(labels).toEqual(['Citrus', 'Stone']);
            expect([...groups[0]!.querySelectorAll('[data-part="item"]')].map((i) => i.textContent)).toEqual(['lemon', 'lime']);
            expect([...groups[1]!.querySelectorAll('[data-part="item"]')].map((i) => i.textContent)).toEqual(['peach']);
            // The ungrouped option is a direct child of the popup, in
            // document order between the two groups' first appearances.
            const sequence = [...popup.querySelectorAll<HTMLElement>('[data-part="group"], :scope > [data-part="item"]')];
            expect(sequence.map((el) => el.getAttribute('data-part'))).toEqual(['group', 'group', 'item']);
            expect(groups[0]!.getAttribute('aria-labelledby')).toBeTruthy();
            expectAnatomy(container, selectAnatomy);
        });

        it('explicit slot children win entirely — no merging', () => {
            render(
                <Select.Root items={OPTIONS} placeholder="Pick a fruit…">
                    <Select.Trigger label="Fruit">
                        <Select.Value />
                    </Select.Trigger>
                    <Select.Popup>
                        <Select.Item value="mango">Mango</Select.Item>
                    </Select.Popup>
                </Select.Root>,
                container,
            );
            const items = container.querySelectorAll<HTMLElement>('[data-part="item"]');
            expect(items.length).toBe(1);
            expect(items[0]!.textContent).toBe('Mango');
        });

        it('keyboard highlight, selection and closed typeahead work exactly as with hand-written items', () => {
            const state = signal({ fruit: '' });
            render(
                <Select.Root model={[state, 'fruit']} items={OPTIONS} itemValue={(o) => o.value} placeholder="Pick a fruit…" />,
                container,
            );
            const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
            const key = (k: string) => trigger.dispatchEvent(new KeyboardEvent('keydown', { key: k, cancelable: true, bubbles: true }));

            // Closed typeahead matches on the label (not the raw value).
            key('B');
            expect(state.fruit).toBe('banana');

            // Open on the current value; the disabled cherry clamps the walk
            // (APG listbox: no wrap) exactly as a hand-written disabled item.
            key('ArrowDown');
            const items = container.querySelectorAll<HTMLElement>('[data-part="item"]');
            expect(items[1]!.getAttribute('data-highlighted')).toBe('');
            key('ArrowDown');
            expect(items[2]!.hasAttribute('data-highlighted')).toBe(false);
            expect(items[1]!.getAttribute('data-highlighted')).toBe('');
            key('ArrowUp');
            expect(items[0]!.getAttribute('data-highlighted')).toBe('');
            key('Enter');
            expect(state.fruit).toBe('apple');
        });
    });

    it('scrolls the highlighted option into view as the highlight moves', async () => {
        const state = signal({ fruit: '' });
        mount(state);
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        trigger.click();
        const items = container.querySelectorAll<HTMLElement>('[data-part="item"]');
        const scrolled = vi.fn();
        items[1]!.scrollIntoView = scrolled;
        trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true, bubbles: true }));
        await tick();
        // block:'nearest' — never yank the page, just keep the option visible.
        expect(scrolled).toHaveBeenCalledWith({ block: 'nearest' });
    });
});

describe('Select over the collection (#445)', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    interface Country { code: string; name: string; region?: string; off?: boolean }
    const COUNTRIES: Country[] = [
        { code: 'se', name: 'Sweden', region: 'Nordics' },
        { code: 'jp', name: 'Japan', region: 'Asia' },
        { code: 'no', name: 'Norway', region: 'Nordics', off: true },
    ];
    const key = (el: Element, k: string) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, cancelable: true, bubbles: true }));

    const platformWrites = (hidden: HTMLSelectElement, ...keys: string[]) => {
        for (const o of Array.from(hidden.options)) o.selected = keys.includes(o.value);
        hidden.dispatchEvent(new Event('change', { bubbles: true }));
    };

    it('a root without children is data-driven even while its items are still to come', () => {
        const state = signal({ list: [] as string[] });
        render(<Select.Root items={state.list} name="later" placeholder="Loading…" />, container);
        const hidden = container.querySelector<HTMLSelectElement>('[data-part="hidden-input"]')!;
        expect([...hidden.options].map((o) => o.value)).toEqual(['']);
        expect(container.querySelector('[data-part="value"]')!.textContent).toBe('Loading…');
        // Plain props are values in sigx: the list arrives INTO the proxied array.
        state.list.push('a', 'b');
        expect([...hidden.options].map((o) => o.value)).toEqual(['', 'a', 'b']);
        expect(container.querySelectorAll('[data-part="item"]').length).toBe(2);
    });

    it('explicit children win over items ENTIRELY: the collection and the hidden select hold only what is rendered', () => {
        render(
            <Select.Root items={COUNTRIES} itemKey={(c) => c.code} itemLabel={(c) => c.name} name="country">
                <Select.Trigger label="Country"><Select.Value /></Select.Trigger>
                <Select.Popup><Select.Item value="x">Only</Select.Item></Select.Popup>
            </Select.Root>,
            container,
        );
        const items = container.querySelectorAll('[data-part="item"]');
        expect(items.length).toBe(1);
        expect(items[0]!.textContent).toContain('Only');
        const hidden = container.querySelector<HTMLSelectElement>('[data-part="hidden-input"]')!;
        expect([...hidden.options].map((o) => o.value)).toEqual(['']);
        // The typeahead sees the rendered item, not the data (in data mode 's' would select Sweden).
        key(container.querySelector<HTMLElement>('[data-part="trigger"]')!, 's');
        expect(container.querySelector('[data-part="value"]')!.textContent).toBe('');
    });

    it('Select.Value slot: the items behind the keys, or the keys themselves for hand-written items', () => {
        render(
            <Select.Root defaultValue="a">
                <Select.Trigger label="L"><Select.Value slots={{ default: ({ items }) => <b>{(items as string[]).join('+')}</b> }} /></Select.Trigger>
                <Select.Popup><Select.Item value="a">A</Select.Item></Select.Popup>
            </Select.Root>,
            container,
        );
        expect(container.querySelector('[data-part="value"]')!.textContent).toBe('a');
    });

    it('an item keyed "" is refused in single mode (it is the placeholder) and accepted under multiple', () => {
        expect(() => render(<Select.Root items={['', 'a']} name="x" />, container)).toThrow(/reserved for the placeholder/);
        // With or without a name, data or hand-written items: the key is the sentinel either way.
        expect(() => render(<Select.Root items={['', 'a']} />, container)).toThrow(/reserved for the placeholder/);
        expect(() => render(<Select.Root><Select.Popup><Select.Item value="">None</Select.Item></Select.Popup></Select.Root>, container)).toThrow(/reserved for the placeholder/);
        expect(() => render(<Select.Root items={['', 'a']} multiple name="y" />, container)).not.toThrow();
        // A value of '' behind a non-empty key is refused too: the core reads '' as nothing
        // selected. (A fresh container: a render over a mounted app reports rather than throws.)
        const fresh = document.body.appendChild(document.createElement('div'));
        expect(() => render(<Select.Root items={[{ id: 'none', v: '' }]} itemKey={(i) => i.id} itemValue={(i) => i.v} />, fresh)).toThrow(/keyed or valued ""/);
    });

    it("the platform's write to the hidden select (autofill, restoration) flows back into the model", () => {
        const state = signal({ country: null as Country | null, codes: [] as string[], code: '' as string | null });
        render(
            <>
                <Select.Root items={COUNTRIES} itemKey={(c) => c.code} itemLabel={(c) => c.name} itemDisabled={(c) => !!c.off} model={[state, 'country']} name="country" />
                <Select.Root items={COUNTRIES} itemValue={(c) => c.code} itemLabel={(c) => c.name} model={[state, 'code']} name="code" />
                <Select.Root items={COUNTRIES} itemValue={(c) => c.code} itemLabel={(c) => c.name} multiple model={[state, 'codes']} name="codes" />
            </>,
            container,
        );
        const [single, value, multi] = Array.from(container.querySelectorAll<HTMLSelectElement>('[data-part="hidden-input"]'));
        // A disabled item is a disabled option: the platform cannot pick it either.
        expect([...single!.options].find((o) => o.value === 'no')!.disabled).toBe(true);
        expect([...single!.options].find((o) => o.value === 'jp')!.disabled).toBe(false);
        platformWrites(single!, 'jp');
        expect(state.country).toEqual(COUNTRIES[1]);
        expect(container.querySelector('[data-part="value"]')!.textContent).toBe('Japan');
        platformWrites(single!);
        expect(state.country).toBeNull();
        platformWrites(multi!, 'se', 'no');
        expect(state.codes).toEqual(['se', 'no']);
        // A value model: '' reads as nothing selected, and nothing selected is written as null.
        expect(container.querySelectorAll('[data-part="value"]')[1]!.hasAttribute('data-placeholder')).toBe(true);
        platformWrites(value!, 'jp');
        expect(state.code).toBe('jp');
        platformWrites(value!);
        expect(state.code).toBeNull();
    });

    it('object model: the model holds the item, and a preset item shows its label on the FIRST render', () => {
        const state = signal({ country: COUNTRIES[1] as Country | null });
        render(
            <Select.Root items={COUNTRIES} itemKey={(c) => c.code} itemLabel={(c) => c.name} model={[state, 'country']} name="country" />,
            container,
        );
        // No tick: the label comes from data, not from a mounted element.
        expect(container.querySelector('[data-part="value"]')!.textContent).toBe('Japan');
        container.querySelectorAll<HTMLElement>('[data-part="item"]')[0]!.click();
        expect(state.country).toEqual(COUNTRIES[0]);
        // The hidden select posts the KEY, with every item as an option.
        const hidden = container.querySelector<HTMLSelectElement>('select[data-part="hidden-input"]')!;
        expect([...hidden.options].map((o) => o.value)).toEqual(['', 'se', 'jp', 'no']);
    });

    it('key model: itemValue decides what the model holds', () => {
        const state = signal({ code: 'se' });
        render(
            <Select.Root items={COUNTRIES} itemValue={(c) => c.code} itemLabel={(c) => c.name} model={[state, 'code']} />,
            container,
        );
        expect(container.querySelector('[data-part="value"]')!.textContent).toBe('Sweden');
        container.querySelectorAll<HTMLElement>('[data-part="item"]')[1]!.click();
        expect(state.code).toBe('jp');
    });

    it('itemDisabled and itemGroup flow into the generated parts', async () => {
        render(
            <Select.Root items={COUNTRIES} itemKey={(c) => c.code} itemLabel={(c) => c.name} itemDisabled={(c) => !!c.off} itemGroup={(c) => c.region} />,
            container,
        );
        await tick();
        // Grouped rendering reorders the DOM (Nordics collects Norway), so find
        // the item by its label rather than its data index.
        const norway = [...container.querySelectorAll<HTMLElement>('[data-part="item"]')].find((i) => i.textContent === 'Norway')!;
        expect(norway.getAttribute('aria-disabled')).toBe('true');
        expect([...container.querySelectorAll('[data-part="group-label"]')].map((l) => l.textContent)).toEqual(['Nordics', 'Asia']);
    });

    it('multiple: selections toggle, the popup stays open, the hidden select is multiple and posts each', async () => {
        const state = signal({ codes: [] as string[] });
        render(
            <form>
                <Select.Root items={COUNTRIES} multiple itemValue={(c) => c.code} itemLabel={(c) => c.name} model={[state, 'codes']} name="c" />
            </form>,
            container,
        );
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        trigger.click();
        expect(container.querySelector('[data-part="popup"]')!.getAttribute('data-state')).toBe('open');
        expect(container.querySelector('[data-part="popup"]')!.getAttribute('aria-multiselectable')).toBe('true');
        const items = container.querySelectorAll<HTMLElement>('[data-part="item"]');
        items[0]!.click();
        items[1]!.click();
        expect(state.codes).toEqual(['se', 'jp']);
        expect(container.querySelector('[data-part="popup"]')!.getAttribute('data-state')).toBe('open');
        expect(container.querySelector('[data-part="value"]')!.textContent).toBe('Sweden, Japan');
        await tick();
        const hidden = container.querySelector<HTMLSelectElement>('select[data-part="hidden-input"]')!;
        expect(hidden.multiple).toBe(true);
        expect([...hidden.selectedOptions].map((o) => o.value)).toEqual(['se', 'jp']);
        // Enter on the highlighted item toggles it off.
        key(trigger, 'Home');
        key(trigger, 'Enter');
        expect(state.codes).toEqual(['jp']);
    });

    it('model:open is a named model (closes #104)', () => {
        const state = signal({ open: false, fruit: '' });
        render(
            <Select.Root model={[state, 'fruit']} model:open={[state, 'open']}>
                <Select.Trigger label="Fruit"><Select.Value /></Select.Trigger>
                <Select.Popup><Select.Item value="apple">Apple</Select.Item></Select.Popup>
            </Select.Root>,
            container,
        );
        container.querySelector<HTMLElement>('[data-part="trigger"]')!.click();
        expect(state.open).toBe(true);
        state.open = false;
        expect(container.querySelector('[data-part="popup"]')!.getAttribute('data-state')).toBe('closed');
        // A consumer's write to the open model initialises and clears the
        // highlight exactly as the trigger does.
        state.open = true;
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        expect(trigger.getAttribute('aria-activedescendant')).toBeTruthy();
        expect(container.querySelector('[data-part="item"]')!.hasAttribute('data-highlighted')).toBe(true);
        state.open = false;
        expect(trigger.hasAttribute('aria-activedescendant')).toBe(false);
    });

    it('the item slot customises a generated option', () => {
        render(
            <Select.Root items={COUNTRIES} itemKey={(c) => c.code} slots={{ item: ({ item }) => <em>{(item as Country).code.toUpperCase()}</em> }} />,
            container,
        );
        expect(container.querySelector('[data-part="item"] em')!.textContent).toBe('SE');
    });
});
