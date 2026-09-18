import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { component, signal } from 'sigx';
import { Combobox, Field, comboboxAnatomy } from '@sigx/zero';
import { expectAnatomy } from './helpers';

/** watch()-driven syncs settle a tick after the write. */
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const FRUIT = ['Apple', 'Banana', 'Cherry'];

describe('Combobox', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    function harness(opts: { disabledBanana?: boolean } = {}) {
        const state = signal({ value: '', query: '', open: false });
        const List = component(() => {
            return () => {
                const matches = FRUIT.filter((f) => f.toLowerCase().includes(state.query.toLowerCase()));
                return (
                    <>
                        {matches.map((f) => (
                            <Combobox.Item value={f.toLowerCase()} disabled={opts.disabledBanana && f === 'Banana'} key={f}>
                                {f}
                            </Combobox.Item>
                        ))}
                        {matches.length === 0 ? <Combobox.Empty>No fruit found</Combobox.Empty> : null}
                    </>
                );
            };
        }, { name: 'List' });

        render(
            <Combobox.Root
                model={[state, 'value']}
                model:inputValue={[state, 'query']}
                model:open={[state, 'open']}
                name="fruit"
                placeholder="Search fruit…"
            >
                <Combobox.Control>
                    <Combobox.Input />
                    <Combobox.Trigger />
                </Combobox.Control>
                <Combobox.Popup>
                    <List />
                </Combobox.Popup>
            </Combobox.Root>,
            container,
        );

        return {
            state,
            input: container.querySelector<HTMLInputElement>('[data-part="input"]')!,
            trigger: container.querySelector<HTMLElement>('[data-part="trigger"]')!,
            popup: container.querySelector<HTMLElement>('[data-part="popup"]')!,
            items: () => [...container.querySelectorAll<HTMLElement>('[data-part="item"]')],
        };
    }

    function type(input: HTMLInputElement, text: string) {
        input.value = text;
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    function key(el: HTMLElement, k: string) {
        el.dispatchEvent(new KeyboardEvent('keydown', { key: k, cancelable: true, bubbles: true }));
    }

    it('renders a valid anatomy with the editable-combobox ARIA', () => {
        const { input, popup, trigger } = harness();
        trigger.click();
        expectAnatomy(container, comboboxAnatomy);
        expect(input.getAttribute('role')).toBe('combobox');
        expect(input.getAttribute('aria-autocomplete')).toBe('list');
        expect(input.getAttribute('aria-controls')).toBe(popup.id);
        expect(popup.getAttribute('role')).toBe('listbox');
        expect(popup.getAttribute('aria-labelledby')).toBe(input.id);
        expect(popup.getAttribute('popover')).toBe('manual');
        const hidden = container.querySelector<HTMLInputElement>('[data-part="hidden-input"]')!;
        expect(hidden.getAttribute('name')).toBe('fruit');
    });

    it('named models bind end-to-end: value, inputValue and open', async () => {
        const { state, input, trigger, items } = harness();
        // open flows out…
        trigger.click();
        expect(state.open).toBe(true);
        // …and in.
        state.open = false;
        expect(container.querySelector('[data-part="popup"]')!.getAttribute('data-state')).toBe('closed');
        // typing writes the inputValue model,
        type(input, 'ba');
        expect(state.query).toBe('ba');
        expect(state.open).toBe(true); // typing reopens
        // selection writes the value model and syncs the text.
        items().find((i) => i.textContent!.includes('Banana'))!.click();
        expect(state.value).toBe('banana');
        expect(state.query).toBe('Banana');
        expect(state.open).toBe(false);
        // An external value write reflects into the input text — via the
        // item's label when it is mounted, the raw value otherwise (the
        // consumer owns filtering, so an unmounted item's label is unknown).
        type(input, ''); // clear the filter: all items mounted again
        state.value = 'cherry';
        await tick();
        expect(state.query).toBe('Cherry');
        expect(input.value).toBe('Cherry');
    });

    it('ArrowDown opens and highlights first; arrows move; Enter selects, closes and fills', () => {
        const { state, input, items } = harness();
        key(input, 'ArrowDown');
        expect(state.open).toBe(true);
        expect(items()[0]!.hasAttribute('data-highlighted')).toBe(true);
        expect(input.getAttribute('aria-activedescendant')).toBe(items()[0]!.id);
        key(input, 'ArrowDown');
        expect(items()[1]!.hasAttribute('data-highlighted')).toBe(true);
        key(input, 'Enter');
        expect(state.value).toBe('banana');
        expect(state.open).toBe(false);
        expect(input.value).toBe('Banana');
    });

    it('arrow movement skips disabled items', () => {
        const { input, items } = harness({ disabledBanana: true });
        key(input, 'ArrowDown');
        key(input, 'ArrowDown');
        expect(items()[1]!.hasAttribute('data-highlighted')).toBe(false);
        expect(items()[2]!.hasAttribute('data-highlighted')).toBe(true);
    });

    it('Escape closes; Tab closes without being swallowed; Home stays with the caret', () => {
        const { state, input } = harness();
        key(input, 'ArrowDown');
        expect(state.open).toBe(true);
        key(input, 'Escape');
        expect(state.open).toBe(false);
        key(input, 'ArrowDown');
        const tab = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true, bubbles: true });
        input.dispatchEvent(tab);
        expect(state.open).toBe(false);
        expect(tab.defaultPrevented).toBe(false);
        key(input, 'ArrowDown');
        const home = new KeyboardEvent('keydown', { key: 'Home', cancelable: true, bubbles: true });
        input.dispatchEvent(home);
        expect(home.defaultPrevented).toBe(false);
    });

    it('consumer filtering unmounts items and prunes a dangling highlight', () => {
        const { state, input, items } = harness();
        key(input, 'ArrowDown');
        key(input, 'ArrowDown'); // highlight Banana
        expect(input.getAttribute('aria-activedescendant')).toBe(items()[1]!.id);
        type(input, 'ap'); // Banana unmounts
        expect(items().map((i) => i.textContent!.trim())).toEqual(['Apple']);
        expect(state.open).toBe(true);
        // No stale reference to the removed option.
        expect(input.hasAttribute('aria-activedescendant')).toBe(false);
        type(input, 'zzz');
        expect(items()).toHaveLength(0);
        expect(container.querySelector('[data-part="empty"]')!.textContent).toBe('No fruit found');
    });

    it('publishes press feedback on the trigger and pointer-only on items', () => {
        const { trigger, items } = harness();
        trigger.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
        expect(trigger.hasAttribute('data-pressed')).toBe(true);
        trigger.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        expect(trigger.hasAttribute('data-pressed')).toBe(false);
        trigger.click();
        const item = items()[0]!;
        item.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
        expect(item.hasAttribute('data-pressed')).toBe(true);
        item.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        expect(item.hasAttribute('data-pressed')).toBe(false);
    });

    it('scrolls the highlighted option into view as the highlight moves', async () => {
        const h = harness();
        h.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true, bubbles: true }));
        await tick();
        const items = container.querySelectorAll<HTMLElement>('[data-part="item"]');
        const scrolled = vi.fn();
        items[1]!.scrollIntoView = scrolled;
        h.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true, bubbles: true }));
        await tick();
        // block:'nearest' — never yank the page, just keep the option visible.
        expect(scrolled).toHaveBeenCalledWith({ block: 'nearest' });
    });

    it('adopts field wiring: label for, describedby, invalid', () => {
        render(
            <Field.Root invalid>
                <Field.Label>Fruit</Field.Label>
                <Combobox.Root>
                    <Combobox.Control>
                        <Combobox.Input />
                        <Combobox.Trigger />
                    </Combobox.Control>
                    <Combobox.Popup>
                        <Combobox.Item value="apple">Apple</Combobox.Item>
                    </Combobox.Popup>
                </Combobox.Root>
                <Field.Error>Required</Field.Error>
            </Field.Root>,
            container,
        );
        const input = container.querySelector<HTMLInputElement>('[data-part="input"]')!;
        const label = container.querySelector<HTMLElement>('[data-scope="field"][data-part="label"]')!;
        expect(label.getAttribute('for')).toBe(input.id);
        expect(input.getAttribute('aria-describedby')).toBeTruthy();
        expect(input.getAttribute('data-invalid')).toBe('');
        expect(container.querySelector('[data-scope="combobox"][data-part="control"]')!.getAttribute('data-invalid')).toBe('');
    });

    it('a defaultValue reflects its item label into the input on mount', async () => {
        render(
            <Combobox.Root defaultValue="banana">
                <Combobox.Control>
                    <Combobox.Input />
                    <Combobox.Trigger label="Open the list" />
                </Combobox.Control>
                <Combobox.Popup>
                    <Combobox.Item value="banana">Banana</Combobox.Item>
                </Combobox.Popup>
            </Combobox.Root>,
            container,
        );
        await tick();
        expect(container.querySelector<HTMLInputElement>('[data-part="input"]')!.value).toBe('Banana');
        expect(container.querySelector('[data-part="trigger"]')!.getAttribute('aria-label')).toBe('Open the list');
    });

    it('the mount sync never clobbers a live query', async () => {
        render(
            <Combobox.Root defaultValue="banana" defaultInputValue="ban">
                <Combobox.Control>
                    <Combobox.Input />
                    <Combobox.Trigger />
                </Combobox.Control>
                <Combobox.Popup>
                    <Combobox.Item value="banana">Banana</Combobox.Item>
                </Combobox.Popup>
            </Combobox.Root>,
            container,
        );
        await tick();
        // The item mounted with the value already selected, but the text is
        // a real query ('ban' ≠ '' and ≠ the raw value) — hands off.
        expect(container.querySelector<HTMLInputElement>('[data-part="input"]')!.value).toBe('ban');
    });

    it('the selected item shows its indicator', () => {
        const { input, items, trigger } = harness();
        key(input, 'ArrowDown');
        key(input, 'Enter'); // select Apple
        trigger.click(); // reopen
        const apple = items()[0]!;
        expect(apple.getAttribute('data-selected')).toBe('');
        expect(apple.querySelector('[data-part="item-indicator"]')).not.toBeNull();
    });

    it('option groups: role=group named by its label, keyboard walks through, valid anatomy', async () => {
        const state = signal({ value: '' });
        render(
            <Combobox.Root model={[state, 'value']}>
                <Combobox.Control>
                    <Combobox.Input />
                    <Combobox.Trigger />
                </Combobox.Control>
                <Combobox.Popup>
                    <Combobox.Group>
                        <Combobox.GroupLabel>Citrus</Combobox.GroupLabel>
                        <Combobox.Item value="lemon">Lemon</Combobox.Item>
                    </Combobox.Group>
                    <Combobox.Group>
                        <Combobox.GroupLabel>Stone</Combobox.GroupLabel>
                        <Combobox.Item value="peach">Peach</Combobox.Item>
                    </Combobox.Group>
                </Combobox.Popup>
            </Combobox.Root>,
            container,
        );
        await tick();
        expectAnatomy(container, comboboxAnatomy);
        const groups = container.querySelectorAll<HTMLElement>('[data-part="group"]');
        const labels = container.querySelectorAll<HTMLElement>('[data-part="group-label"]');
        expect(groups.length).toBe(2);
        expect(groups[0]!.getAttribute('role')).toBe('group');
        expect(groups[0]!.getAttribute('aria-labelledby')).toBe(labels[0]!.id);
        // Labels never register as options: the highlight walks item→item
        // straight across the group boundary.
        const input = container.querySelector<HTMLInputElement>('[data-part="input"]')!;
        key(input, 'ArrowDown');
        key(input, 'ArrowDown');
        const items = container.querySelectorAll<HTMLElement>('[data-part="item"]');
        expect(items[1]!.hasAttribute('data-highlighted')).toBe(true);
        key(input, 'Enter');
        expect(state.value).toBe('peach');
    });

    it('a group without a label stays anonymous rather than dangling', async () => {
        render(
            <Combobox.Root>
                <Combobox.Control><Combobox.Input /></Combobox.Control>
                <Combobox.Popup>
                    <Combobox.Group>
                        <Combobox.Item value="lemon">Lemon</Combobox.Item>
                    </Combobox.Group>
                </Combobox.Popup>
            </Combobox.Root>,
            container,
        );
        await tick();
        expect(container.querySelector<HTMLElement>('[data-part="group"]')!.hasAttribute('aria-labelledby')).toBe(false);
    });

    describe('items (the data expansion)', () => {
        it('with no children, renders the full default composition from items', () => {
            const state = signal({ value: '' });
            render(
                <Combobox.Root
                    model={[state, 'value']}
                    name="fruit"
                    placeholder="Search fruit…"
                    items={[
                        { value: 'apple' },
                        { value: 'banana', label: 'Banana' },
                        { value: 'cherry', label: 'Cherry', disabled: true },
                    ]}
                />,
                container,
            );
            expectAnatomy(container, comboboxAnatomy);
            for (const name of ['control', 'input', 'trigger', 'popup']) {
                expect(container.querySelector(`[data-scope="combobox"][data-part="${name}"]`), `combobox/${name} must render`).toBeTruthy();
            }
            const items = container.querySelectorAll<HTMLElement>('[data-part="item"]');
            expect(items.length).toBe(3);
            expect(items[0]!.textContent).toBe('apple'); // label defaults to value
            expect(items[2]!.getAttribute('data-disabled')).toBe('');
            // The generated input inherits the root placeholder.
            expect(container.querySelector<HTMLInputElement>('[data-part="input"]')!.placeholder).toBe('Search fruit…');
        });

        it('groups render per distinct `group` in first-appearance order', async () => {
            render(
                <Combobox.Root
                    items={[
                        { value: 'lemon', group: 'Citrus' },
                        { value: 'peach', group: 'Stone' },
                        { value: 'lime', group: 'Citrus' },
                    ]}
                />,
                container,
            );
            await tick();
            const groups = container.querySelectorAll<HTMLElement>('[data-part="group"]');
            expect(groups.length).toBe(2);
            const labels = [...container.querySelectorAll<HTMLElement>('[data-part="group-label"]')].map((l) => l.textContent);
            expect(labels).toEqual(['Citrus', 'Stone']);
            expect([...groups[0]!.querySelectorAll('[data-part="item"]')].map((i) => i.textContent)).toEqual(['lemon', 'lime']);
            expectAnatomy(container, comboboxAnatomy);
        });

        it('explicit slot children win entirely — no merging', () => {
            render(
                <Combobox.Root items={[{ value: 'apple' }]}>
                    <Combobox.Control><Combobox.Input /></Combobox.Control>
                    <Combobox.Popup>
                        <Combobox.Item value="mango">Mango</Combobox.Item>
                    </Combobox.Popup>
                </Combobox.Root>,
                container,
            );
            const items = container.querySelectorAll<HTMLElement>('[data-part="item"]');
            expect(items.length).toBe(1);
            expect(items[0]!.textContent).toBe('Mango');
        });

        it('highlight and selection behave exactly as with hand-written items', () => {
            const state = signal({ value: '' });
            render(
                <Combobox.Root
                    model={[state, 'value']}
                    items={[
                        { value: 'apple', label: 'Apple' },
                        { value: 'banana', label: 'Banana' },
                    ]}
                    itemValue={(o) => o.value}
                />,
                container,
            );
            const input = container.querySelector<HTMLInputElement>('[data-part="input"]')!;
            key(input, 'ArrowDown');
            key(input, 'ArrowDown');
            const items = container.querySelectorAll<HTMLElement>('[data-part="item"]');
            expect(items[1]!.getAttribute('data-highlighted')).toBe('');
            key(input, 'Enter');
            expect(state.value).toBe('banana');
            // Selecting fills the input with the item's LABEL, as it would
            // for a hand-written item.
            expect(input.value).toBe('Banana');
        });
    });
});

describe('Combobox over the collection (#445)', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    const FRUITS = [
        { value: 'apple', label: 'Apple' },
        { value: 'banana', label: 'Banana' },
        { value: 'cherry', label: 'Cherry' },
    ];
    const type = (el: HTMLInputElement, text: string) => { el.value = text; el.dispatchEvent(new Event('input', { bubbles: true })); };

    it('explicit children win over items ENTIRELY: the collection and the hidden select hold only what is rendered', () => {
        render(
            <Combobox.Root items={FRUITS} itemValue={(f) => f.value} name="fruit" defaultValue="x">
                <Combobox.Control><Combobox.Input aria-label="Fruit" /></Combobox.Control>
                <Combobox.Popup><Combobox.Item value="x">Only</Combobox.Item></Combobox.Popup>
            </Combobox.Root>,
            container,
        );
        const items = container.querySelectorAll('[data-part="item"]');
        expect(items.length).toBe(1);
        expect(items[0]!.textContent).toContain('Only');
        const hidden = container.querySelector<HTMLSelectElement>('[data-part="hidden-input"]')!;
        expect([...hidden.options].map((o) => o.value)).toEqual(['', 'x']);
    });

    it('an item keyed "" is refused in single mode (it is the placeholder) and accepted under multiple', () => {
        expect(() => render(<Combobox.Root items={['', 'a']} name="x" />, container)).toThrow(/reserved for the placeholder/);
        // With or without a name, data or hand-written items: the key is the sentinel either way.
        expect(() => render(<Combobox.Root items={['', 'a']} />, container)).toThrow(/reserved for the placeholder/);
        expect(() => render(<Combobox.Root><Combobox.Popup><Combobox.Item value="">None</Combobox.Item></Combobox.Popup></Combobox.Root>, container)).toThrow(/reserved for the placeholder/);
        expect(() => render(<Combobox.Root items={['', 'a']} multiple name="y" />, container)).not.toThrow();
        // A value of '' behind a non-empty key is refused too: the core reads '' as nothing
        // selected. (A fresh container: a render over a mounted app reports rather than throws.)
        const fresh = document.body.appendChild(document.createElement('div'));
        expect(() => render(<Combobox.Root items={[{ id: 'none', v: '' }]} itemKey={(i) => i.id} itemValue={(i) => i.v} />, fresh)).toThrow(/keyed or valued ""/);
    });

    it("the platform's write to the hidden select (autofill, restoration) flows back into the model and the input", () => {
        const state = signal({ value: '' });
        render(<Combobox.Root items={FRUITS} itemValue={(f) => f.value} itemDisabled={(f) => f.value === 'cherry'} model={[state, 'value']} name="fruit" />, container);
        const hidden = container.querySelector<HTMLSelectElement>('[data-part="hidden-input"]')!;
        // A disabled item is a disabled option: the platform cannot pick it either.
        expect([...hidden.options].find((o) => o.value === 'cherry')!.disabled).toBe(true);
        hidden.value = 'banana';
        hidden.dispatchEvent(new Event('change', { bubbles: true }));
        expect(state.value).toBe('banana');
        expect(container.querySelector<HTMLInputElement>('[data-part="input"]')!.value).toBe('Banana');
    });

    it('data mode filters by default: a contains-match on the label as you type', () => {
        const state = signal({ value: '', query: '' });
        render(
            <Combobox.Root items={FRUITS} itemValue={(f) => f.value} model={[state, 'value']} model:inputValue={[state, 'query']} emptyText="No fruit" />,
            container,
        );
        const input = container.querySelector<HTMLInputElement>('[data-part="input"]')!;
        expect(container.querySelectorAll('[data-part="item"]').length).toBe(3);
        type(input, 'AN');
        expect([...container.querySelectorAll('[data-part="item"]')].map((i) => i.textContent)).toEqual(['Banana']);
        expect(container.querySelector('[data-part="empty"]')).toBeNull();
        type(input, 'zzz');
        expect(container.querySelectorAll('[data-part="item"]').length).toBe(0);
        expect(container.querySelector('[data-part="empty"]')!.textContent).toBe('No fruit');
    });

    it('filter={false} shows everything (a server-filtered list); a function replaces the default', () => {
        const state = signal({ query: 'x' });
        render(
            <div>
                <Combobox.Root items={FRUITS} filter={false} model:inputValue={[state, 'query']} />
                <Combobox.Root items={FRUITS} filter={(f, q) => f.label.startsWith(q)} model:inputValue={[state, 'query']} />
            </div>,
            container,
        );
        const roots = container.querySelectorAll('[data-scope="combobox"][data-part="root"]');
        expect(roots[0]!.querySelectorAll('[data-part="item"]').length).toBe(3);
        expect(roots[1]!.querySelectorAll('[data-part="item"]').length).toBe(0);
        state.query = 'C';
        expect([...roots[1]!.querySelectorAll('[data-part="item"]')].map((i) => i.textContent)).toEqual(['Cherry']);
    });

    it('a preset value reaches the input from data, before any item mounts', () => {
        const state = signal({ value: 'cherry', query: '' });
        render(
            <Combobox.Root items={FRUITS} itemValue={(f) => f.value} model={[state, 'value']} model:inputValue={[state, 'query']} />,
            container,
        );
        // The render pass: the input already shows the label.
        expect(container.querySelector<HTMLInputElement>('[data-part="input"]')!.value).toBe('Cherry');
    });

    it('object model by default: selecting fills the input and the model holds the item', () => {
        const state = signal({ fruit: null as unknown });
        render(<Combobox.Root items={FRUITS} model={[state, 'fruit']} />, container);
        container.querySelectorAll<HTMLElement>('[data-part="item"]')[1]!.click();
        expect(state.fruit).toEqual(FRUITS[1]);
        expect(container.querySelector<HTMLInputElement>('[data-part="input"]')!.value).toBe('Banana');
    });

    it('multiple: a selection toggles, clears the query and keeps the popup open', () => {
        const state = signal({ values: [] as string[], query: 'a' });
        render(
            <Combobox.Root items={FRUITS} multiple itemValue={(f) => f.value} model={[state, 'values']} model:inputValue={[state, 'query']} defaultOpen />,
            container,
        );
        const items = container.querySelectorAll<HTMLElement>('[data-part="item"]');
        items[0]!.click();
        expect(state.values).toEqual(['apple']);
        expect(state.query).toBe('');
        expect(container.querySelector('[data-part="popup"]')!.getAttribute('data-state')).toBe('open');
        container.querySelectorAll<HTMLElement>('[data-part="item"]')[0]!.click();
        expect(state.values).toEqual([]);
    });
});
