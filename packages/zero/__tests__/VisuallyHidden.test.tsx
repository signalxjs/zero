/**
 * Visually hidden (#54): one technique — `data-visually-hidden`, clipped by
 * `css/base.css` in `@layer zero.structure` — reached three ways: the
 * `VisuallyHidden` utility, a part's own `visuallyHidden` option (declared in
 * its anatomy), and Switch/Checkbox's `hideLabel`. happy-dom resolves no
 * cascade, so the clipping itself is pinned against base.css's text and the
 * real-browser half lives in the playground's field e2e.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@sigx/runtime-dom';
import { signal } from 'sigx';
import {
    Checkbox,
    Dialog,
    Drawer,
    Field,
    Input,
    Switch,
    Textarea,
    VisuallyHidden,
    checkboxAnatomy,
    dialogAnatomy,
    drawerAnatomy,
    fieldAnatomy,
    inputAnatomy,
    switchAnatomy,
    textareaAnatomy,
} from '@sigx/zero';
import type { VisuallyHiddenBag } from '@sigx/zero';
import { expectAnatomy as expectAnatomyPublic } from '@sigx/zero/testing';
import { defineAnatomy } from '@sigx/zero/anatomy';
import { expectAnatomy } from './helpers';

/** Presence flags land one microtask after the render pass; settle them. */
const tick = () => new Promise((r) => setTimeout(r, 0));

let container: HTMLElement;
beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
});

const part = (scope: string, name: string) =>
    container.querySelector<HTMLElement>(`[data-scope="${scope}"][data-part="${name}"]`)!;

describe('VisuallyHidden', () => {
    it('renders a span carrying data-visually-hidden, and no scope', () => {
        render(<VisuallyHidden class="x">Close</VisuallyHidden>, container);
        const el = container.querySelector<HTMLElement>('[data-visually-hidden]')!;
        expect(el.tagName).toBe('SPAN');
        expect(el.getAttribute('data-visually-hidden')).toBe('');
        expect(el.className).toBe('x');
        expect(el.textContent).toBe('Close');
        expect(el.hasAttribute('data-scope')).toBe(false);
    });

    it('asChild spreads the attribute onto the consumer\'s element', () => {
        render(
            <VisuallyHidden asChild>{(p: VisuallyHiddenBag) => <h2 {...p}>Navigation</h2>}</VisuallyHidden>,
            container,
        );
        const h2 = container.querySelector('h2')!;
        expect(h2.getAttribute('data-visually-hidden')).toBe('');
        expect(container.querySelector('span')).toBeNull();
    });
});

describe('the visuallyHidden option on label and title parts', () => {
    it('Field.Label: hidden from sight, still the control\'s label', () => {
        render(
            <Field.Root>
                <Field.Label visuallyHidden>Search</Field.Label>
                <Input.Root><Input.Control><Input.Input /></Input.Control></Input.Root>
            </Field.Root>,
            container,
        );
        expectAnatomy(container, fieldAnatomy);
        const label = part('field', 'label') as HTMLLabelElement;
        expect(label.getAttribute('data-visually-hidden')).toBe('');
        const input = part('input', 'input') as HTMLInputElement;
        expect(label.htmlFor).toBe(input.id);
    });

    it('Input.Label and Textarea.Label', () => {
        render(
            <>
                <Input.Root><Input.Label visuallyHidden>Email</Input.Label></Input.Root>
                <Textarea.Root><Textarea.Label visuallyHidden>Message</Textarea.Label></Textarea.Root>
            </>,
            container,
        );
        expectAnatomy(container, inputAnatomy);
        expectAnatomy(container, textareaAnatomy);
        expect(part('input', 'label').hasAttribute('data-visually-hidden')).toBe(true);
        expect(part('textarea', 'label').hasAttribute('data-visually-hidden')).toBe(true);
    });

    it('Dialog.Title / Drawer.Title: hidden, and still what the popup is labelled by', async () => {
        render(
            <>
                <Dialog.Root defaultOpen>
                    <Dialog.Popup><Dialog.Title visuallyHidden>Settings</Dialog.Title></Dialog.Popup>
                </Dialog.Root>
                <Drawer.Root>
                    <Drawer.Panel><Drawer.Title visuallyHidden>Navigation</Drawer.Title></Drawer.Panel>
                </Drawer.Root>
            </>,
            container,
        );
        await tick();
        expectAnatomy(container, dialogAnatomy);
        expectAnatomy(container, drawerAnatomy);
        for (const [scope, host] of [['dialog', 'popup'], ['drawer', 'panel']] as const) {
            const title = part(scope, 'title');
            expect(title.getAttribute('data-visually-hidden')).toBe('');
            expect(part(scope, host).getAttribute('aria-labelledby')).toBe(title.id);
        }
    });

    it('is absent unless asked for — never data-visually-hidden="false"', () => {
        render(
            <Field.Root>
                <Field.Label>Name</Field.Label>
                <Field.Label visuallyHidden={false}>Name</Field.Label>
            </Field.Root>,
            container,
        );
        expect(container.querySelector('[data-visually-hidden]')).toBeNull();
    });
});

describe('hideLabel on Switch and Checkbox', () => {
    it('hides the label part and keeps it inside the <label> that names the input', () => {
        render(
            <>
                <Switch.Root hideLabel>Notifications</Switch.Root>
                <Checkbox.Root hideLabel>Select row</Checkbox.Root>
            </>,
            container,
        );
        expectAnatomy(container, switchAnatomy);
        expectAnatomy(container, checkboxAnatomy);
        for (const scope of ['switch', 'checkbox']) {
            const label = part(scope, 'label');
            expect(label.getAttribute('data-visually-hidden')).toBe('');
            const input = part(scope, 'hidden-input') as HTMLInputElement;
            expect(input.closest('label')!.contains(label)).toBe(true);
        }
    });

    it('Field + Switch: every <label> of the input names it, so name it ONCE', () => {
        // Both labels are labels of the same input — the accessible name
        // concatenates them. Field.Label as the name means a Switch with no
        // label text of its own (its root <label> then contributes nothing).
        render(
            <Field.Root>
                <Field.Label>Notifications</Field.Label>
                <Switch.Root model={[signal({ on: false }), 'on']} />
            </Field.Root>,
            container,
        );
        const input = part('switch', 'hidden-input') as HTMLInputElement;
        const labels = [...(input.labels ?? [])];
        expect(labels).toContain(part('field', 'label'));
        expect(labels.map((l) => l.textContent?.trim()).filter(Boolean)).toEqual(['Notifications']);
        expect(part('switch', 'label')).toBeNull();
    });
});

describe('the contract around data-visually-hidden', () => {
    const demo = defineAnatomy('demo-vh', {
        root: { element: 'div' },
        label: { element: 'span', parent: 'root', visuallyHidden: true },
    });
    const build = (partName: string, value = '') => {
        const root = document.createElement('div');
        root.setAttribute('data-scope', 'demo-vh');
        root.setAttribute('data-part', 'root');
        const el = partName === 'root' ? root : root.appendChild(document.createElement('span'));
        if (partName !== 'root') {
            el.setAttribute('data-scope', 'demo-vh');
            el.setAttribute('data-part', partName);
        }
        el.setAttribute('data-visually-hidden', value);
        const host = document.createElement('div');
        host.append(root);
        return host;
    };

    it('expectAnatomy accepts it on a part that declares visuallyHidden', () => {
        expect(() => expectAnatomyPublic(build('label'), demo)).not.toThrow();
    });

    it('expectAnatomy fails it on a part that never offered it, and when not presence-only', () => {
        expect(() => expectAnatomyPublic(build('root'), demo)).toThrow(/does not declare visuallyHidden/);
        expect(() => expectAnatomyPublic(build('label', 'true'), demo)).toThrow(/presence-only/);
    });

    it('the manifest carries the declaration', () => {
        expect(fieldAnatomy.toJSON().parts.find((p) => p.name === 'label')).toMatchObject({ visuallyHidden: true });
        // Not a flag: no selector is minted for it.
        expect(fieldAnatomy.toJSON().parts.find((p) => p.name === 'label')!.selectors).not.toHaveProperty('visually-hidden');
    });

    it('base.css clips it in the structure layer, where no recipe can undo it', () => {
        const css = readFileSync(resolve(import.meta.dirname, '../css/base.css'), 'utf8');
        const structure = css.slice(css.indexOf('@layer zero.structure {'));
        const rule = structure.slice(structure.indexOf('[data-visually-hidden] {'));
        expect(rule.slice(0, rule.indexOf('}'))).toMatch(/position: absolute;[\s\S]*clip-path: inset\(50%\);/);
    });
});
