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
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { signal } from 'sigx';
import { Drawer, clearThemes, drawerAnatomy, registerThemes } from '@sigx/zero';
import type { DrawerCloseDetail } from '@sigx/zero';
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

    it('non-modal and open on first render: open in markup, then show()/close() own it', async () => {
        const state = signal({ open: true });
        render(
            <Drawer.Root model={[state, 'open']} modal={false} label="Nav">
                <Drawer.Trigger>Menu</Drawer.Trigger>
                <Drawer.Panel>Links</Drawer.Panel>
            </Drawer.Root>,
            container,
        );
        const panel = part(container, 'panel') as HTMLDialogElement;
        expect(panel.hasAttribute('open')).toBe(true);

        // Later flips go through show()/close() — the render never re-writes
        // `open`, so it cannot close the element behind the model's back.
        state.open = false;
        await tick();
        expect(panel.open).toBe(false);
        state.open = true;
        await tick();
        expect(panel.open).toBe(true);
        state.open = false;
        await tick();
        expect(panel.open).toBe(false);
    });

    it('measure stamps the declared layout attribute on the panel, and only when set (#51)', () => {
        render(
            <Drawer.Root>
                <Drawer.Panel measure="md"><Drawer.Title>Wide</Drawer.Title></Drawer.Panel>
            </Drawer.Root>,
            container,
        );
        expect(part(container, 'panel').getAttribute('data-l-measure')).toBe('md');
        expectAnatomy(container, drawerAnatomy);

        const plain = document.createElement('div');
        document.body.appendChild(plain);
        mount(plain, signal({ open: false }));
        expect(part(plain, 'panel').hasAttribute('data-l-measure')).toBe(false);
    });

    it('stamps the regime on the panel — sheet or inline — and it holds through a close (#83)', async () => {
        const state = signal({ open: true });
        mount(container, state);
        await tick();
        const panel = part(container, 'panel');
        expect(panel.getAttribute('data-l-dock')).toBe('sheet');
        // `:modal` stops matching at close(); the regime does not.
        state.open = false;
        await tick();
        expect(panel.getAttribute('data-l-dock')).toBe('sheet');
        expectAnatomy(container, drawerAnatomy);

        const inline = document.createElement('div');
        document.body.appendChild(inline);
        render(
            <Drawer.Root modal={false} label="Filters"><Drawer.Panel>Links</Drawer.Panel></Drawer.Root>,
            inline,
        );
        expect(part(inline, 'panel').getAttribute('data-l-dock')).toBe('inline');
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

describe('Drawer close reason (#52) — Dialog\'s contract, minus cancel', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    function mountRecorded(state: { open: boolean }, opts: { modal?: boolean } = {}) {
        const log: Array<[string, unknown]> = [];
        render(
            <Drawer.Root
                model={[state, 'open']}
                modal={opts.modal}
                onOpenChange={(open: boolean) => log.push(['openChange', open])}
                onClose={(detail: DrawerCloseDetail) => log.push(['close', detail])}
            >
                <Drawer.Panel>
                    <Drawer.Title>Navigation</Drawer.Title>
                    <Drawer.Close value="done">Close</Drawer.Close>
                </Drawer.Panel>
            </Drawer.Root>,
            container,
        );
        return log;
    }

    it('Drawer.Close reports `close` with its value, after openChange(false)', () => {
        const state = signal({ open: true });
        const log = mountRecorded(state);
        part(container, 'close').click();
        expect(log).toEqual([['openChange', false], ['close', { reason: 'close', value: 'done' }]]);
    });

    it('Escape, the scrim and a model write report `escape`, `backdrop`, `programmatic`', async () => {
        const state = signal({ open: true });
        const log = mountRecorded(state);
        const panel = part(container, 'panel') as HTMLDialogElement;
        panel.getBoundingClientRect = () =>
            ({ left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

        panel.dispatchEvent(new Event('cancel', { cancelable: true }));
        state.open = true;
        panel.dispatchEvent(new MouseEvent('click', { clientX: 300, clientY: 50, detail: 1, bubbles: true }));
        state.open = true;
        state.open = false;
        expect(log.filter(([name]) => name === 'close')).toEqual([
            ['close', { reason: 'escape' }],
            ['close', { reason: 'backdrop' }],
            ['close', { reason: 'programmatic' }],
        ]);
    });

    it('inline mode: the dismiss layer\'s Escape reports `escape`', async () => {
        const state = signal({ open: true });
        const log = mountRecorded(state, { modal: false });
        await tick();
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        expect(log).toEqual([['openChange', false], ['close', { reason: 'escape' }]]);
    });

    it('a native close zero did not start carries the returnValue; a requested close is reported once', () => {
        const state = signal({ open: true });
        const log = mountRecorded(state);
        const panel = part(container, 'panel') as HTMLDialogElement;
        // A real native close: `open` is gone before the event arrives (one
        // for a panel open again is stale, and ignored).
        panel.close('save');
        expect(log).toEqual([['openChange', false], ['close', { reason: 'programmatic', value: 'save' }]]);

        state.open = true;
        part(container, 'close').click();
        panel.dispatchEvent(new Event('close'));
        expect(log.filter(([name]) => name === 'close')).toHaveLength(2);
    });

    it('a controlled parent that refuses the close gets no close event', () => {
        const log: DrawerCloseDetail[] = [];
        render(
            <Drawer.Root
                model={[{ get open() { return true; }, set open(_v: boolean) {} }, 'open']}
                onClose={(detail: DrawerCloseDetail) => log.push(detail)}
            >
                <Drawer.Panel>
                    <Drawer.Close>Close</Drawer.Close>
                </Drawer.Panel>
            </Drawer.Root>,
            container,
        );
        part(container, 'close').click();
        expect(log).toEqual([]);
    });

    it('forwards `value` to the rendered button, as <form method="dialog"> would read it', () => {
        mountRecorded(signal({ open: true }));
        expect(part(container, 'close').getAttribute('value')).toBe('done');
    });
});

describe('Drawer responsive regime (#82) — modal={{ below }}', () => {
    type Listener = (e: { matches: boolean }) => void;
    const original = window.matchMedia;
    let container: HTMLElement;
    let queries: string[];
    let fire: (matches: boolean) => void;

    /** One shared fake list for `{ above: 'md' }`; `fire` crosses the breakpoint. */
    function viewport(wide: boolean) {
        const listeners = new Set<Listener>();
        const list = {
            matches: wide,
            addEventListener: (_: string, fn: Listener) => { listeners.add(fn); },
            removeEventListener: (_: string, fn: Listener) => { listeners.delete(fn); },
        };
        queries = [];
        window.matchMedia = ((q: string) => {
            queries.push(q);
            return list as unknown as MediaQueryList;
        }) as typeof window.matchMedia;
        fire = (matches) => {
            list.matches = matches;
            for (const fn of listeners) fn({ matches });
        };
    }

    beforeEach(() => {
        clearThemes();
        registerThemes({ themes: {}, breakpoints: { sm: '640px', md: '768px' } });
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(() => {
        window.matchMedia = original;
        clearThemes();
    });

    function mountResponsive(state: { open: boolean }) {
        const log: Array<[string, unknown]> = [];
        render(
            <Drawer.Root
                model={[state, 'open']}
                modal={{ below: 'md' }}
                onOpenChange={(open: boolean) => log.push(['openChange', open])}
                onClose={(detail: DrawerCloseDetail) => log.push(['close', detail])}
            >
                <Drawer.Trigger>Menu</Drawer.Trigger>
                <Drawer.Panel>
                    <Drawer.Title>Navigation</Drawer.Title>
                    <a href="#x">Link</a>
                    <Drawer.Close>Close</Drawer.Close>
                </Drawer.Panel>
            </Drawer.Root>,
            container,
        );
        return log;
    }

    it('stamps the breakpoint on trigger, panel and close, declared in the anatomy', async () => {
        viewport(true);
        mountResponsive(signal({ open: false }));
        await tick();
        for (const name of ['trigger', 'panel', 'close']) {
            expect(part(container, name).getAttribute('data-l-md-dock')).toBe('inline');
        }
        expectAnatomy(container, drawerAnatomy);
        // The same boundary the compiled CSS and useMediaQuery use.
        expect(queries).toEqual(['(min-width: 768px)']);
    });

    it('wide: docked open whatever the model says, and the model is ignored', async () => {
        viewport(true);
        const state = signal({ open: false });
        const log = mountResponsive(state);
        await tick();
        const panel = part(container, 'panel') as HTMLDialogElement;
        const trigger = part(container, 'trigger');
        expect(panel.open).toBe(true);
        expect(panel.getAttribute('data-state')).toBe('open');
        expect(trigger.getAttribute('data-state')).toBe('closed');
        expect(trigger.getAttribute('aria-expanded')).toBe('false');

        // Nothing to close while docked: Close, Escape and a model write all
        // leave the panel where it is.
        part(container, 'close').click();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        state.open = true;
        await tick();
        state.open = false;
        await tick();
        expect(panel.open).toBe(true);
        expect(log.filter(([name]) => name === 'close')).toEqual([]);
    });

    it('narrow on mount: the server\'s docked markup closes silently, and the model drives a sheet', async () => {
        viewport(false);
        const state = signal({ open: false });
        const log = mountResponsive(state);
        await tick();
        const panel = part(container, 'panel') as HTMLDialogElement;
        expect(panel.open).toBe(false);
        expect(panel.getAttribute('data-state')).toBe('closed');
        expect(log).toEqual([]);

        part(container, 'trigger').click();
        await tick();
        expect(panel.open).toBe(true);
        expect(part(container, 'trigger').getAttribute('data-state')).toBe('open');
        part(container, 'close').click();
        await tick();
        expect(panel.open).toBe(false);
        expect(log).toEqual([
            ['openChange', true],
            ['openChange', false],
            ['close', { reason: 'close' }],
        ]);
    });

    it('widening with the sheet up docks it silently: no openChange, no close, the model reset', async () => {
        viewport(false);
        const state = signal({ open: true });
        const log = mountResponsive(state);
        await tick();
        const panel = part(container, 'panel') as HTMLDialogElement;
        expect(panel.open).toBe(true);

        expect(panel.getAttribute('data-l-dock')).toBe('sheet');

        fire(true);
        await tick();
        expect(state.open).toBe(false);
        expect(panel.open).toBe(true);
        expect(panel.getAttribute('data-state')).toBe('open');
        // Docked is the inline regime (#83).
        expect(panel.getAttribute('data-l-dock')).toBe('inline');
        expect(log).toEqual([]);

        // …and narrowing again does not bring the sheet back.
        fire(false);
        await tick();
        expect(panel.open).toBe(false);
        expect(log).toEqual([]);
    });

    it('narrowing moves focus from the docked panel to the trigger, silently', async () => {
        viewport(true);
        const state = signal({ open: false });
        const log = mountResponsive(state);
        await tick();
        const link = container.querySelector<HTMLElement>('a[href="#x"]')!;
        link.focus();
        expect(document.activeElement).toBe(link);

        fire(false);
        await tick();
        expect((part(container, 'panel') as HTMLDialogElement).open).toBe(false);
        expect(document.activeElement).toBe(part(container, 'trigger'));
        expect(log).toEqual([]);
    });

    it('a model write made while docked takes effect when the sheet regime returns', async () => {
        viewport(true);
        const state = signal({ open: false });
        mountResponsive(state);
        await tick();
        state.open = true;
        await tick();
        fire(false);
        await tick();
        const panel = part(container, 'panel') as HTMLDialogElement;
        expect(panel.open).toBe(true);
        expect(panel.getAttribute('data-state')).toBe('open');
    });

    it('an undeclared breakpoint throws at setup rather than never matching', () => {
        viewport(true);
        expect(() => render(
            <Drawer.Root modal={{ below: 'xl' as 'md' }}>
                <Drawer.Panel>Links</Drawer.Panel>
            </Drawer.Root>,
            container,
        )).toThrow(/breakpoint "xl" is not declared/);
    });
});
