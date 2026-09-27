import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { component, signal } from 'sigx';
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

    it('promise: a sticky loading toast, updated in place when it resolves (#292)', async () => {
        const t = createToaster({ duration: 1000 });
        let resolve!: (v: string) => void;
        const id = t.promise(new Promise<string>((r) => { resolve = r; }), {
            loading: 'Uploading…',
            success: (name) => ({ title: `Uploaded ${name}`, description: 'All done.' }),
            error: 'Upload failed',
        });
        const item = () => t.toasts().find((x) => x.id === id)!;
        expect(item().title).toBe('Uploading…');
        expect(item().status).toBe('loading');
        expect(item().duration).toBe(Infinity);
        item().open = true; // the component's enter flip, simulated
        // Pending: never auto-dismissed.
        vi.advanceTimersByTime(60_000);
        expect(item().open).toBe(true);
        resolve('report.pdf');
        await vi.advanceTimersByTimeAsync(0);
        expect(t.toasts()).toHaveLength(1);
        expect(item().title).toBe('Uploaded report.pdf');
        expect(item().description).toBe('All done.');
        expect(item().status).toBe('complete');
        // The default duration is restored and armed.
        expect(item().duration).toBe(1000);
        vi.advanceTimersByTime(1100);
        expect(item().open).toBe(false);
    });

    it('promise: a rejection becomes the error stage, handled here (#292)', async () => {
        const t = createToaster({ duration: 1000 });
        const id = t.promise(Promise.reject(new Error('disk full')), {
            id: 'upload',
            loading: { title: 'Uploading…', description: 'report.pdf' },
            success: 'Uploaded',
            error: (e) => ({ title: 'Upload failed', description: (e as Error).message, role: 'alert', duration: 8000 }),
        });
        expect(id).toBe('upload');
        await vi.advanceTimersByTimeAsync(0);
        const item = t.toasts()[0]!;
        expect(item.status).toBe('error');
        expect(item.title).toBe('Upload failed');
        expect(item.description).toBe('disk full');
        expect(item.role).toBe('alert');
        // A stage's own duration wins over the restored default.
        expect(item.duration).toBe(8000);
    });

    it('promise: a throwing stage mapper settles the error stage, never an unhandled rejection (#292)', async () => {
        const unhandled = vi.fn();
        process.on('unhandledRejection', unhandled);
        try {
            const t = createToaster({ duration: Infinity });
            const ok = t.promise(Promise.resolve(1), {
                loading: 'Saving…',
                success: () => { throw new Error('bad mapper'); },
                error: (e) => ({ title: 'Save failed', description: (e as Error).message }),
            });
            const bad = t.promise(Promise.reject(new Error('io')), {
                loading: 'Loading…',
                success: 'Loaded',
                error: () => { throw new Error('bad mapper'); },
            });
            await vi.advanceTimersByTimeAsync(0);
            await vi.advanceTimersByTimeAsync(0);
            const find = (id: string) => t.toasts().find((x) => x.id === id)!;
            expect(find(ok).status).toBe('error');
            expect(find(ok).title).toBe('Save failed');
            expect(find(ok).description).toBe('bad mapper');
            // Nothing left to map: the status moves, the loading copy stays.
            expect(find(bad).status).toBe('error');
            expect(find(bad).title).toBe('Loading…');
            expect(unhandled).not.toHaveBeenCalled();
        } finally {
            process.off('unhandledRejection', unhandled);
        }
    });

    it('promise: a toast removed before the promise settles stays gone (#292)', async () => {
        const t = createToaster();
        let resolve!: () => void;
        const id = t.promise(new Promise<void>((r) => { resolve = r; }), {
            loading: 'Working…', success: 'Done', error: 'Failed',
        });
        t.remove(id);
        resolve();
        await vi.advanceTimersByTimeAsync(0);
        expect(t.count()).toBe(0);
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
    afterEach(() => {
        render(null, container);
        container.remove();
        // Reset shared focus state so no test depends on its order: blur
        // whatever is focused, then drain the one-shot capture guards sigx's
        // restoreFocus leaves on the then-active element (body, once a
        // focused Close was removed), which would swallow the next test's
        // focus events.
        (document.activeElement as HTMLElement | null)?.blur?.();
        for (const type of ['blur', 'focusout', 'focus', 'focusin']) {
            document.body.dispatchEvent(new FocusEvent(type));
        }
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
        // A focusable named group inside the viewport's live region — not a
        // live region of its own.
        expect(root.getAttribute('role')).toBe('group');
        expect(root.getAttribute('tabindex')).toBe('-1');
        expect(root.hasAttribute('aria-live')).toBe(false);
        expect(root.hasAttribute('aria-atomic')).toBe(false);
        expect(container.querySelector('[data-part="title"]')!.textContent).toBe('Saved');
        expect(container.querySelector('[data-part="description"]')!.textContent).toBe('Your changes are safe.');
        expect(container.querySelector('[data-part="action"]')!.textContent).toBe('Undo');
        expect(container.querySelector('[data-part="close"]')).not.toBeNull();
        const viewport = container.querySelector<HTMLElement>('[data-part="viewport"]')!;
        expect(viewport.tagName).toBe('OL');
        expect(viewport.getAttribute('popover')).toBe('manual');
        expect(viewport.getAttribute('role')).toBe('region');
        expect(viewport.getAttribute('aria-live')).toBe('polite');
        expect(viewport.getAttribute('aria-relevant')).toBe('additions text');
        expect(viewport.getAttribute('aria-atomic')).toBe('false');
        expect(viewport.getAttribute('aria-label')).toBe('Notifications (F8)');
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

    it('Toast.Indicator shows the status, and is absent without one (#292)', async () => {
        const t = mount();
        const plain = t.create({ title: 'Plain' });
        const job = t.create({ title: 'Working…', status: 'loading' });
        await settle();
        expectAnatomy(container, toastAnatomy);
        const indicatorOf = (id: string) => {
            const title = t.toasts().find((x) => x.id === id)!.title!;
            const root = [...container.querySelectorAll<HTMLElement>('[data-part="root"]')]
                .find((r) => r.querySelector('[data-part="title"]')!.textContent === title)!;
            return root.querySelector<HTMLElement>('[data-part="indicator"]');
        };
        expect(indicatorOf(plain)).toBeNull();
        const indicator = indicatorOf(job)!;
        expect(indicator.tagName).toBe('SPAN');
        expect(indicator.getAttribute('data-state')).toBe('loading');
        expect(indicator.getAttribute('aria-hidden')).toBe('true');
        t.update(job, { title: 'Done', status: 'complete' });
        await settle();
        expect(indicatorOf(job)!.getAttribute('data-state')).toBe('complete');
        t.update(job, { status: 'error' });
        await settle();
        expect(indicatorOf(job)!.getAttribute('data-state')).toBe('error');
        expectAnatomy(container, toastAnatomy);
    });

    it('a promise toast walks the indicator from loading to complete (#292)', async () => {
        const t = mount();
        let resolve!: () => void;
        t.promise(new Promise<void>((r) => { resolve = r; }), { loading: 'Saving…', success: 'Saved', error: 'Failed' });
        await settle();
        const indicator = () => container.querySelector<HTMLElement>('[data-part="indicator"]')!;
        expect(indicator().getAttribute('data-state')).toBe('loading');
        resolve();
        await settle();
        expect(indicator().getAttribute('data-state')).toBe('complete');
        expect(container.querySelector('[data-part="title"]')!.textContent).toBe('Saved');
    });

    it('the viewport is closed at rest and open while hovered or holding focus (#292)', async () => {
        const t = mount();
        t.create({ title: 'Stacked' });
        await settle();
        const viewport = container.querySelector<HTMLElement>('[data-part="viewport"]')!;
        expect(viewport.getAttribute('data-state')).toBe('closed');
        viewport.dispatchEvent(new PointerEvent('pointerenter'));
        await settle();
        expect(viewport.getAttribute('data-state')).toBe('open');
        viewport.dispatchEvent(new PointerEvent('pointerleave'));
        await settle();
        expect(viewport.getAttribute('data-state')).toBe('closed');
        const close = container.querySelector<HTMLElement>('[data-part="close"]')!;
        close.focus();
        await settle();
        expect(viewport.getAttribute('data-state')).toBe('open');
        close.blur();
        await settle();
        expect(viewport.getAttribute('data-state')).toBe('closed');
    });

    it('expand="always" keeps the stack open (#292)', async () => {
        const t = createToaster({ duration: Infinity });
        render(<Toast.Viewport toaster={t} expand="always" />, container);
        t.create({ title: 'Fanned' });
        await settle();
        expect(container.querySelector('[data-part="viewport"]')!.getAttribute('data-state')).toBe('open');
    });

    it('each root publishes its measured height and the heights in front of it (#292)', async () => {
        // happy-dom lays nothing out: give every root a height by its title.
        const heights: Record<string, number> = { a: 40, b: 60, c: 50 };
        const spy = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
            return heights[this.querySelector('[data-part="title"]')?.textContent ?? ''] ?? 0;
        });
        try {
            const t = mount();
            t.create({ title: 'a' });
            t.create({ title: 'b' });
            t.create({ title: 'c' });
            await settle();
            const vars = () => [...container.querySelectorAll<HTMLElement>('[data-part="root"]')].map((r) => [
                r.style.getPropertyValue('--toast-height'),
                r.style.getPropertyValue('--toast-offset'),
            ]);
            // Oldest first; the offset sums the NEWER toasts, which stand in front.
            expect(vars()).toEqual([['40px', '110px'], ['60px', '50px'], ['50px', '0px']]);
            t.remove(t.toasts()[2]!.id);
            await settle();
            expect(vars()).toEqual([['40px', '60px'], ['60px', '0px']]);
        } finally {
            spy.mockRestore();
        }
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

    it('role=alert speaks once, through the assertive channel only', async () => {
        const t = mount();
        const assertive = () => container.querySelector<HTMLElement>('[aria-live="assertive"]')!;
        // The channel exists before any alert does, empty and outside the
        // popover (so it is in the accessibility tree before it is filled).
        expect(assertive()).not.toBeNull();
        expect(assertive().textContent).toBe('');
        expect(assertive().hasAttribute('data-visually-hidden')).toBe(true);
        expect(assertive().getAttribute('aria-atomic')).toBe('true');
        expect(assertive().closest('[data-part="viewport"]')).toBeNull();

        t.create({ title: 'Saved', role: 'status' });
        t.create({ title: 'Failure', description: 'Retrying.', role: 'alert' });
        await settle();
        await settle();
        const [status, alert] = container.querySelectorAll<HTMLElement>('[data-part="root"]');
        // No double announcement, by structure: the alert's root opts out of
        // the polite region it sits in, and only the alert reaches the
        // assertive channel.
        expect(status!.hasAttribute('aria-live')).toBe(false);
        expect(status!.closest('[aria-live]')!.getAttribute('aria-live')).toBe('polite');
        expect(alert!.getAttribute('aria-live')).toBe('off');
        expect(alert!.getAttribute('role')).toBe('group');
        expect(assertive().textContent).toBe('Failure. Retrying.');
        expect(assertive().contains(alert!)).toBe(false);
    });

    it('an updated alert is announced again', async () => {
        const t = mount();
        const id = t.create({ title: 'Upload failed', role: 'alert' });
        await settle();
        await settle();
        const assertive = container.querySelector<HTMLElement>('[aria-live="assertive"]')!;
        expect(assertive.textContent).toBe('Upload failed');
        t.update(id, { title: 'Upload failed again' });
        await settle();
        await settle();
        expect(assertive.textContent).toBe('Upload failed again');
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

    it('the pointer leaving keeps the pause while focus is still inside', async () => {
        const t = mount(createToaster({ duration: 50 }));
        t.create({ title: 'Focused' });
        await settle();
        const viewport = container.querySelector<HTMLElement>('[data-part="viewport"]')!;
        viewport.dispatchEvent(new PointerEvent('pointerenter'));
        container.querySelector<HTMLElement>('[data-part="close"]')!.focus();
        viewport.dispatchEvent(new PointerEvent('pointerleave'));
        await new Promise((r) => setTimeout(r, 120));
        expect(container.querySelector('[data-part="root"]')!.getAttribute('data-state')).toBe('open');
        // Focus leaves the viewport: now it resumes.
        container.querySelector<HTMLElement>('[data-part="close"]')!.blur();
        await new Promise((r) => setTimeout(r, 200));
        expect(container.querySelector('[data-part="root"]')).toBeNull();
    });

    it('closing the focused toast releases the focus pause (#168)', async () => {
        // Removing a focused node fires no focusout (happy-dom, Firefox,
        // WebKit), so the viewport must notice focus left with the toast.
        const t = mount(createToaster({ duration: 50 }));
        t.create({ title: 'A', duration: Infinity });
        await settle();
        const close = container.querySelector<HTMLElement>('[data-part="close"]')!;
        close.focus();
        close.click();
        await settle();
        expect(container.querySelector('[data-part="root"]')).toBeNull();
        t.create({ title: 'B' });
        await settle();
        await new Promise((r) => setTimeout(r, 200));
        expect(container.querySelector('[data-part="root"]')).toBeNull();
    });

    it('closing one of two toasts hands focus to the other, keeping the pause', async () => {
        const t = mount(createToaster({ duration: 50 }));
        t.create({ title: 'A', duration: Infinity });
        t.create({ title: 'B' });
        await settle();
        const [closeA, closeB] = container.querySelectorAll<HTMLElement>('[data-part="close"]');
        closeA!.focus();
        closeB!.focus(); // focus moves within the viewport: still paused
        await new Promise((r) => setTimeout(r, 120));
        expect(t.toasts().find((x) => x.title === 'B')?.open).toBe(true);
        closeA!.focus();
        closeA!.click(); // A leaves; focus moves on to B, never to body
        await settle();
        const rootB = container.querySelector<HTMLElement>('[data-part="root"]')!;
        expect(rootB.textContent).toContain('B');
        expect(document.activeElement).toBe(rootB);
        await new Promise((r) => setTimeout(r, 120));
        expect(t.toasts().find((x) => x.title === 'B')?.open).toBe(true);
        rootB.blur(); // focus leaves: B's timer resumes
        await new Promise((r) => setTimeout(r, 200));
        expect(container.querySelector('[data-part="root"]')).toBeNull();
    });

    it('closing the focused toast at the cap keeps focus in the viewport until it leaves', async () => {
        // A removal at `max` promotes a queued toast, so the viewport stays
        // shown — and with no other toast rendered yet and nowhere focus came
        // from, the viewport itself takes focus (and holds the pause).
        const t = mount(createToaster({ duration: 50, max: 1 }));
        t.create({ title: 'A', duration: Infinity });
        t.create({ title: 'B' });
        await settle();
        const close = container.querySelector<HTMLElement>('[data-part="close"]')!;
        close.focus();
        close.click();
        await settle();
        const viewport = container.querySelector<HTMLElement>('[data-part="viewport"]')!;
        expect(document.activeElement).toBe(viewport);
        await new Promise((r) => setTimeout(r, 120));
        expect(t.count()).toBe(1);
        viewport.blur();
        await new Promise((r) => setTimeout(r, 200));
        expect(t.count()).toBe(0);
    });

    it('closing the last toast after the previous one closes focuses the previous toast', async () => {
        const t = mount();
        t.create({ title: 'A' });
        t.create({ title: 'B' });
        await settle();
        const [rootA, rootB] = container.querySelectorAll<HTMLElement>('[data-part="root"]');
        rootB!.querySelector<HTMLElement>('[data-part="close"]')!.focus();
        rootB!.querySelector<HTMLElement>('[data-part="close"]')!.click();
        await settle();
        expect(document.activeElement).toBe(rootA);
    });

    it('closing the only toast returns focus to where it came from', async () => {
        const t = mount();
        const opener = document.createElement('button');
        document.body.appendChild(opener);
        try {
            t.create({ title: 'Only' });
            await settle();
            opener.focus();
            const close = container.querySelector<HTMLElement>('[data-part="close"]')!;
            // Focus enters the viewport from the opener.
            close.dispatchEvent(new FocusEvent('focusin', { bubbles: true, relatedTarget: opener }));
            close.focus();
            close.click();
            await settle();
            expect(document.activeElement).toBe(opener);
        } finally {
            opener.remove();
        }
    });

    it('the hotkey (F8 by default) focuses the first toast', async () => {
        const t = mount();
        t.create({ title: 'First' });
        t.create({ title: 'Second' });
        await settle();
        const event = new KeyboardEvent('keydown', { key: 'F8', code: 'F8', bubbles: true, cancelable: true });
        document.body.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(container.querySelector('[data-part="root"]'));
    });

    it('a custom hotkey names itself in the label; hotkey={false} turns it off', async () => {
        const t = createToaster({ duration: Infinity });
        render(<Toast.Viewport toaster={t} hotkey={['altKey', 'KeyT']} />, container);
        t.create({ title: 'x' });
        await settle();
        const viewport = () => container.querySelector<HTMLElement>('[data-part="viewport"]')!;
        expect(viewport().getAttribute('aria-label')).toBe('Notifications (alt+T)');
        document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyT', key: 't', bubbles: true }));
        expect(document.activeElement).not.toBe(container.querySelector('[data-part="root"]'));
        document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyT', key: 't', altKey: true, bubbles: true }));
        expect(document.activeElement).toBe(container.querySelector('[data-part="root"]'));
        (document.activeElement as HTMLElement).blur();

        render(<Toast.Viewport toaster={t} hotkey={false} label="Alerts ({hotkey})" />, container);
        await settle();
        expect(viewport().getAttribute('aria-label')).toBe('Alerts');
        const f8 = new KeyboardEvent('keydown', { key: 'F8', code: 'F8', bubbles: true, cancelable: true });
        document.body.dispatchEvent(f8);
        expect(f8.defaultPrevented).toBe(false);
    });

    it('with no toasts the hotkey does nothing', async () => {
        mount();
        await settle();
        const f8 = new KeyboardEvent('keydown', { key: 'F8', code: 'F8', bubbles: true, cancelable: true });
        document.body.dispatchEvent(f8);
        expect(f8.defaultPrevented).toBe(false);
    });

    it('Escape inside a toast dismisses it', async () => {
        const t = mount();
        t.create({ title: 'Esc me' });
        await settle();
        const close = container.querySelector<HTMLElement>('[data-part="close"]')!;
        const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
        close.dispatchEvent(esc);
        expect(esc.defaultPrevented).toBe(true);
        await settle();
        expect(t.count()).toBe(0);
    });

    it('an Escape an inner widget already handled does not dismiss', async () => {
        const t = mount();
        t.create({ title: 'Stay' });
        await settle();
        const close = container.querySelector<HTMLElement>('[data-part="close"]')!;
        const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
        esc.preventDefault();
        close.dispatchEvent(esc);
        await settle();
        expect(t.count()).toBe(1);
    });

    it('re-shows the popover when a toast arrives while showing, so it tops the top layer', async () => {
        const t = mount();
        const viewport = container.querySelector<HTMLElement>('[data-part="viewport"]')! as HTMLElement & {
            showPopover(): void; hidePopover(): void;
        };
        let open = false;
        const calls: string[] = [];
        viewport.showPopover = () => { open = true; calls.push('show'); };
        viewport.hidePopover = () => { open = false; calls.push('hide'); };
        const matches = viewport.matches.bind(viewport);
        Object.defineProperty(viewport, 'matches', {
            value: (s: string) => (s === ':popover-open' ? open : matches(s)),
        });
        t.create({ title: 'first' });
        await settle();
        expect(calls).toEqual(['show']);
        const focusTarget = container.querySelector<HTMLElement>('[data-part="close"]')!;
        focusTarget.focus();
        t.create({ title: 'second' });
        await settle();
        expect(calls).toEqual(['show', 'hide', 'show']);
        // Focus inside survives the re-show.
        expect(document.activeElement).toBe(focusTarget);
    });

    it('a hidden document pauses auto-dismiss; visible again resumes it', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
        const state = { value: 'visible' as DocumentVisibilityState };
        const spy = vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => state.value);
        try {
            const t = mount(createToaster({ duration: 1000 }));
            await Promise.resolve(); // the viewport's mount hook
            t.create({ title: 'Background' });
            // No frame runs in this synchronous test, so the toast never
            // opens: its dismissal is a hard removal.
            const gone = () => t.count() === 0;
            state.value = 'hidden';
            document.dispatchEvent(new Event('visibilitychange'));
            vi.advanceTimersByTime(10_000);
            expect(gone()).toBe(false);
            state.value = 'visible';
            document.dispatchEvent(new Event('visibilitychange'));
            vi.advanceTimersByTime(1100);
            expect(gone()).toBe(true);
        } finally {
            spy.mockRestore();
            vi.useRealTimers();
        }
    });

    it('an unfocused window pauses auto-dismiss; focusing it resumes', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
        try {
            const t = mount(createToaster({ duration: 1000 }));
            await Promise.resolve(); // the viewport's mount hook
            t.create({ title: 'Elsewhere' });
            const gone = () => t.count() === 0;
            window.dispatchEvent(new Event('blur'));
            vi.advanceTimersByTime(10_000);
            expect(gone()).toBe(false);
            window.dispatchEvent(new Event('focus'));
            vi.advanceTimersByTime(1100);
            expect(gone()).toBe(true);
        } finally {
            vi.useRealTimers();
        }
    });

    it('a toaster swap mid-hold releases the old toaster and holds the new one', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
        try {
            const a = createToaster({ duration: 1000 });
            const b = createToaster({ duration: 1000 });
            const state = signal({ which: 'a' as 'a' | 'b' });
            const App = component(() => () => (
                <Toast.Viewport toaster={state.which === 'a' ? a : b} />
            ));
            render(<App />, container);
            await Promise.resolve(); // the viewport's mount hook
            a.create({ title: 'A' });
            b.create({ title: 'B' });
            window.dispatchEvent(new Event('blur'));
            state.which = 'b';
            await Promise.resolve();
            vi.advanceTimersByTime(1100);
            expect(a.count()).toBe(0); // released: its timer ran out
            expect(b.count()).toBe(1); // held now
            window.dispatchEvent(new Event('focus'));
            vi.advanceTimersByTime(1100);
            expect(b.count()).toBe(0);
        } finally {
            window.dispatchEvent(new Event('focus'));
            vi.useRealTimers();
        }
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

    it('a focusable root with no Title is labelled by its Description', async () => {
        const t = mount();
        t.create({ description: 'Only a description' });
        await settle();
        const root = container.querySelector<HTMLElement>('[data-part="root"]')!;
        const description = container.querySelector<HTMLElement>('[data-part="description"]')!;
        expect(root.getAttribute('aria-labelledby')).toBe(description.id);
        expect(root.hasAttribute('aria-describedby')).toBe(false);
        expect(root.hasAttribute('aria-label')).toBe(false);
    });

    it('a composed root with no Title or Description falls back to a generic name; an app name wins', async () => {
        const u = createToaster({ duration: Infinity });
        let root: HTMLElement;
        render(
            <Toast.Viewport toaster={u}>
                {(data: ToastData) => (
                    data.data === 'named'
                        ? <Toast.Root toast={data} key={data.id} aria-label="Upload"><Toast.Description>Done</Toast.Description></Toast.Root>
                        : <Toast.Root toast={data} key={data.id}><Toast.Close>✕</Toast.Close></Toast.Root>
                )}
            </Toast.Viewport>,
            container,
        );
        u.create({});
        await settle();
        root = container.querySelector<HTMLElement>('[data-part="root"]')!;
        expect(root.getAttribute('aria-label')).toBe('Notification');
        expect(root.hasAttribute('aria-labelledby')).toBe(false);

        u.create({ data: 'named' });
        await settle();
        root = Array.from(container.querySelectorAll<HTMLElement>('[data-part="root"]')).at(-1)!;
        expect(root.getAttribute('aria-label')).toBe('Upload');
        expect(root.hasAttribute('aria-labelledby')).toBe(false);
        expect(root.getAttribute('aria-describedby')).toBe(container.querySelectorAll('[data-part="description"]')[0]!.id);
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
