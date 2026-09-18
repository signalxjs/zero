import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { signal } from 'sigx';
import { Field, Textarea, textareaAnatomy } from '@sigx/zero';
import { expectAnatomy } from './helpers';

function mount(container: HTMLElement, extra: {
    model?: unknown;
    defaultValue?: string;
    name?: string;
    rows?: number;
    maxlength?: number;
    disabled?: boolean;
    readonly?: boolean;
    invalid?: boolean;
    required?: boolean;
} = {}) {
    render(
        <Textarea.Root
            model={extra.model as never}
            defaultValue={extra.defaultValue}
            name={extra.name}
            rows={extra.rows}
            maxlength={extra.maxlength}
            disabled={extra.disabled}
            readonly={extra.readonly}
            invalid={extra.invalid}
            required={extra.required}
        >
            <Textarea.Label>Bio</Textarea.Label>
            <Textarea.Textarea placeholder="Tell us about yourself" />
        </Textarea.Root>,
        container,
    );
}

const box = (c: HTMLElement) => c.querySelector<HTMLTextAreaElement>('[data-part="textarea"]')!;
const part = (c: HTMLElement, name: string) =>
    c.querySelector<HTMLElement>(`[data-scope="textarea"][data-part="${name}"]`)!;

function type(el: HTMLTextAreaElement, text: string) {
    el.value = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('Textarea', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('renders a valid anatomy', () => {
        mount(container, { name: 'bio', defaultValue: 'hi' });
        expectAnatomy(container, textareaAnatomy);
        for (const name of ['root', 'label', 'textarea']) {
            expect(part(container, name), `textarea/${name} must render`).toBeTruthy();
        }
    });

    it('has no control box — the chrome draws on the element itself', () => {
        // Input's `control` exists so something can sit beside the text inside
        // the box. A textarea has no such inside, and this asserts the
        // anatomies stayed deliberately different rather than drifting.
        mount(container);
        expect(container.querySelector('[data-scope="textarea"][data-part="control"]')).toBeNull();
        expect(textareaAnatomy.partNames()).toEqual(['root', 'label', 'textarea']);
    });

    it('posts under its own name — there is no hidden mirror', () => {
        mount(container, { name: 'bio', defaultValue: 'hi' });
        expect(container.querySelectorAll('input').length).toBe(0);
        expect(box(container).name).toBe('bio');
        expect(box(container).value).toBe('hi');
    });

    it('writes through on every keystroke', () => {
        const state = signal({ bio: '' });
        mount(container, { model: () => state.bio });
        type(box(container), 'a');
        expect(state.bio).toBe('a');
        type(box(container), 'ab');
        expect(state.bio).toBe('ab');
    });

    it('runs uncontrolled from defaultValue', () => {
        mount(container, { defaultValue: 'seed' });
        expect(box(container).value).toBe('seed');
        type(box(container), 'edited');
        expect(box(container).value).toBe('edited');
    });

    it('passes rows and maxlength to the element', () => {
        mount(container, { rows: 6, maxlength: 280 });
        // Attributes, not the IDL properties: happy-dom reflects `rows` as a
        // string, and asserting the attribute is what the recipe and the
        // server-rendered markup actually see anyway.
        expect(box(container).getAttribute('rows')).toBe('6');
        expect(box(container).getAttribute('maxlength')).toBe('280');
    });

    it('carries disabled/readonly/required/invalid onto every part that declares them', () => {
        mount(container, { disabled: true, readonly: true, required: true, invalid: true });
        for (const name of ['root', 'textarea']) {
            const el = part(container, name);
            expect(el.getAttribute('data-disabled'), `${name} data-disabled`).toBe('');
            expect(el.getAttribute('data-invalid'), `${name} data-invalid`).toBe('');
            expect(el.getAttribute('data-required'), `${name} data-required`).toBe('');
            expect(el.getAttribute('data-readonly'), `${name} data-readonly`).toBe('');
        }
        expect(box(container).disabled).toBe(true);
        expect(box(container).readOnly).toBe(true);
        expect(box(container).required).toBe(true);
        expect(box(container).getAttribute('aria-invalid')).toBe('true');
    });

    it('wires its own label standalone', () => {
        mount(container);
        const label = part(container, 'label') as HTMLLabelElement;
        expect(box(container).id).not.toBe('');
        expect(label.getAttribute('for')).toBe(box(container).id);
    });

    it('a Field supplies the id, the description and the flags', () => {
        render(
            <Field.Root invalid required disabled>
                <Field.Label>Bio</Field.Label>
                <Textarea.Root>
                    <Textarea.Textarea />
                </Textarea.Root>
                <Field.Description>Markdown is fine.</Field.Description>
                <Field.Error>Too long.</Field.Error>
            </Field.Root>,
            container,
        );
        const el = box(container);
        const label = container.querySelector<HTMLLabelElement>('[data-scope="field"][data-part="label"]')!;

        expect(el.id).not.toBe('');
        expect(label.getAttribute('for')).toBe(el.id);
        const describedBy = el.getAttribute('aria-describedby') ?? '';
        for (const name of ['description', 'error']) {
            expect(describedBy, `aria-describedby must name the field's ${name}`).toContain(
                container.querySelector(`[data-scope="field"][data-part="${name}"]`)!.id,
            );
        }

        expect(part(container, 'root').getAttribute('data-invalid')).toBe('');
        expect(el.disabled).toBe(true);
        expect(el.required).toBe(true);
        expect(el.getAttribute('aria-invalid')).toBe('true');
    });

    it('passes the variant axes through as data attributes', () => {
        render(
            <Textarea.Root color="primary" size="lg">
                <Textarea.Textarea />
            </Textarea.Root>,
            container,
        );
        const root = part(container, 'root');
        expect(root.getAttribute('data-color')).toBe('primary');
        expect(root.getAttribute('data-size')).toBe('lg');
    });
});
