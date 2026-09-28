/**
 * `data-placeholder` on the text controls (#416): the flag a floating label
 * reads to rest inside its field. Present while the value is empty, gone the
 * moment there is text (or, for a combobox, a chosen value), back on clear or
 * reset — and never on the native element, whose re-render per keystroke
 * would drop a pending `debounce` (see the input anatomy).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { signal } from 'sigx';
import { Combobox, Input, NumberInput, Textarea } from '@sigx/zero';

let container: HTMLElement;
beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
});
afterEach(() => {
    render(null, container);
    container.remove();
});

const part = (scope: string, name: string): HTMLElement =>
    container.querySelector<HTMLElement>(`[data-scope="${scope}"][data-part="${name}"]`)!;
const flagged = (el: Element): boolean => el.hasAttribute('data-placeholder');

function type(el: HTMLInputElement | HTMLTextAreaElement, text: string): void {
    el.value = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('data-placeholder on the text controls', () => {
    it('Input: root and control while empty, cleared by typing, back when emptied', () => {
        render(
            <Input.Root>
                <Input.Label>Name</Input.Label>
                <Input.Control><Input.Input /></Input.Control>
            </Input.Root>,
            container,
        );
        const input = part('input', 'input') as HTMLInputElement;
        expect(flagged(part('input', 'root'))).toBe(true);
        expect(flagged(part('input', 'control'))).toBe(true);
        expect(flagged(input)).toBe(false);

        type(input, 'Ada');
        expect(flagged(part('input', 'root'))).toBe(false);
        expect(flagged(part('input', 'control'))).toBe(false);

        type(input, '');
        expect(flagged(part('input', 'root'))).toBe(true);
    });

    it('Input: follows a model write, and tracks the element under lazy', () => {
        const state = signal({ q: 'seed' });
        render(
            <Input.Root model={() => state.q} modelModifiers={{ lazy: true }}>
                <Input.Control><Input.Input /></Input.Control>
            </Input.Root>,
            container,
        );
        expect(flagged(part('input', 'root'))).toBe(false);
        state.q = '';
        expect(flagged(part('input', 'root'))).toBe(true);
        // `lazy` holds the model back until change; the label must not wait.
        type(part('input', 'input') as HTMLInputElement, 'x');
        expect(state.q).toBe('');
        expect(flagged(part('input', 'root'))).toBe(false);
    });

    it('Textarea: the root while empty', () => {
        render(
            <Textarea.Root>
                <Textarea.Textarea />
            </Textarea.Root>,
            container,
        );
        const textarea = part('textarea', 'textarea') as HTMLTextAreaElement;
        expect(flagged(part('textarea', 'root'))).toBe(true);
        expect(flagged(textarea)).toBe(false);
        type(textarea, 'Notes');
        expect(flagged(part('textarea', 'root'))).toBe(false);
    });

    it('Textarea: tracks the element under debounce', () => {
        const state = signal({ notes: '' });
        render(
            <Textarea.Root model={() => state.notes} modelModifiers={{ debounce: 200 }}>
                <Textarea.Textarea />
            </Textarea.Root>,
            container,
        );
        type(part('textarea', 'textarea') as HTMLTextAreaElement, 'x');
        // The model is held back; what the box shows is not.
        expect(state.notes).toBe('');
        expect(flagged(part('textarea', 'root'))).toBe(false);
    });

    it('NumberInput: root and control while the text is empty, the draft included', () => {
        const state = signal({ n: null as number | null });
        render(
            <NumberInput.Root model={() => state.n}>
                <NumberInput.Control><NumberInput.Input /></NumberInput.Control>
            </NumberInput.Root>,
            container,
        );
        expect(flagged(part('number-input', 'root'))).toBe(true);
        expect(flagged(part('number-input', 'control'))).toBe(true);
        // An uncommitted draft is text in the field — the label floats.
        type(part('number-input', 'input') as HTMLInputElement, '4');
        expect(state.n).toBe(null);
        expect(flagged(part('number-input', 'root'))).toBe(false);
        state.n = 7;
        expect(flagged(part('number-input', 'control'))).toBe(false);
    });

    it('Combobox: empty means no query AND nothing chosen', () => {
        const state = signal({ value: [] as string[], query: '' });
        render(
            <Combobox.Root multiple model={[state, 'value']} model:inputValue={[state, 'query']}>
                <Combobox.Control>
                    <Combobox.Input />
                </Combobox.Control>
                <Combobox.Popup>
                    <Combobox.Item value="apple">Apple</Combobox.Item>
                </Combobox.Popup>
            </Combobox.Root>,
            container,
        );
        expect(flagged(part('combobox', 'root'))).toBe(true);
        expect(flagged(part('combobox', 'control'))).toBe(true);
        expect(flagged(part('combobox', 'input'))).toBe(false);
        state.query = 'ap';
        expect(flagged(part('combobox', 'root'))).toBe(false);
        // A chosen tag with an empty input is still a value — not empty.
        state.query = '';
        state.value = ['apple'];
        expect(flagged(part('combobox', 'root'))).toBe(false);
        expect(flagged(part('combobox', 'control'))).toBe(false);
        state.value = [];
        expect(flagged(part('combobox', 'control'))).toBe(true);
    });

    it('Combobox: trigger mode never claims empty — its Textarea flags itself', () => {
        render(
            <Combobox.Root trigger="@">
                <Textarea.Root><Textarea.Textarea /></Textarea.Root>
                <Combobox.Popup>
                    <Combobox.Item value="ada">Ada</Combobox.Item>
                </Combobox.Popup>
            </Combobox.Root>,
            container,
        );
        expect(flagged(part('combobox', 'root'))).toBe(false);
        expect(flagged(part('textarea', 'root'))).toBe(true);
        type(part('textarea', 'textarea') as HTMLTextAreaElement, 'hi there');
        expect(flagged(part('combobox', 'root'))).toBe(false);
        expect(flagged(part('textarea', 'root'))).toBe(false);
    });
});
