/**
 * The form-participation contract (#441) — one table, every posting scope.
 *
 * Six claims per row, the ones four different hidden-input regimes used to
 * answer four different ways: the committed value posts; nothing posts
 * without a `name`; a disabled control never posts; a required, empty
 * control fails constraint validation; the owning form's reset restores the
 * default in the DOM AND the model; and `form="id"` associates a control
 * from outside the form's subtree.
 *
 * FormData is read from a real `<form>` — that is the platform's answer, not
 * an attribute check. A row that cannot validate (`type="hidden"` inputs are
 * barred from constraint validation) says so with `validates: false`; that
 * row's control is still posted, still disabled-aware, still reset.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { signal } from 'sigx';
import type { JSXElement } from 'sigx';
import {
    Checkbox, Combobox, FileUpload, Input, NumberInput,
    RadioGroup, RatingGroup, Select, Slider, Switch, Textarea,
} from '@sigx/zero';

interface MountOpts {
    name: string;
    /** Mount with the row's default value (else empty). */
    withDefault: boolean;
    disabled?: boolean;
    required?: boolean;
    form?: string;
    /** A `[state, key]` binding — rows that bind one prove the model resets too. */
    model?: unknown;
}

const FILE = Symbol('an empty File entry');

interface Row {
    scope: string;
    mount(o: MountOpts): JSXElement;
    /** Drive a user change through the real control. */
    commit?(root: HTMLElement): void;
    /** FormData entries after `commit` (null = the name is absent). */
    committed?: string | string[] | null;
    /** FormData entries at the default. */
    defaultEntry: string | string[] | null | typeof FILE;
    /** The model at the default and after commit, where a row binds one. */
    model?: { initial: unknown; committed: unknown };
    /** `required` + empty → `form.checkValidity()` is false. */
    validates: boolean;
}

const type = (el: Element, text: string): void => {
    (el as HTMLInputElement).value = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
};
const change = (el: Element): void => { el.dispatchEvent(new Event('change', { bubbles: true })); };
const q = <T extends Element = HTMLElement>(root: ParentNode, sel: string): T => {
    const el = root.querySelector<T>(sel);
    if (!el) throw new Error(`not rendered: ${sel}`);
    return el;
};

const rows: Row[] = [
    {
        scope: 'input',
        mount: (o) => (
            <Input.Root name={o.name} form={o.form} disabled={o.disabled} required={o.required} defaultValue={o.withDefault ? 'x' : undefined} model={o.model as never}>
                <Input.Control><Input.Input /></Input.Control>
            </Input.Root>
        ),
        commit: (root) => type(q(root, '[data-scope="input"][data-part="input"]'), 'typed'),
        committed: 'typed',
        defaultEntry: 'x',
        model: { initial: 'x', committed: 'typed' },
        validates: true,
    },
    {
        scope: 'textarea',
        mount: (o) => (
            <Textarea.Root name={o.name} form={o.form} disabled={o.disabled} required={o.required} defaultValue={o.withDefault ? 'x' : undefined} model={o.model as never}>
                <Textarea.Textarea />
            </Textarea.Root>
        ),
        commit: (root) => type(q(root, '[data-scope="textarea"][data-part="textarea"]'), 'typed'),
        committed: 'typed',
        defaultEntry: 'x',
        model: { initial: 'x', committed: 'typed' },
        validates: true,
    },
    {
        scope: 'checkbox',
        mount: (o) => (
            <Checkbox.Root name={o.name} form={o.form} disabled={o.disabled} required={o.required} value="yes" defaultChecked={o.withDefault} model={o.model as never}>
                Terms
            </Checkbox.Root>
        ),
        commit: (root) => { const el = q<HTMLInputElement>(root, '[data-scope="checkbox"] input'); el.checked = false; change(el); },
        committed: null,
        defaultEntry: 'yes',
        model: { initial: true, committed: false },
        validates: true,
    },
    {
        scope: 'switch',
        mount: (o) => (
            <Switch.Root name={o.name} form={o.form} disabled={o.disabled} required={o.required} defaultChecked={o.withDefault} model={o.model as never}>
                Notify
            </Switch.Root>
        ),
        commit: (root) => { const el = q<HTMLInputElement>(root, '[data-scope="switch"] input'); el.checked = false; change(el); },
        committed: null,
        defaultEntry: 'on',
        model: { initial: true, committed: false },
        validates: true,
    },
    {
        scope: 'radio-group',
        mount: (o) => (
            <RadioGroup.Root name={o.name} form={o.form} disabled={o.disabled} required={o.required} defaultValue={o.withDefault ? 'a' : undefined} model={o.model as never}>
                <RadioGroup.Item value="a">A</RadioGroup.Item>
                <RadioGroup.Item value="b">B</RadioGroup.Item>
            </RadioGroup.Root>
        ),
        commit: (root) => { const el = root.querySelectorAll<HTMLInputElement>('[data-scope="radio-group"] input')[1]!; el.checked = true; change(el); },
        committed: 'b',
        defaultEntry: 'a',
        model: { initial: 'a', committed: 'b' },
        validates: true,
    },
    {
        scope: 'select',
        mount: (o) => (
            <Select.Root name={o.name} form={o.form} disabled={o.disabled} required={o.required} placeholder="Pick a fruit…" defaultValue={o.withDefault ? 'apple' : undefined} model={o.model as never}>
                <Select.Trigger label="Fruit"><Select.Value /></Select.Trigger>
                <Select.Popup>
                    <Select.Item value="apple">Apple</Select.Item>
                    <Select.Item value="banana">Banana</Select.Item>
                </Select.Popup>
            </Select.Root>
        ),
        commit: (root) => { root.querySelectorAll<HTMLElement>('[data-scope="select"][data-part="item"]')[1]!.click(); },
        committed: 'banana',
        defaultEntry: 'apple',
        model: { initial: 'apple', committed: 'banana' },
        validates: true,
    },
    {
        scope: 'combobox',
        mount: (o) => (
            <Combobox.Root name={o.name} form={o.form} disabled={o.disabled} required={o.required} placeholder="Search…" defaultValue={o.withDefault ? 'apple' : undefined} model={o.model as never}>
                <Combobox.Control><Combobox.Input /><Combobox.Trigger /></Combobox.Control>
                <Combobox.Popup>
                    <Combobox.Item value="apple">Apple</Combobox.Item>
                    <Combobox.Item value="banana">Banana</Combobox.Item>
                </Combobox.Popup>
            </Combobox.Root>
        ),
        commit: (root) => { root.querySelectorAll<HTMLElement>('[data-scope="combobox"][data-part="item"]')[1]!.click(); },
        committed: 'banana',
        defaultEntry: 'apple',
        model: { initial: 'apple', committed: 'banana' },
        validates: true,
    },
    {
        scope: 'number-input',
        mount: (o) => (
            <NumberInput.Root name={o.name} form={o.form} disabled={o.disabled} required={o.required} defaultValue={o.withDefault ? 3 : undefined} model={o.model as never}>
                <NumberInput.Control><NumberInput.Input /></NumberInput.Control>
            </NumberInput.Root>
        ),
        commit: (root) => { const el = q(root, '[data-scope="number-input"][data-part="input"]'); type(el, '5'); el.dispatchEvent(new FocusEvent('blur')); },
        committed: '5',
        defaultEntry: '3',
        model: { initial: 3, committed: 5 },
        validates: false,
    },
    {
        scope: 'rating-group',
        mount: (o) => (
            <RatingGroup.Root name={o.name} form={o.form} disabled={o.disabled} required={o.required} count={3} defaultValue={o.withDefault ? 2 : undefined} model={o.model as never}>
                <RatingGroup.Control>
                    <RatingGroup.Item index={1} />
                    <RatingGroup.Item index={2} />
                    <RatingGroup.Item index={3} />
                </RatingGroup.Control>
            </RatingGroup.Root>
        ),
        commit: (root) => { root.querySelectorAll<HTMLElement>('[data-scope="rating-group"][data-part="item"]')[2]!.click(); },
        committed: '3',
        defaultEntry: '2',
        model: { initial: 2, committed: 3 },
        validates: false,
    },
    {
        scope: 'slider',
        mount: (o) => (
            <Slider.Root name={o.name} form={o.form} disabled={o.disabled} min={0} max={100} defaultValue={o.withDefault ? 30 : undefined} model={o.model as never}>
                <Slider.Control />
            </Slider.Root>
        ),
        commit: (root) => type(q(root, '[data-scope="slider"][data-part="control"]'), '40'),
        committed: '40',
        defaultEntry: '30',
        model: { initial: 30, committed: 40 },
        validates: false,
    },
    {
        scope: 'slider (range)',
        mount: (o) => (
            <Slider.Root name={o.name} form={o.form} disabled={o.disabled} min={0} max={100} defaultValue={[10, 20]} model={o.model as never}>
                <Slider.Track>
                    <Slider.Range />
                    <Slider.Thumb label="Low" />
                    <Slider.Thumb label="High" />
                </Slider.Track>
            </Slider.Root>
        ),
        commit: (root) => {
            const thumb = root.querySelectorAll<HTMLElement>('[data-scope="slider"][data-part="thumb"]')[0]!;
            thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true, bubbles: true }));
        },
        committed: ['11', '20'],
        defaultEntry: ['10', '20'],
        model: { initial: [10, 20], committed: [11, 20] },
        validates: false,
    },
    {
        scope: 'file-upload',
        mount: (o) => (
            <FileUpload.Root name={o.name} form={o.form} disabled={o.disabled} required={o.required}>
                <FileUpload.Trigger>Pick</FileUpload.Trigger>
            </FileUpload.Root>
        ),
        defaultEntry: FILE,
        validates: true,
    },
];

let container: HTMLElement;
beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
});

/** Mount `inside` within `<form id="f">` (and `outside` beside it); return the form. */
function mountForm(inside: JSXElement | null, outside: JSXElement | null = null): HTMLFormElement {
    render(
        <div>
            <form id="f">{inside}</form>
            {outside}
        </div>,
        container,
    );
    return q<HTMLFormElement>(container, 'form');
}

const entries = (form: HTMLFormElement, name: string): string[] =>
    new FormData(form).getAll(name).map((v) => (typeof v === 'string' ? v : `[File ${v.name}]`));

function expectEntries(form: HTMLFormElement, name: string, expected: Row['defaultEntry'] | undefined): void {
    if (expected === FILE) {
        expect(new FormData(form).get(name)).toBeInstanceOf(File);
        return;
    }
    const want = expected == null ? [] : Array.isArray(expected) ? expected : [expected];
    expect(entries(form, name)).toEqual(want);
}

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe.each(rows)('$scope participates in forms', (row) => {
    const name = 'field';

    it('posts its default, then the committed value', () => {
        const form = mountForm(row.mount({ name, withDefault: true }));
        expectEntries(form, name, row.defaultEntry);
        if (!row.commit) return;
        row.commit(form);
        expectEntries(form, name, row.committed);
    });

    it('posts nothing without a name', () => {
        const form = mountForm(row.mount({ name: undefined as unknown as string, withDefault: true }));
        // A control that keeps a generated name for the platform's sake
        // (RadioGroup: same-name radios are the arrow-key roving) detaches
        // from the form with an empty `form` attribute instead. Browsers
        // honour that (the forms e2e spec proves it in three engines);
        // happy-dom does not, so the attribute is the assertion there.
        const named = Array.from(form.querySelectorAll('[name]'));
        if (named.length > 0 && named.every((el) => el.getAttribute('form') === '')) return;
        expect([...new FormData(form).keys()]).toEqual([]);
    });

    it('is omitted from FormData while disabled', () => {
        const form = mountForm(row.mount({ name, withDefault: true, disabled: true }));
        // The platform excludes a disabled control by its `disabled` state —
        // every element that carries the name must carry it. happy-dom applies
        // the rule to <input> only, so FormData is asserted there and the
        // e2e forms spec is the authority for the rest.
        const named = Array.from(form.querySelectorAll<HTMLInputElement>(`[name="${name}"]`));
        expect(named.length).toBeGreaterThan(0);
        for (const el of named) expect(el.disabled).toBe(true);
        if (named.every((el) => el.tagName === 'INPUT')) expect(new FormData(form).has(name)).toBe(false);
    });

    if (row.validates) {
        it('required and empty fails constraint validation; a commit satisfies it', () => {
            const form = mountForm(row.mount({ name, withDefault: false, required: true }));
            expect(form.checkValidity()).toBe(false);
            if (!row.commit || row.committed == null) return;
            row.commit(form);
            expect(form.checkValidity()).toBe(true);
        });
    }

    const commit = row.commit;
    if (commit) {
        it('form.reset() restores the default in the DOM and in the model', async () => {
            const state = signal({ v: row.model?.initial });
            const form = mountForm(row.mount({ name, withDefault: true, model: row.model ? [state, 'v'] : undefined }));
            commit(form);
            expectEntries(form, name, row.committed);
            if (row.model) expect(state.v).toEqual(row.model.committed);

            form.reset();
            await tick();
            expectEntries(form, name, row.defaultEntry);
            if (row.model) expect(state.v).toEqual(row.model.initial);
        });
    }

    it('form="id" associates a control from outside the form subtree', () => {
        const form = mountForm(null, row.mount({ name, withDefault: true, form: 'f' }));
        expectEntries(form, name, row.defaultEntry);
    });
});

describe('the hidden select is a real form control', () => {
    it('Select: the platform invalid event lands focus on the trigger', () => {
        const form = mountForm(
            <Select.Root name="fruit" required placeholder="Pick…">
                <Select.Trigger label="Fruit"><Select.Value /></Select.Trigger>
                <Select.Popup><Select.Item value="apple">Apple</Select.Item></Select.Popup>
            </Select.Root>,
        );
        const hidden = q<HTMLSelectElement>(form, '[data-scope="select"][data-part="hidden-input"]');
        expect(hidden.tagName).toBe('SELECT');
        expect(hidden.required).toBe(true);
        expect(form.checkValidity()).toBe(false);
        expect(document.activeElement).toBe(q(form, '[data-scope="select"][data-part="trigger"]'));
    });

    it('Combobox: the platform invalid event lands focus on the input', () => {
        const form = mountForm(
            <Combobox.Root name="country" required placeholder="Search…">
                <Combobox.Control><Combobox.Input /><Combobox.Trigger /></Combobox.Control>
                <Combobox.Popup><Combobox.Item value="se">Sweden</Combobox.Item></Combobox.Popup>
            </Combobox.Root>,
        );
        expect(form.checkValidity()).toBe(false);
        expect(document.activeElement).toBe(q(form, '[data-scope="combobox"][data-part="input"]'));
    });

    it('renders no hidden control without a name', () => {
        render(
            <Select.Root placeholder="Pick…">
                <Select.Trigger label="Fruit"><Select.Value /></Select.Trigger>
                <Select.Popup><Select.Item value="apple">Apple</Select.Item></Select.Popup>
            </Select.Root>,
            container,
        );
        expect(container.querySelector('[data-scope="select"][data-part="hidden-input"]')).toBeNull();
    });
});
