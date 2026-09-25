/**
 * Field's `aria-describedby` names only what is rendered (#266): the
 * Description and Error report their presence the way a RadioGroup Label
 * does (#169), so a control never points at an id no element carries.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { component, signal } from 'sigx';
import { Field, Input, Textarea } from '@sigx/zero';

let container: HTMLElement;
beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
});

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const fieldPart = (part: string) => container.querySelector<HTMLElement>(`[data-scope="field"][data-part="${part}"]`);
const input = () => container.querySelector<HTMLInputElement>('[data-scope="input"][data-part="input"]')!;

describe('Field aria-describedby', () => {
    it('renders none once mounted when the field has no Description or Error', async () => {
        render(
            <Field.Root>
                <Field.Label>Email</Field.Label>
                <Input.Root>
                    <Input.Control><Input.Input /></Input.Control>
                </Input.Root>
            </Field.Root>,
            container,
        );
        // Optimistic until mounted — the server's markup, which the
        // hydrating first render must match.
        expect(input().getAttribute('aria-describedby')!.split(' ')).toHaveLength(2);
        await tick();
        expect(input().hasAttribute('aria-describedby')).toBe(false);
    });

    it('references only the Error when that is all there is', async () => {
        render(
            <Field.Root invalid>
                <Textarea.Root><Textarea.Textarea /></Textarea.Root>
                <Field.Error>Too short.</Field.Error>
            </Field.Root>,
            container,
        );
        await tick();
        const textarea = container.querySelector('textarea')!;
        expect(textarea.getAttribute('aria-describedby')).toBe(fieldPart('error')!.id);
    });

    it('follows an Error rendered on and off, keeping the Description', async () => {
        const state = signal({ error: '' });
        const App = component(() => () => (
            <Field.Root invalid={!!state.error}>
                <Input.Root>
                    <Input.Control><Input.Input /></Input.Control>
                </Input.Root>
                <Field.Description>We never spam.</Field.Description>
                {state.error ? <Field.Error>{state.error}</Field.Error> : null}
            </Field.Root>
        ));
        render(<App />, container);
        await tick();
        const description = fieldPart('description')!.id;
        expect(input().getAttribute('aria-describedby')).toBe(description);

        state.error = 'That address looks wrong.';
        await tick();
        expect(input().getAttribute('aria-describedby')).toBe(`${description} ${fieldPart('error')!.id}`);

        state.error = '';
        await tick();
        expect(fieldPart('error')).toBeNull();
        expect(input().getAttribute('aria-describedby')).toBe(description);
    });

    it("joins an app's own aria-describedby to the present ids only", async () => {
        render(
            <Field.Root>
                <Input.Root>
                    <Input.Control><Input.Input aria-describedby="counter" /></Input.Control>
                </Input.Root>
            </Field.Root>,
            container,
        );
        await tick();
        expect(input().getAttribute('aria-describedby')).toBe('counter');
    });

    it('every id it names resolves to an element', async () => {
        render(
            <Field.Root>
                <Input.Root>
                    <Input.Control><Input.Input /></Input.Control>
                </Input.Root>
                <Field.Description>Hint.</Field.Description>
            </Field.Root>,
            container,
        );
        await tick();
        const ids = input().getAttribute('aria-describedby')!.split(' ');
        for (const id of ids) expect(document.getElementById(id), id).not.toBeNull();
    });
});
