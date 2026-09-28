/**
 * Composition (#452, #494): a Tooltip lent to a Button.
 *
 * ```tsx
 * <Tooltip.Trigger asChild>
 *     {(p) => <Button.Root lend={p} onClick={archive} aria-label="Archive">…</Button.Root>}
 * </Tooltip.Trigger>
 * ```
 *
 * One element, the Button's: it keeps `button.root` and its paint, while
 * the tooltip trigger it absorbed contributes its hover/focus intent, the
 * `aria-describedby` and the anchor.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { component, signal } from 'sigx';
import { Button, Tooltip, buttonAnatomy, tooltipAnatomy } from '@sigx/zero';
import type { PositionAnchor, PositionStrategy } from '@sigx/zero';
import { expectAnatomy } from './helpers';

function pointer(type: string, pointerType = 'mouse'): Event {
    return new PointerEvent(type, { pointerType });
}

describe('composition: Tooltip lent to Button', () => {
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

    function mount(opts: {
        loading?: boolean;
        focusableWhenDisabled?: boolean;
        disabled?: boolean;
        onClick?: (e: MouseEvent) => void;
        strategy?: PositionStrategy;
    } = {}) {
        render(
            <Tooltip.Root openDelay={500} positionStrategy={opts.strategy}>
                <Tooltip.Trigger asChild>
                    {(p) => (
                        <Button.Root
                            lend={p}
                            loading={opts.loading}
                            disabled={opts.disabled}
                            focusableWhenDisabled={opts.focusableWhenDisabled}
                            onClick={opts.onClick}
                            aria-label="Archive"
                        >
                            A
                        </Button.Root>
                    )}
                </Tooltip.Trigger>
                <Tooltip.Popup>Archive the thread</Tooltip.Popup>
            </Tooltip.Root>,
            container,
        );
        return {
            el: container.querySelector<HTMLElement>('button')!,
            popup: container.querySelector<HTMLElement>('[data-scope="tooltip"][data-part="popup"]')!,
        };
    }

    it('renders one element with the Button\'s anatomy and none of the trigger\'s', () => {
        const { el } = mount();
        expect(container.querySelectorAll('button')).toHaveLength(1);
        expect(el.getAttribute('data-scope')).toBe('button');
        expect(el.getAttribute('data-part')).toBe('root');
        expect(el.hasAttribute('data-state')).toBe(false);
        expect(container.querySelector('[data-scope="tooltip"][data-part="trigger"]')).toBeNull();
        expectAnatomy(container, buttonAnatomy);
        expectAnatomy(container, tooltipAnatomy);
    });

    it('opens on hover only after openDelay, and joins aria-describedby while open', () => {
        const { el, popup } = mount();
        el.dispatchEvent(pointer('pointerenter'));
        vi.advanceTimersByTime(499);
        expect(popup.getAttribute('data-state')).toBe('closed');
        expect(el.hasAttribute('aria-describedby')).toBe(false);
        vi.advanceTimersByTime(1);
        expect(popup.getAttribute('data-state')).toBe('open');
        expect(el.getAttribute('aria-describedby')?.split(' ')).toContain(popup.id);
        // The trigger's state never lands on the Button.
        expect(el.hasAttribute('data-state')).toBe(false);
        expectAnatomy(container, buttonAnatomy);
        expectAnatomy(container, tooltipAnatomy);
    });

    it('a click fires the Button\'s onClick exactly once', () => {
        const onClick = vi.fn();
        const { el } = mount({ onClick });
        el.click();
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('anchors the popup to the Button element', async () => {
        vi.useRealTimers();
        const anchors: PositionAnchor[] = [];
        const strategy: PositionStrategy = { apply: (anchor) => { anchors.push(anchor); return () => {}; } };
        const { el } = mount({ strategy });
        el.focus();
        await new Promise((r) => setTimeout(r, 0));
        expect(anchors.at(-1)).toBe(el);
    });

    it('a loading Button still shows the tooltip on focus but ignores activation', () => {
        const onClick = vi.fn();
        const { el, popup } = mount({ loading: true, onClick });
        expect(el.getAttribute('aria-disabled')).toBe('true');
        // happy-dom answers `:focus-visible` for anything focused.
        el.focus();
        expect(popup.getAttribute('data-state')).toBe('open');
        el.click();
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(onClick).not.toHaveBeenCalled();
    });

    it('a focusableWhenDisabled Button shows the tooltip on hover and ignores clicks', () => {
        const onClick = vi.fn();
        const { el, popup } = mount({ disabled: true, focusableWhenDisabled: true, onClick });
        expect(el.hasAttribute('disabled')).toBe(false);
        el.dispatchEvent(pointer('pointerenter'));
        vi.advanceTimersByTime(500);
        expect(popup.getAttribute('data-state')).toBe('open');
        el.click();
        expect(onClick).not.toHaveBeenCalled();
    });

    describe('an inert host skips the lender\'s app handlers', () => {
        function mountLender(host: { loading?: boolean; disabled?: boolean; focusableWhenDisabled?: boolean }) {
            const lent = vi.fn();
            const lentKey = vi.fn();
            render(
                <Tooltip.Root>
                    <Tooltip.Trigger asChild onClick={lent} onKeydown={lentKey}>
                        {(p) => (
                            <Button.Root
                                lend={p}
                                loading={host.loading}
                                disabled={host.disabled}
                                focusableWhenDisabled={host.focusableWhenDisabled}
                                aria-label="Archive"
                            >
                                A
                            </Button.Root>
                        )}
                    </Tooltip.Trigger>
                    <Tooltip.Popup>Archive the thread</Tooltip.Popup>
                </Tooltip.Root>,
                container,
            );
            const el = container.querySelector<HTMLElement>('button')!;
            el.click();
            el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            return { lent, lentKey };
        }

        it('control: a plain Button hands the lender its click and keydown', () => {
            const { lent, lentKey } = mountLender({});
            expect(lent).toHaveBeenCalledTimes(1);
            expect(lentKey).toHaveBeenCalledTimes(1);
        });

        it('a loading Button', () => {
            const { lent, lentKey } = mountLender({ loading: true });
            expect(lent).not.toHaveBeenCalled();
            expect(lentKey).not.toHaveBeenCalled();
        });

        it('a disabled focusableWhenDisabled Button', () => {
            const { lent, lentKey } = mountLender({ disabled: true, focusableWhenDisabled: true });
            expect(lent).not.toHaveBeenCalled();
            expect(lentKey).not.toHaveBeenCalled();
        });
    });

    it('a disabled lender goes quiet: its handlers stop, the host acts', () => {
        const lent = vi.fn();
        const own = vi.fn();
        render(
            <Tooltip.Root>
                <Tooltip.Trigger asChild disabled onClick={lent}>
                    {(p) => <Button.Root lend={p} onClick={own} aria-label="Archive">A</Button.Root>}
                </Tooltip.Trigger>
                <Tooltip.Popup>Archive the thread</Tooltip.Popup>
            </Tooltip.Root>,
            container,
        );
        const el = container.querySelector<HTMLElement>('button')!;
        // The lender's disabled flag is its own anatomy: dropped, not the host's.
        expect(el.hasAttribute('data-disabled')).toBe(false);
        el.click();
        expect(lent).not.toHaveBeenCalled();
        expect(own).toHaveBeenCalledTimes(1);
    });

    it('chains: an outer tooltip lent through an inner one to the Button', () => {
        const model = signal({ outer: false, inner: false });
        const App = component(() => () => (
            <Tooltip.Root model={[model, 'outer']}>
                <Tooltip.Trigger asChild>
                    {(t) => (
                        <Tooltip.Root model={[model, 'inner']}>
                            <Tooltip.Trigger asChild lend={t}>
                                {(p) => <Button.Root lend={p} aria-label="Archive">A</Button.Root>}
                            </Tooltip.Trigger>
                            <Tooltip.Popup>Inner</Tooltip.Popup>
                        </Tooltip.Root>
                    )}
                </Tooltip.Trigger>
                <Tooltip.Popup>Outer</Tooltip.Popup>
            </Tooltip.Root>
        ));
        render(<App />, container);
        const el = container.querySelector<HTMLElement>('button')!;
        expect(el.getAttribute('data-scope')).toBe('button');
        el.focus();
        expect(model.outer).toBe(true);
        expect(model.inner).toBe(true);
        const idOf = (text: string) => [...container.querySelectorAll('[role="tooltip"]')].find((p) => p.textContent === text)!.id;
        // Lender tokens first: the outer tooltip's, then the inner one's.
        expect(el.getAttribute('aria-describedby')?.split(' ')).toEqual([idOf('Outer'), idOf('Inner')]);
    });
});
