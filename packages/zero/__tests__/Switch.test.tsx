import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { signal } from 'sigx';
import { Field, Switch, switchAnatomy } from '@sigx/zero';
import { expectAnatomy } from './helpers';

describe('Switch', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('renders a valid anatomy over a native checkbox with role=switch', () => {
        render(<Switch.Root defaultChecked>Label</Switch.Root>, container);
        expectAnatomy(container, switchAnatomy);
        const input = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
        expect(input.getAttribute('role')).toBe('switch');
        expect(input.checked).toBe(true);
        expect(container.querySelector('[data-part="root"]')!.getAttribute('data-state')).toBe('checked');
    });

    it('native change syncs the model both ways', () => {
        const state = signal({ on: false });
        render(<Switch.Root model={[state, 'on']}>Label</Switch.Root>, container);
        const input = container.querySelector<HTMLInputElement>('input')!;

        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        expect(state.on).toBe(true);
        expect(container.querySelector('[data-part="thumb"]')!.getAttribute('data-state')).toBe('checked');

        state.on = false;
        expect(input.checked).toBe(false);
        expect(container.querySelector('[data-part="control"]')!.getAttribute('data-state')).toBe('unchecked');
    });

    it('passes contract variant axes through as data attributes', () => {
        render(<Switch.Root color="success" size="lg" variant="soft" />, container);
        const root = container.querySelector('[data-part="root"]')!;
        expect(root.getAttribute('data-color')).toBe('success');
        expect(root.getAttribute('data-size')).toBe('lg');
        expect(root.getAttribute('data-variant')).toBe('soft');
    });

    it('pointer press on the row lands feedback on the control', () => {
        render(<Switch.Root>Label</Switch.Root>, container);
        const root = container.querySelector<HTMLElement>('[data-scope="switch"][data-part="root"]')!;
        const control = container.querySelector<HTMLElement>('[data-scope="switch"][data-part="control"]')!;
        root.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
        expect(control.hasAttribute('data-pressed')).toBe(true);
        // Cross-element on purpose: the row is the target, the control is the
        // styling surface — the row itself stays unmarked.
        expect(root.hasAttribute('data-pressed')).toBe(false);
        root.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        expect(control.hasAttribute('data-pressed')).toBe(false);
    });

    it('keyboard press on the hidden input lands feedback on the control', () => {
        render(<Switch.Root>Label</Switch.Root>, container);
        const input = container.querySelector<HTMLElement>('[data-scope="switch"][data-part="hidden-input"]')!;
        const control = container.querySelector<HTMLElement>('[data-scope="switch"][data-part="control"]')!;
        input.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
        expect(control.hasAttribute('data-pressed')).toBe(true);
        input.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
        expect(control.hasAttribute('data-pressed')).toBe(false);
    });

    it('publishes no press feedback while disabled', () => {
        render(<Switch.Root disabled>Label</Switch.Root>, container);
        const root = container.querySelector<HTMLElement>('[data-scope="switch"][data-part="root"]')!;
        root.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
        expect(container.querySelector('[data-part="control"]')!.hasAttribute('data-pressed')).toBe(false);
    });

    it('disabled and form wiring', () => {
        render(<Switch.Root disabled name="notify" value="yes" />, container);
        const input = container.querySelector<HTMLInputElement>('input')!;
        expect(input.disabled).toBe(true);
        expect(input.name).toBe('notify');
        expect(input.value).toBe('yes');
        expect(container.querySelector('[data-part="root"]')!.getAttribute('data-disabled')).toBe('');
    });

    it('the control carries `invalid`, not only the root', () => {
        render(<Switch.Root invalid>Label</Switch.Root>, container);
        expectAnatomy(container, switchAnatomy);
        // The track is what a design system paints. Reaching it from the root
        // would cost every recipe a descendant selector for a fact the
        // control can carry itself — the shape `checkbox/control` already has.
        for (const part of ['root', 'control']) {
            expect(
                container.querySelector(`[data-scope="switch"][data-part="${part}"]`)!.getAttribute('data-invalid'),
                `switch/${part} must carry data-invalid`,
            ).toBe('');
        }
        expect(container.querySelector('input')!.getAttribute('aria-invalid')).toBe('true');
    });

    it('a Field supplies disabled/invalid/required when the prop does not', () => {
        render(
            <Field.Root invalid required disabled>
                <Field.Label>Notifications</Field.Label>
                <Switch.Root>On</Switch.Root>
                <Field.Description>You can turn this off later.</Field.Description>
                <Field.Error>Pick one.</Field.Error>
            </Field.Root>,
            container,
        );
        const root = container.querySelector<HTMLElement>('[data-scope="switch"][data-part="root"]')!;
        const control = container.querySelector<HTMLElement>('[data-scope="switch"][data-part="control"]')!;
        const input = container.querySelector<HTMLInputElement>('input')!;

        // The ids, not only the flags: `Field.Label` points `for` at the
        // control's id, so a switch that adopts the flags but not the id is
        // still a switch with no accessible name from its field.
        const label = container.querySelector<HTMLLabelElement>('[data-scope="field"][data-part="label"]')!;
        expect(input.id).not.toBe('');
        expect(label.getAttribute('for')).toBe(input.id);
        const describedBy = input.getAttribute('aria-describedby') ?? '';
        for (const part of ['description', 'error']) {
            expect(describedBy, `aria-describedby must name the field's ${part}`).toContain(
                container.querySelector(`[data-scope="field"][data-part="${part}"]`)!.id,
            );
        }

        expect(root.getAttribute('data-invalid')).toBe('');
        expect(root.getAttribute('data-required')).toBe('');
        expect(root.getAttribute('data-disabled')).toBe('');
        expect(control.getAttribute('data-invalid')).toBe('');
        expect(input.getAttribute('aria-invalid')).toBe('true');
        expect(input.required).toBe(true);
        expect(input.disabled).toBe(true);
    });

    it('a Field cannot un-set what the prop asserts', () => {
        // The prop is an OR, not an override: a Switch marked invalid inside a
        // valid Field stays invalid. Same direction as every other control.
        render(
            <Field.Root>
                <Switch.Root invalid required disabled>On</Switch.Root>
            </Field.Root>,
            container,
        );
        const root = container.querySelector<HTMLElement>('[data-scope="switch"][data-part="root"]')!;
        expect(root.getAttribute('data-invalid')).toBe('');
        expect(root.getAttribute('data-required')).toBe('');
        expect(root.getAttribute('data-disabled')).toBe('');
    });
});
