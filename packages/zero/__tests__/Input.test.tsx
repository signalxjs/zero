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

    it('renders the typed native constraint and hint attributes on the input (#266)', () => {
        render(
            <Input.Root
                minlength={3}
                pattern="[0-9]+"
                inputmode="numeric"
                enterkeyhint="done"
                spellcheck={false}
                autocapitalize="off"
                autocorrect="off"
                autofocus
            >
                <Input.Control><Input.Input /></Input.Control>
            </Input.Root>,
            container,
        );
        const el = field(container);
        expect(el.getAttribute('minlength')).toBe('3');
        expect(el.getAttribute('pattern')).toBe('[0-9]+');
        expect(el.getAttribute('inputmode')).toBe('numeric');
        expect(el.getAttribute('enterkeyhint')).toBe('done');
        // Enumerated, not boolean: `false` is the token, not an absence.
        expect(el.getAttribute('spellcheck')).toBe('false');
        expect(el.getAttribute('autocapitalize')).toBe('off');
        expect(el.getAttribute('autocorrect')).toBe('off');
        expect(el.hasAttribute('autofocus')).toBe(true);
    });

    it('renders none of them when unset', () => {
        mount(container);
        const el = field(container);
        for (const name of ['minlength', 'pattern', 'inputmode', 'enterkeyhint', 'spellcheck', 'autocapitalize', 'autocorrect', 'autofocus']) {
            expect(el.hasAttribute(name), name).toBe(false);
        }
    });

    it('native constraint validation honours pattern and minlength', () => {
        render(
            <Input.Root pattern="[0-9]{4}">
                <Input.Control><Input.Input /></Input.Control>
            </Input.Root>,
            container,
        );
        const el = field(container);
        type(el, 'abcd');
        expect(el.checkValidity()).toBe(false);
        expect(el.validity.patternMismatch).toBe(true);
        type(el, '1234');
        expect(el.checkValidity()).toBe(true);
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

describe('Input affordances (#281)', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    function mountAll(extra: {
        model?: unknown;
        defaultValue?: string;
        type?: 'text' | 'password' | 'search';
        visible?: unknown;
        defaultVisible?: boolean;
        disabled?: boolean;
        readonly?: boolean;
        onValueChange?: (v: string) => void;
        onVisibleChange?: (v: boolean) => void;
        onInput?: (e: Event) => void;
    } = {}) {
        render(
            <Input.Root
                model={extra.model as never}
                model:visible={extra.visible as never}
                defaultValue={extra.defaultValue}
                defaultVisible={extra.defaultVisible}
                type={extra.type}
                disabled={extra.disabled}
                readonly={extra.readonly}
                onValueChange={extra.onValueChange}
                onVisibleChange={extra.onVisibleChange}
            >
                <Input.Label>Secret</Input.Label>
                <Input.Control>
                    <Input.Adornment placement="start"><svg data-icon="" /></Input.Adornment>
                    <Input.Input onInput={extra.onInput} />
                    <Input.Adornment placement="end"><button type="button" data-own="">?</button></Input.Adornment>
                    <Input.ClearTrigger />
                    <Input.VisibilityTrigger />
                </Input.Control>
            </Input.Root>,
            container,
        );
    }

    it('renders a valid anatomy with every part', () => {
        mountAll({ type: 'password', defaultValue: 'hunter2' });
        expectAnatomy(container, inputAnatomy);
        for (const name of ['adornment', 'clear-trigger', 'visibility-trigger']) {
            expect(part(container, name), `input/${name} must render`).toBeTruthy();
        }
        const [start, end] = container.querySelectorAll('[data-part="adornment"]');
        expect(start!.getAttribute('data-placement')).toBe('start');
        expect(end!.getAttribute('data-placement')).toBe('end');
        // Consumer content decides whether it speaks.
        expect(start!.hasAttribute('aria-hidden')).toBe(false);
    });

    it('a press on an adornment focuses the input and keeps the caret', () => {
        mountAll({ defaultValue: 'x' });
        const icon = container.querySelector('[data-icon]')!;
        const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
        icon.dispatchEvent(down);
        expect(down.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(field(container));
    });

    it('an interactive element inside an adornment keeps its own press', () => {
        mountAll({ defaultValue: 'x' });
        const own = container.querySelector<HTMLButtonElement>('[data-own]')!;
        const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
        own.dispatchEvent(down);
        expect(down.defaultPrevented).toBe(false);
        expect(document.activeElement).not.toBe(field(container));
    });

    it('clear-trigger is a labelled, untabbable button that controls the input', () => {
        mountAll({ defaultValue: 'abc' });
        const clear = part(container, 'clear-trigger') as HTMLButtonElement;
        expect(clear.tagName).toBe('BUTTON');
        expect(clear.getAttribute('type')).toBe('button');
        expect(clear.tabIndex).toBe(-1);
        expect(clear.getAttribute('aria-label')).toBe('Clear');
        expect(clear.getAttribute('aria-controls')).toBe(field(container).id);
    });

    it('clear-trigger empties the value like typing, emits valueChange, and focuses the input', () => {
        const state = signal({ q: 'abc' });
        const changes: string[] = [];
        const inputs: string[] = [];
        mountAll({
            model: () => state.q,
            onValueChange: (v) => changes.push(v),
            onInput: (e) => inputs.push((e.target as HTMLInputElement).value),
        });
        part(container, 'clear-trigger').click();
        expect(state.q).toBe('');
        expect(field(container).value).toBe('');
        expect(changes).toEqual(['']);
        // The app's own input listener sees the clear as it sees a keystroke.
        expect(inputs).toEqual(['']);
        expect(document.activeElement).toBe(field(container));
        // Nothing left to clear: nothing rendered.
        expect(part(container, 'clear-trigger')).toBeNull();
        type(field(container), 'z');
        expect(part(container, 'clear-trigger')).toBeTruthy();
    });

    it('clear-trigger is not rendered while the value is empty', () => {
        mountAll();
        expect(part(container, 'clear-trigger')).toBeNull();
    });

    it('clear-trigger follows what the field shows under a lazy model, not the lagging model', () => {
        const state = signal({ q: '' });
        render(
            <Input.Root model={() => state.q} modelModifiers={{ lazy: true }}>
                <Input.Control>
                    <Input.Input />
                    <Input.ClearTrigger />
                </Input.Control>
            </Input.Root>,
            container,
        );
        type(field(container), 'abc');
        // Not committed yet, but there is something to clear.
        expect(state.q).toBe('');
        expect(part(container, 'clear-trigger')).toBeTruthy();
        part(container, 'clear-trigger').click();
        expect(field(container).value).toBe('');
        expect(state.q).toBe('');
        expect(part(container, 'clear-trigger')).toBeNull();
        // Committed, then emptied by keystroke before the next commit.
        type(field(container), 'xy');
        field(container).dispatchEvent(new Event('change', { bubbles: true }));
        expect(state.q).toBe('xy');
        type(field(container), '');
        expect(part(container, 'clear-trigger')).toBeNull();
        // An app write reaches it too.
        state.q = 'set';
        expect(part(container, 'clear-trigger')).toBeTruthy();
    });

    it('clear-trigger answers to disabled and readonly — clearing is an edit', () => {
        mountAll({ defaultValue: 'x', readonly: true });
        const clear = part(container, 'clear-trigger') as HTMLButtonElement;
        expect(clear.disabled).toBe(true);
        expect(clear.getAttribute('data-disabled')).toBe('');
    });

    it('clear-trigger takes a label', () => {
        render(
            <Input.Root defaultValue="x">
                <Input.Control>
                    <Input.Input />
                    <Input.ClearTrigger label="Clear search">✕</Input.ClearTrigger>
                </Input.Control>
            </Input.Root>,
            container,
        );
        expect(part(container, 'clear-trigger').getAttribute('aria-label')).toBe('Clear search');
    });

    it('Escape clears a non-empty search field and is cancelled for enclosing layers', () => {
        const changes: string[] = [];
        mountAll({ type: 'search', defaultValue: 'term', onValueChange: (v) => changes.push(v) });
        const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
        field(container).dispatchEvent(esc);
        expect(esc.defaultPrevented).toBe(true);
        expect(field(container).value).toBe('');
        expect(changes).toEqual(['']);
        // Empty now: Escape passes through to whatever would close.
        const again = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
        field(container).dispatchEvent(again);
        expect(again.defaultPrevented).toBe(false);
    });

    it('Escape leaves a non-search field alone', () => {
        mountAll({ type: 'text', defaultValue: 'term' });
        const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
        field(container).dispatchEvent(esc);
        expect(esc.defaultPrevented).toBe(false);
        expect(field(container).value).toBe('term');
    });

    it('visibility-trigger toggles a password field between hidden and shown', () => {
        const changes: boolean[] = [];
        mountAll({ type: 'password', onVisibleChange: (v) => changes.push(v) });
        const toggle = part(container, 'visibility-trigger') as HTMLButtonElement;
        expect(toggle.getAttribute('type')).toBe('button');
        expect(toggle.getAttribute('aria-label')).toBe('Show password');
        expect(toggle.getAttribute('aria-controls')).toBe(field(container).id);
        expect(toggle.getAttribute('aria-pressed')).toBe('false');
        expect(toggle.getAttribute('data-state')).toBe('off');
        expect(field(container).getAttribute('type')).toBe('password');

        toggle.click();
        expect(toggle.getAttribute('aria-pressed')).toBe('true');
        expect(toggle.getAttribute('data-state')).toBe('on');
        expect(field(container).getAttribute('type')).toBe('text');
        // One constant name — the pressed state says the rest.
        expect(toggle.getAttribute('aria-label')).toBe('Show password');
        expect(changes).toEqual([true]);

        toggle.click();
        expect(field(container).getAttribute('type')).toBe('password');
        expect(changes).toEqual([true, false]);
    });

    it('model:visible binds, and defaultVisible seeds', () => {
        const state = signal({ shown: true });
        mountAll({ type: 'password', visible: () => state.shown });
        expect(field(container).getAttribute('type')).toBe('text');
        part(container, 'visibility-trigger').click();
        expect(state.shown).toBe(false);
        expect(field(container).getAttribute('type')).toBe('password');

        const other = document.createElement('div');
        document.body.appendChild(other);
        render(
            <Input.Root type="password" defaultVisible>
                <Input.Control><Input.Input /><Input.VisibilityTrigger /></Input.Control>
            </Input.Root>,
            other,
        );
        expect(field(other).getAttribute('type')).toBe('text');
    });

    it('visible changes nothing on a field that is not a password', () => {
        mountAll({ type: 'search', defaultVisible: true });
        expect(field(container).getAttribute('type')).toBe('search');
    });

    it('the triggers answer to disabled', () => {
        mountAll({ type: 'password', defaultValue: 'x', disabled: true });
        for (const name of ['clear-trigger', 'visibility-trigger']) {
            const el = part(container, name) as HTMLButtonElement;
            expect(el.disabled, name).toBe(true);
            expect(el.getAttribute('data-disabled'), name).toBe('');
        }
        expect(part(container, 'adornment').getAttribute('data-disabled')).toBe('');
    });
});
