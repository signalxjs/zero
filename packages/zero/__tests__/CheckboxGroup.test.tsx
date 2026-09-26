/**
 * CheckboxGroup (#282): a labelled group of checkboxes under one `string[]`
 * model, the derived tri-state parent box, and the indeterminate fix
 * bundled with it — a click on an indeterminate box used to clear the
 * native property while `data-state` still said `indeterminate`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { component, signal } from 'sigx';
import { Checkbox, CheckboxGroup, Field, checkboxAnatomy, checkboxGroupAnatomy } from '@sigx/zero';
import { expectAnatomy } from './helpers';

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

let container: HTMLElement;
beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
});

const groupRoot = (root: ParentNode = container) =>
    root.querySelector<HTMLElement>('[data-scope="checkbox-group"][data-part="root"]')!;
const boxes = (root: ParentNode = container) =>
    [...root.querySelectorAll<HTMLElement>('[data-scope="checkbox"][data-part="root"]')];
const inputs = (root: ParentNode = container) =>
    [...root.querySelectorAll<HTMLInputElement>('[data-scope="checkbox"][data-part="hidden-input"]')];
/** A user click: the platform toggles and fires `change` (happy-dom does both). */
const click = (input: HTMLInputElement) => input.click();

describe('CheckboxGroup', () => {
    it('renders its anatomy — a labelled role="group" — and the boxes keep theirs', async () => {
        render(
            <CheckboxGroup.Root defaultValue={['a']}>
                <CheckboxGroup.Label>Letters</CheckboxGroup.Label>
                <Checkbox.Root value="a">A</Checkbox.Root>
                <Checkbox.Root value="b">B</Checkbox.Root>
            </CheckboxGroup.Root>,
            container,
        );
        await tick();
        expectAnatomy(container, checkboxGroupAnatomy);
        expectAnatomy(boxes()[0]!.parentElement!, checkboxAnatomy);
        const root = groupRoot();
        expect(root.getAttribute('role')).toBe('group');
        expect(root.getAttribute('data-orientation')).toBe('vertical');
        const label = container.querySelector('[data-scope="checkbox-group"][data-part="label"]')!;
        expect(root.getAttribute('aria-labelledby')).toBe(label.id);
    });

    it('drops the label reference when no Label is rendered (no dangling IDREF)', async () => {
        render(
            <CheckboxGroup.Root orientation="horizontal">
                <Checkbox.Root value="a">A</Checkbox.Root>
            </CheckboxGroup.Root>,
            container,
        );
        await tick();
        expect(groupRoot().hasAttribute('aria-labelledby')).toBe(false);
        expect(groupRoot().getAttribute('data-orientation')).toBe('horizontal');
    });

    it('a box is checked while the group model includes its value; toggling writes the group model', () => {
        const state = signal({ picked: ['b'] as string[] });
        const changes: boolean[] = [];
        render(
            <CheckboxGroup.Root model={[state, 'picked']}>
                <Checkbox.Root value="a" onCheckedChange={(v: boolean) => changes.push(v)}>A</Checkbox.Root>
                <Checkbox.Root value="b">B</Checkbox.Root>
            </CheckboxGroup.Root>,
            container,
        );
        expect(boxes().map((b) => b.getAttribute('data-state'))).toEqual(['unchecked', 'checked']);
        expect(inputs().map((i) => i.checked)).toEqual([false, true]);

        click(inputs()[0]!);
        expect(state.picked).toEqual(['b', 'a']);
        expect(changes).toEqual([true]);
        expect(boxes()[0]!.getAttribute('data-state')).toBe('checked');

        click(inputs()[1]!);
        expect(state.picked).toEqual(['a']);

        state.picked = [];
        expect(inputs().map((i) => i.checked)).toEqual([false, false]);
        expect(boxes().map((b) => b.getAttribute('data-state'))).toEqual(['unchecked', 'unchecked']);
    });

    it('uncontrolled: defaultValue seeds, valueChange reports the whole array', () => {
        const seen: string[][] = [];
        render(
            <CheckboxGroup.Root defaultValue={['a']} onValueChange={(v: string[]) => seen.push([...v])}>
                <Checkbox.Root value="a">A</Checkbox.Root>
                <Checkbox.Root value="b">B</Checkbox.Root>
            </CheckboxGroup.Root>,
            container,
        );
        click(inputs()[1]!);
        expect(seen).toEqual([['a', 'b']]);
    });

    it('name reaches every child input, and the form posts the checked values', () => {
        const form = document.createElement('form');
        container.appendChild(form);
        render(
            <CheckboxGroup.Root name="letters" defaultValue={['a', 'c']}>
                <Checkbox.Root value="a">A</Checkbox.Root>
                <Checkbox.Root value="b">B</Checkbox.Root>
                <Checkbox.Root value="c">C</Checkbox.Root>
            </CheckboxGroup.Root>,
            form,
        );
        expect(inputs(form).map((i) => i.name)).toEqual(['letters', 'letters', 'letters']);
        expect(new FormData(form).getAll('letters')).toEqual(['a', 'c']);
    });

    it('disabled / invalid / readonly reach every box, ORed with the box\'s own', () => {
        render(
            <CheckboxGroup.Root disabled invalid readonly>
                <Checkbox.Root value="a">A</Checkbox.Root>
            </CheckboxGroup.Root>,
            container,
        );
        const root = groupRoot();
        for (const flag of ['data-disabled', 'data-invalid', 'data-readonly']) {
            expect(root.hasAttribute(flag), flag).toBe(true);
            expect(boxes()[0]!.hasAttribute(flag), flag).toBe(true);
        }
        expect(inputs()[0]!.disabled).toBe(true);
        expect(inputs()[0]!.getAttribute('aria-invalid')).toBe('true');
    });

    it('readonly: a click never toggles a box', () => {
        const state = signal({ picked: [] as string[] });
        render(
            <CheckboxGroup.Root model={[state, 'picked']} readonly>
                <Checkbox.Root value="a">A</Checkbox.Root>
            </CheckboxGroup.Root>,
            container,
        );
        click(inputs()[0]!);
        expect(state.picked).toEqual([]);
        expect(inputs()[0]!.checked).toBe(false);
    });

    it('required means "at least one": the boxes are natively required only while none is checked', () => {
        const form = document.createElement('form');
        container.appendChild(form);
        render(
            <CheckboxGroup.Root name="letters" required>
                <Checkbox.Root value="a">A</Checkbox.Root>
                <Checkbox.Root value="b">B</Checkbox.Root>
            </CheckboxGroup.Root>,
            form,
        );
        expect(groupRoot(form).hasAttribute('data-required')).toBe(true);
        expect(inputs(form).map((i) => i.required)).toEqual([true, true]);
        click(inputs(form)[1]!);
        expect(inputs(form).map((i) => i.required)).toEqual([false, false]);
        expect(form.checkValidity()).toBe(true);
    });

    it('required counts only rendered boxes: a model value no box renders leaves the group empty', async () => {
        const form = document.createElement('form');
        container.appendChild(form);
        render(
            <CheckboxGroup.Root name="letters" required defaultValue={['zzz']}>
                <Checkbox.Root value="a">A</Checkbox.Root>
                <Checkbox.Root value="b">B</Checkbox.Root>
            </CheckboxGroup.Root>,
            form,
        );
        await tick();
        expect(inputs(form).map((i) => i.required)).toEqual([true, true]);
        expect(form.checkValidity()).toBe(false);
        click(inputs(form)[0]!);
        expect(inputs(form).map((i) => i.required)).toEqual([false, false]);
        expect(form.checkValidity()).toBe(true);
    });

    it('warns when a child box has no value (every such box would share "on")', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            render(
                <CheckboxGroup.Root>
                    <Checkbox.Root value="a">A</Checkbox.Root>
                    <Checkbox.Root>No value</Checkbox.Root>
                    <Checkbox.Root parent>All</Checkbox.Root>
                </CheckboxGroup.Root>,
                container,
            );
            await tick();
            const calls = warn.mock.calls.filter((c) => String(c[0]).includes('CheckboxGroup has no `value`'));
            expect(calls).toHaveLength(1);
        } finally {
            warn.mockRestore();
        }
    });

    it('Field: its label and description name the ROOT; its disabled reaches the boxes; the boxes keep ids of their own', async () => {
        render(
            <Field.Root disabled>
                <Field.Label>Letters</Field.Label>
                <CheckboxGroup.Root>
                    <Checkbox.Root value="a">A</Checkbox.Root>
                    <Checkbox.Root value="b">B</Checkbox.Root>
                </CheckboxGroup.Root>
                <Field.Description>Pick any</Field.Description>
            </Field.Root>,
            container,
        );
        await tick();
        const root = groupRoot();
        const label = container.querySelector('[data-scope="field"][data-part="label"]')!;
        const description = container.querySelector('[data-scope="field"][data-part="description"]')!;
        expect(root.getAttribute('aria-labelledby')).toBe(label.id);
        expect(root.getAttribute('aria-describedby')).toBe(description.id);
        expect(root.hasAttribute('data-disabled')).toBe(true);
        expect(inputs().every((i) => i.disabled)).toBe(true);
        const [a, b] = inputs();
        expect(a!.id).not.toBe(b!.id);
        expect(a!.id).not.toBe(label.getAttribute('for'));
        expect(a!.hasAttribute('aria-describedby')).toBe(false);
    });

    it('the group size reaches every box that sets none of its own', () => {
        render(
            <CheckboxGroup.Root size="sm">
                <Checkbox.Root value="a">A</Checkbox.Root>
                <Checkbox.Root value="b" size="lg">B</Checkbox.Root>
            </CheckboxGroup.Root>,
            container,
        );
        expect(groupRoot().getAttribute('data-size')).toBe('sm');
        expect(boxes().map((b) => b.getAttribute('data-size'))).toEqual(['sm', 'lg']);
    });

    it('form reset restores the group default', async () => {
        const form = document.createElement('form');
        container.appendChild(form);
        render(
            <CheckboxGroup.Root name="letters" defaultValue={['a']}>
                <Checkbox.Root parent>All</Checkbox.Root>
                <Checkbox.Root value="a">A</Checkbox.Root>
                <Checkbox.Root value="b">B</Checkbox.Root>
            </CheckboxGroup.Root>,
            form,
        );
        await tick();
        click(inputs(form)[2]!);
        expect(new FormData(form).getAll('letters')).toEqual(['a', 'b']);
        form.reset();
        await tick();
        expect(inputs(form).slice(1).map((i) => i.checked)).toEqual([true, false]);
        expect(boxes(form)[0]!.getAttribute('data-state')).toBe('indeterminate');
        expect(inputs(form)[0]!.indeterminate).toBe(true);
    });
});

describe('Checkbox.Root parent — the derived tri-state box', () => {
    const renderParent = (initial: string[], allValues?: string[]) => {
        const state = signal({ picked: initial });
        render(
            <CheckboxGroup.Root model={[state, 'picked']} name="letters" allValues={allValues}>
                <Checkbox.Root parent>All</Checkbox.Root>
                <Checkbox.Root value="a">A</Checkbox.Root>
                <Checkbox.Root value="b">B</Checkbox.Root>
                <Checkbox.Root value="c">C</Checkbox.Root>
            </CheckboxGroup.Root>,
            container,
        );
        return state;
    };
    const parentBox = () => boxes()[0]!;
    const parentInput = () => inputs()[0]!;

    it('derives checked / unchecked / indeterminate from the children', async () => {
        const state = renderParent([]);
        await tick();
        expect(parentBox().getAttribute('data-state')).toBe('unchecked');
        expect(parentInput().checked).toBe(false);
        expect(parentInput().indeterminate).toBe(false);

        state.picked = ['b'];
        expect(parentBox().getAttribute('data-state')).toBe('indeterminate');
        expect(parentInput().indeterminate).toBe(true);
        expect(container.querySelector('[data-scope="checkbox"][data-part="control"]')!.getAttribute('data-state')).toBe('indeterminate');

        state.picked = ['c', 'a', 'b'];
        expect(parentBox().getAttribute('data-state')).toBe('checked');
        expect(parentInput().checked).toBe(true);
        expect(parentInput().indeterminate).toBe(false);
    });

    it('toggling selects all from none or some, and none from all', async () => {
        const state = renderParent(['b']);
        await tick();
        click(parentInput());
        expect([...state.picked].sort()).toEqual(['a', 'b', 'c']);
        expect(parentBox().getAttribute('data-state')).toBe('checked');
        expect(inputs().slice(1).every((i) => i.checked)).toBe(true);

        click(parentInput());
        expect(state.picked).toEqual([]);
        expect(parentBox().getAttribute('data-state')).toBe('unchecked');
        expect(parentInput().checked).toBe(false);

        click(parentInput());
        expect([...state.picked].sort()).toEqual(['a', 'b', 'c']);
    });

    it('allValues bounds what the parent selects and derives from, and keeps values outside it', async () => {
        const state = renderParent(['x'], ['a', 'b']);
        await tick();
        expect(parentBox().getAttribute('data-state')).toBe('unchecked');
        click(parentInput());
        expect(state.picked).toEqual(['x', 'a', 'b']);
        expect(parentBox().getAttribute('data-state')).toBe('checked');
        click(parentInput());
        expect(state.picked).toEqual(['x']);
    });

    it('aria-controls lists the child inputs; the parent posts nothing', async () => {
        const form = document.createElement('form');
        container.appendChild(form);
        render(
            <CheckboxGroup.Root name="letters" defaultValue={['a', 'b']}>
                <Checkbox.Root parent>All</Checkbox.Root>
                <Checkbox.Root value="a">A</Checkbox.Root>
                <Checkbox.Root value="b">B</Checkbox.Root>
            </CheckboxGroup.Root>,
            form,
        );
        await tick();
        const [parent, a, b] = inputs(form);
        expect(parent!.getAttribute('aria-controls')).toBe(`${a!.id} ${b!.id}`);
        expect(parent!.hasAttribute('name')).toBe(false);
        expect(new FormData(form).getAll('letters')).toEqual(['a', 'b']);
    });

    it('outside a group, parent has no effect', () => {
        render(<Checkbox.Root parent defaultChecked>Alone</Checkbox.Root>, container);
        expect(boxes()[0]!.getAttribute('data-state')).toBe('checked');
        expect(inputs()[0]!.hasAttribute('aria-controls')).toBe(false);
    });
});

describe('Checkbox indeterminate stays asserted (#282)', () => {
    it('a click with the prop still true leaves the native input indeterminate', async () => {
        const state = signal({ checked: false });
        render(<Checkbox.Root indeterminate model={[state, 'checked']}>Some</Checkbox.Root>, container);
        await tick();
        const input = inputs()[0]!;
        expect(input.indeterminate).toBe(true);
        click(input);
        expect(state.checked).toBe(true);
        expect(boxes()[0]!.getAttribute('data-state')).toBe('indeterminate');
        expect(input.indeterminate).toBe(true);
        click(input);
        expect(input.indeterminate).toBe(true);
    });

    it('clearing the prop clears the native property', async () => {
        const s = signal({ mixed: true });
        const App = component(() => () => <Checkbox.Root indeterminate={s.mixed}>Some</Checkbox.Root>);
        render(<App />, container);
        await tick();
        expect(inputs()[0]!.indeterminate).toBe(true);
        s.mixed = false;
        expect(inputs()[0]!.indeterminate).toBe(false);
    });
});
