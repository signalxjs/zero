import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { component, signal } from 'sigx';
import { Button, Card, Collapsible, Tooltip, buttonAnatomy, cardAnatomy, collapsibleAnatomy } from '@sigx/zero';
import { expectAnatomy, supportUntilFound } from './helpers';

const frame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()));

describe('Collapsible', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    function mount(state: { open: boolean }) {
        render(
            <Collapsible.Root model={[state, 'open']}>
                <Collapsible.Trigger>Toggle</Collapsible.Trigger>
                <Collapsible.Panel>Content</Collapsible.Panel>
            </Collapsible.Root>,
            container,
        );
    }

    it('renders a valid anatomy on a native details element', () => {
        mount(signal({ open: false }));
        expectAnatomy(container, collapsibleAnatomy);
        expect(container.querySelector('details')).not.toBeNull();
        expect(container.querySelector('summary')?.getAttribute('data-part')).toBe('trigger');
    });

    it('passes the variant axes through on the root', () => {
        render(
            <Collapsible.Root defaultOpen color="primary" size="lg">
                <Collapsible.Trigger>Toggle</Collapsible.Trigger>
                <Collapsible.Panel>Content</Collapsible.Panel>
            </Collapsible.Root>,
            container,
        );
        const root = container.querySelector<HTMLElement>('[data-scope="collapsible"][data-part="root"]')!;
        expect(root.getAttribute('data-color')).toBe('primary');
        expect(root.getAttribute('data-size')).toBe('lg');
        expectAnatomy(container, collapsibleAnatomy);
    });

    it('clicking the trigger toggles state and model', () => {
        const state = signal({ open: false });
        mount(state);
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        expect(trigger.getAttribute('data-state')).toBe('closed');
        trigger.click();
        expect(state.open).toBe(true);
        expect(trigger.getAttribute('data-state')).toBe('open');
        expect(container.querySelector('[data-part="root"]')!.hasAttribute('open')).toBe(true);
        trigger.click();
        expect(state.open).toBe(false);
    });

    it('model writes flow into the DOM', () => {
        const state = signal({ open: false });
        mount(state);
        state.open = true;
        expect(container.querySelector('[data-part="panel"]')!.getAttribute('data-state')).toBe('open');
    });

    // #166: find-in-page and fragment navigation open a closed <details> by
    // themselves, then fire `toggle`. The model has to follow, or the parts
    // announce "closed" over an open panel and the next click only resyncs.
    it('a native toggle (find-in-page auto-expand) syncs back into the model', async () => {
        const state = signal({ open: false });
        mount(state);
        const details = container.querySelector<HTMLDetailsElement>('details')!;
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        details.open = true;
        details.dispatchEvent(new Event('toggle'));
        await Promise.resolve();
        expect(state.open).toBe(true);
        expect(details.getAttribute('data-state')).toBe('open');
        expect(trigger.getAttribute('data-state')).toBe('open');
        expect(trigger.getAttribute('aria-expanded')).toBe('true');
        expect(container.querySelector('[data-part="panel"]')!.getAttribute('data-state')).toBe('open');
        // One press closes it — no silent resync click first.
        trigger.click();
        expect(state.open).toBe(false);
        // The native close waits a frame for the panel's exit animation (#276).
        await frame();
        expect(details.open).toBe(false);
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });

    it('a native toggle on a disabled root is reverted, not adopted', async () => {
        render(
            <Collapsible.Root disabled>
                <Collapsible.Trigger>Toggle</Collapsible.Trigger>
                <Collapsible.Panel>Content</Collapsible.Panel>
            </Collapsible.Root>,
            container,
        );
        const details = container.querySelector<HTMLDetailsElement>('details')!;
        details.open = true;
        details.dispatchEvent(new Event('toggle'));
        await Promise.resolve();
        expect(details.open).toBe(false);
        expect(details.getAttribute('data-state')).toBe('closed');
    });

    it('publishes press feedback on the trigger, by pointer and by Enter', () => {
        mount(signal({ open: false }));
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        trigger.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
        expect(trigger.hasAttribute('data-pressed')).toBe(true);
        trigger.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        expect(trigger.hasAttribute('data-pressed')).toBe(false);

        trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        expect(trigger.hasAttribute('data-pressed')).toBe(true);
        trigger.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
        expect(trigger.hasAttribute('data-pressed')).toBe(false);
    });

    it('publishes no press feedback while the root is disabled', () => {
        render(
            <Collapsible.Root disabled>
                <Collapsible.Trigger>Toggle</Collapsible.Trigger>
                <Collapsible.Panel>Content</Collapsible.Panel>
            </Collapsible.Root>,
            container,
        );
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        trigger.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
        expect(trigger.hasAttribute('data-pressed')).toBe(false);
    });

    it('wires explicit disclosure semantics: aria-expanded + aria-controls', () => {
        const state = signal({ open: false });
        mount(state);
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        const panel = container.querySelector<HTMLElement>('[data-part="panel"]')!;
        // Native <summary> conveys expansion in most ATs, but explicit
        // wiring covers the rest and keeps the contract inspectable.
        expect(panel.id).not.toBe('');
        expect(trigger.getAttribute('aria-controls')).toBe(panel.id);
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
        state.open = true;
        expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });

    it('a disabled root announces aria-disabled on the trigger', () => {
        render(
            <Collapsible.Root disabled>
                <Collapsible.Trigger>Toggle</Collapsible.Trigger>
                <Collapsible.Panel>Content</Collapsible.Panel>
            </Collapsible.Root>,
            container,
        );
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        // <summary> has no disabled attribute — without aria-disabled the
        // inert trigger announces as an ordinary interactive one.
        expect(trigger.getAttribute('aria-disabled')).toBe('true');

        const other = document.createElement('div');
        document.body.appendChild(other);
        render(
            <Collapsible.Root>
                <Collapsible.Trigger>Toggle</Collapsible.Trigger>
                <Collapsible.Panel>Content</Collapsible.Panel>
            </Collapsible.Root>,
            other,
        );
        expect(other.querySelector<HTMLElement>('[data-part="trigger"]')!.hasAttribute('aria-disabled')).toBe(false);
    });

    it('disabled root blocks toggling', () => {
        render(
            <Collapsible.Root disabled>
                <Collapsible.Trigger>Toggle</Collapsible.Trigger>
                <Collapsible.Panel>Content</Collapsible.Panel>
            </Collapsible.Root>,
            container,
        );
        const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')!;
        trigger.click();
        expect(trigger.getAttribute('data-state')).toBe('closed');
        expect(trigger.getAttribute('data-disabled')).toBe('');
    });
});

// #453: `native={false}` — a div root, a button trigger that can sit
// anywhere inside it (asChild, lend), an until-found panel.
describe('Collapsible native={false}', () => {
    let container: HTMLElement;
    beforeEach(() => {
        supportUntilFound();
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(() => container.remove());

    const part = (name: string) => container.querySelector<HTMLElement>(`[data-scope="collapsible"][data-part="${name}"]`)!;

    function mount(state: { open: boolean }, props: { disabled?: boolean } = {}) {
        render(
            <Collapsible.Root native={false} model={[state, 'open']} disabled={props.disabled}>
                <Collapsible.Trigger>Toggle</Collapsible.Trigger>
                <Collapsible.Panel>Content</Collapsible.Panel>
            </Collapsible.Root>,
            container,
        );
    }

    it('renders a div root, a disclosure button and an until-found panel', () => {
        const state = signal({ open: false });
        mount(state);
        expect(container.querySelector('details, summary')).toBeNull();
        expect(part('root').tagName).toBe('DIV');
        const trigger = part('trigger');
        const panel = part('panel');
        expect(trigger.tagName).toBe('BUTTON');
        expect(trigger.getAttribute('type')).toBe('button');
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
        expect(trigger.getAttribute('aria-controls')).toBe(panel.id);
        expect(panel.getAttribute('aria-labelledby')).toBe(trigger.id);
        expect(panel.getAttribute('hidden')).toBe('until-found');
        expectAnatomy(container, collapsibleAnatomy);

        state.open = true;
        expect(trigger.getAttribute('aria-expanded')).toBe('true');
        expect(panel.hasAttribute('hidden')).toBe(false);
        expect(part('root').getAttribute('data-state')).toBe('open');
        expectAnatomy(container, collapsibleAnatomy);
    });

    it('a trigger nested inside Card.Header toggles by click, Enter and Space', () => {
        const state = signal({ open: false });
        render(
            <Collapsible.Root native={false} model={[state, 'open']}>
                <Card.Root>
                    <Card.Header>
                        <Card.Title>Message</Card.Title>
                        <Collapsible.Trigger>Expand</Collapsible.Trigger>
                    </Card.Header>
                    <Collapsible.Panel><Card.Body>Body</Card.Body></Collapsible.Panel>
                </Card.Root>
            </Collapsible.Root>,
            container,
        );
        expectAnatomy(container, collapsibleAnatomy);
        expectAnatomy(container, cardAnatomy);
        const trigger = part('trigger');
        expect(trigger.closest('[data-scope="card"][data-part="header"]')).not.toBeNull();
        trigger.click();
        expect(state.open).toBe(true);
        // A native <button> clicks itself from Enter and Space; ours must not
        // add a second toggle on top.
        trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        expect(state.open).toBe(true);
        trigger.click();
        expect(state.open).toBe(false);
    });

    it('asChild on a non-button element toggles by Enter and Space itself', () => {
        const state = signal({ open: false });
        render(
            <Collapsible.Root native={false} model={[state, 'open']}>
                <Collapsible.Trigger asChild>
                    {(p) => <span role="button" tabIndex={0} {...p}>Expand</span>}
                </Collapsible.Trigger>
                <Collapsible.Panel>Body</Collapsible.Panel>
            </Collapsible.Root>,
            container,
        );
        const trigger = part('trigger');
        expect(trigger.tagName).toBe('SPAN');
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
        expect(trigger.getAttribute('aria-controls')).toBe(part('panel').id);
        const key = (k: string, repeat = false) => {
            const e = new KeyboardEvent('keydown', { key: k, repeat, bubbles: true, cancelable: true });
            trigger.dispatchEvent(e);
            return e;
        };
        expect(key('Enter').defaultPrevented).toBe(true);
        expect(state.open).toBe(true);
        key(' ');
        expect(state.open).toBe(false);
        // A held key flips once per press, not per repeat.
        key(' ', true);
        expect(state.open).toBe(false);
        trigger.click();
        expect(state.open).toBe(true);
        expectAnatomy(container, collapsibleAnatomy);
    });

    it('a disabled root refuses every activation; an asChild trigger says so with aria-disabled', () => {
        const state = signal({ open: false });
        render(
            <Collapsible.Root native={false} model={[state, 'open']} disabled>
                <Collapsible.Trigger asChild>
                    {(p) => <span role="button" tabIndex={0} {...p}>Expand</span>}
                </Collapsible.Trigger>
                <Collapsible.Panel>Body</Collapsible.Panel>
            </Collapsible.Root>,
            container,
        );
        const trigger = part('trigger');
        expect(trigger.getAttribute('aria-disabled')).toBe('true');
        trigger.click();
        trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        expect(state.open).toBe(false);

        const other = document.createElement('div');
        document.body.appendChild(other);
        render(
            <Collapsible.Root native={false} disabled>
                <Collapsible.Trigger>Toggle</Collapsible.Trigger>
                <Collapsible.Panel>Content</Collapsible.Panel>
            </Collapsible.Root>,
            other,
        );
        const button = other.querySelector<HTMLButtonElement>('button')!;
        expect(button.disabled).toBe(true);
        expect(button.hasAttribute('aria-disabled')).toBe(false);
        other.remove();
    });

    // Find-in-page / a text fragment: `beforematch` fires on the until-found
    // panel, then the platform removes the attribute itself.
    it('beforematch on the panel opens it through the model', () => {
        const state = signal({ open: false });
        const changes: boolean[] = [];
        render(
            <Collapsible.Root native={false} model={[state, 'open']} onOpenChange={(v: boolean) => changes.push(v)}>
                <Collapsible.Trigger>Toggle</Collapsible.Trigger>
                <Collapsible.Panel>Content</Collapsible.Panel>
            </Collapsible.Root>,
            container,
        );
        part('panel').dispatchEvent(new Event('beforematch', { bubbles: true }));
        expect(state.open).toBe(true);
        expect(changes).toEqual([true]);
        expect(part('trigger').getAttribute('aria-expanded')).toBe('true');
        expect(part('panel').hasAttribute('hidden')).toBe(false);
    });

    it('a disabled root refuses beforematch and hides the panel again', () => {
        vi.useFakeTimers();
        try {
            const state = signal({ open: false });
            mount(state, { disabled: true });
            const panel = part('panel');
            panel.dispatchEvent(new Event('beforematch', { bubbles: true }));
            // What the platform does next.
            panel.removeAttribute('hidden');
            expect(state.open).toBe(false);
            vi.runAllTimers();
            expect(panel.getAttribute('hidden')).toBe('until-found');
        } finally {
            vi.useRealTimers();
        }
    });

    it('defaultOpen seeds it and openChange reports each toggle', () => {
        const changes: boolean[] = [];
        render(
            <Collapsible.Root native={false} defaultOpen onOpenChange={(v: boolean) => changes.push(v)}>
                <Collapsible.Trigger>Toggle</Collapsible.Trigger>
                <Collapsible.Panel>Content</Collapsible.Panel>
            </Collapsible.Root>,
            container,
        );
        expect(part('panel').hasAttribute('hidden')).toBe(false);
        part('trigger').click();
        part('trigger').click();
        expect(changes).toEqual([false, true]);
    });

    it('asChild renders the child with the bag', () => {
        render(
            <Collapsible.Root native={false}>
                <Collapsible.Trigger asChild>
                    {(p) => <a href="#more" {...p}>More</a>}
                </Collapsible.Trigger>
                <Collapsible.Panel>Content</Collapsible.Panel>
            </Collapsible.Root>,
            container,
        );
        const trigger = part('trigger');
        expect(trigger.tagName).toBe('A');
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
        expect(trigger.getAttribute('data-state')).toBe('closed');
        expect(container.querySelectorAll('button')).toHaveLength(0);
    });

    it('chains: Tooltip.Trigger → Collapsible.Trigger → Button.Root renders one button', () => {
        const model = signal({ tip: false, open: false });
        const App = component(() => () => (
            <Collapsible.Root native={false} model={[model, 'open']}>
                <Card.Root>
                    <Card.Header>
                        <Tooltip.Root model={[model, 'tip']}>
                            <Tooltip.Trigger asChild>
                                {(t) => (
                                    <Collapsible.Trigger asChild lend={t}>
                                        {(c) => <Button.Root lend={c} aria-label="Expand message" aria-describedby="hint">v</Button.Root>}
                                    </Collapsible.Trigger>
                                )}
                            </Tooltip.Trigger>
                            <Tooltip.Popup>Expand message</Tooltip.Popup>
                        </Tooltip.Root>
                        <span id="hint">Shift-click expands all</span>
                    </Card.Header>
                    <Collapsible.Panel><Card.Body>Body</Card.Body></Collapsible.Panel>
                </Card.Root>
            </Collapsible.Root>
        ));
        render(<App />, container);
        const buttons = container.querySelectorAll<HTMLElement>('button');
        expect(buttons).toHaveLength(1);
        const el = buttons[0];
        // The host keeps its own anatomy; the lenders render no part.
        expect(el.getAttribute('data-scope')).toBe('button');
        expect(el.getAttribute('data-part')).toBe('root');
        expect(container.querySelector('[data-scope="collapsible"][data-part="trigger"]')).toBeNull();
        expect(container.querySelector('[data-scope="tooltip"][data-part="trigger"]')).toBeNull();
        expectAnatomy(container, buttonAnatomy);
        const panel = part('panel');
        expect(el.getAttribute('aria-expanded')).toBe('false');
        expect(el.getAttribute('aria-controls')).toBe(panel.id);
        expect(panel.getAttribute('aria-labelledby')).toBe(el.id);

        el.focus();
        expect(model.tip).toBe(true);
        const tip = container.querySelector<HTMLElement>('[role="tooltip"]')!;
        expect(el.getAttribute('aria-describedby')?.split(' ')).toEqual([tip.id, 'hint']);

        el.click();
        expect(model.open).toBe(true);
        expect(el.getAttribute('aria-expanded')).toBe('true');
        expect(panel.hasAttribute('hidden')).toBe(false);
        el.click();
        expect(model.open).toBe(false);
    });

    it('asChild or lend on a native trigger throws, naming native={false}', () => {
        expect(() => render(
            <Collapsible.Root>
                <Collapsible.Trigger asChild>{(p) => <button {...p}>x</button>}</Collapsible.Trigger>
            </Collapsible.Root>,
            document.createElement('div'),
        )).toThrow(/native=\{false\}/);
        const lend = { 'data-scope': 'tooltip', 'data-part': 'trigger' };
        expect(() => render(
            <Collapsible.Root>
                <Collapsible.Trigger lend={lend}>x</Collapsible.Trigger>
            </Collapsible.Root>,
            document.createElement('div'),
        )).toThrow(/native=\{false\}/);
    });
});
