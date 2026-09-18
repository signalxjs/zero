/**
 * Swap — two faces over one boolean (#340).
 *
 * The decisions pinned here:
 * - The model is a BOOLEAN, nothing more. daisy's swap-rotate/swap-flip are
 *   styling — `data-state` transitions a recipe owns — and its
 *   `indeterminate` face is a third state a boolean cannot honestly carry,
 *   so it is out.
 * - BOTH faces stay rendered: the whole point of the component is a CSS
 *   transition between them, and the `hidden` attribute computes
 *   `display: none` (ds-smoke's first invariant), which would kill the
 *   cross-fade. The inactive face is `aria-hidden` instead — visually
 *   present for the animation, absent for AT.
 * - Interactive is OPT-IN (`interactive`): a swap is a DISPLAY by default
 *   (a theme icon that follows external state), and a display must not
 *   claim button semantics. With `interactive` it renders a real
 *   `<button aria-pressed>` — the platform supplies Enter/Space — which is
 *   Toggle's exact contract, restated here because a swap's faces are its
 *   content, not a restyled Toggle.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { Swap, swapAnatomy } from '@sigx/zero';
import { expectAnatomy } from './helpers';

const selector = (scope: string, name: string) => `[data-scope="${scope}"][data-part="${name}"]`;
const part = (c: HTMLElement, name: string) =>
    c.querySelector<HTMLElement>(selector('swap', name))!;

describe('Swap', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('renders a valid anatomy: a display span with two faces, state off', () => {
        render(
            <Swap.Root>
                <Swap.On>🌙</Swap.On>
                <Swap.Off>☀️</Swap.Off>
            </Swap.Root>,
            container,
        );
        expectAnatomy(container, swapAnatomy);
        const root = part(container, 'root');
        // A display, not a control: no role, no tab stop, no aria-pressed.
        expect(root.tagName).toBe('SPAN');
        expect(root.hasAttribute('role')).toBe(false);
        expect(root.hasAttribute('tabindex')).toBe(false);
        expect(root.hasAttribute('aria-pressed')).toBe(false);
        expect(root.getAttribute('data-state')).toBe('off');
    });

    it('both faces stay rendered; the inactive one is aria-hidden', () => {
        render(
            <Swap.Root defaultActive>
                <Swap.On>🌙</Swap.On>
                <Swap.Off>☀️</Swap.Off>
            </Swap.Root>,
            container,
        );
        const on = part(container, 'on');
        const off = part(container, 'off');
        // Present in the DOM — the cross-fade needs both painted.
        expect(on.textContent).toBe('🌙');
        expect(off.textContent).toBe('☀️');
        expect(on.getAttribute('data-state')).toBe('on');
        expect(off.getAttribute('data-state')).toBe('on');
        // …but only one face exists for AT.
        expect(on.hasAttribute('aria-hidden')).toBe(false);
        expect(off.getAttribute('aria-hidden')).toBe('true');
        // No `hidden` anywhere: display:none would kill the transition.
        expect(on.hasAttribute('hidden')).toBe(false);
        expect(off.hasAttribute('hidden')).toBe(false);
    });

    it('interactive renders a real toggle button', () => {
        const changes: boolean[] = [];
        render(
            <Swap.Root interactive label="Toggle theme" onActiveChange={(v: boolean) => changes.push(v)}>
                <Swap.On>🌙</Swap.On>
                <Swap.Off>☀️</Swap.Off>
            </Swap.Root>,
            container,
        );
        const root = part(container, 'root') as unknown as HTMLButtonElement;
        expect(root.tagName).toBe('BUTTON');
        expect(root.getAttribute('type')).toBe('button');
        expect(root.getAttribute('aria-pressed')).toBe('false');
        expect(root.getAttribute('aria-label')).toBe('Toggle theme');

        root.click();
        expect(changes).toEqual([true]);
        expect(root.getAttribute('aria-pressed')).toBe('true');
        expect(root.getAttribute('data-state')).toBe('on');
        expect(part(container, 'on').hasAttribute('aria-hidden')).toBe(false);
        expect(part(container, 'off').getAttribute('aria-hidden')).toBe('true');

        root.click();
        expect(changes).toEqual([true, false]);
        expect(root.getAttribute('data-state')).toBe('off');
    });

    it('a non-interactive swap ignores clicks — display only', () => {
        const changes: boolean[] = [];
        render(
            <Swap.Root onActiveChange={(v: boolean) => changes.push(v)}>
                <Swap.On>🌙</Swap.On>
                <Swap.Off>☀️</Swap.Off>
            </Swap.Root>,
            container,
        );
        part(container, 'root').click();
        expect(changes).toEqual([]);
        expect(part(container, 'root').getAttribute('data-state')).toBe('off');
    });

    it('interactive + disabled is inert and conveyed', () => {
        const changes: boolean[] = [];
        render(
            <Swap.Root interactive disabled label="Toggle" onActiveChange={(v: boolean) => changes.push(v)}>
                <Swap.On>on</Swap.On>
                <Swap.Off>off</Swap.Off>
            </Swap.Root>,
            container,
        );
        const root = part(container, 'root') as unknown as HTMLButtonElement;
        expect(root.disabled).toBe(true);
        expect(root.getAttribute('data-disabled')).toBe('');
        root.click();
        expect(changes).toEqual([]);
    });

    it('a disabled display swap still stamps the styling fact', () => {
        render(
            <Swap.Root disabled>
                <Swap.On>on</Swap.On>
                <Swap.Off>off</Swap.Off>
            </Swap.Root>,
            container,
        );
        // No semantics to disable — but the recipe's fade must still key on
        // something, and the flag is the contract's word for it.
        expect(part(container, 'root').getAttribute('data-disabled')).toBe('');
    });

    it('the model is boolean only — no indeterminate face in the anatomy', () => {
        expect(swapAnatomy.partNames()).toEqual(['root', 'on', 'off']);
        expect(swapAnatomy.parts.root.states).toEqual(['on', 'off']);
        expect(swapAnatomy.parts.on.states).toEqual(['on', 'off']);
        expect(swapAnatomy.parts.off.states).toEqual(['on', 'off']);
    });
});
