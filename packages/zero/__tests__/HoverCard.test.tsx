import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { signal } from 'sigx';
import { HoverCard, hoverCardAnatomy } from '@sigx/zero';
import type { PositionOptions, PositionStrategy } from '@sigx/zero';
import { expectAnatomy } from './helpers';

/** A mouse pointer event (`pointerType` is what the touch guard reads). */
function pointer(type: string, init: PointerEventInit = {}): Event {
    return new PointerEvent(type, { pointerType: 'mouse', ...init });
}

function escape(target: EventTarget = document.body): void {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
}

describe('HoverCard', () => {
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

    function mount(props: Record<string, unknown> = {}) {
        const onOpenChange = vi.fn();
        render(
            <HoverCard.Root {...props} onOpenChange={onOpenChange}>
                <HoverCard.Trigger href="/users/ada">@ada</HoverCard.Trigger>
                <HoverCard.Popup>
                    Ada Lovelace <a href="/users/ada/followers">followers</a>
                </HoverCard.Popup>
            </HoverCard.Root>,
            container,
        );
        const trigger = container.querySelector<HTMLElement>('[data-scope="hover-card"][data-part="trigger"]')!;
        const popup = container.querySelector<HTMLElement>('[data-scope="hover-card"][data-part="popup"]')!;
        const link = popup.querySelector<HTMLElement>('a')!;
        return { trigger, popup, link, onOpenChange };
    }

    const state = (el: HTMLElement) => el.getAttribute('data-state');

    it('renders a valid anatomy: a link trigger and a manual popover with no tooltip semantics', () => {
        const { trigger, popup } = mount();
        expectAnatomy(container, hoverCardAnatomy);
        expect(trigger.tagName).toBe('A');
        expect(trigger.getAttribute('href')).toBe('/users/ada');
        expect(popup.getAttribute('popover')).toBe('manual');
        // Content may be interactive: not a tooltip, not a description, not a disclosure.
        expect(popup.hasAttribute('role')).toBe(false);
        expect(trigger.hasAttribute('aria-describedby')).toBe(false);
        expect(trigger.hasAttribute('aria-expanded')).toBe(false);
        expect(trigger.hasAttribute('aria-controls')).toBe(false);
    });

    it('defaultOpen seeds the open model', () => {
        const { popup, trigger } = mount({ defaultOpen: true });
        expect(state(popup)).toBe('open');
        expect(state(trigger)).toBe('open');
        expectAnatomy(container, hoverCardAnatomy);
    });

    it('opens after the default 700ms hover intent and closes 300ms after the pointer leaves', () => {
        const { trigger, popup, onOpenChange } = mount();
        trigger.dispatchEvent(pointer('pointerenter'));
        vi.advanceTimersByTime(699);
        expect(state(popup)).toBe('closed');
        vi.advanceTimersByTime(1);
        expect(state(popup)).toBe('open');
        expect(onOpenChange).toHaveBeenLastCalledWith(true);

        trigger.dispatchEvent(pointer('pointerleave'));
        vi.advanceTimersByTime(299);
        expect(state(popup)).toBe('open');
        vi.advanceTimersByTime(1);
        expect(state(popup)).toBe('closed');
        expect(onOpenChange).toHaveBeenLastCalledWith(false);
    });

    it('a pass shorter than openDelay never opens', () => {
        const { trigger, popup } = mount({ openDelay: 200 });
        trigger.dispatchEvent(pointer('pointerenter'));
        vi.advanceTimersByTime(150);
        trigger.dispatchEvent(pointer('pointerleave'));
        vi.advanceTimersByTime(1000);
        expect(state(popup)).toBe('closed');
    });

    it('the pointer can travel from the trigger into the card, which stays open until it leaves', () => {
        const { trigger, popup } = mount({ openDelay: 100, closeDelay: 200 });
        trigger.dispatchEvent(pointer('pointerenter'));
        vi.advanceTimersByTime(100);
        trigger.dispatchEvent(pointer('pointerleave'));
        vi.advanceTimersByTime(150);
        popup.dispatchEvent(pointer('pointerenter'));
        vi.advanceTimersByTime(1000);
        expect(state(popup)).toBe('open');
        popup.dispatchEvent(pointer('pointerleave'));
        vi.advanceTimersByTime(199);
        expect(state(popup)).toBe('open');
        vi.advanceTimersByTime(1);
        expect(state(popup)).toBe('closed');
    });

    it('a move inside the safe triangle toward the card pushes the close back', () => {
        const { trigger, popup } = mount({ openDelay: 0, closeDelay: 100 });
        // The card below the trigger: top edge at y=200, x 100..400.
        popup.getBoundingClientRect = () => ({
            left: 100, top: 200, right: 400, bottom: 320, width: 300, height: 120, x: 100, y: 200, toJSON: () => ({}),
        });
        trigger.dispatchEvent(pointer('pointerenter'));
        expect(state(popup)).toBe('open');
        trigger.dispatchEvent(pointer('pointerleave', { clientX: 150, clientY: 180 }));
        // Slow travel: each move inside the triangle restarts the delay.
        for (const y of [184, 188, 192]) {
            vi.advanceTimersByTime(80);
            document.dispatchEvent(pointer('pointermove', { clientX: 160, clientY: y }));
        }
        vi.advanceTimersByTime(80);
        expect(state(popup)).toBe('open');
        // A move away from the card does not push it: the delay runs out.
        document.dispatchEvent(pointer('pointermove', { clientX: 20, clientY: 150 }));
        vi.advanceTimersByTime(20);
        expect(state(popup)).toBe('closed');
    });

    it('ignores a touch pointerenter (touch has no hover)', () => {
        const { trigger, popup } = mount({ openDelay: 0 });
        trigger.dispatchEvent(pointer('pointerenter', { pointerType: 'touch' }));
        vi.advanceTimersByTime(1000);
        expect(state(popup)).toBe('closed');
    });

    it('a keyboard focus opens at once; a pointer-driven focus does not', () => {
        const { trigger, popup } = mount();
        // happy-dom answers `:focus-visible` for anything focused, so the
        // browser heuristic is modelled (see Tooltip's test).
        let pointerDriven = true;
        const realMatches = trigger.matches.bind(trigger);
        trigger.matches = ((selector: string): boolean =>
            (selector === ':focus-visible'
                ? !pointerDriven && realMatches(':focus')
                : realMatches(selector))) as HTMLElement['matches'];

        trigger.focus();
        vi.advanceTimersByTime(1000);
        expect(state(popup)).toBe('closed');
        expect(trigger.hasAttribute('data-focus-visible')).toBe(false);
        trigger.blur();

        pointerDriven = false;
        trigger.focus();
        expect(state(popup)).toBe('open');
        expect(trigger.hasAttribute('data-focus-visible')).toBe(true);
        trigger.blur();
        expect(state(popup)).toBe('closed');
        expect(trigger.hasAttribute('data-focus-visible')).toBe(false);
    });

    it('openOnFocus={false} leaves a keyboard focus alone', () => {
        const { trigger, popup } = mount({ openOnFocus: false });
        trigger.focus();
        vi.advanceTimersByTime(1000);
        expect(state(popup)).toBe('closed');
    });

    it('focus moving into the card keeps it open; leaving both closes it', () => {
        const outside = document.createElement('button');
        document.body.appendChild(outside);
        const { trigger, popup, link } = mount();
        trigger.focus();
        expect(state(popup)).toBe('open');
        link.focus();
        vi.advanceTimersByTime(1000);
        expect(state(popup)).toBe('open');
        // Back to the trigger and into the card again: still open.
        trigger.focus();
        link.focus();
        expect(state(popup)).toBe('open');
        outside.focus();
        expect(state(popup)).toBe('closed');
        outside.remove();
    });

    it('focus inside the card holds it open after the pointer leaves', () => {
        const { trigger, popup, link } = mount({ openDelay: 0, closeDelay: 50 });
        trigger.dispatchEvent(pointer('pointerenter'));
        trigger.dispatchEvent(pointer('pointerleave'));
        popup.dispatchEvent(pointer('pointerenter'));
        link.focus();
        popup.dispatchEvent(pointer('pointerleave'));
        vi.advanceTimersByTime(1000);
        expect(state(popup)).toBe('open');
    });

    it('a blur while the pointer rests on the card does not close it', () => {
        const { trigger, popup } = mount({ openDelay: 0 });
        trigger.focus();
        popup.dispatchEvent(pointer('pointerenter'));
        trigger.blur();
        vi.advanceTimersByTime(1000);
        expect(state(popup)).toBe('open');
    });

    it('Escape closes a hover-opened card wherever focus is, and it stays closed under the resting pointer', () => {
        const { trigger, popup } = mount({ openDelay: 0 });
        trigger.dispatchEvent(pointer('pointerenter'));
        expect(state(popup)).toBe('open');
        escape();
        expect(state(popup)).toBe('closed');
        vi.advanceTimersByTime(1000);
        expect(state(popup)).toBe('closed');
    });

    it('Escape keeps focus on the trigger, and hands focus back from inside the card without reopening', () => {
        const { trigger, popup, link } = mount();
        trigger.focus();
        expect(state(popup)).toBe('open');
        escape(trigger);
        expect(state(popup)).toBe('closed');
        expect(document.activeElement).toBe(trigger);

        // Reopen by keyboard, move into the card, Escape from there.
        trigger.blur();
        trigger.focus();
        link.focus();
        expect(state(popup)).toBe('open');
        escape(link);
        expect(state(popup)).toBe('closed');
        expect(document.activeElement).toBe(trigger);
        vi.advanceTimersByTime(1000);
        expect(state(popup)).toBe('closed');
    });

    it('an outside press does not close it', () => {
        const { popup } = mount({ defaultOpen: true });
        document.body.dispatchEvent(pointer('pointerdown', { bubbles: true }));
        expect(state(popup)).toBe('open');
    });

    it('the model drives it both ways', () => {
        const s = signal({ open: false });
        render(
            <HoverCard.Root model={[s, 'open']} openDelay={0}>
                <HoverCard.Trigger href="#">x</HoverCard.Trigger>
                <HoverCard.Popup>card</HoverCard.Popup>
            </HoverCard.Root>,
            container,
        );
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        const popup = container.querySelector<HTMLElement>('[data-part="popup"]')!;
        s.open = true;
        expect(state(popup)).toBe('open');
        trigger.dispatchEvent(pointer('pointerenter'));
        trigger.dispatchEvent(pointer('pointerleave'));
        vi.advanceTimersByTime(300);
        expect(s.open).toBe(false);
    });

    it('passes the variant axes through on the trigger (the carrier part)', () => {
        render(
            <HoverCard.Root>
                <HoverCard.Trigger href="#" color="primary" size="sm">x</HoverCard.Trigger>
                <HoverCard.Popup>card</HoverCard.Popup>
            </HoverCard.Root>,
            container,
        );
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        expect(trigger.getAttribute('data-color')).toBe('primary');
        expect(trigger.getAttribute('data-size')).toBe('sm');
    });

    it('asChild hands the bag, href included, to the app element', () => {
        render(
            <HoverCard.Root>
                <HoverCard.Trigger href="/users/ada" asChild>
                    {(p: Record<string, unknown>) => <a {...p} class="mention">@ada</a>}
                </HoverCard.Trigger>
                <HoverCard.Popup>card</HoverCard.Popup>
            </HoverCard.Root>,
            container,
        );
        const trigger = container.querySelector<HTMLElement>('a.mention')!;
        expect(trigger.getAttribute('data-scope')).toBe('hover-card');
        expect(trigger.getAttribute('data-part')).toBe('trigger');
        expect(trigger.getAttribute('href')).toBe('/users/ada');
        expectAnatomy(container, hoverCardAnatomy);
    });

    it('renders an aria-hidden arrow and hands it to the strategy with the placement defaults', async () => {
        vi.useRealTimers();
        const seen: PositionOptions[] = [];
        const spy: PositionStrategy = { apply: (_a, _f, opts) => { seen.push(opts); return () => {}; } };
        const s = signal({ open: false });
        render(
            <HoverCard.Root model={[s, 'open']} positionStrategy={spy} arrowPadding={4}>
                <HoverCard.Trigger href="#">x</HoverCard.Trigger>
                <HoverCard.Popup><HoverCard.Arrow />card</HoverCard.Popup>
            </HoverCard.Root>,
            container,
        );
        s.open = true;
        await new Promise((r) => setTimeout(r, 0));
        expectAnatomy(container, hoverCardAnatomy);
        const arrow = container.querySelector<HTMLElement>('[data-scope="hover-card"][data-part="arrow"]')!;
        expect(arrow.getAttribute('aria-hidden')).toBe('true');
        const opts = seen.at(-1)!;
        expect(opts.placement).toBe('bottom');
        expect(opts.offset).toBe(8);
        expect(opts.arrowPadding).toBe(4);
        expect(opts.getArrow?.()).toBe(arrow);
    });
});
