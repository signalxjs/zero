import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { signal } from 'sigx';
import { Checkbox, Input, Switch, Tabs, Textarea } from '@sigx/zero';

describe('getter-form model binding', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('Switch: model={() => state.on} reads and writes back', () => {
        const state = signal({ on: false });
        render(<Switch.Root model={() => state.on}>Label</Switch.Root>, container);
        const input = container.querySelector<HTMLInputElement>('input')!;

        // write-back: DOM change updates the signal
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        expect(state.on).toBe(true);

        // read: signal change updates the DOM
        state.on = false;
        expect(container.querySelector('[data-part="root"]')!.getAttribute('data-state')).toBe('unchecked');
    });

    it('Tabs: model={() => state.tab} two-way', () => {
        const state = signal({ tab: 'a' });
        render(
            <Tabs.Root model={() => state.tab}>
                <Tabs.List>
                    <Tabs.Tab value="a">A</Tabs.Tab>
                    <Tabs.Tab value="b">B</Tabs.Tab>
                </Tabs.List>
            </Tabs.Root>,
            container,
        );
        const tabs = container.querySelectorAll<HTMLElement>('[data-part="tab"]');
        tabs[1]!.click();
        expect(state.tab).toBe('b');
        state.tab = 'a';
        expect(tabs[0]!.getAttribute('data-state')).toBe('active');
    });

    it('Input: model={() => state.email} two-way', () => {
        const state = signal({ email: '' });
        render(
            <Input.Root model={() => state.email}>
                <Input.Control><Input.Input /></Input.Control>
            </Input.Root>,
            container,
        );
        const input = container.querySelector<HTMLInputElement>('[data-part="input"]')!;

        input.value = 'a@b.c';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        expect(state.email).toBe('a@b.c');

        // The read direction, which typing alone cannot prove: the field
        // follows the signal when something else writes it.
        state.email = 'x@y.z';
        expect(input.value).toBe('x@y.z');
    });
});

// The binding law, from the consumer's side: whatever sigx gives a raw
// native element, a zero wrapper around that element gives too. These are
// the capabilities the hand-wired value=/onInput pairs used to lose.
describe('modelModifiers reach the native control through the zero wrapper', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(() => { vi.useRealTimers(); });

    const type = (el: HTMLInputElement | HTMLTextAreaElement, text: string) => {
        el.value = text;
        el.dispatchEvent(new Event('input', { bubbles: true }));
    };

    it('Input: debounce holds the write-back until the timer fires', () => {
        vi.useFakeTimers();
        const state = signal({ q: '' });
        render(
            <Input.Root model={() => state.q} modelModifiers={{ debounce: 200 }}>
                <Input.Control><Input.Input /></Input.Control>
            </Input.Root>,
            container,
        );
        const input = container.querySelector<HTMLInputElement>('[data-part="input"]')!;
        type(input, 'abc');
        expect(state.q).toBe('');
        vi.advanceTimersByTime(199);
        expect(state.q).toBe('');
        vi.advanceTimersByTime(1);
        expect(state.q).toBe('abc');
    });

    it('Input: lazy syncs on change, not on every keystroke', () => {
        const state = signal({ q: '' });
        render(
            <Input.Root model={() => state.q} modelModifiers={{ lazy: true }}>
                <Input.Control><Input.Input /></Input.Control>
            </Input.Root>,
            container,
        );
        const input = container.querySelector<HTMLInputElement>('[data-part="input"]')!;
        type(input, 'abc');
        expect(state.q).toBe('');
        input.dispatchEvent(new Event('change', { bubbles: true }));
        expect(state.q).toBe('abc');
    });

    it('Input: trim applies exactly once, controlled and uncontrolled', () => {
        const state = signal({ q: '' });
        const seen: string[] = [];
        render(
            <div>
                <Input.Root model={() => state.q} modelModifiers={{ trim: true }}>
                    <Input.Control><Input.Input /></Input.Control>
                </Input.Root>
                <Input.Root modelModifiers={{ trim: true }} onValueChange={(v) => seen.push(v)}>
                    <Input.Control><Input.Input /></Input.Control>
                </Input.Root>
            </div>,
            container,
        );
        const [controlled, uncontrolled] = Array.from(container.querySelectorAll<HTMLInputElement>('[data-part="input"]'));
        type(controlled!, '  a  ');
        expect(state.q).toBe('a');
        type(uncontrolled!, '  b  ');
        expect(seen).toEqual(['b']);
    });

    it('Textarea: lazy syncs on change', () => {
        const state = signal({ bio: '' });
        render(
            <Textarea.Root model={() => state.bio} modelModifiers={{ lazy: true }}>
                <Textarea.Textarea />
            </Textarea.Root>,
            container,
        );
        const el = container.querySelector<HTMLTextAreaElement>('[data-part="textarea"]')!;
        type(el, 'x');
        expect(state.bio).toBe('');
        el.dispatchEvent(new Event('change', { bubbles: true }));
        expect(state.bio).toBe('x');
    });

    it('Checkbox: array mode — several boxes over one string[] model toggle membership', () => {
        const state = signal({ tags: ['news'] as string[] });
        const reported: boolean[] = [];
        render(
            <div>
                <Checkbox.Root model={() => state.tags} value="news" onCheckedChange={(v) => reported.push(v)}>News</Checkbox.Root>
                <Checkbox.Root model={() => state.tags} value="deals">Deals</Checkbox.Root>
            </div>,
            container,
        );
        const [news, deals] = Array.from(container.querySelectorAll<HTMLInputElement>('input'));
        const roots = container.querySelectorAll<HTMLElement>('[data-scope="checkbox"][data-part="root"]');
        expect(news!.checked).toBe(true);
        expect(deals!.checked).toBe(false);
        expect(roots[0]!.getAttribute('data-state')).toBe('checked');
        expect(roots[1]!.getAttribute('data-state')).toBe('unchecked');

        deals!.checked = true;
        deals!.dispatchEvent(new Event('change', { bubbles: true }));
        expect(state.tags).toEqual(['news', 'deals']);
        expect(roots[1]!.getAttribute('data-state')).toBe('checked');

        news!.checked = false;
        news!.dispatchEvent(new Event('change', { bubbles: true }));
        expect(state.tags).toEqual(['deals']);
        expect(roots[0]!.getAttribute('data-state')).toBe('unchecked');
        // checkedChange reports THIS box's state, not the array.
        expect(reported).toEqual([false]);
    });
});
