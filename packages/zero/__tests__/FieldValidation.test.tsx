/**
 * Field validation (#284): the platform's constraint API surfaced through
 * Field.Root's `validate`/`validateOn` and Field.Error's `match`.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { renderToString } from '@sigx/server-renderer';
import { defineApp } from 'sigx';
import { Checkbox, Combobox, Field, Input, NumberInput, RadioGroup, Select, Switch, Textarea, zeroPlugin } from '@sigx/zero';

let container: HTMLElement;
beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
});
afterEach(() => {
    render(null, container);
    container.remove();
});

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const q = <T extends Element = HTMLElement>(sel: string) => container.querySelector<T>(sel);
const fieldRoot = () => q('[data-scope="field"][data-part="root"]')!;
const errors = () => [...container.querySelectorAll<HTMLElement>('[data-scope="field"][data-part="error"]')];
const input = () => q<HTMLInputElement>('[data-scope="input"][data-part="input"]')!;
const form = () => q<HTMLFormElement>('form')!;
const submit = () => q<HTMLButtonElement>('button[type="submit"]')!.click();
const type = (el: HTMLInputElement, value: string) => {
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
};

describe('Field validation — validateOn="submit" (default)', () => {
    it('shows nothing until a failed submit, then the matched Error, and focuses the control', async () => {
        let submitted = 0;
        render(
            <form onSubmit={(e: Event) => { e.preventDefault(); submitted++; }}>
                <Field.Root>
                    <Input.Root name="user" required minlength={3} pattern="[a-z]+">
                        <Input.Control><Input.Input /></Input.Control>
                    </Input.Root>
                    <Field.Error match="valueMissing">Required.</Field.Error>
                    <Field.Error match="patternMismatch">Lowercase only.</Field.Error>
                </Field.Root>
                <button type="submit">Send</button>
            </form>,
            container,
        );
        await tick();
        expect(errors()).toHaveLength(0);
        expect(fieldRoot().hasAttribute('data-invalid')).toBe(false);

        type(input(), 'x');
        type(input(), '');
        await tick();
        expect(errors()).toHaveLength(0);

        submit();
        await tick();
        expect(submitted).toBe(0);
        expect(errors().map((e) => e.textContent)).toEqual(['Required.']);
        expect(fieldRoot().hasAttribute('data-invalid')).toBe(true);
        expect(input().getAttribute('aria-invalid')).toBe('true');
        expect(input().getAttribute('aria-describedby')).toBe(errors()[0]!.id);
        expect(document.activeElement).toBe(input());

        // After a failed submit, every change revalidates.
        type(input(), 'AB');
        await tick();
        expect(errors().map((e) => e.textContent)).toEqual(['Lowercase only.']);

        type(input(), 'abc');
        await tick();
        expect(errors()).toHaveLength(0);
        expect(fieldRoot().hasAttribute('data-invalid')).toBe(false);
        expect(input().hasAttribute('aria-describedby')).toBe(false);
        submit();
        expect(submitted).toBe(1);
    });
});

describe('Field validation — validateOn="blur"', () => {
    it('shows on leaving the field, then clears on the change that fixes it', async () => {
        render(
            <form>
                <Field.Root validateOn="blur">
                    <Input.Root name="code" minlength={3}>
                        <Input.Control><Input.Input /></Input.Control>
                    </Input.Root>
                    <Field.Error match="tooShort">Three at least.</Field.Error>
                </Field.Root>
                <button type="submit">Send</button>
            </form>,
            container,
        );
        await tick();
        input().focus();
        type(input(), 'ab');
        await tick();
        // Typing is not leaving.
        expect(errors()).toHaveLength(0);
        q<HTMLButtonElement>('button')!.focus();
        await tick();
        expect(errors().map((e) => e.textContent)).toEqual(['Three at least.']);
        expect(fieldRoot().hasAttribute('data-invalid')).toBe(true);

        input().focus();
        type(input(), 'abc');
        await tick();
        expect(errors()).toHaveLength(0);
        expect(fieldRoot().hasAttribute('data-invalid')).toBe(false);
    });
});

describe('Field validation — validateOn="change"', () => {
    it('validates on every change, never at mount', async () => {
        render(
            <Field.Root validateOn="change" validate={(v) => (String(v).includes(' ') ? 'No spaces.' : null)}>
                <Input.Root>
                    <Input.Control><Input.Input /></Input.Control>
                </Input.Root>
                <Field.Error match="custom" />
            </Field.Root>,
            container,
        );
        await tick();
        expect(errors()).toHaveLength(0);
        type(input(), 'a b');
        await tick();
        expect(errors().map((e) => e.textContent)).toEqual(['No spaces.']);
        type(input(), 'ab');
        await tick();
        expect(errors()).toHaveLength(0);
    });
});

describe('Field validation — validate and setCustomValidity', () => {
    it("pushes validate's message into the element, so native submission blocks on it", async () => {
        let submitted = 0;
        const seen: unknown[] = [];
        render(
            <form onSubmit={(e: Event) => { e.preventDefault(); submitted++; }}>
                <Field.Root
                    validate={(value, validity) => {
                        seen.push(value, validity.valueMissing);
                        return value === 'admin' ? ['Taken.', 'Pick another.'] : null;
                    }}
                >
                    <Input.Root name="user" defaultValue="admin">
                        <Input.Control><Input.Input /></Input.Control>
                    </Input.Root>
                    <Field.Error match="custom" />
                </Field.Root>
                <button type="submit">Send</button>
            </form>,
            container,
        );
        await tick();
        // Kept current from mount, before anything is shown.
        expect(input().validity.customError).toBe(true);
        expect(input().validationMessage).toBe('Taken.\nPick another.');
        expect(seen).toEqual(['admin', false]);
        expect(errors()).toHaveLength(0);

        submit();
        await tick();
        expect(submitted).toBe(0);
        expect(errors().map((e) => e.textContent)).toEqual(['Taken. Pick another.']);

        type(input(), 'ada');
        await tick();
        expect(input().validity.customError).toBe(false);
        expect(input().validity.valid).toBe(true);
        expect(errors()).toHaveLength(0);
        submit();
        expect(submitted).toBe(1);
    });

    it('a failing validate on an otherwise valid control matches "custom" only', async () => {
        render(
            <form>
                <Field.Root validate={() => 'Nope.'}>
                    <Input.Root name="x" required defaultValue="ok">
                        <Input.Control><Input.Input /></Input.Control>
                    </Input.Root>
                    <Field.Error match="valueMissing">Required.</Field.Error>
                    <Field.Error match="customError">Custom via the key.</Field.Error>
                    <Field.Error match="custom" />
                </Field.Root>
                <button type="submit">Send</button>
            </form>,
            container,
        );
        await tick();
        submit();
        await tick();
        expect(errors().map((e) => e.textContent)).toEqual(['Custom via the key.', 'Nope.']);
        // Each keyed Error has its own id, and the control names both.
        const ids = errors().map((e) => e.id);
        expect(new Set(ids).size).toBe(2);
        expect(input().getAttribute('aria-describedby')!.split(' ').sort()).toEqual([...ids].sort());
    });
});

describe('Field validation — Field.Error', () => {
    it('without match renders as before, and fills in the current messages when it has no children', async () => {
        render(
            <form>
                <Field.Root validate={(v) => (v ? null : 'Say something.')}>
                    <Input.Root name="x">
                        <Input.Control><Input.Input /></Input.Control>
                    </Input.Root>
                    <Field.Error />
                </Field.Root>
                <button type="submit">Send</button>
            </form>,
            container,
        );
        await tick();
        expect(errors()).toHaveLength(1);
        expect(errors()[0]!.textContent).toBe('');
        submit();
        await tick();
        expect(errors()[0]!.textContent).toBe('Say something.');
    });

    it('match={true} always renders', async () => {
        render(
            <Field.Root>
                <Input.Root><Input.Control><Input.Input /></Input.Control></Input.Root>
                <Field.Error match>Always.</Field.Error>
            </Field.Root>,
            container,
        );
        await tick();
        expect(errors().map((e) => e.textContent)).toEqual(['Always.']);
    });

    it('the invalid prop still marks the field, independent of validation', async () => {
        render(
            <Field.Root invalid>
                <Input.Root><Input.Control><Input.Input /></Input.Control></Input.Root>
            </Field.Root>,
            container,
        );
        await tick();
        expect(fieldRoot().hasAttribute('data-invalid')).toBe(true);
        expect(input().getAttribute('aria-invalid')).toBe('true');
    });
});

describe('Field validation — the invalid event', () => {
    it('is cancelled only when the Field renders an Error', async () => {
        render(
            <form>
                <Field.Root>
                    <Input.Root name="a" required><Input.Control><Input.Input /></Input.Control></Input.Root>
                </Field.Root>
                <Field.Root>
                    <Textarea.Root name="b" required><Textarea.Textarea /></Textarea.Root>
                    <Field.Error match="valueMissing">Required.</Field.Error>
                </Field.Root>
            </form>,
            container,
        );
        await tick();
        const a = input();
        const b = q<HTMLTextAreaElement>('textarea')!;
        const prevented: Record<string, boolean> = {};
        a.addEventListener('invalid', (e) => { prevented.a = e.defaultPrevented; });
        b.addEventListener('invalid', (e) => { prevented.b = e.defaultPrevented; });
        form().checkValidity();
        expect(prevented).toEqual({ a: false, b: true });
        // Both fields validated, with or without an Error.
        await tick();
        const roots = [...container.querySelectorAll('[data-scope="field"][data-part="root"]')];
        expect(roots.map((r) => r.hasAttribute('data-invalid'))).toEqual([true, true]);
    });

    it('focuses the FIRST invalid control in form order, not the last to hear its event', async () => {
        render(
            <form>
                <Field.Root>
                    <Input.Root name="first" required><Input.Control><Input.Input /></Input.Control></Input.Root>
                    <Field.Error match="valueMissing">Required.</Field.Error>
                </Field.Root>
                <Field.Root>
                    <Textarea.Root name="second" required><Textarea.Textarea /></Textarea.Root>
                    <Field.Error match="valueMissing">Required.</Field.Error>
                </Field.Root>
                <button type="submit">Send</button>
            </form>,
            container,
        );
        await tick();
        q<HTMLTextAreaElement>('textarea')!.focus();
        submit();
        await tick();
        expect(document.activeElement).toBe(input());
        expect(errors()).toHaveLength(2);
    });
});

describe('Field validation — composed controls report their validating element', () => {
    it('Select: the hidden select validates, the trigger takes focus', async () => {
        render(
            <form>
                <Field.Root>
                    <Field.Label>Fruit</Field.Label>
                    <Select.Root name="fruit" required placeholder="Pick" items={['apple', 'pear']}>
                        <Select.Trigger><Select.Value /></Select.Trigger>
                    </Select.Root>
                    <Field.Error match="valueMissing">Pick a fruit.</Field.Error>
                </Field.Root>
                <button type="submit">Send</button>
            </form>,
            container,
        );
        await tick();
        submit();
        await tick();
        expect(errors().map((e) => e.textContent)).toEqual(['Pick a fruit.']);
        const trigger = q('[data-scope="select"][data-part="trigger"]')!;
        expect(trigger.hasAttribute('data-invalid')).toBe(true);
        expect(document.activeElement).toBe(trigger);
    });

    it('Checkbox: validate receives the checked boolean', async () => {
        const seen: unknown[] = [];
        render(
            <form>
                <Field.Root validate={(v) => { seen.push(v); return v ? null : 'Accept the terms.'; }}>
                    <Checkbox.Root name="terms">I agree</Checkbox.Root>
                    <Field.Error match="custom" />
                </Field.Root>
                <button type="submit">Send</button>
            </form>,
            container,
        );
        await tick();
        submit();
        await tick();
        expect(errors().map((e) => e.textContent)).toEqual(['Accept the terms.']);
        const box = q<HTMLInputElement>('[data-scope="checkbox"][data-part="hidden-input"]')!;
        expect(document.activeElement).toBe(box);
        box.click();
        await tick();
        expect(errors()).toHaveLength(0);
        expect(seen).toContain(true);
    });

    it('RadioGroup: a missing choice focuses the first radio', async () => {
        render(
            <form>
                <Field.Root>
                    <RadioGroup.Root name="plan" required items={['free', 'pro']} />
                    <Field.Error match="valueMissing">Choose a plan.</Field.Error>
                </Field.Root>
                <button type="submit">Send</button>
            </form>,
            container,
        );
        await tick();
        submit();
        await tick();
        expect(errors().map((e) => e.textContent)).toEqual(['Choose a plan.']);
        const radios = container.querySelectorAll<HTMLInputElement>('input[type="radio"]');
        expect(document.activeElement).toBe(radios[0]);
        radios[1]!.click();
        await tick();
        expect(errors()).toHaveLength(0);
    });
});

describe('Field validation — form reset', () => {
    it('forgets what was shown', async () => {
        render(
            <form>
                <Field.Root>
                    <Input.Root name="x" required><Input.Control><Input.Input /></Input.Control></Input.Root>
                    <Field.Error match="valueMissing">Required.</Field.Error>
                </Field.Root>
                <button type="submit">Send</button>
            </form>,
            container,
        );
        await tick();
        submit();
        await tick();
        expect(errors()).toHaveLength(1);
        form().reset();
        await tick();
        await tick();
        expect(errors()).toHaveLength(0);
        expect(fieldRoot().hasAttribute('data-invalid')).toBe(false);
        // …and a change after the reset does not revalidate: the failed submit is forgotten.
        type(input(), 'a');
        type(input(), '');
        await tick();
        expect(errors()).toHaveLength(0);
    });
});

describe('Field validation — more controls', () => {
    it('Switch: validate receives the boolean; required is valueMissing', async () => {
        render(
            <form>
                <Field.Root>
                    <Switch.Root name="notify" required>Notify me</Switch.Root>
                    <Field.Error match="valueMissing">Turn it on.</Field.Error>
                </Field.Root>
                <button type="submit">Send</button>
            </form>,
            container,
        );
        await tick();
        submit();
        await tick();
        expect(errors().map((e) => e.textContent)).toEqual(['Turn it on.']);
        expect(q('[data-scope="switch"][data-part="root"]')!.hasAttribute('data-invalid')).toBe(true);
    });

    it('Combobox: the hidden select validates, the input takes focus', async () => {
        render(
            <form>
                <Field.Root>
                    <Combobox.Root name="country" required items={['Sweden', 'Norway']} />
                    <Field.Error match="valueMissing">Pick a country.</Field.Error>
                </Field.Root>
                <button type="submit">Send</button>
            </form>,
            container,
        );
        await tick();
        submit();
        await tick();
        expect(errors().map((e) => e.textContent)).toEqual(['Pick a country.']);
        expect(document.activeElement).toBe(q('[data-scope="combobox"][data-part="input"]'));
    });

    it('NumberInput: validate receives the number', async () => {
        const seen: unknown[] = [];
        render(
            <Field.Root validateOn="change" validate={(v) => { seen.push(v); return typeof v === 'number' && v % 2 ? 'Even numbers only.' : null; }}>
                <NumberInput.Root defaultValue={2}>
                    <NumberInput.Control>
                        <NumberInput.Input />
                    </NumberInput.Control>
                </NumberInput.Root>
                <Field.Error match="custom" />
            </Field.Root>,
            container,
        );
        await tick();
        expect(seen).toEqual([2]);
        q('[data-scope="number-input"][data-part="input"]')!
            .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
        await tick();
        expect(seen).toContain(3);
        expect(errors().map((e) => e.textContent)).toEqual(['Even numbers only.']);
    });
});

describe('Field validation — server render', () => {
    it('a keyed Error renders nothing until validated, and no reference names it', async () => {
        const app = defineApp(
            <Field.Root>
                <Input.Root name="x" required><Input.Control><Input.Input /></Input.Control></Input.Root>
                <Field.Error match="valueMissing">Required.</Field.Error>
            </Field.Root>,
        );
        app.use(zeroPlugin());
        const html = await renderToString(app);
        expect(html).not.toContain('Required.');
        expect(html).not.toMatch(/-error-valueMissing/);
    });
});
