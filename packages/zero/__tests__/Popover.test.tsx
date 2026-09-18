import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { signal } from 'sigx';
import { Popover, popoverAnatomy } from '@sigx/zero';
import { expectAnatomy } from './helpers';

/** Presence flags land one microtask after the render pass; settle them. */
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('Popover', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    function mount(state: { open: boolean }) {
        render(
            <Popover.Root model={[state, 'open']}>
                <Popover.Trigger>Filters</Popover.Trigger>
                <Popover.Popup>
                    <Popover.Title>Filters</Popover.Title>
                    <Popover.Close>Done</Popover.Close>
                </Popover.Popup>
            </Popover.Root>,
            container,
        );
    }

    it('renders a valid anatomy with the popover attribute', () => {
        mount(signal({ open: false }));
        expectAnatomy(container, popoverAnatomy);
        const popup = container.querySelector<HTMLElement>('[data-part="popup"]')!;
        expect(popup.getAttribute('popover')).toBe('auto');
        expect(popup.getAttribute('role')).toBe('dialog');
    });

    it('passes the variant axes through on the trigger (the carrier part)', () => {
        mountWithAxes();
        const trigger = container.querySelector<HTMLElement>('[data-scope="popover"][data-part="trigger"]')!;
        expect(trigger.getAttribute('data-color')).toBe('primary');
        expect(trigger.getAttribute('data-size')).toBe('sm');
    });

    function mountWithAxes() {
        render(
            <Popover.Root>
                <Popover.Trigger color="primary" size="sm">Filters</Popover.Trigger>
                <Popover.Popup>
                    <Popover.Title>Filters</Popover.Title>
                    <Popover.Close>Done</Popover.Close>
                </Popover.Popup>
            </Popover.Root>,
            container,
        );
    }

    it('trigger toggles, close closes, aria wiring holds', async () => {
        const state = signal({ open: false });
        mount(state);
        await tick();
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        const popup = container.querySelector<HTMLElement>('[data-part="popup"]')!;
        expect(trigger.getAttribute('aria-controls')).toBe(popup.id);
        expect(popup.getAttribute('aria-labelledby')).toBe(container.querySelector('[data-part="title"]')!.id);

        trigger.click();
        expect(state.open).toBe(true);
        expect(trigger.getAttribute('aria-expanded')).toBe('true');
        expect(popup.getAttribute('data-state')).toBe('open');

        trigger.click();
        expect(state.open).toBe(false);

        trigger.click();
        container.querySelector<HTMLElement>('[data-part="close"]')!.click();
        expect(state.open).toBe(false);
    });

    it('omits aria-labelledby when no Title is rendered', async () => {
        render(
            <Popover.Root>
                <Popover.Trigger>Filters</Popover.Trigger>
                <Popover.Popup>
                    <Popover.Close>Done</Popover.Close>
                </Popover.Popup>
            </Popover.Root>,
            container,
        );
        await tick();
        const popup = container.querySelector<HTMLElement>('[data-part="popup"]')!;
        expect(popup.hasAttribute('aria-labelledby')).toBe(false);
    });

    it('publishes press feedback on the trigger and the close button', () => {
        mount(signal({ open: true }));
        for (const part of ['trigger', 'close'] as const) {
            const el = container.querySelector<HTMLElement>(`[data-part="${part}"]`)!;
            el.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
            expect(el.hasAttribute('data-pressed')).toBe(true);
            el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
            expect(el.hasAttribute('data-pressed')).toBe(false);
        }
    });

    it('publishes no press feedback on a disabled trigger', () => {
        render(
            <Popover.Root model={[signal({ open: false }), 'open']}>
                <Popover.Trigger disabled>Filters</Popover.Trigger>
            </Popover.Root>,
            container,
        );
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        trigger.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
        expect(trigger.hasAttribute('data-pressed')).toBe(false);
    });

    it('moves focus to the first tabbable in the popup on open, restores on close', async () => {
        const state = signal({ open: false });
        mount(state);
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        trigger.focus();
        trigger.click();
        await tick();
        // Title is a heading; the close button is the first tabbable.
        expect(document.activeElement).toBe(container.querySelector('[data-part="close"]'));
        state.open = false;
        await tick();
        expect(document.activeElement).toBe(trigger);
    });

    it('with nothing tabbable inside, the popup itself takes focus', async () => {
        const state = signal({ open: false });
        render(
            <Popover.Root model={[state, 'open']}>
                <Popover.Trigger>Filters</Popover.Trigger>
                <Popover.Popup>
                    <Popover.Title>Filters</Popover.Title>
                </Popover.Popup>
            </Popover.Root>,
            container,
        );
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        trigger.focus();
        trigger.click();
        await tick();
        expect(document.activeElement).toBe(container.querySelector('[data-part="popup"]'));
    });

    it('native toggle events (light dismiss) sync into the model', () => {
        const state = signal({ open: true });
        mount(state);
        const popup = container.querySelector<HTMLElement>('[data-part="popup"]')!;
        const e = new Event('toggle');
        (e as unknown as { newState: string }).newState = 'closed';
        popup.dispatchEvent(e);
        expect(state.open).toBe(false);
    });
});
