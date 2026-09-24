import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { Tooltip, tooltipAnatomy } from '@sigx/zero';
import { expectAnatomy } from './helpers';

describe('Tooltip', () => {
    let container: HTMLElement;
    beforeEach(() => {
        vi.useFakeTimers();
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    function mount() {
        render(
            <Tooltip.Root openDelay={500}>
                <Tooltip.Trigger>Save</Tooltip.Trigger>
                <Tooltip.Popup>Save the document</Tooltip.Popup>
            </Tooltip.Root>,
            container,
        );
    }

    it('defaultOpen seeds the open model', () => {
        render(
            <Tooltip.Root defaultOpen>
                <Tooltip.Trigger>Save</Tooltip.Trigger>
                <Tooltip.Popup>Save the document</Tooltip.Popup>
            </Tooltip.Root>,
            container,
        );
        expect(container.querySelector('[data-part="popup"]')!.getAttribute('data-state')).toBe('open');
    });

    it('renders a valid anatomy with popover=manual and role=tooltip', () => {
        mount();
        expectAnatomy(container, tooltipAnatomy);
        const popup = container.querySelector<HTMLElement>('[data-part="popup"]')!;
        expect(popup.getAttribute('popover')).toBe('manual');
        expect(popup.getAttribute('role')).toBe('tooltip');
    });

    it('passes the variant axes through on the trigger (the carrier part)', () => {
        render(
            <Tooltip.Root>
                <Tooltip.Trigger color="primary" size="sm">Save</Tooltip.Trigger>
                <Tooltip.Popup>Save the document</Tooltip.Popup>
            </Tooltip.Root>,
            container,
        );
        const trigger = container.querySelector<HTMLElement>('[data-scope="tooltip"][data-part="trigger"]')!;
        expect(trigger.getAttribute('data-color')).toBe('primary');
        expect(trigger.getAttribute('data-size')).toBe('sm');
    });

    it('opens after the hover delay and closes on leave', () => {
        mount();
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        trigger.dispatchEvent(new Event('pointerenter'));
        expect(trigger.getAttribute('data-state')).toBe('closed');
        vi.advanceTimersByTime(500);
        expect(trigger.getAttribute('data-state')).toBe('open');
        expect(trigger.getAttribute('aria-describedby')).toBe(
            container.querySelector('[data-part="popup"]')!.id,
        );
        trigger.dispatchEvent(new Event('pointerleave'));
        // A short grace period (#167) before the close, so the pointer can
        // cross the offset gap onto the popup.
        vi.advanceTimersByTime(150);
        expect(trigger.getAttribute('data-state')).toBe('closed');
        expect(trigger.getAttribute('aria-describedby')).toBeNull();
    });

    it('the pointer can cross from the trigger onto the popup with default props (WCAG 1.4.13 hoverable, #167)', () => {
        render(
            <Tooltip.Root openDelay={0}>
                <Tooltip.Trigger>Save</Tooltip.Trigger>
                <Tooltip.Popup>Save the document</Tooltip.Popup>
            </Tooltip.Root>,
            container,
        );
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        const popup = container.querySelector<HTMLElement>('[data-part="popup"]')!;
        trigger.dispatchEvent(new Event('pointerenter'));
        vi.advanceTimersByTime(0);
        expect(popup.getAttribute('data-state')).toBe('open');
        // Leaving the trigger toward the popup: the pointer is in the gap.
        trigger.dispatchEvent(new Event('pointerleave'));
        expect(popup.getAttribute('data-state')).toBe('open');
        vi.advanceTimersByTime(50);
        popup.dispatchEvent(new Event('pointerenter'));
        vi.advanceTimersByTime(1000);
        expect(popup.getAttribute('data-state')).toBe('open');
        // Leaving the popup closes after the same grace period.
        popup.dispatchEvent(new Event('pointerleave'));
        expect(popup.getAttribute('data-state')).toBe('open');
        vi.advanceTimersByTime(150);
        expect(popup.getAttribute('data-state')).toBe('closed');
    });

    it('blur still closes immediately with default props', () => {
        mount();
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        trigger.dispatchEvent(new Event('focus'));
        expect(trigger.getAttribute('data-state')).toBe('open');
        trigger.dispatchEvent(new Event('blur'));
        expect(trigger.getAttribute('data-state')).toBe('closed');
    });

    it('closeDelay={0} opts back into an immediate pointer-leave close', () => {
        render(
            <Tooltip.Root openDelay={0} closeDelay={0}>
                <Tooltip.Trigger>Save</Tooltip.Trigger>
                <Tooltip.Popup>Save the document</Tooltip.Popup>
            </Tooltip.Root>,
            container,
        );
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        trigger.dispatchEvent(new Event('pointerenter'));
        vi.advanceTimersByTime(0);
        expect(trigger.getAttribute('data-state')).toBe('open');
        trigger.dispatchEvent(new Event('pointerleave'));
        expect(trigger.getAttribute('data-state')).toBe('closed');
    });

    it('opens immediately on focus and dismisses on Escape without losing state', async () => {
        mount();
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        trigger.dispatchEvent(new Event('focus'));
        expect(trigger.getAttribute('data-state')).toBe('open');
        // The dismiss layer attaches one tick after the open flip.
        await vi.advanceTimersByTimeAsync(0);
        trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        expect(trigger.getAttribute('data-state')).toBe('closed');
    });

    it('Escape dismisses no matter where focus is (WCAG 2.1 SC 1.4.13)', async () => {
        mount();
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        // Hover-open: focus never touched the trigger, so a trigger-local
        // keydown handler would never see the Escape.
        trigger.dispatchEvent(new Event('pointerenter'));
        vi.advanceTimersByTime(500);
        expect(trigger.getAttribute('data-state')).toBe('open');
        await vi.advanceTimersByTimeAsync(0);
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        expect(trigger.getAttribute('data-state')).toBe('closed');
    });

    it('Escape also cancels a pending hover-open', async () => {
        mount();
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        trigger.dispatchEvent(new Event('focus'));
        expect(trigger.getAttribute('data-state')).toBe('open');
        await vi.advanceTimersByTimeAsync(0);
        // Re-hovering schedules a (redundant) open; Escape must clear it so
        // the tooltip does not pop back up after the dismissal.
        trigger.dispatchEvent(new Event('pointerenter'));
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        expect(trigger.getAttribute('data-state')).toBe('closed');
        vi.advanceTimersByTime(1000);
        expect(trigger.getAttribute('data-state')).toBe('closed');
    });
});
