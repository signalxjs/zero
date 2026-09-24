// #172 — `items` that start undefined (still loading) and resolve later.
// The data mode used to be decided once, at setup: an `items` prop that was
// undefined on the first render left the root in the hand-written shape for
// its whole life, so the later list rendered nothing and never posted.
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { component, signal } from 'sigx';
import { Combobox, RadioGroup, Select } from '@sigx/zero';

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('items that arrive after the first render (#172)', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    const hiddenOptions = () => [...container.querySelector<HTMLSelectElement>('[data-part="hidden-input"]')!.options].map((o) => o.value);
    const itemCount = () => container.querySelectorAll('[data-part="item"]').length;

    it('Select renders, posts and selects the list once it resolves — and clears to the data-mode empty', async () => {
        const s = signal({ list: undefined as string[] | undefined, value: undefined as unknown });
        const App = component(() => () => (
            <Select.Root
                items={s.list}
                name="later"
                placeholder="Loading…"
                onValueChange={(v: unknown) => { s.value = v; }}
            />
        ));
        render(<App />, container);
        expect(itemCount()).toBe(0);
        expect(hiddenOptions()).toEqual(['']);
        s.list = ['a', 'b'];
        await tick();
        expect(itemCount()).toBe(2);
        expect(hiddenOptions()).toEqual(['', 'a', 'b']);
        container.querySelectorAll<HTMLElement>('[data-part="item"]')[1]!.click();
        await tick();
        expect(s.value).toBe('b');
        expect(container.querySelector('[data-part="value"]')!.textContent).toBe('b');
        // Nothing chosen is now the data-mode null, not the hand-written ''.
        const hidden = container.querySelector<HTMLSelectElement>('[data-part="hidden-input"]')!;
        hidden.value = '';
        hidden.dispatchEvent(new Event('change', { bubbles: true }));
        expect(s.value).toBeNull();
    });

    it('Combobox renders the list once it resolves and selects from it', async () => {
        const s = signal({ list: undefined as string[] | undefined, value: undefined as unknown });
        const App = component(() => () => (
            <Combobox.Root
                items={s.list}
                name="later"
                defaultOpen
                onValueChange={(v: unknown) => { s.value = v; }}
            />
        ));
        render(<App />, container);
        expect(itemCount()).toBe(0);
        s.list = ['apple', 'banana'];
        await tick();
        expect(itemCount()).toBe(2);
        expect(hiddenOptions()).toEqual(['', 'apple', 'banana']);
        container.querySelectorAll<HTMLElement>('[data-part="item"]')[0]!.click();
        await tick();
        expect(s.value).toBe('apple');
        expect(container.querySelector<HTMLInputElement>('[data-part="input"]')!.value).toBe('apple');
    });

    it('RadioGroup renders one radio per item once the list resolves', async () => {
        const s = signal({ list: undefined as string[] | undefined });
        const App = component(() => () => <RadioGroup.Root items={s.list} name="plan" />);
        render(<App />, container);
        expect(itemCount()).toBe(0);
        s.list = ['free', 'pro'];
        await tick();
        expect(itemCount()).toBe(2);
        expect([...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')].map((r) => r.value)).toEqual(['free', 'pro']);
    });
});
