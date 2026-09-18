/**
 * The text-control surface of `Input.Input` and `Textarea.Textarea` (#40).
 *
 * A chat composer built on Textarea needs Enter to send and Shift+Enter to
 * break a line, arrow keys driving an `@mention` popup, the popup's combobox
 * ARIA on the control, and the element itself for the caret. sigx forwards
 * no rest props, so before this every one of those had to be done from a
 * form-level listener filtered by target, or `setAttribute` in `onUpdated`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { signal } from 'sigx';
import { Field, Input, Textarea } from '@sigx/zero';
import type { InputHandle, TextareaHandle } from '@sigx/zero';

type Handlers = {
    onKeydown?: (e: KeyboardEvent) => void;
    onKeyup?: (e: KeyboardEvent) => void;
    onBeforeinput?: (e: InputEvent) => void;
    onInput?: (e: Event) => void;
    onCompositionstart?: (e: CompositionEvent) => void;
    onCompositionend?: (e: CompositionEvent) => void;
    onFocus?: (e: FocusEvent) => void;
    onBlur?: (e: FocusEvent) => void;
};

const kinds = [
    {
        name: 'Textarea.Textarea',
        mount(c: HTMLElement, model: { v: string }, h: Handlers, attrs: Record<string, unknown> = {}, ref?: (r: TextareaHandle | null) => void) {
            render(
                <Textarea.Root model={[model, 'v']}>
                    <Textarea.Textarea {...h} {...attrs} ref={ref} />
                </Textarea.Root>,
                c,
            );
            return c.querySelector<HTMLTextAreaElement>('[data-part="textarea"]')!;
        },
    },
    {
        name: 'Input.Input',
        mount(c: HTMLElement, model: { v: string }, h: Handlers, attrs: Record<string, unknown> = {}, ref?: (r: InputHandle | null) => void) {
            render(
                <Input.Root model={[model, 'v']}>
                    <Input.Control><Input.Input {...h} {...attrs} ref={ref} /></Input.Control>
                </Input.Root>,
                c,
            );
            return c.querySelector<HTMLInputElement>('[data-part="input"]')!;
        },
    },
];

describe.each(kinds)('$name', ({ mount }) => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('forwards key events to the element, where preventDefault works', () => {
        const onKeydown = vi.fn((e: KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) e.preventDefault(); });
        const onKeyup = vi.fn();
        const el = mount(container, signal({ v: '' }), { onKeydown, onKeyup });
        const enter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true });
        el.dispatchEvent(enter);
        expect(onKeydown).toHaveBeenCalledOnce();
        expect(enter.defaultPrevented).toBe(true);
        const shiftEnter = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, cancelable: true, bubbles: true });
        el.dispatchEvent(shiftEnter);
        expect(shiftEnter.defaultPrevented).toBe(false);
        el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
        expect(onKeyup).toHaveBeenCalledOnce();
    });

    it('runs onInput after the model has the new value', () => {
        const model = signal({ v: '' });
        const seen: string[] = [];
        const el = mount(container, model, { onInput: () => seen.push(model.v) });
        el.value = 'hi @';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        expect(seen).toEqual(['hi @']);
    });

    it('forwards beforeinput and composition events', () => {
        const onBeforeinput = vi.fn();
        const onCompositionstart = vi.fn();
        const onCompositionend = vi.fn();
        const el = mount(container, signal({ v: '' }), { onBeforeinput, onCompositionstart, onCompositionend });
        el.dispatchEvent(new Event('beforeinput', { bubbles: true }));
        el.dispatchEvent(new Event('compositionstart', { bubbles: true }));
        el.dispatchEvent(new Event('compositionend', { bubbles: true }));
        expect(onBeforeinput).toHaveBeenCalledOnce();
        expect(onCompositionstart).toHaveBeenCalledOnce();
        expect(onCompositionend).toHaveBeenCalledOnce();
    });

    it('composes onFocus/onBlur with its own focus-visible tracking', () => {
        const onFocus = vi.fn();
        const onBlur = vi.fn();
        const el = mount(container, signal({ v: '' }), { onFocus, onBlur });
        el.focus();
        expect(onFocus).toHaveBeenCalledOnce();
        el.blur();
        expect(onBlur).toHaveBeenCalledOnce();
        expect(el.hasAttribute('data-focus-visible')).toBe(false);
    });

    it('forwards the combobox ARIA a composer sets on its control', () => {
        const el = mount(container, signal({ v: '' }), {}, {
            role: 'combobox',
            'aria-autocomplete': 'list',
            'aria-controls': 'mentions',
            'aria-expanded': false,
            'aria-activedescendant': 'mention-1',
            'data-testid': 'composer',
        });
        expect(el.getAttribute('role')).toBe('combobox');
        expect(el.getAttribute('aria-autocomplete')).toBe('list');
        expect(el.getAttribute('aria-controls')).toBe('mentions');
        expect(el.getAttribute('aria-expanded')).toBe('false');
        expect(el.getAttribute('aria-activedescendant')).toBe('mention-1');
        expect(el.getAttribute('data-testid')).toBe('composer');
    });

    it('keeps its own id and joins an app aria-describedby to its own', () => {
        const el = mount(container, signal({ v: '' }), {}, { id: 'mine', 'aria-describedby': 'hint' });
        expect(el.id).not.toBe('mine');
        expect(el.getAttribute('aria-describedby')).toBe('hint');
    });

    it('hands its ref the element and focus()', () => {
        let handle: TextareaHandle | InputHandle | null = null;
        const el = mount(container, signal({ v: 'hello' }), {}, {}, (r) => { handle = r; });
        expect(handle!.element).toBe(el);
        handle!.focus();
        expect(document.activeElement).toBe(el);
        handle!.element!.setSelectionRange(2, 2);
        expect(el.selectionStart).toBe(2);
    });
});

describe('text controls inside a Field', () => {
    it("joins an app aria-describedby to the Field's description", () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        render(
            <Field.Root>
                <Field.Label>Bio</Field.Label>
                <Textarea.Root>
                    <Textarea.Textarea aria-describedby="counter" />
                </Textarea.Root>
                <Field.Description>Markdown works.</Field.Description>
            </Field.Root>,
            container,
        );
        const el = container.querySelector<HTMLTextAreaElement>('[data-part="textarea"]')!;
        const description = container.querySelector<HTMLElement>('[data-scope="field"][data-part="description"]')!;
        const ids = el.getAttribute('aria-describedby')!.split(' ');
        expect(ids).toContain(description.id);
        expect(ids.at(-1)).toBe('counter');
    });
});
