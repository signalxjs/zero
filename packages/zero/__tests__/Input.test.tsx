import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { signal } from 'sigx';
import { Field, Input, inputAnatomy } from '@sigx/zero';
import { expectAnatomy } from './helpers';

function mount(container: HTMLElement, extra: {
    model?: unknown;
    defaultValue?: string;
    type?: 'text' | 'email' | 'password' | 'search' | 'tel' | 'url';
    name?: string;
    autocomplete?: string;
    maxlength?: number;
    disabled?: boolean;
    readonly?: boolean;
    invalid?: boolean;
    required?: boolean;
} = {}) {
    render(
        <Input.Root
            model={extra.model as never}
            defaultValue={extra.defaultValue}
            type={extra.type}
            name={extra.name}
            autocomplete={extra.autocomplete}
            maxlength={extra.maxlength}
            disabled={extra.disabled}
            readonly={extra.readonly}
            invalid={extra.invalid}
            required={extra.required}
        >
            <Input.Label>Email</Input.Label>
            <Input.Control>
                <Input.Input placeholder="you@example.com" />
            </Input.Control>
        </Input.Root>,
        container,
    );
}

const field = (c: HTMLElement) => c.querySelector<HTMLInputElement>('[data-part="input"]')!;
const part = (c: HTMLElement, name: string) =>
    c.querySelector<HTMLElement>(`[data-scope="input"][data-part="${name}"]`)!;

function type(el: HTMLInputElement, text: string) {
    el.value = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('Input', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('renders a valid anatomy', () => {
        mount(container, { name: 'email', defaultValue: 'a@b.c' });
        expectAnatomy(container, inputAnatomy);
        for (const name of ['root', 'label', 'control', 'input']) {
            expect(part(container, name), `input/${name} must render`).toBeTruthy();
        }
    });

    it('posts under its own name — there is no hidden mirror', () => {
        // The distinguishing fact of this component against Checkbox/Switch/
        // NumberInput: the visible element IS the form control, so a second
        // `input` in the DOM would mean the anatomy grew one behind our back.
        mount(container, { name: 'email', defaultValue: 'a@b.c' });
        const inputs = container.querySelectorAll('input');
        expect(inputs.length).toBe(1);
        expect(field(container).name).toBe('email');
        expect(field(container).value).toBe('a@b.c');
    });

    it('writes through on every keystroke', () => {
        const state = signal({ email: '' });
        mount(container, { model: () => state.email });
        type(field(container), 'a');
        expect(state.email).toBe('a');
        // No draft/commit split — the model tracks the field, it does not lag
        // it until blur the way NumberInput's does.
        type(field(container), 'ab');
        expect(state.email).toBe('ab');
    });

    it('runs uncontrolled from defaultValue', () => {
        mount(container, { defaultValue: 'seed' });
        expect(field(container).value).toBe('seed');
        type(field(container), 'edited');
        expect(field(container).value).toBe('edited');
    });

    it('defaults to type=text and passes the declared types through', () => {
        mount(container);
        expect(field(container).getAttribute('type')).toBe('text');

        const other = document.createElement('div');
        document.body.appendChild(other);
        mount(other, { type: 'password', autocomplete: 'current-password', maxlength: 64 });
        expect(field(other).getAttribute('type')).toBe('password');
        expect(field(other).getAttribute('autocomplete')).toBe('current-password');
        expect(field(other).getAttribute('maxlength')).toBe('64');
    });

    it('carries disabled/readonly/required/invalid onto the parts that declare them', () => {
        mount(container, { disabled: true, readonly: true, required: true, invalid: true });
        for (const name of ['root', 'input']) {
            const el = part(container, name);
            expect(el.getAttribute('data-disabled'), `${name} data-disabled`).toBe('');
            expect(el.getAttribute('data-invalid'), `${name} data-invalid`).toBe('');
            expect(el.getAttribute('data-required'), `${name} data-required`).toBe('');
            expect(el.getAttribute('data-readonly'), `${name} data-readonly`).toBe('');
        }
        // `control` is where the ring and the invalid tint draw, so it needs
        // the flags too — minus `required`, which is a fact about the value,
        // not about the box.
        const control = part(container, 'control');
        expect(control.getAttribute('data-disabled')).toBe('');
        expect(control.getAttribute('data-invalid')).toBe('');
        expect(control.getAttribute('data-readonly')).toBe('');

        expect(field(container).disabled).toBe(true);
        expect(field(container).readOnly).toBe(true);
        expect(field(container).required).toBe(true);
        expect(field(container).getAttribute('aria-invalid')).toBe('true');
    });

    it('wires its own label standalone', () => {
        mount(container);
        const label = part(container, 'label') as HTMLLabelElement;
        expect(field(container).id).not.toBe('');
        expect(label.getAttribute('for')).toBe(field(container).id);
    });

    it('a Field supplies the id, the description and the flags', () => {
        render(
            <Field.Root invalid required disabled>
                <Field.Label>Email</Field.Label>
                <Input.Root>
                    <Input.Control>
                        <Input.Input />
                    </Input.Control>
                </Input.Root>
                <Field.Description>We never spam.</Field.Description>
                <Field.Error>That address looks wrong.</Field.Error>
            </Field.Root>,
            container,
        );
        const input = field(container);
        const label = container.querySelector<HTMLLabelElement>('[data-scope="field"][data-part="label"]')!;

        // The whole point of the component: a raw <input> in a Field gets
        // none of this, which is why zero had to own one.
        expect(input.id).not.toBe('');
        expect(label.getAttribute('for')).toBe(input.id);
        const describedBy = input.getAttribute('aria-describedby') ?? '';
        for (const name of ['description', 'error']) {
            expect(describedBy, `aria-describedby must name the field's ${name}`).toContain(
                container.querySelector(`[data-scope="field"][data-part="${name}"]`)!.id,
            );
        }

        expect(part(container, 'root').getAttribute('data-invalid')).toBe('');
        expect(part(container, 'root').getAttribute('data-required')).toBe('');
        expect(part(container, 'root').getAttribute('data-disabled')).toBe('');
        expect(input.disabled).toBe(true);
        expect(input.required).toBe(true);
        expect(input.getAttribute('aria-invalid')).toBe('true');
    });

    it('a Field cannot un-set what the prop asserts', () => {
        render(
            <Field.Root>
                <Input.Root invalid required disabled>
                    <Input.Control><Input.Input /></Input.Control>
                </Input.Root>
            </Field.Root>,
            container,
        );
        const root = part(container, 'root');
        expect(root.getAttribute('data-invalid')).toBe('');
        expect(root.getAttribute('data-required')).toBe('');
        expect(root.getAttribute('data-disabled')).toBe('');
    });

    it('passes the variant axes through as data attributes', () => {
        render(
            <Input.Root color="primary" size="lg">
                <Input.Control><Input.Input /></Input.Control>
            </Input.Root>,
            container,
        );
        const root = part(container, 'root');
        expect(root.getAttribute('data-color')).toBe('primary');
        expect(root.getAttribute('data-size')).toBe('lg');
    });
});
