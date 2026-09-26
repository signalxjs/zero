/**
 * Announce what users see (#274) — the feedback tier's announcement fixes,
 * one file because each is a few lines: progress value text, alert naming /
 * politeness / focus on close, and avatar's no-image settle and fallback
 * delay. Spinner, Skeleton and Swap carry theirs in their own files.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { renderToString } from '@sigx/server-renderer';
import { signal } from 'sigx';
import { Alert, alertAnatomy, Avatar, avatarAnatomy, Progress, RadialProgress } from '@sigx/zero';
import { expectAnatomy } from './helpers';

const part = (c: HTMLElement, scope: string, name: string) =>
    c.querySelector<HTMLElement>(`[data-scope="${scope}"][data-part="${name}"]`);

/** Presence reports and settles land a microtask after mount. */
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

let container: HTMLElement;
beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
});
afterEach(() => {
    container.remove();
});

describe('Progress / RadialProgress value text', () => {
    const roots = {
        progress: (props: Record<string, unknown>) => (
            <Progress.Root {...props}>
                <Progress.Track><Progress.Range /></Progress.Track>
                <Progress.ValueText />
            </Progress.Root>
        ),
        'radial-progress': (props: Record<string, unknown>) => (
            <RadialProgress.Root {...props}>
                <RadialProgress.ValueText />
            </RadialProgress.Root>
        ),
    } as const;

    for (const [scope, make] of Object.entries(roots)) {
        describe(scope, () => {
            it('announces what the value text shows — a percent by default', () => {
                render(make({ value: 256, max: 1024 }), container);
                const root = part(container, scope, 'root')!;
                expect(root.getAttribute('aria-valuenow')).toBe('256');
                expect(root.getAttribute('aria-valuetext')).toBe('25%');
                expect(part(container, scope, 'value-text')!.textContent).toBe('25%');
            });

            it('formats through locale and formatOptions — a non-percent style formats the value', () => {
                render(make({ value: 0.5, max: 1, locale: 'de-DE', formatOptions: { style: 'percent', minimumFractionDigits: 1 } }), container);
                // German puts a no-break space before the sign.
                expect(part(container, scope, 'root')!.getAttribute('aria-valuetext')).toBe('50,0\u00a0%');
                const other = document.createElement('div');
                document.body.appendChild(other);
                render(make({ value: 62, max: 100, locale: 'en-US', formatOptions: { style: 'unit', unit: 'megabyte' } }), other);
                expect(part(other, scope, 'root')!.getAttribute('aria-valuetext')).toBe('62 MB');
                expect(part(other, scope, 'value-text')!.textContent).toBe('62 MB');
                other.remove();
            });

            it('formatOptions without a style still format a percent', () => {
                render(make({ value: 256, max: 1024, locale: 'en-US', formatOptions: { minimumFractionDigits: 1 } }), container);
                expect(part(container, scope, 'root')!.getAttribute('aria-valuetext')).toBe('25.0%');
            });

            it('getValueText replaces the formatter, told the clamped value and the range', () => {
                const calls: unknown[] = [];
                render(make({
                    value: 12,
                    max: 10,
                    getValueText: (v: number, d: unknown) => { calls.push([v, d]); return `${v} of 10 files`; },
                }), container);
                expect(part(container, scope, 'root')!.getAttribute('aria-valuetext')).toBe('10 of 10 files');
                expect(part(container, scope, 'value-text')!.textContent).toBe('10 of 10 files');
                expect(calls[0]).toEqual([10, { min: 0, max: 10, percent: 100 }]);
                // One shared string: the root and the ValueText read it, the formatter runs once.
                expect(calls).toHaveLength(1);
            });

            it('an indeterminate bar has no value text', () => {
                render(make({ value: null, getValueText: () => 'never' }), container);
                expect(part(container, scope, 'root')!.hasAttribute('aria-valuetext')).toBe(false);
                expect(part(container, scope, 'value-text')!.textContent).toBe('');
            });
        });
    }
});

describe('Alert', () => {
    it('is named by its Title and described by its Description', async () => {
        render(
            <Alert.Root>
                <Alert.Title>Quota</Alert.Title>
                <Alert.Description>92% used.</Alert.Description>
            </Alert.Root>,
            container,
        );
        await tick();
        const root = part(container, 'alert', 'root')!;
        const title = part(container, 'alert', 'title')!;
        const description = part(container, 'alert', 'description')!;
        expect(title.id).not.toBe('');
        expect(root.getAttribute('aria-labelledby')).toBe(title.id);
        expect(root.getAttribute('aria-describedby')).toBe(description.id);
        expectAnatomy(container, alertAnatomy);
    });

    it('never references a part that is not rendered, and joins an app reference', async () => {
        const state = signal({ title: true });
        render(
            <Alert.Root aria-describedby="extra">
                {() => (state.title ? <Alert.Title>Quota</Alert.Title> : null)}
            </Alert.Root>,
            container,
        );
        await tick();
        const root = part(container, 'alert', 'root')!;
        expect(root.getAttribute('aria-labelledby')).toBe(part(container, 'alert', 'title')!.id);
        // No Description: only the app's own reference remains.
        expect(root.getAttribute('aria-describedby')).toBe('extra');
        state.title = false;
        await tick();
        expect(root.hasAttribute('aria-labelledby')).toBe(false);
    });

    it('live="polite" is a status; the default interrupts as an alert', () => {
        render(
            <div>
                <Alert.Root data-probe="a" />
                <Alert.Root data-probe="p" live="polite" />
            </div>,
            container,
        );
        expect(container.querySelector('[data-probe="a"]')!.getAttribute('role')).toBe('alert');
        expect(container.querySelector('[data-probe="p"]')!.getAttribute('role')).toBe('status');
    });

    function mountWithSiblings(finalFocus?: () => HTMLElement | null) {
        render(
            <div>
                <button data-probe="before">Before</button>
                <p>Text</p>
                <Alert.Root finalFocus={finalFocus}>
                    <Alert.Title>Saved</Alert.Title>
                    <Alert.Close />
                </Alert.Root>
                <button data-probe="elsewhere">Elsewhere</button>
            </div>,
            container,
        );
        return {
            before: container.querySelector<HTMLElement>('[data-probe="before"]')!,
            elsewhere: container.querySelector<HTMLElement>('[data-probe="elsewhere"]')!,
            close: part(container, 'alert', 'close')!,
        };
    }

    it('closing with focus inside moves it to the nearest focusable before the alert', () => {
        const { before, close } = mountWithSiblings();
        close.focus();
        close.click();
        expect(part(container, 'alert', 'root')!.hasAttribute('hidden')).toBe(true);
        expect(document.activeElement).toBe(before);
    });

    it('skips a sibling that is focusable but not a Tab stop', () => {
        render(
            <div>
                <button data-probe="before">Before</button>
                <div data-probe="scripted" tabIndex={-1}>Scripted target</div>
                <Alert.Root><Alert.Close /></Alert.Root>
            </div>,
            container,
        );
        const close = part(container, 'alert', 'close')!;
        close.focus();
        close.click();
        expect(document.activeElement).toBe(container.querySelector('[data-probe="before"]'));
    });

    it('a finalFocus target inside the closing alert falls back to the sibling', () => {
        const { before, close } = mountWithSiblings(() => part(container, 'alert', 'close'));
        close.focus();
        close.click();
        expect(document.activeElement).toBe(before);
    });

    it('finalFocus wins over the sibling fallback', () => {
        const { elsewhere, close } = mountWithSiblings(() => container.querySelector<HTMLElement>('[data-probe="elsewhere"]'));
        close.focus();
        close.click();
        expect(document.activeElement).toBe(elsewhere);
    });

    it('closing while focus is elsewhere leaves it there', () => {
        const state = signal({ open: true });
        render(
            <div>
                <button data-probe="before">Before</button>
                <Alert.Root model={() => state.open}><Alert.Close /></Alert.Root>
                <button data-probe="elsewhere">Elsewhere</button>
            </div>,
            container,
        );
        const elsewhere = container.querySelector<HTMLElement>('[data-probe="elsewhere"]')!;
        elsewhere.focus();
        state.open = false;
        expect(document.activeElement).toBe(elsewhere);
    });

    it('with nothing focusable before it, focus is left alone rather than forced', () => {
        render(<Alert.Root><Alert.Close /></Alert.Root>, container);
        const close = part(container, 'alert', 'close')!;
        close.focus();
        expect(() => close.click()).not.toThrow();
        expect(part(container, 'alert', 'root')!.getAttribute('data-state')).toBe('closed');
    });
});

describe('Avatar', () => {
    /** happy-dom reports an unfetched image `complete`; a real one is still loading. */
    let complete: PropertyDescriptor | undefined;
    beforeEach(() => {
        complete = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'complete');
        Object.defineProperty(HTMLImageElement.prototype, 'complete', { configurable: true, get: () => false });
    });
    afterEach(() => {
        if (complete) Object.defineProperty(HTMLImageElement.prototype, 'complete', complete);
        else Reflect.deleteProperty(HTMLImageElement.prototype, 'complete');
    });

    it('a root with no Image settles to error: the fallback is the avatar', async () => {
        const statuses: string[] = [];
        render(
            <Avatar.Root onStatusChange={(s: string) => statuses.push(s)}>
                <Avatar.Fallback>AE</Avatar.Fallback>
            </Avatar.Root>,
            container,
        );
        expect(part(container, 'avatar', 'root')!.getAttribute('data-state')).toBe('loading');
        await tick();
        expect(part(container, 'avatar', 'root')!.getAttribute('data-state')).toBe('error');
        expect(part(container, 'avatar', 'fallback')!.hasAttribute('hidden')).toBe(false);
        expect(statuses).toEqual(['error']);
        expectAnatomy(container, avatarAnatomy);
    });

    it('an Image that is there keeps the root loading until it answers', async () => {
        render(
            <Avatar.Root>
                <Avatar.Image src="/me.png" alt="Me" />
                <Avatar.Fallback>ME</Avatar.Fallback>
            </Avatar.Root>,
            container,
        );
        await tick();
        expect(part(container, 'avatar', 'root')!.getAttribute('data-state')).toBe('loading');
    });

    it('an Image removed after mount settles to error; one added back loads again', async () => {
        const state = signal({ image: true });
        render(
            <Avatar.Root>
                {() => (state.image ? <Avatar.Image src="/me.png" alt="Me" /> : null)}
                <Avatar.Fallback>ME</Avatar.Fallback>
            </Avatar.Root>,
            container,
        );
        await tick();
        state.image = false;
        await tick();
        expect(part(container, 'avatar', 'root')!.getAttribute('data-state')).toBe('error');
        state.image = true;
        await tick();
        expect(part(container, 'avatar', 'root')!.getAttribute('data-state')).toBe('loading');
    });

    describe('Fallback delay', () => {
        beforeEach(() => { vi.useFakeTimers(); });
        afterEach(() => { vi.useRealTimers(); });

        it('is not rendered until the delay passes', () => {
            render(
                <Avatar.Root>
                    <Avatar.Image src="/me.png" alt="Me" />
                    <Avatar.Fallback delay={600}>ME</Avatar.Fallback>
                </Avatar.Root>,
                container,
            );
            expect(part(container, 'avatar', 'fallback')).toBeNull();
            vi.advanceTimersByTime(599);
            expect(part(container, 'avatar', 'fallback')).toBeNull();
            vi.advanceTimersByTime(1);
            expect(part(container, 'avatar', 'fallback')).not.toBeNull();
        });

        it('clears its timer on unmount', () => {
            render(<Avatar.Root><Avatar.Fallback delay={600}>ME</Avatar.Fallback></Avatar.Root>, container);
            expect(vi.getTimerCount()).toBe(1);
            render(null, container);
            expect(vi.getTimerCount()).toBe(0);
        });

        it('no delay renders at once', () => {
            render(<Avatar.Root><Avatar.Fallback>ME</Avatar.Fallback></Avatar.Root>, container);
            expect(part(container, 'avatar', 'fallback')).not.toBeNull();
        });
    });

    it('server markup renders no fallback while a delay is set', async () => {
        const html = await renderToString(
            <Avatar.Root>
                <Avatar.Image src="/me.png" alt="Me" />
                <Avatar.Fallback delay={300}>ME</Avatar.Fallback>
            </Avatar.Root>,
        );
        expect(html).not.toContain('data-part="fallback"');
        expect(html).toContain('data-part="image"');
    });
});
