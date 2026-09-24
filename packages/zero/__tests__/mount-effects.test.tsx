/**
 * #163 — an `effect()` created inside `onMounted` must die with its
 * component.
 *
 * sigx collects only the effects a component creates *during setup*; a
 * mount hook runs with no collection scope active, so an effect created
 * there is never stopped. It stays subscribed to whatever state outlives
 * the part — the root's model, the toaster — and re-runs a dead closure on
 * every write.
 *
 * The probe wraps `sigx`'s `effect` so every effect created while a part
 * mounts is counted each time it runs. After the part unmounts, writes to
 * the surviving state must run none of them.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { component, signal } from 'sigx';
import type { EffectFn, EffectOptions } from 'sigx';
import { Checkbox, Dialog, Menu, Popover, Toast, Tooltip, createToaster, syncPopover } from '@sigx/zero';

const probe = vi.hoisted(() => ({ tracking: false, runs: [] as { n: number }[] }));

vi.mock('sigx', async (importOriginal) => {
    const actual = await importOriginal<typeof import('sigx')>();
    return {
        ...actual,
        effect: (fn: EffectFn, options?: EffectOptions) => {
            if (!probe.tracking) return actual.effect(fn, options);
            const rec = { n: 0 };
            probe.runs.push(rec);
            return actual.effect(() => { rec.n++; fn(); }, options);
        },
    };
});

const tick = () => new Promise<void>((r) => setTimeout(r, 10));

/** Effects created while `mount` runs; resets their run counts. */
async function track(mount: () => void): Promise<{ n: number }[]> {
    probe.runs = [];
    probe.tracking = true;
    try {
        mount();
        await tick();
    } finally {
        probe.tracking = false;
    }
    const created = probe.runs;
    for (const rec of created) rec.n = 0;
    return created;
}

const totalRuns = (recs: { n: number }[]): number => recs.reduce((s, r) => s + r.n, 0);

describe('effects created in onMounted stop on unmount (#163)', () => {
    let container: HTMLElement;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(() => {
        container.remove();
        probe.tracking = false;
        probe.runs = [];
    });

    it('a plain component: setup and mount-hook effects both stop', async () => {
        // The helper the components use: a scope created during setup is
        // owned by the component, and effects run inside it from a mount
        // hook are owned by that scope.
        const { mountScope } = await import('@sigx/zero');
        const ext = signal({ n: 0 });
        const show = signal({ on: false });
        const C = component(({ onMounted }) => {
            const scoped = mountScope();
            onMounted(() => scoped(() => {
                syncPopover(() => null, () => ext.n > 0);
            }));
            return () => <span>x</span>;
        });
        const App = component(() => () => <div>{show.on ? <C /> : null}</div>);
        render(<App />, container);

        const recs = await track(() => { show.on = true; });
        expect(recs.length).toBeGreaterThan(0);
        show.on = false;
        await tick();
        expect(container.querySelector('span')).toBeNull();
        ext.n++;
        ext.n++;
        await tick();
        expect(totalRuns(recs)).toBe(0);
    });

    it('syncPopover returns a stopper', async () => {
        const open = signal({ on: false });
        const recs = await track(() => {
            const stop = syncPopover(() => null, () => open.on);
            expect(typeof stop).toBe('function');
            stop();
        });
        open.on = true;
        await tick();
        expect(totalRuns(recs)).toBe(0);
    });

    it('Tooltip.Popup under a surviving root', async () => {
        const state = signal({ open: false });
        const show = signal({ on: false });
        const App = component(() => () => (
            <Tooltip.Root model={[state, 'open']}>
                <Tooltip.Trigger>Save</Tooltip.Trigger>
                {show.on ? <Tooltip.Popup>Save the document</Tooltip.Popup> : null}
            </Tooltip.Root>
        ));
        render(<App />, container);

        const recs = await track(() => { show.on = true; });
        expect(recs.length).toBeGreaterThan(0);
        show.on = false;
        await tick();
        expect(container.querySelector('[data-part="popup"]')).toBeNull();
        state.open = true;
        await tick();
        state.open = false;
        await tick();
        expect(totalRuns(recs)).toBe(0);
    });

    // The other popups that sync a native surface to the root's open model.
    const popups: [string, (state: { open: boolean }, show: { on: boolean }) => unknown][] = [
        ['Popover.Popup', (state, show) => (
            <Popover.Root model={[state, 'open']}>
                <Popover.Trigger>Open</Popover.Trigger>
                {show.on ? <Popover.Popup>Body</Popover.Popup> : null}
            </Popover.Root>
        )],
        ['Dialog.Popup', (state, show) => (
            <Dialog.Root model={[state, 'open']}>
                <Dialog.Trigger>Open</Dialog.Trigger>
                {show.on ? <Dialog.Popup><Dialog.Title>Title</Dialog.Title></Dialog.Popup> : null}
            </Dialog.Root>
        )],
        ['Menu.Popup', (state, show) => (
            <Menu.Root model={[state, 'open']}>
                <Menu.Trigger>Actions</Menu.Trigger>
                {show.on ? <Menu.Popup><Menu.Item value="a">A</Menu.Item></Menu.Popup> : null}
            </Menu.Root>
        )],
    ];
    for (const [name, view] of popups) {
        it(`${name} under a surviving root`, async () => {
            const state = signal({ open: false });
            const show = signal({ on: false });
            const App = component(() => () => <div>{view(state, show)}</div>);
            render(<App />, container);

            const recs = await track(() => { show.on = true; });
            expect(recs.length).toBeGreaterThan(0);
            show.on = false;
            await tick();
            expect(container.querySelector('[data-part="popup"]')).toBeNull();
            state.open = true;
            await tick();
            state.open = false;
            await tick();
            expect(totalRuns(recs)).toBe(0);
        });
    }

    it('Toast.Viewport (and its toasts) against a surviving toaster', async () => {
        const t = createToaster({ duration: Infinity });
        t.create({ title: 'Saved' });
        const show = signal({ on: false });
        const App = component(() => () => (
            <div>
                {show.on
                    ? (
                        <Toast.Viewport toaster={t}>
                            {(toast) => <Toast.Root toast={toast}><Toast.Title /></Toast.Root>}
                        </Toast.Viewport>
                    )
                    : null}
            </div>
        ));
        render(<App />, container);

        const recs = await track(() => { show.on = true; });
        expect(recs.length).toBeGreaterThan(0);
        show.on = false;
        await tick();
        expect(container.querySelector('[data-part="viewport"]')).toBeNull();
        t.toasts()[0]!.open = !t.toasts()[0]!.open;
        t.create({ title: 'Again' });
        await tick();
        expect(totalRuns(recs)).toBe(0);
    });

    it('Checkbox under a surviving root', async () => {
        const flag = signal({ indeterminate: false });
        const show = signal({ on: false });
        const App = component(() => () => (
            <div>{show.on ? <Checkbox.Root indeterminate={flag.indeterminate}>Accept</Checkbox.Root> : null}</div>
        ));
        render(<App />, container);

        const recs = await track(() => { show.on = true; });
        expect(recs.length).toBeGreaterThan(0);
        show.on = false;
        await tick();
        expect(container.querySelector('[data-scope="checkbox"]')).toBeNull();
        flag.indeterminate = true;
        await tick();
        expect(totalRuns(recs)).toBe(0);
    });
});
