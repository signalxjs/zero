/**
 * Drawer (#339) — the edge panel on the native <dialog>, Dialog's patterns
 * inherited deliberately (presence-tracked labelling, model-driven
 * showModal/show, cancel routed through the model). What is Drawer's OWN:
 * `data-placement="start|end"` on the panel (the logical pair — an edge
 * panel anchors to the reading direction, not to the glass), the `label`
 * prop (a navigation drawer often has no visible title), and the inline
 * non-modal mode. The real-browser half (scrim geometry, Escape via
 * cancel, focus restore) lives in e2e/drawer.spec.ts.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { signal } from 'sigx';
import { Drawer, drawerAnatomy } from '@sigx/zero';
import { expectAnatomy } from './helpers';

/** Presence flags land one microtask after the render pass; settle them. */
const tick = () => new Promise((r) => setTimeout(r, 0));

const part = (c: HTMLElement, name: string) =>
    c.querySelector<HTMLElement>(`[data-scope="drawer"][data-part="${name}"]`)!;

function mount(container: HTMLElement, state: { open: boolean }, extra: { placement?: 'start' | 'end' } = {}) {
    render(
        <Drawer.Root model={[state, 'open']} placement={extra.placement}>
            <Drawer.Trigger>Menu</Drawer.Trigger>
            <Drawer.Panel>
                <Drawer.Title>Navigation</Drawer.Title>
                <Drawer.Close>Close</Drawer.Close>
            </Drawer.Panel>
        </Drawer.Root>,
        container,
    );
}

describe('Drawer', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('renders a valid anatomy on a native dialog element', () => {
        mount(container, signal({ open: false }));
        expectAnatomy(container, drawerAnatomy);
        expect(part(container, 'panel').tagName).toBe('DIALOG');
        // The backdrop projects onto ::backdrop — no element of its own.
        expect(container.querySelector('[data-part="backdrop"]')).toBeNull();
    });

    it('stamps the logical placement on the panel, start by default', () => {
        mount(container, signal({ open: false }));
        expect(part(container, 'panel').getAttribute('data-placement')).toBe('start');

        const end = document.createElement('div');
        document.body.appendChild(end);
        mount(end, signal({ open: false }), { placement: 'end' });
        expect(part(end, 'panel').getAttribute('data-placement')).toBe('end');
        expectAnatomy(end, drawerAnatomy);
    });

    it('trigger opens, close closes, state stays in the model', () => {
        const state = signal({ open: false });
        mount(container, state);
        const trigger = part(container, 'trigger');
        expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
        expect(trigger.getAttribute('aria-expanded')).toBe('false');

        trigger.click();
        expect(state.open).toBe(true);
        expect(trigger.getAttribute('data-state')).toBe('open');
        expect(part(container, 'panel').getAttribute('data-state')).toBe('open');

        part(container, 'close').click();
        expect(state.open).toBe(false);
        expect(trigger.getAttribute('data-state')).toBe('closed');
    });

    it('labels the panel from a rendered title, presence-tracked', async () => {
        mount(container, signal({ open: false }));
        await tick();
        const panel = part(container, 'panel');
        expect(panel.getAttribute('aria-labelledby')).toBe(part(container, 'title').id);
        expect(panel.hasAttribute('aria-label')).toBe(false);
    });

    it('falls back to the label prop when no title renders — never a dangling ref', async () => {
        render(
            <Drawer.Root label="Site navigation">
                <Drawer.Trigger>Menu</Drawer.Trigger>
                <Drawer.Panel>
                    <Drawer.Close>Close</Drawer.Close>
                </Drawer.Panel>
            </Drawer.Root>,
            container,
        );
        await tick();
        const panel = part(container, 'panel');
        expect(panel.hasAttribute('aria-labelledby')).toBe(false);
        expect(panel.getAttribute('aria-label')).toBe('Site navigation');
        expectAnatomy(container, drawerAnatomy);
    });

    it('SSR-shape: renders closed, no open attribute, content present', () => {
        mount(container, signal({ open: false }));
        const panel = part(container, 'panel');
        expect(panel.getAttribute('data-state')).toBe('closed');
        expect(panel.hasAttribute('open')).toBe(false);
        expect(panel.textContent).toContain('Navigation');
    });

    it('non-modal inline mode: cancel-free, Escape still dismisses through the behavior', () => {
        const state = signal({ open: true });
        render(
            <Drawer.Root model={[state, 'open']} modal={false}>
                <Drawer.Trigger>Menu</Drawer.Trigger>
                <Drawer.Panel>
                    <Drawer.Title>Filters</Drawer.Title>
                </Drawer.Panel>
            </Drawer.Root>,
            container,
        );
        // No dismiss trap: an outside click leaves an inline drawer open —
        // it is furniture, not a popup.
        document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(state.open).toBe(true);
        // Escape still closes it (the find-bar convention), through the
        // dismissable behavior since a non-modal <dialog> fires no cancel.
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(state.open).toBe(false);
    });

    it('passes the variant axes through on the trigger (the carrier part)', () => {
        render(
            <Drawer.Root>
                <Drawer.Trigger color="primary" size="sm">Menu</Drawer.Trigger>
            </Drawer.Root>,
            container,
        );
        const trigger = part(container, 'trigger');
        expect(trigger.getAttribute('data-color')).toBe('primary');
        expect(trigger.getAttribute('data-size')).toBe('sm');
    });
});
