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

        it('the keyboard walks groups in the order they render, not the data order (#127)', async () => {
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
            const input = container.querySelector<HTMLInputElement>('[data-part="input"]')!;
            const press = (key: string): void => {
                input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
            };
            const walked: string[] = [];
            press('ArrowDown');
            await tick();
            for (let i = 0; i < 3; i++) {
                walked.push(document.getElementById(input.getAttribute('aria-activedescendant')!)!.textContent!);
                press('ArrowDown');
                await tick();
            }
            expect(walked).toEqual(['lemon', 'lime', 'peach']);
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

    describe('tags (#39)', () => {
        const key = (el: HTMLElement, k: string) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
        const tags = () => [...container.querySelectorAll<HTMLElement>('[data-part="tag"]')];
        const input = () => container.querySelector<HTMLInputElement>('[data-part="input"]')!;

        it('the data expansion renders a tag per chosen value in the control, before the input', () => {
            render(<Combobox.Root items={FRUITS} multiple itemValue={(f) => f.value} defaultValue={['cherry', 'apple']} />, container);
            expect(tags().map((t) => t.textContent)).toEqual(['Cherry×', 'Apple×']);
            const control = container.querySelector('[data-part="control"]')!;
            expect(tags().every((t) => t.parentElement === control)).toBe(true);
            expect(control.firstElementChild).toBe(tags()[0]);
            const remove = container.querySelector('[data-part="tag-remove"]')!;
            expect(remove.tagName).toBe('BUTTON');
            expect(remove.getAttribute('aria-label')).toBe('Remove Cherry');
            expectAnatomy(container, comboboxAnatomy);
        });

        it('single mode renders no tags', () => {
            render(<Combobox.Root items={FRUITS} itemValue={(f) => f.value} defaultValue="apple" />, container);
            expect(tags()).toEqual([]);
        });

        it('a remove button deselects its value and returns focus to the input', () => {
            const state = signal({ values: ['apple', 'banana'] });
            render(<Combobox.Root items={FRUITS} multiple itemValue={(f) => f.value} model={[state, 'values']} name="fruit" />, container);
            container.querySelectorAll<HTMLElement>('[data-part="tag-remove"]')[0]!.click();
            expect(state.values).toEqual(['banana']);
            expect(tags().map((t) => t.querySelector('[data-part="tag-label"]')!.textContent)).toEqual(['Banana']);
            expect(document.activeElement).toBe(input());
        });

        it('Backspace on an empty input focuses the last tag, the next one removes it; with text it edits the text (#411)', async () => {
            const state = signal({ values: ['apple', 'banana'], query: 'x' });
            render(<Combobox.Root items={FRUITS} multiple itemValue={(f) => f.value} model={[state, 'values']} model:inputValue={[state, 'query']} />, container);
            input().focus();
            key(input(), 'Backspace');
            expect(state.values).toEqual(['apple', 'banana']);
            expect(document.activeElement).toBe(input());
            type(input(), '');
            key(input(), 'Backspace');
            expect(state.values).toEqual(['apple', 'banana']);
            expect(document.activeElement).toBe(tags()[1]);
            key(tags()[1]!, 'Backspace');
            expect(state.values).toEqual(['apple']);
            await tick();
            // Backspace moves back: the previous tag holds focus.
            expect(document.activeElement).toBe(tags()[0]);
            key(tags()[0]!, 'Backspace');
            expect(state.values).toEqual([]);
            expect(document.activeElement).toBe(input());
        });

        describe('tag keyboard (#411)', () => {
            const values = (state: { values: string[] }) => state.values;
            const setup = (extra: Record<string, unknown> = {}, init = ['apple', 'banana', 'cherry']) => {
                const state = signal({ values: init, query: '' });
                render(
                    <Combobox.Root
                        items={FRUITS}
                        multiple
                        itemValue={(f) => f.value}
                        model={[state, 'values']}
                        model:inputValue={[state, 'query']}
                        {...extra}
                    />,
                    container,
                );
                input().focus();
                return state;
            };
            const caret = (at: number) => input().setSelectionRange(at, at);

            it('tags and their remove buttons are focusable but out of the Tab order', () => {
                setup();
                expect(tags().every((t) => t.tabIndex === -1)).toBe(true);
                expect(tags()[0]!.getAttribute('aria-keyshortcuts')).toBe('Backspace Delete');
                const removes = [...container.querySelectorAll<HTMLButtonElement>('[data-part="tag-remove"]')];
                expect(removes.every((b) => b.tabIndex === -1)).toBe(true);
                expect(tags()[0]!.hasAttribute('role')).toBe(false);
                expectAnatomy(container, comboboxAnatomy);
            });

            it('ArrowLeft at caret 0 focuses the last tag — not with the caret further in the text', () => {
                const state = setup();
                type(input(), 'ch');
                caret(1);
                key(input(), 'ArrowLeft');
                expect(document.activeElement).toBe(input());
                caret(0);
                key(input(), 'ArrowLeft');
                expect(document.activeElement).toBe(tags()[2]);
                // The typed query survives the trip onto the tags.
                expect(state.query).toBe('ch');
                expect(values(state)).toEqual(['apple', 'banana', 'cherry']);
            });

            it('moving onto a tag closes the list but keeps the query', async () => {
                const state = setup();
                type(input(), 'a');
                expect(container.querySelector('[data-part="popup"]')!.getAttribute('data-state')).toBe('open');
                caret(0);
                key(input(), 'ArrowLeft');
                await tick();
                expect(container.querySelector('[data-part="popup"]')!.getAttribute('data-state')).toBe('closed');
                expect(state.query).toBe('a');
            });

            it('arrows move between tags and past the last back into the input; Home/End jump', () => {
                setup();
                key(input(), 'ArrowLeft');
                expect(document.activeElement).toBe(tags()[2]);
                key(tags()[2]!, 'ArrowLeft');
                expect(document.activeElement).toBe(tags()[1]);
                key(tags()[1]!, 'ArrowLeft');
                key(tags()[0]!, 'ArrowLeft');
                expect(document.activeElement).toBe(tags()[0]);
                key(tags()[0]!, 'ArrowRight');
                expect(document.activeElement).toBe(tags()[1]);
                key(tags()[1]!, 'End');
                expect(document.activeElement).toBe(input());
                key(input(), 'ArrowLeft');
                key(tags()[2]!, 'Home');
                expect(document.activeElement).toBe(tags()[0]);
                key(tags()[0]!, 'ArrowRight');
                key(tags()[1]!, 'ArrowRight');
                key(tags()[2]!, 'ArrowRight');
                expect(document.activeElement).toBe(input());
                expect(input().selectionStart).toBe(0);
            });

            it('Delete removes the tag and focuses the one taking its place, or the input after the last', async () => {
                const state = setup();
                key(input(), 'ArrowLeft');
                key(tags()[2]!, 'Home');
                key(tags()[0]!, 'Delete');
                expect(values(state)).toEqual(['banana', 'cherry']);
                await tick();
                expect(document.activeElement).toBe(tags()[0]);
                expect(tags()[0]!.textContent).toBe('Banana×');
                key(tags()[0]!, 'ArrowRight');
                key(tags()[1]!, 'Delete');
                expect(values(state)).toEqual(['banana']);
                expect(document.activeElement).toBe(input());
            });

            it('Backspace on the first tag focuses the new first tag', async () => {
                const state = setup();
                key(input(), 'ArrowLeft');
                key(tags()[2]!, 'Home');
                key(tags()[0]!, 'Backspace');
                expect(values(state)).toEqual(['banana', 'cherry']);
                await tick();
                expect(document.activeElement).toBe(tags()[0]);
            });

            it('Escape returns to the input; ArrowDown returns and opens the list', async () => {
                setup();
                key(input(), 'ArrowLeft');
                key(tags()[2]!, 'Escape');
                expect(document.activeElement).toBe(input());
                key(input(), 'ArrowLeft');
                key(tags()[2]!, 'ArrowDown');
                await tick();
                expect(document.activeElement).toBe(input());
                expect(container.querySelector('[data-part="popup"]')!.getAttribute('data-state')).toBe('open');
            });

            it('a printable key on a tag moves focus to the input', () => {
                setup();
                key(input(), 'ArrowLeft');
                key(tags()[2]!, 'b');
                expect(document.activeElement).toBe(input());
            });

            it('readonly: the tags are reachable, but nothing is removed', () => {
                const state = setup({ readonly: true });
                key(input(), 'Backspace');
                expect(document.activeElement).toBe(tags()[2]);
                key(tags()[2]!, 'Backspace');
                key(tags()[2]!, 'Delete');
                expect(values(state)).toEqual(['apple', 'banana', 'cherry']);
                expect(tags()[0]!.hasAttribute('aria-keyshortcuts')).toBe(false);
            });

            it('focus leaving the combobox from a tag drops the query, as from the input', async () => {
                const state = setup();
                const outside = document.createElement('button');
                document.body.appendChild(outside);
                type(input(), 'ch');
                caret(0);
                key(input(), 'ArrowLeft');
                await tick();
                outside.focus();
                await tick();
                expect(state.query).toBe('');
                outside.remove();
            });

            it('under rtl the arrows swap: ArrowRight is the way onto the tags', () => {
                container.setAttribute('dir', 'rtl');
                container.style.direction = 'rtl';
                setup();
                key(input(), 'ArrowLeft');
                expect(document.activeElement).toBe(input());
                key(input(), 'ArrowRight');
                expect(document.activeElement).toBe(tags()[2]);
                key(tags()[2]!, 'ArrowRight');
                expect(document.activeElement).toBe(tags()[1]);
                key(tags()[1]!, 'ArrowLeft');
                expect(document.activeElement).toBe(tags()[2]);
                container.removeAttribute('dir');
                container.style.direction = '';
            });

            it('hand-written Combobox.Tags navigate the same way', () => {
                const state = signal({ values: ['a', 'b'], query: '' });
                render(
                    <Combobox.Root multiple model={[state, 'values']} model:inputValue={[state, 'query']}>
                        <Combobox.Control>
                            <Combobox.Tags />
                            <Combobox.Input />
                        </Combobox.Control>
                        <Combobox.Popup>
                            <Combobox.Item value="a">A</Combobox.Item>
                            <Combobox.Item value="b">B</Combobox.Item>
                        </Combobox.Popup>
                    </Combobox.Root>,
                    container,
                );
                input().focus();
                key(input(), 'Backspace');
                expect(document.activeElement).toBe(tags()[1]);
                key(tags()[1]!, 'ArrowLeft');
                key(tags()[0]!, 'Delete');
                expect(state.values).toEqual(['b']);
            });
        });

        it('disabled and readonly tags cannot be removed', () => {
            const state = signal({ values: ['apple'] });
            render(
                <div>
                    <Combobox.Root items={FRUITS} multiple disabled itemValue={(f) => f.value} model={[state, 'values']} />
                    <Combobox.Root items={FRUITS} multiple readonly itemValue={(f) => f.value} model={[state, 'values']} />
                </div>,
                container,
            );
            const removes = container.querySelectorAll<HTMLButtonElement>('[data-part="tag-remove"]');
            expect([...removes].every((b) => b.disabled)).toBe(true);
            expect(tags()[0]!.hasAttribute('data-disabled')).toBe(true);
            for (const i of container.querySelectorAll<HTMLInputElement>('[data-part="input"]')) key(i, 'Backspace');
            expect(state.values).toEqual(['apple']);
        });

        it('the tag slot replaces the default content; TagLabel/TagRemove compose inside it', () => {
            render(
                <Combobox.Root
                    items={FRUITS}
                    multiple
                    itemValue={(f) => f.value}
                    defaultValue={['apple']}
                    slots={{ tag: ({ value, item }) => (
                        <>
                            <Combobox.TagLabel />
                            <em data-mode={value}>{item?.label.length}</em>
                            <Combobox.TagRemove label="Drop" />
                        </>
                    ) }}
                />,
                container,
            );
            expect(container.querySelector('[data-part="tag-label"]')!.textContent).toBe('Apple');
            expect(container.querySelector('em[data-mode="apple"]')!.textContent).toBe('5');
            expect(container.querySelector('[data-part="tag-remove"]')!.getAttribute('aria-label')).toBe('Drop');
        });

        it('hand-written roots place Combobox.Tags; a filtered-out item keeps its tag label', () => {
            const state = signal({ values: ['banana'], query: '' });
            const List = component(() => () => (
                <>
                    {FRUIT.filter((f) => f.toLowerCase().includes(state.query.toLowerCase())).map((f) => (
                        <Combobox.Item value={f.toLowerCase()} key={f}>{f}</Combobox.Item>
                    ))}
                </>
            ), { name: 'List' });
            render(
                <Combobox.Root multiple model={[state, 'values']} model:inputValue={[state, 'query']}>
                    <Combobox.Control>
                        <Combobox.Tags />
                        <Combobox.Input />
                    </Combobox.Control>
                    <Combobox.Popup><List /></Combobox.Popup>
                </Combobox.Root>,
                container,
            );
            const label = () => container.querySelector('[data-part="tag-label"]')!.textContent;
            expect(label()).toBe('Banana');
            type(input(), 'ch');
            expect(container.querySelectorAll('[data-part="item"]').length).toBe(1);
            expect(label()).toBe('Banana');
        });
    });

    describe('allowCustom (#39)', () => {
        const key = (el: HTMLElement, k: string) => {
            const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
            el.dispatchEvent(e);
            return e;
        };
        const input = () => container.querySelector<HTMLInputElement>('[data-part="input"]')!;

        it('multiple: Enter commits the text as a tag, clears the input, and posts it', () => {
            const state = signal({ values: [] as string[], query: '' });
            render(
                <form>
                    <Combobox.Root items={['apple', 'banana']} multiple allowCustom model={[state, 'values']} model:inputValue={[state, 'query']} name="tags" />
                </form>,
                container,
            );
            type(input(), '  kiwi ');
            const e = key(input(), 'Enter');
            expect(e.defaultPrevented).toBe(true);
            expect(state.values).toEqual(['kiwi']);
            expect(state.query).toBe('');
            expect(container.querySelector('[data-part="tag-label"]')!.textContent).toBe('kiwi');
            const hidden = container.querySelector<HTMLSelectElement>('[data-part="hidden-input"]')!;
            expect([...hidden.selectedOptions].map((o) => o.value)).toEqual(['kiwi']);
            // A duplicate is not added twice; text naming an option commits the option.
            type(input(), 'KIWI');
            key(input(), 'Enter');
            type(input(), 'Banana');
            key(input(), 'Enter');
            expect(state.values).toEqual(['kiwi', 'banana']);
        });

        it('Enter with an empty input, or without allowCustom, is left to the form', () => {
            const state = signal({ values: [] as string[] });
            render(<Combobox.Root items={['apple']} multiple model={[state, 'values']} />, container);
            type(input(), 'kiwi');
            expect(key(input(), 'Enter').defaultPrevented).toBe(false);
            expect(state.values).toEqual([]);
            const fresh = document.body.appendChild(document.createElement('div'));
            render(<Combobox.Root items={['apple']} multiple allowCustom model={[state, 'values']} />, fresh);
            expect(key(fresh.querySelector<HTMLInputElement>('[data-part="input"]')!, 'Enter').defaultPrevented).toBe(false);
        });

        it('a highlighted option wins over the text', () => {
            const state = signal({ values: [] as string[] });
            render(<Combobox.Root items={['apple', 'apricot']} multiple allowCustom model={[state, 'values']} />, container);
            type(input(), 'ap');
            key(input(), 'ArrowDown');
            key(input(), 'Enter');
            expect(state.values).toEqual(['apple']);
        });

        it('single mode: Enter sets the value to the text and closes', () => {
            const state = signal({ value: '', open: false });
            render(<Combobox.Root allowCustom model={[state, 'value']} model:open={[state, 'open']}><Combobox.Control><Combobox.Input /></Combobox.Control><Combobox.Popup /></Combobox.Root>, container);
            type(input(), 'free text');
            expect(state.open).toBe(true);
            key(input(), 'Enter');
            expect(state.value).toBe('free text');
            expect(state.open).toBe(false);
            expect(input().value).toBe('free text');
        });
    });
});

describe('Combobox text resync, APG keys and openOnClick (#265)', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    const COUNTRIES = [
        { code: 'fr', name: 'France' },
        { code: 'de', name: 'Germany' },
        { code: 'es', name: 'Spain' },
    ];
    type Country = (typeof COUNTRIES)[number];

    function countries(opts: { value?: Country | null; openOnClick?: boolean } = {}) {
        const state = signal({ value: (opts.value === undefined ? COUNTRIES[0]! : opts.value) as Country | null, query: '', open: false });
        const changes: Array<Country | null> = [];
        const texts: string[] = [];
        render(
            <form>
                <Combobox.Root
                    items={COUNTRIES}
                    itemKey={(c) => c.code}
                    itemLabel={(c) => c.name}
                    model={[state, 'value']}
                    model:inputValue={[state, 'query']}
                    model:open={[state, 'open']}
                    onValueChange={(v) => changes.push(v)}
                    onInputValueChange={(v) => texts.push(v)}
                    openOnClick={opts.openOnClick}
                    name="country"
                />
                <button type="button" id="elsewhere">elsewhere</button>
            </form>,
            container,
        );
        return {
            state,
            changes,
            texts,
            input: container.querySelector<HTMLInputElement>('[data-part="input"]')!,
            hidden: container.querySelector<HTMLSelectElement>('[data-part="hidden-input"]')!,
            trigger: container.querySelector<HTMLElement>('[data-part="trigger"]')!,
            elsewhere: container.querySelector<HTMLElement>('#elsewhere')!,
            items: () => [...container.querySelectorAll<HTMLElement>('[data-part="item"]')],
        };
    }
    function type(input: HTMLInputElement, text: string) {
        input.value = text;
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    function key(el: HTMLElement, k: string, init: KeyboardEventInit = {}) {
        const e = new KeyboardEvent('keydown', { key: k, cancelable: true, bubbles: true, ...init });
        el.dispatchEvent(e);
        return e;
    }
    function blur(input: HTMLInputElement, to: Element | null) {
        input.dispatchEvent(new FocusEvent('blur', { relatedTarget: to }));
    }

    it('a blur to elsewhere reverts typed text to the value it posts', async () => {
        const { state, input, hidden, elsewhere, texts } = countries();
        expect(input.value).toBe('France');
        type(input, 'Ger');
        expect(state.open).toBe(true);
        blur(input, elsewhere);
        await tick();
        expect(state.open).toBe(false);
        expect(state.value).toEqual(COUNTRIES[0]);
        expect(input.value).toBe('France');
        expect(texts.at(-1)).toBe('France');
        expect(hidden.value).toBe('fr');
    });

    it('a blur that stays inside the combobox (the trigger) does not resync', () => {
        const { state, input, trigger } = countries();
        type(input, 'Ger');
        blur(input, trigger);
        expect(state.query).toBe('Ger');
        expect(state.open).toBe(true);
    });

    it('a blur to nowhere while open is left to the press (option click or outside press)', () => {
        const { state, input } = countries();
        type(input, 'Ger');
        blur(input, null);
        expect(state.query).toBe('Ger');
        // The outside press closes — and the close resyncs.
        document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        document.body.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(state.open).toBe(false);
        expect(state.query).toBe('France');
    });

    it('emptied text clears the value on blur', async () => {
        const { state, input, hidden, elsewhere, changes } = countries();
        type(input, '');
        blur(input, elsewhere);
        await tick();
        expect(state.value).toBe(null);
        expect(changes).toEqual([null]);
        expect(input.value).toBe('');
        expect(hidden.value).toBe('');
    });

    it('with no value, stray text is dropped on blur', () => {
        const { state, input, elsewhere, changes } = countries({ value: null });
        type(input, 'Ger');
        blur(input, elsewhere);
        expect(state.query).toBe('');
        expect(state.value).toBe(null);
        expect(changes).toEqual([]);
    });

    it('Tab closes and resyncs', () => {
        const { state, input } = countries();
        type(input, 'Spa');
        expect(key(input, 'Tab').defaultPrevented).toBe(false);
        expect(state.open).toBe(false);
        expect(state.query).toBe('France');
    });

    it('Escape while open closes and reverts the text', () => {
        const { state, input } = countries();
        type(input, 'Spa');
        expect(key(input, 'Escape').defaultPrevented).toBe(true);
        expect(state.open).toBe(false);
        expect(state.query).toBe('France');
        expect(state.value).toEqual(COUNTRIES[0]);
    });

    it('Escape while closed clears the text and the value, and is swallowed only then', async () => {
        const { state, input, hidden } = countries();
        expect(state.open).toBe(false);
        expect(key(input, 'Escape').defaultPrevented).toBe(true);
        await tick();
        expect(state.query).toBe('');
        expect(state.value).toBe(null);
        expect(hidden.value).toBe('');
        // Nothing left to clear: Escape reaches an enclosing layer.
        expect(key(input, 'Escape').defaultPrevented).toBe(false);
    });

    it('Alt+ArrowDown opens without moving the highlight — onto the chosen option', () => {
        const { state, input, items } = countries();
        key(input, 'ArrowDown', { altKey: true });
        expect(state.open).toBe(true);
        expect(input.getAttribute('aria-activedescendant')).toBe(items()[0]!.id);
        // …and onto none without a value.
        key(input, 'Escape');
        const fresh = document.body.appendChild(document.createElement('div'));
        const s = signal({ value: null as Country | null, open: false });
        render(<Combobox.Root items={COUNTRIES} itemKey={(c) => c.code} itemLabel={(c) => c.name} model={[s, 'value']} model:open={[s, 'open']} />, fresh);
        const other = fresh.querySelector<HTMLInputElement>('[data-part="input"]')!;
        expect(key(other, 'ArrowDown', { altKey: true }).defaultPrevented).toBe(true);
        expect(s.open).toBe(true);
        expect(other.getAttribute('aria-activedescendant')).toBe(null);
    });

    it('Alt+ArrowUp commits the highlighted option and closes', () => {
        const { state, input } = countries({ value: null });
        key(input, 'ArrowDown', { altKey: true }); // nothing highlighted
        key(input, 'ArrowDown'); // France
        key(input, 'ArrowDown'); // Germany
        expect(key(input, 'ArrowUp', { altKey: true }).defaultPrevented).toBe(true);
        expect(state.open).toBe(false);
        expect(state.value).toEqual(COUNTRIES[1]);
        expect(state.query).toBe('Germany');
    });

    it('openOnClick: a click on the input opens the popup; off by default', () => {
        const off = countries();
        off.input.click();
        expect(off.state.open).toBe(false);
        container = document.body.appendChild(document.createElement('div'));
        const on = countries({ openOnClick: true });
        on.input.click();
        expect(on.state.open).toBe(true);
    });

    it('allowCustom commits the typed text on blur', () => {
        const state = signal({ value: '', query: '' });
        render(
            <>
                <Combobox.Root items={['apple', 'banana']} allowCustom model={[state, 'value']} model:inputValue={[state, 'query']} />
                <button type="button" id="out">out</button>
            </>,
            container,
        );
        const input = container.querySelector<HTMLInputElement>('[data-part="input"]')!;
        type(input, 'kiwi');
        blur(input, container.querySelector('#out'));
        expect(state.value).toBe('kiwi');
        expect(state.query).toBe('kiwi');
        type(input, 'BANANA');
        blur(input, container.querySelector('#out'));
        expect(state.value).toBe('banana');
        expect(state.query).toBe('banana');
    });

    it('allowCustom resyncs to the remembered label when the named option has unmounted', async () => {
        const state = signal({ value: '', query: '', show: true });
        render(
            <>
                <Combobox.Root allowCustom model={[state, 'value']} model:inputValue={[state, 'query']}>
                    <Combobox.Control><Combobox.Input /></Combobox.Control>
                    <Combobox.Popup>
                        {() => (state.show ? <Combobox.Item value="banana">Banana Split</Combobox.Item> : null)}
                    </Combobox.Popup>
                </Combobox.Root>
                <button type="button" id="out">out</button>
            </>,
            container,
        );
        const input = container.querySelector<HTMLInputElement>('[data-part="input"]')!;
        type(input, 'banana split');
        blur(input, container.querySelector('#out'));
        expect(state.value).toBe('banana');
        expect(state.query).toBe('Banana Split');
        state.show = false; // the consumer's filter unmounts it
        await tick();
        type(input, 'BANANA SPLIT');
        blur(input, container.querySelector('#out'));
        expect(state.value).toBe('banana');
        expect(state.query).toBe('Banana Split');
    });

    it('multiple: a blur drops the typed query and keeps the tags', () => {
        const state = signal({ values: ['apple'] as string[], query: '' });
        render(
            <>
                <Combobox.Root items={['apple', 'banana']} multiple model={[state, 'values']} model:inputValue={[state, 'query']} />
                <button type="button" id="out">out</button>
            </>,
            container,
        );
        const input = container.querySelector<HTMLInputElement>('[data-part="input"]')!;
        type(input, 'ban');
        blur(input, container.querySelector('#out'));
        expect(state.query).toBe('');
        expect(state.values).toEqual(['apple']);
    });

    it('hand-written items: the chosen label survives the item being filtered away', async () => {
        const state = signal({ value: '', query: '' });
        const List = component(() => () => (
            <>
                {FRUIT.filter((f) => f.toLowerCase().includes(state.query.toLowerCase())).map((f) => (
                    <Combobox.Item value={f.toLowerCase()} key={f}>{f}</Combobox.Item>
                ))}
            </>
        ), { name: 'List' });
        render(
            <>
                <Combobox.Root model={[state, 'value']} model:inputValue={[state, 'query']}>
                    <Combobox.Control><Combobox.Input /></Combobox.Control>
                    <Combobox.Popup><List /></Combobox.Popup>
                </Combobox.Root>
                <button type="button" id="out">out</button>
            </>,
            container,
        );
        const input = container.querySelector<HTMLInputElement>('[data-part="input"]')!;
        type(input, 'ch');
        container.querySelector<HTMLElement>('[data-part="item"]')!.click();
        expect(state.value).toBe('cherry');
        type(input, 'ban'); // Cherry unmounts
        await tick();
        blur(input, container.querySelector('#out'));
        expect(state.query).toBe('Cherry');
        expect(state.value).toBe('cherry');
    });
});

describe('Combobox inline autocomplete (#301)', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    const COUNTRIES = ['Finland', 'France', 'Germany', 'Greece', 'Spain', 'Estonia'];

    function inline(opts: { disabledFirst?: boolean; allowCustom?: boolean } = {}) {
        const state = signal({ value: null as string | null, query: '', open: false });
        render(
            <>
                <Combobox.Root
                    items={COUNTRIES}
                    itemDisabled={(c) => !!opts.disabledFirst && c === 'Finland'}
                    model={[state, 'value']}
                    model:inputValue={[state, 'query']}
                    model:open={[state, 'open']}
                    allowCustom={opts.allowCustom}
                    inlineComplete
                    name="country"
                />
                <button type="button" id="out">out</button>
            </>,
            container,
        );
        const input = container.querySelector<HTMLInputElement>('[data-part="input"]')!;
        input.focus();
        return {
            state,
            input,
            out: container.querySelector<HTMLElement>('#out')!,
            hidden: container.querySelector<HTMLSelectElement>('[data-part="hidden-input"]')!,
            highlighted: () => container.querySelector<HTMLElement>('[data-part="item"][data-highlighted]')?.textContent ?? null,
        };
    }
    /** What a browser does for a keystroke: replace the selection with `text`, caret after it, then `input`. */
    function typeKey(input: HTMLInputElement, text: string, init: InputEventInit = {}) {
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? input.value.length;
        input.value = input.value.slice(0, start) + text + input.value.slice(end);
        input.setSelectionRange(start + text.length, start + text.length);
        input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text, ...init }));
    }
    function backspace(input: HTMLInputElement) {
        const start = input.selectionStart ?? 0;
        const end = input.selectionEnd ?? 0;
        const from = start === end ? Math.max(0, start - 1) : start;
        input.value = input.value.slice(0, from) + input.value.slice(end);
        input.setSelectionRange(from, from);
        input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
    }
    function key(el: HTMLElement, k: string, init: KeyboardEventInit = {}) {
        const e = new KeyboardEvent('keydown', { key: k, cancelable: true, bubbles: true, ...init });
        el.dispatchEvent(e);
        return e;
    }
    const selected = (input: HTMLInputElement) => input.value.slice(input.selectionStart ?? 0, input.selectionEnd ?? 0);

    it('marks the input aria-autocomplete="both" — and only when it applies', () => {
        const { input } = inline();
        expect(input.getAttribute('aria-autocomplete')).toBe('both');
        container.innerHTML = '';
        render(<Combobox.Root items={COUNTRIES} multiple inlineComplete />, container);
        expect(container.querySelector('[data-part="input"]')!.getAttribute('aria-autocomplete')).toBe('list');
    });

    it('typing completes to the first matching option: remainder selected, option highlighted, the query stays typed', () => {
        const { input, state, highlighted } = inline();
        typeKey(input, 'F');
        expect(input.value).toBe('Finland');
        expect(selected(input)).toBe('inland');
        expect(highlighted()).toBe('Finland');
        expect(state.query).toBe('F');
        expect(state.open).toBe(true);
        // Typing over the selection re-completes from the new text.
        typeKey(input, 'r');
        expect(input.value).toBe('France');
        expect(selected(input)).toBe('ance');
        expect(highlighted()).toBe('France');
        expect(state.query).toBe('Fr');
        expect(state.value).toBeNull();
    });

    it('the match is case-insensitive and the typed text keeps its case until a commit', () => {
        const { input, state } = inline();
        typeKey(input, 'fr');
        expect(input.value).toBe('france');
        expect(selected(input)).toBe('ance');
        key(input, 'Enter');
        expect(input.value).toBe('France');
        expect(state.value).toBe('France');
    });

    it('completes to the first option that starts with the text, past ones that only contain it', () => {
        const { input, highlighted } = inline();
        // The contains-filter lists Germany and Greece first; Estonia starts with it.
        typeKey(input, 'E');
        expect(input.value).toBe('Estonia');
        expect(highlighted()).toBe('Estonia');
    });

    it('text no option starts with completes nothing and highlights nothing', () => {
        const { input, highlighted } = inline();
        typeKey(input, 'r'); // France, Germany, Greece contain it; none starts with it
        expect(input.value).toBe('r');
        expect(highlighted()).toBeNull();
    });

    it('skips a disabled first option', () => {
        const { input, highlighted } = inline({ disabledFirst: true });
        typeKey(input, 'F');
        expect(input.value).toBe('France');
        expect(highlighted()).toBe('France');
    });

    it('never completes a deletion, an IME composition, or text typed before the end', () => {
        const { input, highlighted } = inline();
        typeKey(input, 'Fr');
        expect(input.value).toBe('France');
        backspace(input); // removes only the selected completion
        expect(input.value).toBe('Fr');
        expect(highlighted()).toBeNull();
        backspace(input);
        expect(input.value).toBe('F');
        typeKey(input, 'r', { isComposing: true });
        expect(input.value).toBe('Fr');
        expect(highlighted()).toBeNull();
        // A caret in the middle: an insert there is not completed.
        input.setSelectionRange(0, 0);
        typeKey(input, 'G');
        expect(input.value).toBe('GFr');
    });

    it('a paste completes like typing', () => {
        const { input } = inline();
        typeKey(input, 'Ger', { inputType: 'insertFromPaste' });
        expect(input.value).toBe('Germany');
        expect(selected(input)).toBe('many');
    });

    it('Escape first reverts the completion, then follows the usual rules', () => {
        const { input, state, highlighted } = inline();
        typeKey(input, 'Gr');
        expect(input.value).toBe('Greece');
        const first = key(input, 'Escape');
        expect(first.defaultPrevented).toBe(true);
        expect(input.value).toBe('Gr');
        expect(highlighted()).toBeNull();
        expect(state.open).toBe(true);
        key(input, 'Escape');
        expect(state.open).toBe(false);
        expect(input.value).toBe('');
    });

    it('Enter commits the completed option', () => {
        const { input, state, hidden } = inline();
        typeKey(input, 'sp');
        key(input, 'Enter');
        expect(state.value).toBe('Spain');
        expect(input.value).toBe('Spain');
        expect(state.open).toBe(false);
        expect(hidden.value).toBe('Spain');
    });

    it('Tab commits the highlighted option and is not swallowed', () => {
        const { input, state } = inline();
        typeKey(input, 'ger');
        const tab = key(input, 'Tab');
        expect(tab.defaultPrevented).toBe(false);
        expect(state.value).toBe('Germany');
        expect(input.value).toBe('Germany');
        expect(state.open).toBe(false);
    });

    it('a caret move accepts the completed text without committing a value', () => {
        const { input, state, highlighted } = inline();
        typeKey(input, 'Fi');
        key(input, 'End');
        expect(state.query).toBe('Finland');
        expect(input.value).toBe('Finland');
        expect(state.value).toBeNull();
        expect(highlighted()).toBe('Finland');
        // Accepted text is plain text now: Escape closes and reverts it.
        key(input, 'Escape');
        expect(state.open).toBe(false);
    });

    it('a click in the input accepts the completed text, keeping the query in sync', () => {
        const { input, state, highlighted } = inline();
        typeKey(input, 'Fi');
        expect(state.query).toBe('Fi');
        input.setSelectionRange(2, 2);
        input.click();
        expect(state.query).toBe('Finland');
        expect(input.value).toBe('Finland');
        expect(state.value).toBeNull();
        expect(highlighted()).toBe('Finland');
    });

    it('a controlled write away from the typed text retires the completion for good', async () => {
        const { input, state } = inline();
        typeKey(input, 'Fi');
        expect(input.value).toBe('Finland');
        state.query = 'Sp';
        await Promise.resolve();
        state.query = 'Fi';
        await Promise.resolve();
        expect(input.value).toBe('Fi');
    });

    it('ArrowDown leaves the completion behind and walks the list', () => {
        const { input, highlighted } = inline();
        typeKey(input, 'F');
        key(input, 'ArrowDown');
        expect(input.value).toBe('F');
        expect(highlighted()).toBe('France');
    });

    it('a blur resyncs: an unaccepted completion is dropped with the typed text', async () => {
        const { input, state, out } = inline();
        typeKey(input, 'gr');
        input.dispatchEvent(new FocusEvent('blur', { relatedTarget: out }));
        await tick();
        expect(state.open).toBe(false);
        expect(input.value).toBe('');
        expect(state.value).toBeNull();
    });

    it('allowCustom: a blur commits the typed text, not the completion', async () => {
        const { input, state, out } = inline({ allowCustom: true });
        typeKey(input, 'Fr');
        input.dispatchEvent(new FocusEvent('blur', { relatedTarget: out }));
        await tick();
        expect(state.value).toBe('Fr');
        expect(input.value).toBe('Fr');
    });
});

describe('Combobox autoHighlight (#448)', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    type Contact = { name: string; email: string; away?: boolean };
    const CONTACTS: Contact[] = [
        { name: 'Maya Chen', email: 'maya@example.com' },
        { name: 'Marcus Webb', email: 'marcus@example.com' },
        { name: 'Priya Nair', email: 'priya@example.com' },
    ];
    const type = (el: HTMLInputElement, text: string) => { el.value = text; el.dispatchEvent(new Event('input', { bubbles: true })); };
    function key(el: HTMLElement, k: string) {
        const e = new KeyboardEvent('keydown', { key: k, cancelable: true, bubbles: true });
        el.dispatchEvent(e);
        return e;
    }
    const input = () => container.querySelector<HTMLInputElement>('[data-part="input"]')!;
    const highlighted = () => container.querySelector<HTMLElement>('[data-part="item"][data-highlighted]');

    function contacts(opts: { multiple?: boolean; allowCustom?: boolean; autoHighlight?: boolean; openOnClick?: boolean; disabled?: (c: Contact) => boolean } = {}) {
        const state = signal({ value: null as string | null, values: [] as string[], query: '', open: false });
        // The overloads are picked by `multiple`'s and `allowCustom`'s literal types.
        const mode = {
            ...(opts.multiple ? { multiple: true, model: [state, 'values'] } : { model: [state, 'value'] }),
            allowCustom: opts.allowCustom,
        } as unknown as Record<string, never>;
        render(
            <Combobox.Root
                items={CONTACTS}
                itemKey={(c) => c.email}
                itemLabel={(c) => c.name}
                itemValue={(c) => c.email}
                itemDisabled={opts.disabled}
                {...mode}
                autoHighlight={opts.autoHighlight ?? true}
                openOnClick={opts.openOnClick}
                model:inputValue={[state, 'query']}
                model:open={[state, 'open']}
                aria-label="To"
            />,
            container,
        );
        return state;
    }

    it('typing highlights the first visible option, named by aria-activedescendant; Enter selects it (single)', () => {
        const state = contacts();
        type(input(), 'ma');
        const h = highlighted()!;
        expect(h.textContent).toContain('Maya Chen');
        expect(input().getAttribute('aria-activedescendant')).toBe(h.id);
        // The query moves: the head of the new list is highlighted.
        type(input(), 'mar');
        expect(highlighted()!.textContent).toContain('Marcus Webb');
        const e = key(input(), 'Enter');
        expect(e.defaultPrevented).toBe(true);
        expect(state.value).toBe('marcus@example.com');
        expect(state.open).toBe(false);
    });

    it('multiple: Enter adds the highlighted option as a tag and clears the text', () => {
        const state = contacts({ multiple: true });
        type(input(), 'pri');
        key(input(), 'Enter');
        expect(state.values).toEqual(['priya@example.com']);
        expect(state.query).toBe('');
        expect(container.querySelector('[data-part="tag-label"]')!.textContent).toBe('Priya Nair');
    });

    it('allowCustom: a match is picked, a query that matches nothing commits the text', () => {
        const state = contacts({ multiple: true, allowCustom: true });
        type(input(), 'maya');
        key(input(), 'Enter');
        expect(state.values).toEqual(['maya@example.com']);
        type(input(), 'zed@example.com');
        expect(highlighted()).toBeNull();
        expect(input().hasAttribute('aria-activedescendant')).toBe(false);
        expect(key(input(), 'Enter').defaultPrevented).toBe(true);
        expect(state.values).toEqual(['maya@example.com', 'zed@example.com']);
    });

    it('skips a disabled first match', () => {
        contacts({ disabled: (c) => c.name === 'Maya Chen' });
        type(input(), 'ma');
        expect(highlighted()!.textContent).toContain('Marcus Webb');
    });

    it('an empty query or an openOnClick open leaves no highlight, and Enter to the form', () => {
        const state = contacts({ openOnClick: true });
        input().click();
        expect(state.open).toBe(true);
        expect(highlighted()).toBeNull();
        expect(key(input(), 'Enter').defaultPrevented).toBe(false);
        // Typed, then emptied: the highlight goes with the text.
        type(input(), 'ma');
        expect(highlighted()).not.toBeNull();
        type(input(), '');
        expect(state.open).toBe(true);
        expect(highlighted()).toBeNull();
        expect(key(input(), 'Enter').defaultPrevented).toBe(false);
        expect(state.value).toBeNull();
        // ArrowDown on an empty field still starts at the first option, and holds.
        key(input(), 'ArrowDown');
        expect(highlighted()!.textContent).toContain('Maya Chen');
        key(input(), 'ArrowDown');
        expect(highlighted()!.textContent).toContain('Marcus Webb');
    });

    it('an arrow move holds while the query is unchanged', () => {
        const state = contacts();
        type(input(), 'a');
        expect(highlighted()!.textContent).toContain('Maya Chen');
        key(input(), 'ArrowDown');
        expect(highlighted()!.textContent).toContain('Marcus Webb');
        key(input(), 'Enter');
        expect(state.value).toBe('marcus@example.com');
    });

    it('a highlighted option that becomes disabled hands the highlight on', () => {
        const blocked = signal({ maya: false });
        const state = contacts({ disabled: (c) => c.name === 'Maya Chen' && blocked.maya });
        type(input(), 'ma');
        expect(highlighted()!.textContent).toContain('Maya Chen');
        blocked.maya = true;
        expect(highlighted()!.textContent).toContain('Marcus Webb');
        key(input(), 'Enter');
        expect(state.value).toBe('marcus@example.com');
    });

    it('with autoHighlight={false} nothing changes: allowCustom Enter commits the raw text', () => {
        const state = contacts({ multiple: true, allowCustom: true, autoHighlight: false });
        type(input(), 'maya');
        expect(highlighted()).toBeNull();
        key(input(), 'Enter');
        expect(state.values).toEqual(['maya']);
    });

    it('inlineComplete takes precedence: no starts-with match leaves no highlight', () => {
        const state = signal({ value: null as string | null });
        render(<Combobox.Root items={['Finland', 'France', 'Germany']} inlineComplete autoHighlight model={[state, 'value']} aria-label="Country" />, container);
        const el = input();
        el.focus();
        // "an" is contained in France and Germany but starts neither.
        el.value = 'an';
        el.setSelectionRange(2, 2);
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'n' }));
        expect(highlighted()).toBeNull();
        expect(key(el, 'Enter').defaultPrevented).toBe(false);
        // A starts-with match completes and highlights, as without the prop.
        el.value = 'Ge';
        el.setSelectionRange(2, 2);
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'e' }));
        expect(highlighted()!.textContent).toContain('Germany');
        expect(el.value).toBe('Germany');
    });
});

describe('Combobox filterItems (#458)', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    const CONTACTS = [
        { name: 'Maya Chen', email: 'maya@example.com' },
        { name: 'Marcus Webb', email: 'marcus@example.com' },
        { name: 'Priya Nair', email: 'priya@example.com' },
    ];
    const type = (el: HTMLInputElement, text: string) => { el.value = text; el.dispatchEvent(new Event('input', { bubbles: true })); };
    function key(el: HTMLElement, k: string) {
        const e = new KeyboardEvent('keydown', { key: k, cancelable: true, bubbles: true });
        el.dispatchEvent(e);
        return e;
    }
    const input = () => container.querySelector<HTMLInputElement>('[data-part="input"]')!;
    const items = () => [...container.querySelectorAll<HTMLElement>('[data-part="item"]')];
    const texts = () => items().map((i) => i.textContent!.replace('✓', '').trim());
    const highlighted = () => container.querySelector<HTMLElement>('[data-part="item"][data-highlighted]');
    const empty = () => container.querySelector('[data-part="empty"]');

    function contacts(opts: { filterItems?: boolean; textValue?: boolean; filter?: false | ((label: string, query: string) => boolean) } = {}) {
        const state = signal({ value: '', query: '', open: false });
        render(
            <Combobox.Root
                filterItems={opts.filterItems ?? true}
                filter={opts.filter}
                model={[state, 'value']}
                model:inputValue={[state, 'query']}
                model:open={[state, 'open']}
                name="from"
                aria-label="From"
            >
                <Combobox.Control><Combobox.Input /></Combobox.Control>
                <Combobox.Popup>
                    {CONTACTS.map((c) => (
                        <Combobox.Item value={c.email} textValue={opts.textValue === false ? undefined : c.name} key={c.email}>
                            {c.name}
                        </Combobox.Item>
                    ))}
                    <Combobox.Empty>Nobody found</Combobox.Empty>
                </Combobox.Popup>
            </Combobox.Root>,
            container,
        );
        return state;
    }

    it('without filterItems, hand-written items all stay rendered whatever the query', () => {
        contacts({ filterItems: false });
        type(input(), 'zzz');
        expect(texts()).toEqual(['Maya Chen', 'Marcus Webb', 'Priya Nair']);
        expect(empty()).toBeNull();
    });

    it('narrows by textValue, case-insensitively, and shows Combobox.Empty when nothing matches', () => {
        const state = contacts();
        type(input(), 'MA');
        expect(texts()).toEqual(['Maya Chen', 'Marcus Webb']);
        expect(empty()).toBeNull();
        type(input(), 'zzz');
        expect(items()).toHaveLength(0);
        expect(empty()!.textContent).toBe('Nobody found');
        type(input(), '');
        expect(texts()).toEqual(['Maya Chen', 'Marcus Webb', 'Priya Nair']);
        // The hidden select still posts every registered key.
        const options = [...container.querySelectorAll<HTMLOptionElement>('select option')].map((o) => o.value);
        expect(options).toEqual(['']);
        expect(state.value).toBe('');
    });

    it('falls back to the item text when there is no textValue', async () => {
        contacts({ textValue: false });
        await tick();
        type(input(), 'nair');
        expect(texts()).toEqual(['Priya Nair']);
        // The hidden items' remembered text still matches the next query.
        type(input(), 'webb');
        expect(texts()).toEqual(['Marcus Webb']);
    });

    it('the arrows walk only visible items; aria-activedescendant never names a hidden one', () => {
        const state = contacts();
        type(input(), 'ma');
        key(input(), 'ArrowDown');
        expect(highlighted()!.textContent).toContain('Maya Chen');
        key(input(), 'ArrowDown');
        expect(highlighted()!.textContent).toContain('Marcus Webb');
        key(input(), 'ArrowDown');
        expect(highlighted()!.textContent).toContain('Marcus Webb');
        expect(input().getAttribute('aria-activedescendant')).toBe(highlighted()!.id);
        // The highlighted item is filtered out: no dangling reference.
        type(input(), 'maya');
        expect(highlighted()).toBeNull();
        expect(input().hasAttribute('aria-activedescendant')).toBe(false);
        key(input(), 'ArrowDown');
        key(input(), 'Enter');
        expect(state.value).toBe('maya@example.com');
        expect(input().value).toBe('Maya Chen');
    });

    it('a custom filter function is given the label', () => {
        const calls: string[] = [];
        contacts({
            filter: (label, query) => {
                calls.push(label);
                return label.toLowerCase().startsWith(query.toLowerCase());
            },
        });
        type(input(), 'n');
        expect(items()).toHaveLength(0);
        expect(calls).toContain('Priya Nair');
        type(input(), 'p');
        expect(texts()).toEqual(['Priya Nair']);
    });

    it('filter={false} keeps everything visible even with filterItems', () => {
        contacts({ filter: false });
        type(input(), 'zzz');
        expect(items()).toHaveLength(3);
    });

    it('a selected item the query filters out keeps its input label', async () => {
        const state = contacts({ textValue: false });
        await tick();
        type(input(), 'priya');
        key(input(), 'ArrowDown');
        key(input(), 'Enter');
        expect(state.value).toBe('priya@example.com');
        expect(input().value).toBe('Priya Nair');
        // A new query hides the chosen item; the close reverts the text to
        // its remembered label, and the hidden select still names it.
        type(input(), 'maya');
        expect(texts()).toEqual(['Maya Chen']);
        key(input(), 'Escape');
        await tick();
        expect(state.query).toBe('Priya Nair');
        expect(container.querySelector<HTMLOptionElement>('select option[value="priya@example.com"]')!.textContent).toBe('Priya Nair');
    });

    it('under multiple, a chosen item the query filters out keeps its tag label', async () => {
        const multi = signal({ values: [] as string[], query: '' });
        render(
            <Combobox.Root filterItems multiple model={[multi, 'values']} model:inputValue={[multi, 'query']}>
                <Combobox.Control><Combobox.Tags /><Combobox.Input /></Combobox.Control>
                <Combobox.Popup>
                    {CONTACTS.map((c) => <Combobox.Item value={c.email} key={c.email}>{c.name}</Combobox.Item>)}
                </Combobox.Popup>
            </Combobox.Root>,
            container,
        );
        await tick();
        type(input(), 'maya');
        key(input(), 'ArrowDown');
        key(input(), 'Enter');
        expect(multi.values).toEqual(['maya@example.com']);
        type(input(), 'priya');
        expect(texts()).toEqual(['Priya Nair']);
        expect(container.querySelector('[data-part="tag-label"]')!.textContent).toBe('Maya Chen');
    });

    it('is ignored in data mode, which filters by its own rule', () => {
        render(
            <Combobox.Root
                items={CONTACTS}
                itemKey={(c) => c.email}
                itemLabel={(c) => c.name}
                filterItems
                filter={(c, q) => c.email.startsWith(q)}
                aria-label="To"
            />,
            container,
        );
        type(input(), 'pri');
        expect(texts()).toEqual(['Priya Nair']);
        type(input(), 'nair');
        expect(items()).toHaveLength(0);
    });
});
