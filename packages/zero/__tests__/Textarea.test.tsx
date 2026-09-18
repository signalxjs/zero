import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@sigx/runtime-dom';
import { renderToString } from '@sigx/server-renderer';
import { component, defineApp, signal } from 'sigx';
import { Field, Textarea, textareaAnatomy, zeroPlugin } from '@sigx/zero';
import { expectAnatomy as expectAnatomyPublic } from '@sigx/zero/testing';
import { defineAnatomy } from '@sigx/zero/anatomy';
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

    describe('autosize (#88)', () => {
        const tick = () => new Promise<void>((r) => setTimeout(r, 0));
        afterEach(() => vi.unstubAllGlobals());

        it('stays off until minRows or maxRows is set', () => {
            mount(container, { rows: 4 });
            const el = box(container);
            expect(el.hasAttribute('data-autosize')).toBe(false);
            expect(el.getAttribute('style') ?? '').toBe('');
            expect(el.getAttribute('rows')).toBe('4');
        });

        it('publishes the row bounds and a valid anatomy', () => {
            render(
                <Textarea.Root minRows={2} maxRows={8}>
                    <Textarea.Label>Message</Textarea.Label>
                    <Textarea.Textarea />
                </Textarea.Root>,
                container,
            );
            const el = box(container);
            expect(el.getAttribute('data-autosize')).toBe('');
            expect(el.style.getPropertyValue('--textarea-min-rows')).toBe('2');
            expect(el.style.getPropertyValue('--textarea-max-rows')).toBe('8');
            expectAnatomy(container, textareaAnatomy);
        });

        it('renders rows from minRows while autosizing, not the rows prop', () => {
            render(<Textarea.Root rows={6} minRows={2}><Textarea.Textarea /></Textarea.Root>, container);
            expect(box(container).getAttribute('rows')).toBe('2');
        });

        it('maxRows alone floors at one row and leaves the minimum implicit', () => {
            render(<Textarea.Root maxRows={5}><Textarea.Textarea /></Textarea.Root>, container);
            const el = box(container);
            expect(el.style.getPropertyValue('--textarea-min-rows')).toBe('1');
            expect(el.style.getPropertyValue('--textarea-max-rows')).toBe('5');
        });

        it('normalizes the bounds to whole rows, at least one, max never below min', () => {
            render(<Textarea.Root minRows={0} maxRows={2.7}><Textarea.Textarea /></Textarea.Root>, container);
            const el = box(container);
            expect(el.style.getPropertyValue('--textarea-min-rows')).toBe('1');
            expect(el.style.getPropertyValue('--textarea-max-rows')).toBe('2');
            expect(el.getAttribute('rows')).toBe('1');
            const other = document.body.appendChild(document.createElement('div'));
            render(<Textarea.Root minRows={4} maxRows={2}><Textarea.Textarea /></Textarea.Root>, other);
            expect(box(other).style.getPropertyValue('--textarea-max-rows')).toBe('4');
            const third = document.body.appendChild(document.createElement('div'));
            render(<Textarea.Root minRows={Number.NaN} maxRows={Infinity}><Textarea.Textarea /></Textarea.Root>, third);
            expect(box(third).hasAttribute('data-autosize')).toBe(true);
            expect(box(third).style.getPropertyValue('--textarea-min-rows')).toBe('1');
            expect(box(third).style.getPropertyValue('--textarea-max-rows')).toBe('');
            expect(box(third).getAttribute('rows')).toBe('1');
        });

        it('minRows alone is unbounded above', () => {
            render(<Textarea.Root minRows={3}><Textarea.Textarea /></Textarea.Root>, container);
            expect(box(container).style.getPropertyValue('--textarea-max-rows')).toBe('');
        });

        it('turns off again when the bounds go away', async () => {
            const state = signal({ max: 4 as number | undefined });
            const App = component(() => () => <Textarea.Root maxRows={state.max}><Textarea.Textarea /></Textarea.Root>);
            render(<App />, container);
            const el = box(container);
            expect(el.hasAttribute('data-autosize')).toBe(true);
            state.max = undefined;
            await tick();
            expect(el.hasAttribute('data-autosize')).toBe(false);
            expect(el.style.getPropertyValue('--textarea-max-rows')).toBe('');
            expect(el.style.getPropertyValue('--textarea-block-chrome')).toBe('');
        });

        it('renders the bounds on the server, before any script runs', async () => {
            const app = defineApp(
                <Textarea.Root minRows={1} maxRows={8} name="draft">
                    <Textarea.Textarea />
                </Textarea.Root>,
            );
            app.use(zeroPlugin());
            const html = await renderToString(app);
            expect(html).toMatch(/<textarea[^>]*data-autosize[^>]*--textarea-min-rows:\s*1;?\s*--textarea-max-rows:\s*8/);
        });

        it('publishes a border-box element\'s block chrome for the bounds', async () => {
            render(<Textarea.Root maxRows={4}><Textarea.Textarea /></Textarea.Root>, container);
            const el = box(container);
            el.style.boxSizing = 'border-box';
            el.style.padding = '6px 10px';
            el.style.border = '1px solid';
            type(el, 'x');
            await tick();
            expect(el.style.getPropertyValue('--textarea-block-chrome')).toBe('14px');
        });

        it('falls back to measuring scrollHeight where field-sizing is unsupported', async () => {
            vi.stubGlobal('CSS', { supports: () => false });
            render(<Textarea.Root maxRows={4}><Textarea.Textarea /></Textarea.Root>, container);
            const el = box(container);
            el.style.boxSizing = 'border-box';
            el.style.padding = '4px 0';
            el.style.border = '1px solid';
            let content = 20;
            Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => content + 8 });
            type(el, 'one');
            await tick();
            expect(el.style.height).toBe('30px');
            content = 60;
            type(el, 'one\ntwo\nthree');
            await tick();
            expect(el.style.height).toBe('70px');
        });

        it('leaves the height to CSS where field-sizing is supported', async () => {
            vi.stubGlobal('CSS', { supports: (p: string, v: string) => p === 'field-sizing' && v === 'content' });
            render(<Textarea.Root maxRows={4}><Textarea.Textarea /></Textarea.Root>, container);
            const el = box(container);
            Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => 200 });
            type(el, 'one');
            await tick();
            expect(el.style.height).toBe('');
        });

        it('re-measures when the model is written from outside', async () => {
            vi.stubGlobal('CSS', { supports: () => false });
            const state = signal({ draft: 'a\nb\nc' });
            render(
                <Textarea.Root model={() => state.draft} maxRows={6}>
                    <Textarea.Textarea />
                </Textarea.Root>,
                container,
            );
            const el = box(container);
            let content = 60;
            Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => content });
            type(el, 'a\nb\nc');
            await tick();
            expect(el.style.height).toBe('60px');
            content = 20;
            state.draft = '';
            await tick();
            expect(el.style.height).toBe('20px');
        });
    });
});

describe('the contract around data-autosize', () => {
    const demo = defineAnatomy('demo-as', {
        root: { element: 'div' },
        field: { element: 'textarea', parent: 'root', autosize: true },
    });
    const build = (partName: string, value = '') => {
        const root = document.createElement('div');
        root.setAttribute('data-scope', 'demo-as');
        root.setAttribute('data-part', 'root');
        const el = partName === 'root' ? root : root.appendChild(document.createElement('textarea'));
        if (partName !== 'root') {
            el.setAttribute('data-scope', 'demo-as');
            el.setAttribute('data-part', partName);
        }
        el.setAttribute('data-autosize', value);
        const host = document.createElement('div');
        host.append(root);
        return host;
    };

    it('expectAnatomy accepts it on a part that declares autosize', () => {
        expect(() => expectAnatomyPublic(build('field'), demo)).not.toThrow();
    });

    it('expectAnatomy fails it on a part that never offered it, and when not presence-only', () => {
        expect(() => expectAnatomyPublic(build('root'), demo)).toThrow(/does not declare autosize/);
        expect(() => expectAnatomyPublic(build('field', 'true'), demo)).toThrow(/presence-only/);
    });

    it('base.css sizes it in the structure layer, where no recipe can undo it', () => {
        const css = readFileSync(resolve(import.meta.dirname, '../css/base.css'), 'utf8');
        const structure = css.slice(css.indexOf('@layer zero.structure {'));
        const rule = structure.slice(structure.indexOf('[data-scope="textarea"][data-part="textarea"][data-autosize] {'));
        expect(rule.slice(0, rule.indexOf('}'))).toMatch(
            /field-sizing: content;[\s\S]*min-block-size: calc\(var\(--textarea-min-rows, 1\) \* 1lh \+ var\(--textarea-block-chrome, 0px\)\);[\s\S]*max-block-size: calc\(var\(--textarea-max-rows\) \* 1lh/,
        );
    });
});
