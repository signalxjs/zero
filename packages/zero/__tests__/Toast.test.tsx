import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { Toast, createToaster, toastAnatomy } from '@sigx/zero';
import type { ToastData } from '@sigx/zero';
import { expectAnatomy } from './helpers';

/** Enter flips one double-rAF past mount; settle both frames plus a tick. */
const settle = () =>
    new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 0))));

describe('toaster (store)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('creates, auto-dismisses after its duration, removes on demand', () => {
        const t = createToaster({ duration: 1000 });
        const id = t.create({ title: 'Saved' });
        expect(t.toasts()).toHaveLength(1);
        expect(t.count()).toBe(1);
        t.toasts()[0]!.open = true; // the component's enter flip, simulated
        vi.advanceTimersByTime(1100);
        // dismiss only begins the exit — the component removes after it plays.
        expect(t.toasts()[0]!.open).toBe(false);
        expect(t.toasts()).toHaveLength(1);
        t.remove(id);
        expect(t.toasts()).toHaveLength(0);
        expect(t.count()).toBe(0);
    });

    it('sticky toasts (duration Infinity) never auto-dismiss', () => {
        const t = createToaster();
        t.create({ title: 'Stay', duration: Infinity });
        vi.advanceTimersByTime(60_000);
        // Dismissing an unopened toast hard-removes it, so surviving a minute
        // proves no timer was ever armed.
        expect(t.toasts()).toHaveLength(1);
    });

    it('caps mounted toasts at max and promotes the queue FIFO', () => {
        const t = createToaster({ max: 2, duration: Infinity });
        const a = t.create({ title: 'a' });
        t.create({ title: 'b' });
        t.create({ title: 'c' });
        expect(t.toasts().map((x) => x.title)).toEqual(['a', 'b']);
        expect(t.count()).toBe(3);
        t.remove(a);
        expect(t.toasts().map((x) => x.title)).toEqual(['b', 'c']);
        expect(t.count()).toBe(2);
    });

    it('pause banks the remaining time; resume re-arms with it', () => {
        const t = createToaster({ duration: 1000 });
        t.create({ title: 'x' });
        t.toasts()[0]!.open = true; // the component's enter flip, simulated
        vi.advanceTimersByTime(400);
        t.pause();
        vi.advanceTimersByTime(60_000);
        expect(t.toasts()[0]!.open).toBe(true);
        t.resume();
        vi.advanceTimersByTime(599);
        expect(t.toasts()[0]!.open).toBe(true);
        vi.advanceTimersByTime(2);
        expect(t.toasts()[0]!.open).toBe(false);
    });

    it('creating with an existing id updates that toast', () => {
        const t = createToaster({ duration: Infinity });
        const id = t.create({ id: 'job', title: 'Uploading…' });
        t.create({ id: 'job', title: 'Done', color: 'success' });
        expect(t.toasts()).toHaveLength(1);
        expect(t.toasts()[0]!.title).toBe('Done');
        expect(t.toasts()[0]!.color).toBe('success');
        expect(id).toBe('job');
    });

    it('max is clamped to at least 1, so the queue always makes progress', () => {
        const t = createToaster({ max: 0, duration: Infinity });
        t.create({ title: 'first' });
        expect(t.toasts()).toHaveLength(1);
    });

    it('dismiss with no id clears the queue and exits everything', () => {
        const t = createToaster({ max: 1, duration: Infinity });
        t.create({ title: 'a' });
        t.create({ title: 'b' });
        expect(t.count()).toBe(2);
        t.dismiss();
        // The queued toast is dropped outright; the unopened mounted one too.
        expect(t.count()).toBe(0);
    });
});

describe('Toast (component)', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    function mount(t = createToaster({ duration: Infinity })) {
        render(<Toast.Viewport toaster={t} placement="top-end" />, container);
        return t;
    }

    it('renders a valid anatomy with the stock composition', async () => {
        const t = mount();
        t.create({
            title: 'Saved',
            description: 'Your changes are safe.',
            color: 'success',
            action: { label: 'Undo' },
        });
        await settle();
        expectAnatomy(container, toastAnatomy);
        const root = container.querySelector<HTMLElement>('[data-part="root"]')!;
        expect(root.tagName).toBe('LI');
        expect(root.getAttribute('data-color')).toBe('success');
        expect(root.getAttribute('data-placement')).toBe('top-end');
        expect(root.getAttribute('role')).toBe('status');
        expect(container.querySelector('[data-part="title"]')!.textContent).toBe('Saved');
        expect(container.querySelector('[data-part="description"]')!.textContent).toBe('Your changes are safe.');
        expect(container.querySelector('[data-part="action"]')!.textContent).toBe('Undo');
        expect(container.querySelector('[data-part="close"]')).not.toBeNull();
        const viewport = container.querySelector<HTMLElement>('[data-part="viewport"]')!;
        expect(viewport.tagName).toBe('OL');
        expect(viewport.getAttribute('popover')).toBe('manual');
        expect(viewport.getAttribute('role')).toBe('region');
    });

    it('routes colour through variantAttrs — an explicit root prop wins over the queue toast colour', async () => {
        const t = createToaster({ duration: Infinity });
        render(
            <Toast.Viewport toaster={t}>
                {(td: ToastData) => (
                    <Toast.Root toast={td} key={td.id} color="warning" size="lg">
                        <Toast.Title>{td.title}</Toast.Title>
                    </Toast.Root>
                )}
            </Toast.Viewport>,
            container,
        );
        t.create({ title: 'Careful', color: 'success' });
        await settle();
        const root = container.querySelector<HTMLElement>('[data-part="root"]')!;
        expect(root.getAttribute('data-color')).toBe('warning');
        expect(root.getAttribute('data-size')).toBe('lg');
        expectAnatomy(container, toastAnatomy);
    });

    it('enters closed and flips to open a frame later', async () => {
        const t = mount();
        t.create({ title: 'Hi' });
        const root = () => container.querySelector<HTMLElement>('[data-part="root"]')!;
        expect(root().getAttribute('data-state')).toBe('closed');
        await settle();
        expect(root().getAttribute('data-state')).toBe('open');
        expect(root().style.getPropertyValue('--toast-index')).toBe('0');
        expect(root().style.getPropertyValue('--toast-count')).toBe('1');
    });

    it('with no transition, dismissal removes immediately', async () => {
        const t = mount();
        const id = t.create({ title: 'Bye' });
        await settle();
        t.dismiss(id);
        await settle();
        expect(container.querySelector('[data-part="root"]')).toBeNull();
        expect(t.toasts()).toHaveLength(0);
    });

    it('with a transition, the node survives until transitionend (or the fallback timeout)', async () => {
        const style = {
            transitionDuration: '0.2s',
            transitionDelay: '0s',
            animationDuration: '0s',
            animationDelay: '0s',
        } as CSSStyleDeclaration;
        const spy = vi.spyOn(window, 'getComputedStyle').mockReturnValue(style);
        try {
            const t = mount();
            const id = t.create({ title: 'Slow goodbye' });
            await settle();
            t.dismiss(id);
            await settle();
            const root = container.querySelector<HTMLElement>('[data-part="root"]')!;
            expect(root).not.toBeNull();
            expect(root.getAttribute('data-state')).toBe('closed');
            root.dispatchEvent(new Event('transitionend'));
            await settle();
            expect(container.querySelector('[data-part="root"]')).toBeNull();
        } finally {
            spy.mockRestore();
        }
    });

    it('a child transitionend does not end the exit early', async () => {
        const style = { transitionDuration: '0.2s', transitionDelay: '0s', animationDuration: '0s', animationDelay: '0s' } as CSSStyleDeclaration;
        const spy = vi.spyOn(window, 'getComputedStyle').mockReturnValue(style);
        try {
            const t = mount();
            const id = t.create({ title: 'Still here' });
            await settle();
            t.dismiss(id);
            await settle();
            const title = container.querySelector<HTMLElement>('[data-part="title"]')!;
            title.dispatchEvent(new Event('transitionend', { bubbles: true }));
            await settle();
            expect(container.querySelector('[data-part="root"]')).not.toBeNull();
        } finally {
            spy.mockRestore();
        }
    });

    it('the close button dismisses its toast', async () => {
        const t = mount();
        t.create({ title: 'Click me away' });
        await settle();
        container.querySelector<HTMLElement>('[data-part="close"]')!.click();
        await settle();
        expect(container.querySelector('[data-part="root"]')).toBeNull();
    });

    it('role=alert opts into assertive announcement', async () => {
        const t = mount();
        t.create({ title: 'Failure', role: 'alert' });
        await settle();
        expect(container.querySelector('[data-part="root"]')!.getAttribute('role')).toBe('alert');
    });

    it('hovering the viewport pauses auto-dismiss; leaving resumes it', async () => {
        const t = mount(createToaster({ duration: 50 }));
        t.create({ title: 'Hover me' });
        await settle();
        const viewport = container.querySelector<HTMLElement>('[data-part="viewport"]')!;
        viewport.dispatchEvent(new PointerEvent('pointerenter'));
        await new Promise((r) => setTimeout(r, 120));
        expect(container.querySelector('[data-part="root"]')!.getAttribute('data-state')).toBe('open');
        viewport.dispatchEvent(new PointerEvent('pointerleave'));
        await new Promise((r) => setTimeout(r, 120));
        expect(container.querySelector('[data-part="root"]')).toBeNull();
    });

    it('a custom slot composes per toast and the aria wiring holds', async () => {
        const t = createToaster({ duration: Infinity });
        render(
            <Toast.Viewport toaster={t}>
                {(data: ToastData) => (
                    <Toast.Root toast={data} key={data.id}>
                        <Toast.Title>{String(data.data)}</Toast.Title>
                        <Toast.Close>Dismiss</Toast.Close>
                    </Toast.Root>
                )}
            </Toast.Viewport>,
            container,
        );
        t.create({ data: 'custom body' });
        await settle();
        const root = container.querySelector<HTMLElement>('[data-part="root"]')!;
        const title = container.querySelector<HTMLElement>('[data-part="title"]')!;
        expect(title.textContent).toBe('custom body');
        expect(root.getAttribute('aria-labelledby')).toBe(title.id);
        expect(root.getAttribute('aria-atomic')).toBe('true');
    });

    it('the close button carries an accessible name; label overrides it', async () => {
        const t = createToaster({ duration: Infinity });
        render(
            <Toast.Viewport toaster={t}>
                {(data: ToastData) => (
                    <Toast.Root toast={data} key={data.id}>
                        <Toast.Title>{data.title}</Toast.Title>
                        {data.data === 'labelled'
                            ? <Toast.Close label="Stäng">✕</Toast.Close>
                            : <Toast.Close>✕</Toast.Close>}
                    </Toast.Root>
                )}
            </Toast.Viewport>,
            container,
        );
        t.create({ title: 'Default' });
        await settle();
        // "✕" is announced literally without a name of its own.
        expect(container.querySelector('[data-part="close"]')!.getAttribute('aria-label')).toBe('Close');

        t.dismiss(t.toasts()[0]!.id);
        t.create({ title: 'Custom', data: 'labelled' });
        await settle();
        const closes = Array.from(container.querySelectorAll('[data-part="close"]'));
        expect(closes.at(-1)!.getAttribute('aria-label')).toBe('Stäng');
    });

    it('ARIA refs only point at parts that are actually rendered', async () => {
        const t = mount();
        t.create({ title: 'Only a title' });
        await settle();
        const root = container.querySelector<HTMLElement>('[data-part="root"]')!;
        expect(root.getAttribute('aria-labelledby')).toBe(container.querySelector('[data-part="title"]')!.id);
        expect(container.querySelector('[data-part="description"]')).toBeNull();
        expect(root.hasAttribute('aria-describedby')).toBe(false);
    });

    it('the stock action runs its callback', async () => {
        const t = mount();
        const onClick = vi.fn();
        t.create({ title: 'Undoable', action: { label: 'Undo', onClick } });
        await settle();
        container.querySelector<HTMLElement>('[data-part="action"]')!.click();
        expect(onClick).toHaveBeenCalledTimes(1);
    });
});
