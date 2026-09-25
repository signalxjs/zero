import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { Tooltip, tooltipAnatomy } from '@sigx/zero';
import { expectAnatomy } from './helpers';

/** A mouse pointer event (`pointerType` is what the touch guard reads). */
function pointer(type: string, pointerType = 'mouse'): Event {
    return new PointerEvent(type, { pointerType });
}

describe('Tooltip', () => {
    let container: HTMLElement;
    beforeEach(() => {
        vi.useFakeTimers();
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(() => {
        vi.useRealTimers();
        container.remove();
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
        trigger.dispatchEvent(pointer('pointerenter'));
        expect(trigger.getAttribute('data-state')).toBe('closed');
        vi.advanceTimersByTime(500);
        expect(trigger.getAttribute('data-state')).toBe('open');
        expect(trigger.getAttribute('aria-describedby')).toBe(
            container.querySelector('[data-part="popup"]')!.id,
        );
        trigger.dispatchEvent(pointer('pointerleave'));
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
        trigger.dispatchEvent(pointer('pointerenter'));
        vi.advanceTimersByTime(0);
        expect(popup.getAttribute('data-state')).toBe('open');
        // Leaving the trigger toward the popup: the pointer is in the gap.
        trigger.dispatchEvent(pointer('pointerleave'));
        expect(popup.getAttribute('data-state')).toBe('open');
        vi.advanceTimersByTime(50);
        popup.dispatchEvent(pointer('pointerenter'));
        vi.advanceTimersByTime(1000);
        expect(popup.getAttribute('data-state')).toBe('open');
        // Leaving the popup closes after the same grace period.
        popup.dispatchEvent(pointer('pointerleave'));
        expect(popup.getAttribute('data-state')).toBe('open');
        vi.advanceTimersByTime(150);
        expect(popup.getAttribute('data-state')).toBe('closed');
    });

    it('blur still closes immediately with default props', () => {
        mount();
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        trigger.focus();
        expect(trigger.getAttribute('data-state')).toBe('open');
        trigger.blur();
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
        trigger.dispatchEvent(pointer('pointerenter'));
        vi.advanceTimersByTime(0);
        expect(trigger.getAttribute('data-state')).toBe('open');
        trigger.dispatchEvent(pointer('pointerleave'));
        expect(trigger.getAttribute('data-state')).toBe('closed');
    });

    it('opens immediately on focus and dismisses on Escape without losing state', async () => {
        mount();
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        trigger.focus();
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
        trigger.dispatchEvent(pointer('pointerenter'));
        vi.advanceTimersByTime(500);
        expect(trigger.getAttribute('data-state')).toBe('open');
        await vi.advanceTimersByTimeAsync(0);
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        expect(trigger.getAttribute('data-state')).toBe('closed');
    });

    it('Escape also cancels a pending hover-open', async () => {
        mount();
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        trigger.focus();
        expect(trigger.getAttribute('data-state')).toBe('open');
        await vi.advanceTimersByTimeAsync(0);
        // Re-hovering schedules a (redundant) open; Escape must clear it so
        // the tooltip does not pop back up after the dismissal.
        trigger.dispatchEvent(pointer('pointerenter'));
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        expect(trigger.getAttribute('data-state')).toBe('closed');
        vi.advanceTimersByTime(1000);
        expect(trigger.getAttribute('data-state')).toBe('closed');
    });
    it('a pointer-driven focus (no :focus-visible) does not open; a keyboard focus does', () => {
        mount();
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        // happy-dom answers `:focus-visible` for anything focused, so the
        // browser heuristic is modelled (Menu's context-trigger test does the
        // same): a press before the focus suppresses it.
        let pointerDriven = true;
        const realMatches = trigger.matches.bind(trigger);
        trigger.matches = ((selector: string): boolean =>
            (selector === ':focus-visible'
                ? !pointerDriven && realMatches(':focus')
                : realMatches(selector))) as HTMLElement['matches'];

        trigger.focus();
        expect(trigger.getAttribute('data-state')).toBe('closed');
        vi.advanceTimersByTime(1000);
        expect(trigger.getAttribute('data-state')).toBe('closed');
        trigger.blur();

        pointerDriven = false;
        trigger.focus();
        expect(trigger.getAttribute('data-state')).toBe('open');
    });

    it('a press closes it at once, and a re-hover waits for the pointer to leave first', () => {
        mount();
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        trigger.dispatchEvent(pointer('pointerenter'));
        vi.advanceTimersByTime(500);
        expect(trigger.getAttribute('data-state')).toBe('open');

        trigger.dispatchEvent(pointer('pointerdown'));
        expect(trigger.getAttribute('data-state')).toBe('closed');
        // Still over the trigger: a stray pointerenter (re-entering from a
        // child, say) must not bring it back.
        trigger.dispatchEvent(pointer('pointerenter'));
        vi.advanceTimersByTime(1000);
        expect(trigger.getAttribute('data-state')).toBe('closed');

        trigger.dispatchEvent(pointer('pointerleave'));
        trigger.dispatchEvent(pointer('pointerenter'));
        vi.advanceTimersByTime(500);
        expect(trigger.getAttribute('data-state')).toBe('open');
    });

    it('a press also cancels a pending hover-open', () => {
        mount();
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        trigger.dispatchEvent(pointer('pointerenter'));
        vi.advanceTimersByTime(200);
        trigger.dispatchEvent(pointer('pointerdown'));
        vi.advanceTimersByTime(1000);
        expect(trigger.getAttribute('data-state')).toBe('closed');
    });

    it('ignores a touch pointerenter (touch has no hover)', () => {
        mount();
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        trigger.dispatchEvent(pointer('pointerenter', 'touch'));
        vi.advanceTimersByTime(1000);
        expect(trigger.getAttribute('data-state')).toBe('closed');
        // A pen hovers like a mouse.
        trigger.dispatchEvent(pointer('pointerenter', 'pen'));
        vi.advanceTimersByTime(500);
        expect(trigger.getAttribute('data-state')).toBe('open');
    });

    describe('Tooltip.Group', () => {
        function mountGroup(groupProps: Record<string, number> = {}, bProps: Record<string, number> = {}) {
            render(
                <Tooltip.Group openDelay={400} {...groupProps}>
                    <Tooltip.Root>
                        <Tooltip.Trigger>Bold</Tooltip.Trigger>
                        <Tooltip.Popup>Bold text</Tooltip.Popup>
                    </Tooltip.Root>
                    <Tooltip.Root {...bProps}>
                        <Tooltip.Trigger>Italic</Tooltip.Trigger>
                        <Tooltip.Popup>Italic text</Tooltip.Popup>
                    </Tooltip.Root>
                </Tooltip.Group>,
                container,
            );
            const [a, b] = container.querySelectorAll<HTMLElement>('[data-part="trigger"]');
            return { a: a!, b: b! };
        }

        it('renders no element of its own', () => {
            mountGroup();
            expect(container.firstElementChild!.getAttribute('data-part')).toBe('trigger');
            expectAnatomy(container, tooltipAnatomy);
        });

        it("a member's openDelay defaults to the group's", () => {
            const { a } = mountGroup();
            a.dispatchEvent(pointer('pointerenter'));
            vi.advanceTimersByTime(399);
            expect(a.getAttribute('data-state')).toBe('closed');
            vi.advanceTimersByTime(1);
            expect(a.getAttribute('data-state')).toBe('open');
        });

        it("a Root's own openDelay overrides the group's", () => {
            const { b } = mountGroup({}, { openDelay: 100 });
            b.dispatchEvent(pointer('pointerenter'));
            vi.advanceTimersByTime(100);
            expect(b.getAttribute('data-state')).toBe('open');
        });

        it('moving to a sibling while one is open opens it at once and closes the first', () => {
            const { a, b } = mountGroup();
            a.dispatchEvent(pointer('pointerenter'));
            vi.advanceTimersByTime(400);
            expect(a.getAttribute('data-state')).toBe('open');
            a.dispatchEvent(pointer('pointerleave'));
            b.dispatchEvent(pointer('pointerenter'));
            // No delay, and the sibling is gone without waiting out its grace.
            expect(b.getAttribute('data-state')).toBe('open');
            expect(a.getAttribute('data-state')).toBe('closed');
        });

        it('a hover within skipDelay of a close opens instantly; after it, the delay is back', () => {
            const { a, b } = mountGroup({ skipDelay: 300, closeDelay: 0 });
            a.dispatchEvent(pointer('pointerenter'));
            vi.advanceTimersByTime(400);
            a.dispatchEvent(pointer('pointerleave'));
            expect(a.getAttribute('data-state')).toBe('closed');
            vi.advanceTimersByTime(200);
            b.dispatchEvent(pointer('pointerenter'));
            expect(b.getAttribute('data-state')).toBe('open');

            b.dispatchEvent(pointer('pointerleave'));
            vi.advanceTimersByTime(300);
            a.dispatchEvent(pointer('pointerenter'));
            expect(a.getAttribute('data-state')).toBe('closed');
            vi.advanceTimersByTime(400);
            expect(a.getAttribute('data-state')).toBe('open');
        });

        it('a keyboard focus on a sibling closes the open member', () => {
            const { a, b } = mountGroup();
            a.focus();
            expect(a.getAttribute('data-state')).toBe('open');
            b.focus();
            expect(b.getAttribute('data-state')).toBe('open');
            expect(a.getAttribute('data-state')).toBe('closed');
        });

        it('two groups keep separate state', () => {
            render(
                <>
                    <Tooltip.Group openDelay={400}>
                        <Tooltip.Root>
                            <Tooltip.Trigger>One</Tooltip.Trigger>
                            <Tooltip.Popup>First</Tooltip.Popup>
                        </Tooltip.Root>
                    </Tooltip.Group>
                    <Tooltip.Group openDelay={400}>
                        <Tooltip.Root>
                            <Tooltip.Trigger>Two</Tooltip.Trigger>
                            <Tooltip.Popup>Second</Tooltip.Popup>
                        </Tooltip.Root>
                    </Tooltip.Group>
                </>,
                container,
            );
            const [a, b] = container.querySelectorAll<HTMLElement>('[data-part="trigger"]');
            a!.dispatchEvent(pointer('pointerenter'));
            vi.advanceTimersByTime(400);
            b!.dispatchEvent(pointer('pointerenter'));
            expect(b!.getAttribute('data-state')).toBe('closed');
            expect(a!.getAttribute('data-state')).toBe('open');
        });
    });
});
