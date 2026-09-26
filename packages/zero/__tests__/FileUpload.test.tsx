/**
 * FileUpload — a real `<input type="file">` wrapped in the anatomy that
 * makes it styleable (#340).
 *
 * The decisions pinned here:
 * - The INPUT IS THE CONTROL: a real file input carries `name`, `accept`,
 *   `multiple`, `required` and posts its FileList natively — there is no
 *   hidden-input question because nothing else holds the value. It is
 *   visually hidden (the Switch technique) and removed from the tab order:
 *   the TRIGGER is the keyboard path.
 * - The trigger is a `<button>` that opens the picker — one tab stop, real
 *   button semantics. The DROPZONE is a pointer affordance only: never
 *   focusable, no role — drag-and-drop has no keyboard path (APG has no
 *   drop-target pattern), and the trigger already is the keyboard
 *   equivalent, so a focusable dropzone would be a second stop doing the
 *   same thing worse.
 * - Drag-over is the shared `highlighted` FLAG, not a new state: the flag
 *   vocabulary already has the word for "the pointer is over this and it
 *   will act" (menu items under the pointer), so inventing a
 *   `dragging|idle` state pair would be a synonym with a contract cost.
 * - The model is `File[]`; `defaultFiles` seeds it (a preloaded draft) and
 *   is what a form reset restores.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { Field, FileUpload, fileUploadAnatomy } from '@sigx/zero';
import { expectAnatomy } from './helpers';

const selector = (scope: string, name: string) => `[data-scope="${scope}"][data-part="${name}"]`;
const part = (c: HTMLElement, name: string) =>
    c.querySelector<HTMLElement>(selector('file-upload', name))!;
const parts = (c: HTMLElement, name: string) =>
    [...c.querySelectorAll<HTMLElement>(selector('file-upload', name))];

const file = (name: string, size = 4, type = 'text/plain') =>
    new File([new Uint8Array(size)], name, { type });

/** Fire a drag-family event carrying `files` — happy-dom has no DragEvent. */
function drag(el: HTMLElement, type: string, files: File[] = [file('drop.txt')]) {
    const e = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(e, 'dataTransfer', {
        value: { files, types: ['Files'], items: files.map(() => ({ kind: 'file' })) },
    });
    el.dispatchEvent(e);
    return e;
}

function sample(extra: Record<string, unknown> = {}) {
    return (
        <FileUpload.Root name="attachments" accept=".txt,text/plain" multiple {...extra}>
            <FileUpload.Label>Attachments</FileUpload.Label>
            <FileUpload.Dropzone>Drop files here</FileUpload.Dropzone>
            <FileUpload.Trigger>Browse…</FileUpload.Trigger>
            <FileUpload.ItemGroup>
                {(files: File[]) => files.map((f) => (
                    <FileUpload.Item file={f} key={f.name}>
                        <FileUpload.ItemName />
                        <FileUpload.ItemSize />
                        <FileUpload.ItemRemove />
                    </FileUpload.Item>
                ))}
            </FileUpload.ItemGroup>
        </FileUpload.Root>
    );
}

describe('FileUpload', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('defaultFiles seeds the model and is what a form reset restores', () => {
        const seed = [file('draft.txt')];
        const form = document.createElement('form');
        container.appendChild(form);
        render(
            <FileUpload.Root name="docs" defaultFiles={seed} slots={{ default: () => (
                <FileUpload.ItemGroup>
                    {(files: File[]) => files.map((f) => <FileUpload.Item file={f}><FileUpload.ItemName /></FileUpload.Item>)}
                </FileUpload.ItemGroup>
            ) }} />,
            form,
        );
        expect(parts(form, 'item').map((i) => i.textContent)).toEqual(['draft.txt']);
        const input = part(form, 'input') as HTMLInputElement;
        const dt = new DataTransfer();
        dt.items.add(file('more.txt'));
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        // Single mode replaces; the seed is gone until the reset brings it back.
        expect(parts(form, 'item').map((i) => i.textContent)).toEqual(['more.txt']);
        form.reset();
        return new Promise<void>((resolve) => setTimeout(() => {
            expect(parts(form, 'item').map((i) => i.textContent)).toEqual(['draft.txt']);
            resolve();
        }, 0));
    });

    it('renders a valid anatomy; the input is a real file input and IS the control', () => {
        render(sample(), container);
        expectAnatomy(container, fileUploadAnatomy);
        const input = part(container, 'input') as unknown as HTMLInputElement;
        expect(input.tagName).toBe('INPUT');
        expect(input.type).toBe('file');
        expect(input.name).toBe('attachments');
        expect(input.accept).toBe('.txt,text/plain');
        expect(input.multiple).toBe(true);
    });

    it('one tab stop: the trigger is a button, the input and dropzone are not tabbable', () => {
        render(sample(), container);
        const trigger = part(container, 'trigger');
        expect(trigger.tagName).toBe('BUTTON');
        // The input is the form control but never the keyboard affordance —
        // two stops opening one picker is the failure mode.
        const input = part(container, 'input');
        expect(input.getAttribute('tabindex')).toBe('-1');
        expect(input.getAttribute('aria-hidden')).toBe('true');
        // The dropzone is pointer affordance only (no keyboard drop exists).
        const dropzone = part(container, 'dropzone');
        expect(dropzone.hasAttribute('tabindex')).toBe(false);
        expect(dropzone.hasAttribute('role')).toBe(false);
    });

    it('the trigger opens the picker', () => {
        render(sample(), container);
        const input = part(container, 'input') as unknown as HTMLInputElement;
        const click = vi.spyOn(input, 'click');
        part(container, 'trigger').click();
        expect(click).toHaveBeenCalledTimes(1);
    });

    it('selection through the input lands in the model and renders items', () => {
        const changes: File[][] = [];
        render(sample({ onFilesChange: (files: File[]) => changes.push(files) }), container);
        const input = part(container, 'input') as unknown as HTMLInputElement;
        Object.defineProperty(input, 'files', { value: [file('a.txt'), file('b.txt')], configurable: true });
        input.dispatchEvent(new Event('change', { bubbles: true }));

        expect(changes.at(-1)!.map((f) => f.name)).toEqual(['a.txt', 'b.txt']);
        const names = parts(container, 'item-name').map((el) => el.textContent);
        expect(names).toEqual(['a.txt', 'b.txt']);
    });

    it('multiple appends across selections; single replaces', () => {
        render(sample(), container);
        const input = part(container, 'input') as unknown as HTMLInputElement;
        Object.defineProperty(input, 'files', { value: [file('a.txt')], configurable: true });
        input.dispatchEvent(new Event('change', { bubbles: true }));
        Object.defineProperty(input, 'files', { value: [file('b.txt')], configurable: true });
        input.dispatchEvent(new Event('change', { bubbles: true }));
        expect(parts(container, 'item').length).toBe(2);

        const single = document.createElement('div');
        document.body.appendChild(single);
        render(
            <FileUpload.Root>
                <FileUpload.Trigger>Browse…</FileUpload.Trigger>
                <FileUpload.ItemGroup>
                    {(files: File[]) => files.map((f) => (
                        <FileUpload.Item file={f} key={f.name}><FileUpload.ItemName /></FileUpload.Item>
                    ))}
                </FileUpload.ItemGroup>
            </FileUpload.Root>,
            single,
        );
        const singleInput = part(single, 'input') as unknown as HTMLInputElement;
        Object.defineProperty(singleInput, 'files', { value: [file('a.txt')], configurable: true });
        singleInput.dispatchEvent(new Event('change', { bubbles: true }));
        Object.defineProperty(singleInput, 'files', { value: [file('b.txt')], configurable: true });
        singleInput.dispatchEvent(new Event('change', { bubbles: true }));
        const names = parts(single, 'item-name').map((el) => el.textContent);
        expect(names).toEqual(['b.txt']);
    });

    it('drag-over is the shared highlighted flag, cleared on leave and on drop', () => {
        render(sample(), container);
        const dropzone = part(container, 'dropzone');
        const root = part(container, 'root');

        drag(dropzone, 'dragover');
        expect(dropzone.getAttribute('data-highlighted')).toBe('');
        expect(root.getAttribute('data-highlighted')).toBe('');

        drag(dropzone, 'dragleave');
        expect(dropzone.hasAttribute('data-highlighted')).toBe(false);

        drag(dropzone, 'dragover');
        drag(dropzone, 'drop', [file('dropped.txt')]);
        expect(dropzone.hasAttribute('data-highlighted')).toBe(false);
        expect(parts(container, 'item-name').map((el) => el.textContent)).toContain('dropped.txt');
    });

    it('drops are filtered by accept; the picker filters natively', () => {
        render(sample(), container);
        const dropzone = part(container, 'dropzone');
        drag(dropzone, 'drop', [file('ok.txt'), file('nope.png', 4, 'image/png')]);
        const names = parts(container, 'item-name').map((el) => el.textContent);
        expect(names).toContain('ok.txt');
        expect(names).not.toContain('nope.png');
    });

    it('remove is a labelled button that removes exactly its file', () => {
        render(sample(), container);
        const input = part(container, 'input') as unknown as HTMLInputElement;
        Object.defineProperty(input, 'files', { value: [file('a.txt'), file('b.txt')], configurable: true });
        input.dispatchEvent(new Event('change', { bubbles: true }));

        const removes = parts(container, 'item-remove');
        expect(removes[0]!.tagName).toBe('BUTTON');
        expect(removes[0]!.getAttribute('aria-label')).toBe('Remove a.txt');
        removes[0]!.click();
        expect(parts(container, 'item-name').map((el) => el.textContent)).toEqual(['b.txt']);
    });

    it('item-size renders a human-readable size', () => {
        render(sample(), container);
        const input = part(container, 'input') as unknown as HTMLInputElement;
        Object.defineProperty(input, 'files', { value: [file('a.txt', 1536)], configurable: true });
        input.dispatchEvent(new Event('change', { bubbles: true }));
        expect(part(container, 'item-size').textContent).toBe('1.5 kB');
    });

    it('adopts the field context like every form control', () => {
        render(
            <Field.Root invalid disabled>
                <Field.Label>Documents</Field.Label>
                <FileUpload.Root>
                    <FileUpload.Trigger>Browse…</FileUpload.Trigger>
                </FileUpload.Root>
            </Field.Root>,
            container,
        );
        const root = part(container, 'root');
        expect(root.getAttribute('data-disabled')).toBe('');
        expect(root.getAttribute('data-invalid')).toBe('');
        const trigger = part(container, 'trigger') as unknown as HTMLButtonElement;
        expect(trigger.disabled).toBe(true);
        // The trigger is the interactive control, so it owns the field's
        // control id — the Field.Label points at the thing you can focus.
        const label = container.querySelector<HTMLLabelElement>('[data-scope="field"][data-part="label"]')!;
        expect(trigger.id).toBe(label.getAttribute('for'));
    });

    it('a failed required check lands focus on the trigger, cancels the bubble, and reads invalid until the files change', () => {
        const form = document.createElement('form');
        container.appendChild(form);
        render(sample({ required: true, name: 'docs' }), form);
        const trigger = part(form, 'trigger');
        const root = part(form, 'root');
        expect(root.hasAttribute('data-invalid')).toBe(false);

        const invalid = new Event('invalid', { cancelable: true });
        part(form, 'input').dispatchEvent(invalid);
        // No 1px bubble: the platform's default is cancelled, the user lands
        // where they can act.
        expect(invalid.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(trigger);
        expect(root.getAttribute('data-invalid')).toBe('');
        expect(trigger.getAttribute('aria-invalid')).toBe('true');
        expect(part(form, 'label').getAttribute('data-invalid')).toBe('');

        // Any change to the files clears the redirect's invalid.
        drag(part(form, 'dropzone'), 'drop', [file('a.txt')]);
        expect(root.hasAttribute('data-invalid')).toBe(false);
        expect(trigger.hasAttribute('aria-invalid')).toBe(false);
    });

    it('removing a file moves focus to the next remove button, else the previous, else the trigger', () => {
        render(sample(), container);
        drag(part(container, 'dropzone'), 'drop', [file('a.txt'), file('b.txt'), file('c.txt')]);
        const names = () => parts(container, 'item-name').map((el) => el.textContent);
        expect(names()).toEqual(['a.txt', 'b.txt', 'c.txt']);

        // Middle: the next file's button (c).
        let removes = parts(container, 'item-remove');
        removes[1]!.focus();
        removes[1]!.click();
        expect(names()).toEqual(['a.txt', 'c.txt']);
        expect(document.activeElement?.getAttribute('aria-label')).toBe('Remove c.txt');

        // Last: no next, so the previous one (a).
        removes = parts(container, 'item-remove');
        removes[1]!.click();
        expect(names()).toEqual(['a.txt']);
        expect(document.activeElement?.getAttribute('aria-label')).toBe('Remove a.txt');

        // Only one left: the trigger.
        parts(container, 'item-remove')[0]!.click();
        expect(names()).toEqual([]);
        expect(document.activeElement).toBe(part(container, 'trigger'));
    });

    it('a drag leaving into a child of the dropzone keeps the highlight', () => {
        render(
            <FileUpload.Root>
                <FileUpload.Dropzone><span class="hint">Drop here</span></FileUpload.Dropzone>
            </FileUpload.Root>,
            container,
        );
        const dropzone = part(container, 'dropzone');
        const child = dropzone.querySelector<HTMLElement>('.hint')!;
        const leave = (el: HTMLElement, relatedTarget: EventTarget | null) => {
            const e = new Event('dragleave', { bubbles: true });
            Object.defineProperty(e, 'relatedTarget', { value: relatedTarget });
            el.dispatchEvent(e);
        };

        drag(dropzone, 'dragenter');
        drag(dropzone, 'dragover');
        expect(dropzone.getAttribute('data-highlighted')).toBe('');
        // relatedTarget names a descendant: not a leave at all.
        drag(child, 'dragenter');
        leave(dropzone, child);
        expect(dropzone.getAttribute('data-highlighted')).toBe('');
        // Out to somewhere else entirely: cleared.
        leave(child, document.body);
        expect(dropzone.hasAttribute('data-highlighted')).toBe(false);

        // No relatedTarget (WebKit): enters and leaves are counted.
        drag(dropzone, 'dragenter');
        drag(dropzone, 'dragover');
        drag(child, 'dragenter');
        leave(dropzone, null);
        expect(dropzone.getAttribute('data-highlighted')).toBe('');
        leave(child, null);
        expect(dropzone.hasAttribute('data-highlighted')).toBe(false);
    });

    it('constraints reject with codes through filesReject; accepted files still join the model', () => {
        const rejects: { file: File; errors: string[] }[][] = [];
        const changes: File[][] = [];
        render(sample({
            maxFiles: 3,
            minFileSize: 2,
            maxFileSize: 100,
            validate: (f: File) => (f.name.startsWith('secret') ? 'forbidden-name' : null),
            onFilesReject: (r: { file: File; errors: string[] }[]) => rejects.push(r),
            onFilesChange: (f: File[]) => changes.push(f),
        }), container);
        const dropzone = part(container, 'dropzone');
        drag(dropzone, 'drop', [
            file('ok.txt', 10),
            file('huge.txt', 500),
            file('tiny.txt', 1),
            file('pic.png', 10, 'image/png'),
            file('secret.txt', 10),
            file('big.png', 500, 'image/png'),
        ]);
        expect(changes.at(-1)!.map((f) => f.name)).toEqual(['ok.txt']);
        expect(rejects).toHaveLength(1);
        expect(rejects[0]!.map((r) => [r.file.name, r.errors])).toEqual([
            ['huge.txt', ['too-large']],
            ['tiny.txt', ['too-small']],
            ['pic.png', ['invalid-type']],
            ['secret.txt', ['forbidden-name']],
            ['big.png', ['invalid-type', 'too-large']],
        ]);

        // maxFiles counts what the model already holds.
        drag(dropzone, 'drop', [file('b.txt', 10), file('c.txt', 10), file('d.txt', 10)]);
        expect(changes.at(-1)!.map((f) => f.name)).toEqual(['ok.txt', 'b.txt', 'c.txt']);
        expect(rejects.at(-1)!.map((r) => [r.file.name, r.errors])).toEqual([['d.txt', ['too-many']]]);

        // A selection with nothing refused emits no filesReject.
        parts(container, 'item-remove')[0]!.click();
        drag(dropzone, 'drop', [file('e.txt', 10)]);
        expect(rejects).toHaveLength(2);
    });

    it('validate may return several codes; single mode refuses the extras as too-many', () => {
        const rejects: { file: File; errors: string[] }[][] = [];
        render(
            <FileUpload.Root
                validate={(f: File) => (f.name === 'x.txt' ? ['a', 'b'] : null)}
                onFilesReject={(r: { file: File; errors: string[] }[]) => rejects.push(r)}
            >
                <FileUpload.Dropzone>Drop</FileUpload.Dropzone>
            </FileUpload.Root>,
            container,
        );
        drag(part(container, 'dropzone'), 'drop', [file('x.txt'), file('one.txt'), file('two.txt')]);
        expect(rejects[0]!.map((r) => [r.file.name, r.errors])).toEqual([
            ['x.txt', ['a', 'b']],
            ['two.txt', ['too-many']],
        ]);
    });

    it('a refused picker selection is not left in the input to post', () => {
        render(sample({ maxFileSize: 10 }), container);
        const input = part(container, 'input') as unknown as HTMLInputElement;
        const dt = new DataTransfer();
        dt.items.add(file('big.txt', 50));
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        expect(parts(container, 'item')).toHaveLength(0);
        expect(input.files?.length ?? 0).toBe(0);
    });

    it('directory and capture reach the input', () => {
        render(sample({ directory: true, capture: 'environment' }), container);
        const input = part(container, 'input');
        expect(input.hasAttribute('webkitdirectory')).toBe(true);
        expect(input.getAttribute('capture')).toBe('environment');

        const plain = document.createElement('div');
        document.body.appendChild(plain);
        render(sample(), plain);
        expect(part(plain, 'input').hasAttribute('webkitdirectory')).toBe(false);
        expect(part(plain, 'input').hasAttribute('capture')).toBe(false);
    });

    it('clear-trigger renders only with files, empties the model and hands focus to the trigger', () => {
        const changes: File[][] = [];
        render(
            <FileUpload.Root multiple defaultFiles={[file('a.txt'), file('b.txt')]} onFilesChange={(f: File[]) => changes.push(f)}>
                <FileUpload.Trigger>Browse…</FileUpload.Trigger>
                <FileUpload.ClearTrigger>Clear</FileUpload.ClearTrigger>
                <FileUpload.ItemGroup>
                    {(files: File[]) => files.map((f) => (
                        <FileUpload.Item file={f} key={f.name}><FileUpload.ItemName /></FileUpload.Item>
                    ))}
                </FileUpload.ItemGroup>
            </FileUpload.Root>,
            container,
        );
        expectAnatomy(container, fileUploadAnatomy);
        const clear = part(container, 'clear-trigger');
        expect(clear.tagName).toBe('BUTTON');
        expect(clear.getAttribute('type')).toBe('button');
        expect(clear.getAttribute('aria-label')).toBe('Clear files');
        clear.focus();
        clear.click();
        expect(changes.at(-1)).toEqual([]);
        expect(parts(container, 'item')).toHaveLength(0);
        // Nothing to clear: nothing rendered.
        expect(part(container, 'clear-trigger')).toBeNull();
        expect(document.activeElement).toBe(part(container, 'trigger'));
    });

    it('clear-trigger takes a label and answers to disabled', () => {
        render(
            <FileUpload.Root disabled defaultFiles={[file('a.txt')]}>
                <FileUpload.ClearTrigger label="Remove all attachments">✕</FileUpload.ClearTrigger>
            </FileUpload.Root>,
            container,
        );
        const clear = part(container, 'clear-trigger') as unknown as HTMLButtonElement;
        expect(clear.getAttribute('aria-label')).toBe('Remove all attachments');
        expect(clear.disabled).toBe(true);
        expect(clear.getAttribute('data-disabled')).toBe('');
    });

    it('an Item renders a rejected file with data-invalid', () => {
        const rejected = file('nope.png', 4, 'image/png');
        render(
            <FileUpload.Root>
                <FileUpload.ItemGroup>
                    <FileUpload.Item file={rejected} invalid><FileUpload.ItemName /></FileUpload.Item>
                    <FileUpload.Item file={file('fine.txt')}><FileUpload.ItemName /></FileUpload.Item>
                </FileUpload.ItemGroup>
            </FileUpload.Root>,
            container,
        );
        expectAnatomy(container, fileUploadAnatomy);
        const items = parts(container, 'item');
        expect(items[0]!.getAttribute('data-invalid')).toBe('');
        expect(items[1]!.hasAttribute('data-invalid')).toBe(false);
    });

    it('declares no states — presence flags carry everything', () => {
        for (const name of fileUploadAnatomy.partNames()) {
            expect(fileUploadAnatomy.parts[name].states, `${name} must declare no states`).toBeUndefined();
        }
    });
});
