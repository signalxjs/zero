import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { component, signal } from 'sigx';
import { Popover, popoverAnatomy } from '@sigx/zero';
import type { PartProps, PositionOptions, PositionStrategy } from '@sigx/zero';
import { expectAnatomy } from './helpers';

/** Presence flags land one microtask after the render pass; settle them. */
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('Popover', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    function mount(state: { open: boolean }) {
        render(
            <Popover.Root model={[state, 'open']}>
                <Popover.Trigger>Filters</Popover.Trigger>
                <Popover.Popup>
                    <Popover.Title>Filters</Popover.Title>
                    <Popover.Close>Done</Popover.Close>
                </Popover.Popup>
            </Popover.Root>,
            container,
        );
    }

    it('renders a valid anatomy with the popover attribute', () => {
        mount(signal({ open: false }));
        expectAnatomy(container, popoverAnatomy);
        const popup = container.querySelector<HTMLElement>('[data-part="popup"]')!;
        expect(popup.getAttribute('popover')).toBe('auto');
        expect(popup.getAttribute('role')).toBe('dialog');
    });

    it('passes the variant axes through on the trigger (the carrier part)', () => {
        mountWithAxes();
        const trigger = container.querySelector<HTMLElement>('[data-scope="popover"][data-part="trigger"]')!;
        expect(trigger.getAttribute('data-color')).toBe('primary');
        expect(trigger.getAttribute('data-size')).toBe('sm');
    });

    function mountWithAxes() {
        render(
            <Popover.Root>
                <Popover.Trigger color="primary" size="sm">Filters</Popover.Trigger>
                <Popover.Popup>
                    <Popover.Title>Filters</Popover.Title>
                    <Popover.Close>Done</Popover.Close>
                </Popover.Popup>
            </Popover.Root>,
            container,
        );
    }

    it('trigger toggles, close closes, aria wiring holds', async () => {
        const state = signal({ open: false });
        mount(state);
        await tick();
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        const popup = container.querySelector<HTMLElement>('[data-part="popup"]')!;
        expect(trigger.getAttribute('aria-controls')).toBe(popup.id);
        expect(popup.getAttribute('aria-labelledby')).toBe(container.querySelector('[data-part="title"]')!.id);

        trigger.click();
        expect(state.open).toBe(true);
        expect(trigger.getAttribute('aria-expanded')).toBe('true');
        expect(popup.getAttribute('data-state')).toBe('open');

        trigger.click();
        expect(state.open).toBe(false);

        trigger.click();
        container.querySelector<HTMLElement>('[data-part="close"]')!.click();
        expect(state.open).toBe(false);
    });

    it('omits aria-labelledby when no Title is rendered', async () => {
        render(
            <Popover.Root>
                <Popover.Trigger>Filters</Popover.Trigger>
                <Popover.Popup>
                    <Popover.Close>Done</Popover.Close>
                </Popover.Popup>
            </Popover.Root>,
            container,
        );
        await tick();
        const popup = container.querySelector<HTMLElement>('[data-part="popup"]')!;
        expect(popup.hasAttribute('aria-labelledby')).toBe(false);
    });

    it('publishes press feedback on the trigger and the close button', () => {
        mount(signal({ open: true }));
        for (const part of ['trigger', 'close'] as const) {
            const el = container.querySelector<HTMLElement>(`[data-part="${part}"]`)!;
            el.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
            expect(el.hasAttribute('data-pressed')).toBe(true);
            el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
            expect(el.hasAttribute('data-pressed')).toBe(false);
        }
    });

    it('publishes no press feedback on a disabled trigger', () => {
        render(
            <Popover.Root model={[signal({ open: false }), 'open']}>
                <Popover.Trigger disabled>Filters</Popover.Trigger>
            </Popover.Root>,
            container,
        );
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        trigger.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
        expect(trigger.hasAttribute('data-pressed')).toBe(false);
    });

    it('moves focus to the first tabbable in the popup on open, restores on close', async () => {
        const state = signal({ open: false });
        mount(state);
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        trigger.focus();
        trigger.click();
        await tick();
        // Title is a heading; the close button is the first tabbable.
        expect(document.activeElement).toBe(container.querySelector('[data-part="close"]'));
        state.open = false;
        await tick();
        expect(document.activeElement).toBe(trigger);
    });

    it('with nothing tabbable inside, the popup itself takes focus', async () => {
        const state = signal({ open: false });
        render(
            <Popover.Root model={[state, 'open']}>
                <Popover.Trigger>Filters</Popover.Trigger>
                <Popover.Popup>
                    <Popover.Title>Filters</Popover.Title>
                </Popover.Popup>
            </Popover.Root>,
            container,
        );
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        trigger.focus();
        trigger.click();
        await tick();
        expect(document.activeElement).toBe(container.querySelector('[data-part="popup"]'));
    });

    it('native toggle events (light dismiss) sync into the model', () => {
        const state = signal({ open: true });
        mount(state);
        const popup = container.querySelector<HTMLElement>('[data-part="popup"]')!;
        const e = new Event('toggle');
        (e as unknown as { newState: string }).newState = 'closed';
        popup.dispatchEvent(e);
        expect(state.open).toBe(false);
    });
    it('forwards collisionPadding and alignOffset to the position strategy (defaults 8 and 0)', async () => {
        const seen: PositionOptions[] = [];
        const spy: PositionStrategy = { apply: (_a, _f, opts) => { seen.push(opts); return () => {}; } };
        const a = signal({ open: false });
        const b = signal({ open: false });
        render(
            <div>
                <Popover.Root model={[a, 'open']} positionStrategy={spy}>
                    <Popover.Trigger>Defaults</Popover.Trigger>
                    <Popover.Popup>…</Popover.Popup>
                </Popover.Root>
                <Popover.Root model={[b, 'open']} positionStrategy={spy} collisionPadding={16} alignOffset={-4}>
                    <Popover.Trigger>Set</Popover.Trigger>
                    <Popover.Popup>…</Popover.Popup>
                </Popover.Root>
            </div>,
            container,
        );
        await tick();
        a.open = true;
        await tick();
        b.open = true;
        await tick();
        expect(seen.map((o) => [o.collisionPadding, o.alignOffset])).toEqual([[8, 0], [16, -4]]);
    });

    it('renders a valid anatomy with the arrow, description and anchor parts', async () => {
        render(
            <Popover.Root defaultOpen>
                <Popover.Anchor>Field</Popover.Anchor>
                <Popover.Trigger>Filters</Popover.Trigger>
                <Popover.Popup>
                    <Popover.Arrow />
                    <Popover.Title>Filters</Popover.Title>
                    <Popover.Description>Narrow the list.</Popover.Description>
                </Popover.Popup>
            </Popover.Root>,
            container,
        );
        await tick();
        expectAnatomy(container, popoverAnatomy);
        const arrow = container.querySelector<HTMLElement>('[data-part="arrow"]')!;
        expect(arrow.tagName).toBe('SPAN');
        expect(arrow.getAttribute('aria-hidden')).toBe('true');
        expect(container.querySelector('[data-part="description"]')!.tagName).toBe('P');
    });

    it('describes the popup by the Description only while it is rendered', async () => {
        const shown = signal({ description: true });
        const App = component(() => () => (
            <Popover.Root defaultOpen>
                <Popover.Trigger>Filters</Popover.Trigger>
                <Popover.Popup aria-describedby="app-hint">
                    <Popover.Title>Filters</Popover.Title>
                    {shown.description ? <Popover.Description>Narrow the list.</Popover.Description> : null}
                </Popover.Popup>
            </Popover.Root>
        ));
        render(<App />, container);
        await tick();
        const popup = container.querySelector<HTMLElement>('[data-part="popup"]')!;
        const description = container.querySelector<HTMLElement>('[data-part="description"]')!;
        expect(popup.getAttribute('aria-describedby')).toBe(`${description.id} app-hint`);
        shown.description = false;
        await tick();
        expect(container.querySelector('[data-part="description"]')).toBeNull();
        expect(popup.getAttribute('aria-describedby')).toBe('app-hint');
    });

    it('drops the Title reference when the Title unmounts', async () => {
        const shown = signal({ title: true });
        const App = component(() => () => (
            <Popover.Root defaultOpen>
                <Popover.Trigger>Filters</Popover.Trigger>
                <Popover.Popup>
                    {shown.title ? <Popover.Title>Filters</Popover.Title> : null}
                </Popover.Popup>
            </Popover.Root>
        ));
        render(<App />, container);
        await tick();
        const popup = container.querySelector<HTMLElement>('[data-part="popup"]')!;
        expect(popup.getAttribute('aria-labelledby')).toBe(container.querySelector('[data-part="title"]')!.id);
        shown.title = false;
        await tick();
        expect(popup.hasAttribute('aria-labelledby')).toBe(false);
    });

    it('omits aria-describedby when no Description is rendered', async () => {
        mount(signal({ open: true }));
        await tick();
        expect(container.querySelector('[data-part="popup"]')!.hasAttribute('aria-describedby')).toBe(false);
    });

    it('positions against a rendered Anchor, and against the trigger once it is gone', async () => {
        const anchors: Element[] = [];
        const spy: PositionStrategy = { apply: (anchor) => { anchors.push(anchor as Element); return () => {}; } };
        const state = signal({ open: false, anchor: true });
        const App = component(() => () => (
            <Popover.Root model={[state, 'open']} positionStrategy={spy}>
                {state.anchor ? <Popover.Anchor>Field</Popover.Anchor> : null}
                <Popover.Trigger>Filters</Popover.Trigger>
                <Popover.Popup>…</Popover.Popup>
            </Popover.Root>
        ));
        render(<App />, container);
        await tick();
        state.open = true;
        await tick();
        expect(anchors.at(-1)).toBe(container.querySelector('[data-part="anchor"]'));
        state.open = false;
        state.anchor = false;
        await tick();
        state.open = true;
        await tick();
        expect(anchors.at(-1)).toBe(container.querySelector('[data-part="trigger"]'));
    });

    it('with an Anchor, the trigger still toggles and still gets focus back', async () => {
        const state = signal({ open: false });
        render(
            <Popover.Root model={[state, 'open']}>
                <Popover.Anchor>Field</Popover.Anchor>
                <Popover.Trigger>Filters</Popover.Trigger>
                <Popover.Popup>
                    <Popover.Close>Done</Popover.Close>
                </Popover.Popup>
            </Popover.Root>,
            container,
        );
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        trigger.focus();
        trigger.click();
        expect(state.open).toBe(true);
        await tick();
        expect(document.activeElement).toBe(container.querySelector('[data-part="close"]'));
        state.open = false;
        await tick();
        expect(document.activeElement).toBe(trigger);
    });

    it('renders an asChild Anchor as the app element', async () => {
        render(
            <Popover.Root>
                <Popover.Anchor asChild>{(p: PartProps) => <label {...p}>Field</label>}</Popover.Anchor>
                <Popover.Trigger>Filters</Popover.Trigger>
                <Popover.Popup>…</Popover.Popup>
            </Popover.Root>,
            container,
        );
        await tick();
        const anchor = container.querySelector<HTMLElement>('[data-part="anchor"]')!;
        expect(anchor.tagName).toBe('LABEL');
        expect(anchor.getAttribute('data-scope')).toBe('popover');
    });

    it('hands the strategy its Arrow and arrowPadding (default 8)', async () => {
        const seen: PositionOptions[] = [];
        const spy: PositionStrategy = { apply: (_a, _f, opts) => { seen.push(opts); return () => {}; } };
        const a = signal({ open: false });
        const b = signal({ open: false });
        render(
            <div>
                <Popover.Root model={[a, 'open']} positionStrategy={spy}>
                    <Popover.Trigger>Arrowless</Popover.Trigger>
                    <Popover.Popup>…</Popover.Popup>
                </Popover.Root>
                <Popover.Root model={[b, 'open']} positionStrategy={spy} arrowPadding={12}>
                    <Popover.Trigger>Arrowed</Popover.Trigger>
                    <Popover.Popup><Popover.Arrow />…</Popover.Popup>
                </Popover.Root>
            </div>,
            container,
        );
        await tick();
        a.open = true;
        await tick();
        b.open = true;
        await tick();
        expect(seen.map((o) => o.arrowPadding)).toEqual([8, 12]);
        expect(seen[0]!.getArrow?.()).toBeNull();
        expect(seen[1]!.getArrow?.()).toBe(container.querySelector('[data-part="arrow"]'));
    });

    it('re-applies the strategy when an Anchor or Arrow mounts or unmounts while open', async () => {
        const calls: Array<{ anchor: Element; arrow: HTMLElement | null }> = [];
        const spy: PositionStrategy = {
            apply: (anchor, _f, opts) => {
                calls.push({ anchor: anchor as Element, arrow: opts.getArrow?.() ?? null });
                return () => {};
            },
        };
        const state = signal({ open: false, anchor: false, arrow: false });
        const App = component(() => () => (
            <Popover.Root model={[state, 'open']} positionStrategy={spy}>
                {state.anchor ? <Popover.Anchor>Field</Popover.Anchor> : null}
                <Popover.Trigger>Filters</Popover.Trigger>
                <Popover.Popup>{state.arrow ? <Popover.Arrow /> : null}…</Popover.Popup>
            </Popover.Root>
        ));
        render(<App />, container);
        await tick();
        state.open = true;
        await tick();
        const trigger = container.querySelector('[data-part="trigger"]');
        expect(calls.at(-1)!.anchor).toBe(trigger);

        state.anchor = true;
        await tick();
        expect(calls.at(-1)!.anchor).toBe(container.querySelector('[data-part="anchor"]'));

        state.arrow = true;
        await tick();
        expect(calls.at(-1)!.arrow).toBe(container.querySelector('[data-part="arrow"]'));

        // The anchor unmounting hands the popup back to the trigger at once,
        // rather than leaving the strategy measuring a detached element.
        state.anchor = false;
        await tick();
        expect(calls.at(-1)!.anchor).toBe(trigger);

        // Closed, a part change positions nothing.
        state.open = false;
        await tick();
        const settled = calls.length;
        state.anchor = true;
        await tick();
        expect(calls.length).toBe(settled);
    });
});
