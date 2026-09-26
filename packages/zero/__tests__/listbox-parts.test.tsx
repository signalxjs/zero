import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { signal } from 'sigx';
import { Combobox, Select, comboboxAnatomy, selectAnatomy } from '@sigx/zero';
import { expectAnatomy } from './helpers';

/** watch()-driven syncs settle a tick after the write. */
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const key = (el: HTMLElement, k: string): void => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
};
const type = (input: HTMLInputElement, text: string): void => {
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
};

/** The clear-trigger, the separator and combobox's loading part (#280). */
describe('listbox parts (#280)', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    const part = <E extends HTMLElement = HTMLElement>(name: string): E | null =>
        container.querySelector<E>(`[data-part="${name}"]`);

    describe('Select.ClearTrigger', () => {
        function mount(state: { fruit: string }, props: { disabled?: boolean; readonly?: boolean } = {}) {
            render(
                <Select.Root model={[state, 'fruit']} placeholder="Pick a fruit…" {...props}>
                    <Select.Trigger label="Fruit"><Select.Value /><Select.Indicator /></Select.Trigger>
                    <Select.ClearTrigger />
                    <Select.Popup>
                        <Select.Item value="apple">Apple</Select.Item>
                        <Select.Item value="banana">Banana</Select.Item>
                    </Select.Popup>
                </Select.Root>,
                container,
            );
        }

        it('renders only while something is selected: a tab stop beside the trigger, never inside it', async () => {
            const state = signal({ fruit: '' });
            mount(state);
            expect(part('clear-trigger')).toBeNull();
            state.fruit = 'apple';
            await tick();
            const clear = part('clear-trigger')!;
            expect(clear.tagName).toBe('BUTTON');
            expect(clear.getAttribute('type')).toBe('button');
            expect(clear.getAttribute('aria-label')).toBe('Clear selection');
            expect(clear.tabIndex).toBe(0);
            expect(clear.parentElement).toBe(part('root'));
            expect(part('trigger')!.contains(clear)).toBe(false);
            expectAnatomy(container, selectAnatomy);
        });

        it('clears the model and returns focus to the trigger', async () => {
            const state = signal({ fruit: 'banana' });
            const changes: unknown[] = [];
            render(
                <Select.Root model={[state, 'fruit']} onValueChange={(v: unknown) => changes.push(v)}>
                    <Select.Trigger label="Fruit"><Select.Value /></Select.Trigger>
                    <Select.ClearTrigger label="Reset fruit" />
                    <Select.Popup><Select.Item value="banana">Banana</Select.Item></Select.Popup>
                </Select.Root>,
                container,
            );
            const clear = part('clear-trigger')!;
            expect(clear.getAttribute('aria-label')).toBe('Reset fruit');
            clear.click();
            await tick();
            expect(state.fruit).toBe('');
            expect(changes).toEqual(['']);
            expect(document.activeElement).toBe(part('trigger'));
            expect(part('clear-trigger')).toBeNull();
            expect(part('trigger')!.hasAttribute('data-placeholder')).toBe(true);
        });

        it('a data-driven root writes null, and `clearable` puts one in the default composition', async () => {
            const state = signal({ code: 'se' as string | null });
            render(
                <Select.Root
                    items={[{ code: 'se', name: 'Sweden' }, { code: 'no', name: 'Norway' }]}
                    itemValue={(c) => c.code}
                    itemLabel={(c) => c.name}
                    model={[state, 'code']}
                    clearable
                />,
                container,
            );
            part('clear-trigger')!.click();
            await tick();
            expect(state.code).toBeNull();
        });

        it('under `multiple` clears to the empty array', async () => {
            const state = signal({ picks: ['apple', 'banana'] });
            render(
                <Select.Root multiple model={[state, 'picks']}>
                    <Select.Trigger label="Fruit"><Select.Value /></Select.Trigger>
                    <Select.ClearTrigger />
                    <Select.Popup>
                        <Select.Item value="apple">Apple</Select.Item>
                        <Select.Item value="banana">Banana</Select.Item>
                    </Select.Popup>
                </Select.Root>,
                container,
            );
            part('clear-trigger')!.click();
            await tick();
            expect(state.picks).toEqual([]);
        });

        it('is not offered on a disabled or readonly select', () => {
            mount(signal({ fruit: 'apple' }), { disabled: true });
            expect(part('clear-trigger')).toBeNull();
            container.innerHTML = '';
            mount(signal({ fruit: 'apple' }), { readonly: true });
            expect(part('clear-trigger')).toBeNull();
        });
    });

    describe('Select.Separator', () => {
        it('is an aria-hidden separator the keyboard and typeahead walk past', () => {
            const state = signal({ fruit: '' });
            render(
                <Select.Root model={[state, 'fruit']}>
                    <Select.Trigger label="Fruit"><Select.Value /></Select.Trigger>
                    <Select.Popup>
                        <Select.Item value="apple">Apple</Select.Item>
                        <Select.Separator />
                        <Select.Item value="banana">Banana</Select.Item>
                    </Select.Popup>
                </Select.Root>,
                container,
            );
            const sep = part('separator')!;
            expect(sep.getAttribute('role')).toBe('separator');
            expect(sep.getAttribute('aria-hidden')).toBe('true');
            expect(sep.hasAttribute('id')).toBe(false);
            expectAnatomy(container, selectAnatomy);

            const trigger = part('trigger')!;
            key(trigger, 'ArrowDown'); // opens on apple
            const items = container.querySelectorAll<HTMLElement>('[data-part="item"]');
            expect(trigger.getAttribute('aria-activedescendant')).toBe(items[0]!.id);
            key(trigger, 'ArrowDown'); // straight past the rule
            expect(trigger.getAttribute('aria-activedescendant')).toBe(items[1]!.id);
            key(trigger, 'End');
            expect(trigger.getAttribute('aria-activedescendant')).toBe(items[1]!.id);
            // The options are the listbox's only options: the rule takes no
            // place in the set a reader counts.
            expect(part('popup')!.querySelectorAll('[role="option"]').length).toBe(2);
            key(trigger, 'Escape');
            key(trigger, 'b'); // closed typeahead selects
            expect(state.fruit).toBe('banana');
        });
    });

    describe('Combobox.ClearTrigger', () => {
        function mount(state: { value: string; query: string }, props: { disabled?: boolean } = {}) {
            render(
                <Combobox.Root model={[state, 'value']} model:inputValue={[state, 'query']} {...props}>
                    <Combobox.Control>
                        <Combobox.Input aria-label="Fruit" />
                        <Combobox.ClearTrigger />
                        <Combobox.Trigger />
                    </Combobox.Control>
                    <Combobox.Popup>
                        <Combobox.Item value="apple">Apple</Combobox.Item>
                        <Combobox.Item value="banana">Banana</Combobox.Item>
                    </Combobox.Popup>
                </Combobox.Root>,
                container,
            );
        }

        it('renders while there is a value or text, as a pointer affordance in the control', async () => {
            const state = signal({ value: '', query: '' });
            mount(state);
            expect(part('clear-trigger')).toBeNull();
            type(part<HTMLInputElement>('input')!, 'ba');
            await tick();
            const clear = part('clear-trigger')!;
            expect(clear.parentElement).toBe(part('control'));
            expect(clear.tabIndex).toBe(-1);
            expect(clear.getAttribute('aria-label')).toBe('Clear');
            expectAnatomy(container, comboboxAnatomy);
        });

        it('clears the value and the text, and refocuses the input', async () => {
            const state = signal({ value: 'banana', query: 'Banana' });
            mount(state);
            await tick();
            part('clear-trigger')!.click();
            await tick();
            expect(state.value).toBe('');
            expect(state.query).toBe('');
            expect(part<HTMLInputElement>('input')!.value).toBe('');
            expect(document.activeElement).toBe(part('input'));
            expect(part('clear-trigger')).toBeNull();
        });

        it('under `multiple` empties the array; `clearable` puts one in the data expansion', async () => {
            const state = signal({ picks: ['apple', 'kiwi'] as string[] });
            render(<Combobox.Root items={['apple', 'kiwi', 'pear']} multiple clearable model={[state, 'picks']} />, container);
            expect(part('control')!.contains(part('clear-trigger'))).toBe(true);
            part('clear-trigger')!.click();
            await tick();
            expect(state.picks).toEqual([]);
            expect(container.querySelectorAll('[data-part="tag"]').length).toBe(0);
        });

        it('is not offered on a disabled combobox', () => {
            mount(signal({ value: 'apple', query: 'Apple' }), { disabled: true });
            expect(part('clear-trigger')).toBeNull();
        });
    });

    describe('Combobox.Separator', () => {
        it('is skipped by option navigation', () => {
            render(
                <Combobox.Root defaultValue="">
                    <Combobox.Control><Combobox.Input aria-label="Fruit" /></Combobox.Control>
                    <Combobox.Popup>
                        <Combobox.Item value="apple">Apple</Combobox.Item>
                        <Combobox.Separator />
                        <Combobox.Item value="banana">Banana</Combobox.Item>
                    </Combobox.Popup>
                </Combobox.Root>,
                container,
            );
            expect(part('separator')!.getAttribute('aria-hidden')).toBe('true');
            const input = part<HTMLInputElement>('input')!;
            key(input, 'ArrowDown');
            const items = container.querySelectorAll<HTMLElement>('[data-part="item"]');
            expect(input.getAttribute('aria-activedescendant')).toBe(items[0]!.id);
            key(input, 'ArrowDown');
            expect(input.getAttribute('aria-activedescendant')).toBe(items[1]!.id);
            key(input, 'ArrowDown'); // clamps at the last option, never the rule
            expect(input.getAttribute('aria-activedescendant')).toBe(items[1]!.id);
            expectAnatomy(container, comboboxAnatomy);
        });
    });

    describe('Combobox loading', () => {
        it('marks the listbox busy, renders Loading and holds Empty back', async () => {
            render(
                <Combobox.Root defaultOpen loading>
                    <Combobox.Control><Combobox.Input aria-label="City" /></Combobox.Control>
                    <Combobox.Popup>
                        <Combobox.Loading>Loading cities…</Combobox.Loading>
                        <Combobox.Empty>No city</Combobox.Empty>
                    </Combobox.Popup>
                </Combobox.Root>,
                container,
            );
            const popup = part('popup')!;
            expect(popup.getAttribute('aria-busy')).toBe('true');
            const loading = part('loading')!;
            expect(loading.textContent).toBe('Loading cities…');
            // A listbox owns options and groups only: the row is presentation,
            // and the busy listbox is what AT is told.
            expect(loading.getAttribute('role')).toBe('presentation');
            expect(loading.hasAttribute('aria-live')).toBe(false);
            expect(part('empty')).toBeNull();
            expect(popup.getAttribute('data-state')).toBe('open');
            expectAnatomy(container, comboboxAnatomy);
        });

        it('once loaded: not busy, no Loading, and Empty speaks for an empty list', () => {
            render(
                <Combobox.Root defaultOpen loading={false}>
                    <Combobox.Control><Combobox.Input aria-label="City" /></Combobox.Control>
                    <Combobox.Popup>
                        <Combobox.Loading>Loading cities…</Combobox.Loading>
                        <Combobox.Empty>No city</Combobox.Empty>
                    </Combobox.Popup>
                </Combobox.Root>,
                container,
            );
            expect(part('popup')!.hasAttribute('aria-busy')).toBe(false);
            expect(part('loading')).toBeNull();
            expect(part('empty')!.textContent).toBe('No city');
        });

        it('the data expansion renders `loadingText` in place of `emptyText`', () => {
            render(<Combobox.Root items={[] as string[]} defaultOpen loading loadingText="Loading…" emptyText="Nothing" />, container);
            expect(part('loading')!.textContent).toBe('Loading…');
            expect(part('empty')).toBeNull();
        });
    });
});
