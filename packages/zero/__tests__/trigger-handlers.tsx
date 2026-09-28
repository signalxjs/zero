/**
 * The shared half of the trigger-handler tests (#486): every part that takes
 * `WithInteractionHandlers` must deliver `onKeydown`/`onFocus`/`onBlur` (and
 * `onClick`) to its element, drop them while disabled — an asChild `<span>`
 * included, which no native `disabled` protects — and put them in the
 * asChild bag. What differs per part (`onClick` after the open, a closer's
 * veto) is tested in the component's own file.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@sigx/runtime-dom';
import type { JSXElement } from 'sigx';
import type { PartProps } from '@sigx/zero';

type Child = string | ((bag: PartProps) => JSXElement);

/**
 * Renders the part with `props` spread on it and `child` as its children
 * (a function child is the asChild slot).
 */
export type HandlerPartFactory = (props: Record<string, unknown>, child: Child) => unknown;

function handlers() {
    return {
        onClick: vi.fn(),
        onKeydown: vi.fn(),
        onFocus: vi.fn(),
        onBlur: vi.fn(),
    };
}

function fire(el: HTMLElement): void {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true, cancelable: true }));
    el.dispatchEvent(new FocusEvent('focus'));
    el.dispatchEvent(new FocusEvent('blur'));
}

export function describeTriggerHandlers(
    name: string,
    selector: string,
    part: HandlerPartFactory,
    options: { disableable?: boolean } = {},
): void {
    describe(`${name} interaction handlers (#486)`, () => {
        let container: HTMLElement;
        beforeEach(() => {
            container = document.createElement('div');
            document.body.appendChild(container);
        });
        afterEach(() => container.remove());

        const el = (): HTMLElement => container.querySelector<HTMLElement>(selector)!;

        it('onClick, onKeydown, onFocus and onBlur reach the element, once each', () => {
            const h = handlers();
            render(part({ ...h }, 'Label') as never, container);
            fire(el());
            expect(h.onClick).toHaveBeenCalledTimes(1);
            expect(h.onClick.mock.calls[0]![0]).toBeInstanceOf(MouseEvent);
            expect(h.onKeydown).toHaveBeenCalledTimes(1);
            expect(h.onKeydown.mock.calls[0]![0].key).toBe('x');
            expect(h.onFocus).toHaveBeenCalledTimes(1);
            expect(h.onBlur).toHaveBeenCalledTimes(1);
        });

        it('the asChild bag carries the handlers', () => {
            const h = handlers();
            let bag: PartProps | undefined;
            render(part({ ...h, asChild: true }, (b) => {
                bag = b;
                return <span {...b}>Label</span>;
            }) as never, container);
            expect(bag).toBeDefined();
            bag!.onClick!(new MouseEvent('click', { cancelable: true }));
            bag!.onKeydown!(new KeyboardEvent('keydown', { key: 'x' }));
            bag!.onFocus!(new FocusEvent('focus'));
            bag!.onBlur!(new FocusEvent('blur'));
            expect(h.onClick).toHaveBeenCalledTimes(1);
            expect(h.onKeydown).toHaveBeenCalledTimes(1);
            expect(h.onFocus).toHaveBeenCalledTimes(1);
            expect(h.onBlur).toHaveBeenCalledTimes(1);
            // And the spread element really dispatches to them.
            fire(el());
            expect(h.onClick).toHaveBeenCalledTimes(2);
            expect(h.onKeydown).toHaveBeenCalledTimes(2);
        });

        if (options.disableable === false) return;

        it('no handler runs while disabled', () => {
            const h = handlers();
            render(part({ ...h, disabled: true }, 'Label') as never, container);
            fire(el());
            for (const fn of Object.values(h)) expect(fn).not.toHaveBeenCalled();
        });

        it('no handler runs while disabled, on an asChild <span> either', () => {
            const h = handlers();
            render(part({ ...h, disabled: true, asChild: true }, (b) => <span {...b}>Label</span>) as never, container);
            expect(el().tagName).toBe('SPAN');
            fire(el());
            for (const fn of Object.values(h)) expect(fn).not.toHaveBeenCalled();
        });
    });
}
