/**
 * Accordion and Collapsible (#276): the APG accordion keyboard between
 * triggers, panel labelling, the runtime-published panel size variables and
 * the deferred `<details>` close that lets a recipe animate it.
 *
 * happy-dom has no Web Animations and no layout, so the exit is simulated
 * the way `top-layer-exit.test.ts` does it — `getAnimations` stubbed on the
 * panel, frames driven by fake timers — and `scrollHeight`/`scrollWidth` are
 * stubbed getters. The real-engine half is `e2e/accordion.spec.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { signal } from 'sigx';
import { Accordion, Collapsible, accordionAnatomy, collapsibleAnatomy } from '@sigx/zero';
import { expectAnatomy } from './helpers';

let container: HTMLElement;
beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
});
afterEach(() => {
    container.remove();
});

const triggers = () => [...container.querySelectorAll<HTMLElement>('[data-scope="accordion"][data-part="trigger"]')];
const panels = () => [...container.querySelectorAll<HTMLElement>('[data-scope="accordion"][data-part="panel"]')];
const press = (el: Element, key: string) => {
    const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    el.dispatchEvent(e);
    return e;
};

function mountThree(props: Record<string, unknown> = {}, disabledB = false) {
    render(
        <Accordion.Root {...props}>
            <Accordion.Item value="a">
                <Accordion.Trigger>A</Accordion.Trigger>
                <Accordion.Panel>Content A</Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item value="b" disabled={disabledB}>
                <Accordion.Trigger>B</Accordion.Trigger>
                <Accordion.Panel>Content B</Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item value="c">
                <Accordion.Trigger>C</Accordion.Trigger>
                <Accordion.Panel>Content C</Accordion.Panel>
            </Accordion.Item>
        </Accordion.Root>,
        container,
    );
}

describe('Accordion keyboard (APG)', () => {
    it('ArrowDown/ArrowUp move focus between triggers, wrapping by default', () => {
        mountThree();
        const [a, b, c] = triggers();
        a!.focus();
        expect(press(a!, 'ArrowDown').defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(b);
        press(b!, 'ArrowDown');
        expect(document.activeElement).toBe(c);
        press(c!, 'ArrowDown');
        expect(document.activeElement).toBe(a);
        press(a!, 'ArrowUp');
        expect(document.activeElement).toBe(c);
    });

    it('moving focus opens nothing — activation stays Enter/Space/click', () => {
        const state = signal({ open: [] as string[] });
        render(
            <Accordion.Root model={[state, 'open']}>
                <Accordion.Item value="a">
                    <Accordion.Trigger>A</Accordion.Trigger>
                    <Accordion.Panel>Content A</Accordion.Panel>
                </Accordion.Item>
                <Accordion.Item value="b">
                    <Accordion.Trigger>B</Accordion.Trigger>
                    <Accordion.Panel>Content B</Accordion.Panel>
                </Accordion.Item>
            </Accordion.Root>,
            container,
        );
        const [a, b] = triggers();
        a!.focus();
        press(a!, 'ArrowDown');
        expect(document.activeElement).toBe(b);
        expect(state.open).toEqual([]);
    });

    it('Home/End jump to the first and last trigger', () => {
        mountThree();
        const [a, b, c] = triggers();
        b!.focus();
        press(b!, 'End');
        expect(document.activeElement).toBe(c);
        press(c!, 'Home');
        expect(document.activeElement).toBe(a);
    });

    it('skips disabled triggers', () => {
        mountThree({}, true);
        const [a, , c] = triggers();
        a!.focus();
        press(a!, 'ArrowDown');
        expect(document.activeElement).toBe(c);
    });

    it('loop={false} stops at the edges', () => {
        mountThree({ loop: false });
        const [a, , c] = triggers();
        c!.focus();
        press(c!, 'ArrowDown');
        expect(document.activeElement).toBe(c);
        a!.focus();
        press(a!, 'ArrowUp');
        expect(document.activeElement).toBe(a);
    });

    it('no roving tabindex: every trigger stays in the Tab sequence', () => {
        mountThree();
        for (const t of triggers()) expect(t.hasAttribute('tabindex')).toBe(false);
    });

    it('vertical by default: data-orientation on root and triggers; horizontal arrows are ignored', () => {
        mountThree();
        const root = container.querySelector<HTMLElement>('[data-scope="accordion"][data-part="root"]')!;
        expect(root.getAttribute('data-orientation')).toBe('vertical');
        for (const t of triggers()) expect(t.getAttribute('data-orientation')).toBe('vertical');
        const [a] = triggers();
        a!.focus();
        expect(press(a!, 'ArrowRight').defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(a);
        expectAnatomy(container, accordionAnatomy);
    });

    it('horizontal: ArrowRight/ArrowLeft move, ArrowDown does not', () => {
        mountThree({ orientation: 'horizontal' });
        const root = container.querySelector<HTMLElement>('[data-scope="accordion"][data-part="root"]')!;
        expect(root.getAttribute('data-orientation')).toBe('horizontal');
        const [a, b] = triggers();
        a!.focus();
        press(a!, 'ArrowDown');
        expect(document.activeElement).toBe(a);
        press(a!, 'ArrowRight');
        expect(document.activeElement).toBe(b);
        press(b!, 'ArrowLeft');
        expect(document.activeElement).toBe(a);
        expectAnatomy(container, accordionAnatomy);
    });

    it('horizontal under RTL: ArrowLeft moves forward', () => {
        mountThree({ orientation: 'horizontal' });
        container.querySelector<HTMLElement>('[data-scope="accordion"][data-part="root"]')!.style.direction = 'rtl';
        const [a, b] = triggers();
        a!.focus();
        press(a!, 'ArrowLeft');
        expect(document.activeElement).toBe(b);
    });
});

describe('Accordion regions', () => {
    it('each panel is a region labelled by its own trigger', () => {
        mountThree();
        const ts = triggers();
        const ps = panels();
        ts.forEach((t, i) => {
            expect(t.id).not.toBe('');
            expect(ps[i]!.getAttribute('role')).toBe('region');
            expect(ps[i]!.getAttribute('aria-labelledby')).toBe(t.id);
            expect(t.getAttribute('aria-controls')).toBe(ps[i]!.id);
        });
        expect(new Set(ts.map((t) => t.id)).size).toBe(3);
    });

    it('regions={false} drops the role but keeps the label', () => {
        mountThree({ regions: false });
        const [t] = triggers();
        const [p] = panels();
        expect(p!.hasAttribute('role')).toBe(false);
        expect(p!.getAttribute('aria-labelledby')).toBe(t!.id);
    });

    it("an app's aria-labelledby joins the trigger's", () => {
        render(
            <Accordion.Root>
                <Accordion.Item value="a">
                    <Accordion.Trigger>A</Accordion.Trigger>
                    <Accordion.Panel aria-labelledby="extra">Content</Accordion.Panel>
                </Accordion.Item>
            </Accordion.Root>,
            container,
        );
        expect(panels()[0]!.getAttribute('aria-labelledby')).toBe(`${triggers()[0]!.id} extra`);
    });
});

describe('Collapsible labelling', () => {
    it('the panel is labelled by the trigger, with no role', () => {
        render(
            <Collapsible.Root>
                <Collapsible.Trigger>Toggle</Collapsible.Trigger>
                <Collapsible.Panel>Content</Collapsible.Panel>
            </Collapsible.Root>,
            container,
        );
        const trigger = container.querySelector<HTMLElement>('[data-scope="collapsible"][data-part="trigger"]')!;
        const panel = container.querySelector<HTMLElement>('[data-scope="collapsible"][data-part="panel"]')!;
        expect(trigger.id).not.toBe('');
        expect(panel.getAttribute('aria-labelledby')).toBe(trigger.id);
        expect(panel.hasAttribute('role')).toBe(false);
        expectAnatomy(container, collapsibleAnatomy);
    });
});

// ── Size variables and the deferred close ──

interface FakeAnimation {
    effect: { getComputedTiming(): { endTime: number } };
    currentTime: number;
    playbackRate: number;
    finished: Promise<unknown>;
    end(): void;
}

function fakeAnimation(endTime: number): FakeAnimation {
    let end!: () => void;
    const finished = new Promise<unknown>((resolve) => { end = () => resolve(undefined); });
    return { effect: { getComputedTiming: () => ({ endTime }) }, currentTime: 0, playbackRate: 1, finished, end };
}

const flush = async (): Promise<void> => { for (let i = 0; i < 4; i++) await Promise.resolve(); };

describe('panel presence (#276)', () => {
    let animations: FakeAnimation[];
    const proto = HTMLElement.prototype as unknown as { getAnimations?: () => FakeAnimation[] };
    const original = proto.getAnimations;

    beforeEach(() => {
        vi.useFakeTimers();
        animations = [];
        // Only the panel animates: the exit waits on the panel's own.
        proto.getAnimations = function (this: HTMLElement) {
            return this.getAttribute('data-part') === 'panel' ? animations : [];
        };
        vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 16) as unknown as number);
        vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
        vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(120);
        vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(300);
    });

    afterEach(() => {
        if (original) proto.getAnimations = original;
        else delete proto.getAnimations;
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    function mountCollapsible(state: { open: boolean }) {
        render(
            <Collapsible.Root model={[state, 'open']}>
                <Collapsible.Trigger>Toggle</Collapsible.Trigger>
                <Collapsible.Panel>Content</Collapsible.Panel>
            </Collapsible.Root>,
            container,
        );
        return {
            details: container.querySelector<HTMLDetailsElement>('details')!,
            panel: container.querySelector<HTMLElement>('[data-scope="collapsible"][data-part="panel"]')!,
        };
    }

    it('an open panel publishes its measured size on mount', () => {
        const { panel } = mountCollapsible(signal({ open: true }));
        expect(panel.style.getPropertyValue('--collapsible-panel-height')).toBe('120px');
        expect(panel.style.getPropertyValue('--collapsible-panel-width')).toBe('300px');
    });

    it('a closed panel publishes nothing (a closed <details> has no layout to read)', () => {
        const { panel } = mountCollapsible(signal({ open: false }));
        expect(panel.style.getPropertyValue('--collapsible-panel-height')).toBe('');
    });

    it('a close flips data-state at once and keeps <details> open until the exit finishes', async () => {
        const state = signal({ open: true });
        const { details, panel } = mountCollapsible(state);
        const exit = fakeAnimation(150);
        animations = [exit];
        state.open = false;
        expect(panel.getAttribute('data-state')).toBe('closed');
        expect(details.getAttribute('data-state')).toBe('closed');
        expect(details.open).toBe(true);
        vi.advanceTimersByTime(16);
        await flush();
        expect(details.open).toBe(true);
        exit.end();
        await flush();
        expect(details.open).toBe(false);
        expect(state.open).toBe(false);
    });

    it('with nothing animating, the close lands on the next frame', async () => {
        const state = signal({ open: true });
        const { details } = mountCollapsible(state);
        state.open = false;
        expect(details.open).toBe(true);
        vi.advanceTimersByTime(16);
        await flush();
        expect(details.open).toBe(false);
    });

    it('reopening during the exit cancels it', async () => {
        const state = signal({ open: true });
        const { details, panel } = mountCollapsible(state);
        const exit = fakeAnimation(150);
        animations = [exit];
        state.open = false;
        vi.advanceTimersByTime(16);
        await flush();
        state.open = true;
        exit.end();
        await flush();
        vi.advanceTimersByTime(500);
        expect(details.open).toBe(true);
        expect(panel.getAttribute('data-state')).toBe('open');
    });

    it('prefers-reduced-motion closes at once', () => {
        vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q }));
        const state = signal({ open: true });
        const { details } = mountCollapsible(state);
        animations = [fakeAnimation(150)];
        state.open = false;
        expect(details.open).toBe(false);
    });

    it('a native toggle still syncs the model while presence is wired (#166)', async () => {
        const state = signal({ open: false });
        const { details } = mountCollapsible(state);
        details.open = true;
        details.dispatchEvent(new Event('toggle'));
        await flush();
        expect(state.open).toBe(true);
    });

    it('Accordion: a closing item stays open through its exit; single mode opens the next at once', async () => {
        const state = signal({ open: ['a'] });
        render(
            <Accordion.Root model={[state, 'open']}>
                <Accordion.Item value="a">
                    <Accordion.Trigger>A</Accordion.Trigger>
                    <Accordion.Panel>Content A</Accordion.Panel>
                </Accordion.Item>
                <Accordion.Item value="b">
                    <Accordion.Trigger>B</Accordion.Trigger>
                    <Accordion.Panel>Content B</Accordion.Panel>
                </Accordion.Item>
            </Accordion.Root>,
            container,
        );
        const items = container.querySelectorAll<HTMLDetailsElement>('details');
        expect(panels()[0]!.style.getPropertyValue('--accordion-panel-height')).toBe('120px');
        expect(panels()[0]!.style.getPropertyValue('--accordion-panel-width')).toBe('300px');
        const exit = fakeAnimation(150);
        animations = [exit];
        triggers()[1]!.click();
        expect(state.open).toEqual(['b']);
        expect(items[1]!.open).toBe(true);
        expect(items[0]!.getAttribute('data-state')).toBe('closed');
        expect(items[0]!.open).toBe(true);
        vi.advanceTimersByTime(16);
        await flush();
        exit.end();
        await flush();
        expect(items[0]!.open).toBe(false);
        expect(items[1]!.open).toBe(true);
    });
});
