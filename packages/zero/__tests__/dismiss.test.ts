import { describe, it, expect, vi, afterEach } from 'vitest';
import { createDismissable } from '@sigx/zero';
import { signal } from 'sigx';

/**
 * A layer driven by a signal, so each test can close it again — the layer
 * stack is module-scoped and a leaked open layer would shadow the next test.
 */
function layer(surface: HTMLElement) {
    const state = signal({ open: true });
    const dismiss = vi.fn(() => { state.open = false; });
    createDismissable({
        getElement: () => surface,
        isOpen: () => state.open,
        dismiss,
        outsidePress: false,
    });
    return { dismiss, close: () => { state.open = false; } };
}

function escape(target: Element, init: KeyboardEventInit = {}): KeyboardEvent {
    const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(e);
    return e;
}

const cleanups: (() => void)[] = [];
afterEach(() => {
    while (cleanups.length) cleanups.pop()!();
    document.body.innerHTML = '';
});

function mount(html: string): HTMLElement {
    const host = document.createElement('div');
    host.innerHTML = html;
    document.body.appendChild(host);
    return host;
}

describe('createDismissable — Escape', () => {
    it('dismisses the layer on an Escape from inside its surface', () => {
        const host = mount('<div id="surface"><button id="b">x</button></div>');
        const l = layer(host.querySelector('#surface')!);
        cleanups.push(l.close);
        const e = escape(host.querySelector('#b')!);
        expect(l.dismiss).toHaveBeenCalledTimes(1);
        expect(e.defaultPrevented).toBe(true);
    });

    it('yields to an Escape an inner widget already handled (defaultPrevented)', () => {
        const host = mount('<div id="surface"><input id="i"></div>');
        const l = layer(host.querySelector('#surface')!);
        cleanups.push(l.close);
        const input = host.querySelector('#i')!;
        const consume = (e: Event) => e.preventDefault();
        input.addEventListener('keydown', consume);
        escape(input);
        input.removeEventListener('keydown', consume);
        expect(l.dismiss).not.toHaveBeenCalled();
        // The next, unhandled Escape still reaches the layer.
        escape(input);
        expect(l.dismiss).toHaveBeenCalledTimes(1);
    });

    it('yields to a nested [popover] surface inside the layer surface', () => {
        const host = mount(
            '<div id="surface"><button id="trigger">t</button>'
            + '<div id="menu" popover="auto"><button id="item">i</button></div></div>',
        );
        const l = layer(host.querySelector('#surface')!);
        cleanups.push(l.close);
        const e = escape(host.querySelector('#item')!);
        expect(l.dismiss).not.toHaveBeenCalled();
        // Left uncancelled, so the browser's own popover close still runs.
        expect(e.defaultPrevented).toBe(false);
        // Focus back on the trigger: the next Escape is the layer's.
        escape(host.querySelector('#trigger')!);
        expect(l.dismiss).toHaveBeenCalledTimes(1);
    });

    it('does not yield when the popover is the layer surface itself', () => {
        const host = mount('<div id="surface" popover="manual"><button id="b">x</button></div>');
        const l = layer(host.querySelector('#surface')!);
        cleanups.push(l.close);
        escape(host.querySelector('#b')!);
        expect(l.dismiss).toHaveBeenCalledTimes(1);
    });

    it('does not yield to a popover outside the layer surface', () => {
        const host = mount(
            '<div id="surface"><button id="b">x</button></div>'
            + '<div id="other" popover="auto"><button id="o">o</button></div>',
        );
        const l = layer(host.querySelector('#surface')!);
        cleanups.push(l.close);
        escape(host.querySelector('#o')!);
        expect(l.dismiss).toHaveBeenCalledTimes(1);
    });

    it('only the topmost layer dismisses', () => {
        const host = mount('<div id="outer"><div id="inner"><button id="b">x</button></div></div>');
        const outer = layer(host.querySelector('#outer')!);
        const inner = layer(host.querySelector('#inner')!);
        cleanups.push(outer.close, inner.close);
        escape(host.querySelector('#b')!);
        expect(inner.dismiss).toHaveBeenCalledTimes(1);
        expect(outer.dismiss).not.toHaveBeenCalled();
        escape(host.querySelector('#b')!);
        expect(outer.dismiss).toHaveBeenCalledTimes(1);
    });
});
