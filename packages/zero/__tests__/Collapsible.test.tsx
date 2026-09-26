import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { signal } from 'sigx';
import { Collapsible, collapsibleAnatomy } from '@sigx/zero';
import { expectAnatomy } from './helpers';

const frame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()));

describe('Collapsible', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    function mount(state: { open: boolean }) {
        render(
            <Collapsible.Root model={[state, 'open']}>
                <Collapsible.Trigger>Toggle</Collapsible.Trigger>
                <Collapsible.Panel>Content</Collapsible.Panel>
            </Collapsible.Root>,
            container,
        );
    }

    it('renders a valid anatomy on a native details element', () => {
        mount(signal({ open: false }));
        expectAnatomy(container, collapsibleAnatomy);
        expect(container.querySelector('details')).not.toBeNull();
        expect(container.querySelector('summary')?.getAttribute('data-part')).toBe('trigger');
    });

    it('passes the variant axes through on the root', () => {
        render(
            <Collapsible.Root defaultOpen color="primary" size="lg">
                <Collapsible.Trigger>Toggle</Collapsible.Trigger>
                <Collapsible.Panel>Content</Collapsible.Panel>
            </Collapsible.Root>,
            container,
        );
        const root = container.querySelector<HTMLElement>('[data-scope="collapsible"][data-part="root"]')!;
        expect(root.getAttribute('data-color')).toBe('primary');
        expect(root.getAttribute('data-size')).toBe('lg');
        expectAnatomy(container, collapsibleAnatomy);
    });

    it('clicking the trigger toggles state and model', () => {
        const state = signal({ open: false });
        mount(state);
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        expect(trigger.getAttribute('data-state')).toBe('closed');
        trigger.click();
        expect(state.open).toBe(true);
        expect(trigger.getAttribute('data-state')).toBe('open');
        expect(container.querySelector('[data-part="root"]')!.hasAttribute('open')).toBe(true);
        trigger.click();
        expect(state.open).toBe(false);
    });

    it('model writes flow into the DOM', () => {
        const state = signal({ open: false });
        mount(state);
        state.open = true;
        expect(container.querySelector('[data-part="panel"]')!.getAttribute('data-state')).toBe('open');
    });

    // #166: find-in-page and fragment navigation open a closed <details> by
    // themselves, then fire `toggle`. The model has to follow, or the parts
    // announce "closed" over an open panel and the next click only resyncs.
    it('a native toggle (find-in-page auto-expand) syncs back into the model', async () => {
        const state = signal({ open: false });
        mount(state);
        const details = container.querySelector<HTMLDetailsElement>('details')!;
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        details.open = true;
        details.dispatchEvent(new Event('toggle'));
        await Promise.resolve();
        expect(state.open).toBe(true);
        expect(details.getAttribute('data-state')).toBe('open');
        expect(trigger.getAttribute('data-state')).toBe('open');
        expect(trigger.getAttribute('aria-expanded')).toBe('true');
        expect(container.querySelector('[data-part="panel"]')!.getAttribute('data-state')).toBe('open');
        // One press closes it — no silent resync click first.
        trigger.click();
        expect(state.open).toBe(false);
        // The native close waits a frame for the panel's exit animation (#276).
        await frame();
        expect(details.open).toBe(false);
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });

    it('a native toggle on a disabled root is reverted, not adopted', async () => {
        render(
            <Collapsible.Root disabled>
                <Collapsible.Trigger>Toggle</Collapsible.Trigger>
                <Collapsible.Panel>Content</Collapsible.Panel>
            </Collapsible.Root>,
            container,
        );
        const details = container.querySelector<HTMLDetailsElement>('details')!;
        details.open = true;
        details.dispatchEvent(new Event('toggle'));
        await Promise.resolve();
        expect(details.open).toBe(false);
        expect(details.getAttribute('data-state')).toBe('closed');
    });

    it('publishes press feedback on the trigger, by pointer and by Enter', () => {
        mount(signal({ open: false }));
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        trigger.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
        expect(trigger.hasAttribute('data-pressed')).toBe(true);
        trigger.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        expect(trigger.hasAttribute('data-pressed')).toBe(false);

        trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        expect(trigger.hasAttribute('data-pressed')).toBe(true);
        trigger.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
        expect(trigger.hasAttribute('data-pressed')).toBe(false);
    });

    it('publishes no press feedback while the root is disabled', () => {
        render(
            <Collapsible.Root disabled>
                <Collapsible.Trigger>Toggle</Collapsible.Trigger>
                <Collapsible.Panel>Content</Collapsible.Panel>
            </Collapsible.Root>,
            container,
        );
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        trigger.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
        expect(trigger.hasAttribute('data-pressed')).toBe(false);
    });

    it('wires explicit disclosure semantics: aria-expanded + aria-controls', () => {
        const state = signal({ open: false });
        mount(state);
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        const panel = container.querySelector<HTMLElement>('[data-part="panel"]')!;
        // Native <summary> conveys expansion in most ATs, but explicit
        // wiring covers the rest and keeps the contract inspectable.
        expect(panel.id).not.toBe('');
        expect(trigger.getAttribute('aria-controls')).toBe(panel.id);
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
        state.open = true;
        expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });

    it('a disabled root announces aria-disabled on the trigger', () => {
        render(
            <Collapsible.Root disabled>
                <Collapsible.Trigger>Toggle</Collapsible.Trigger>
                <Collapsible.Panel>Content</Collapsible.Panel>
            </Collapsible.Root>,
            container,
        );
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        // <summary> has no disabled attribute — without aria-disabled the
        // inert trigger announces as an ordinary interactive one.
        expect(trigger.getAttribute('aria-disabled')).toBe('true');

        const other = document.createElement('div');
        document.body.appendChild(other);
        render(
            <Collapsible.Root>
                <Collapsible.Trigger>Toggle</Collapsible.Trigger>
                <Collapsible.Panel>Content</Collapsible.Panel>
            </Collapsible.Root>,
            other,
        );
        expect(other.querySelector<HTMLElement>('[data-part="trigger"]')!.hasAttribute('aria-disabled')).toBe(false);
    });

    it('disabled root blocks toggling', () => {
        render(
            <Collapsible.Root disabled>
                <Collapsible.Trigger>Toggle</Collapsible.Trigger>
                <Collapsible.Panel>Content</Collapsible.Panel>
            </Collapsible.Root>,
            container,
        );
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        trigger.click();
        expect(trigger.getAttribute('data-state')).toBe('closed');
        expect(trigger.getAttribute('data-disabled')).toBe('');
    });
});
