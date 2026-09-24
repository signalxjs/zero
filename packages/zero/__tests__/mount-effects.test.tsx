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
 * the surviving state must run none of them. Where nothing the effect reads
 * outlives the part (Checkbox), the test invokes each runner directly
 * instead: a stopped runner is a no-op, a leaked one runs.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@sigx/runtime-dom';
import { component, signal } from 'sigx';
import type { EffectFn, EffectOptions } from 'sigx';
import { Checkbox, Dialog, Drawer, Menu, Popover, Select, Toast, Tooltip, createToaster, syncPopover } from '@sigx/zero';

type Rec = { n: number; runner?: () => void };
const probe = vi.hoisted(() => ({ tracking: false, runs: [] as Rec[] }));

vi.mock('sigx', async (importOriginal) => {
    const actual = await importOriginal<typeof import('sigx')>();
    return {
        ...actual,
        effect: (fn: EffectFn, options?: EffectOptions) => {
            if (!probe.tracking) return actual.effect(fn, options);
            const rec: Rec = { n: 0 };
            probe.runs.push(rec);
            const runner = actual.effect(() => { rec.n++; fn(); }, options);
            rec.runner = runner;
            return runner;
        },
    };
});

const tick = () => new Promise<void>((r) => setTimeout(r, 10));

/** Effects created while `mount` runs; resets their run counts. */
async function track(mount: () => void): Promise<Rec[]> {
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

const totalRuns = (recs: Rec[]): number => recs.reduce((s, r) => s + r.n, 0);

/** Invokes every tracked runner; a stopped one does not run its effect. */
function poke(recs: Rec[]): void {
    for (const rec of recs) rec.runner?.();
}

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
    // The third column is the part the popup renders, so the test can prove
    // it really unmounted.
    const popups: [string, (state: { open: boolean }, show: { on: boolean }) => unknown, string?][] = [
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
        // Select.Popup reaches syncPopover through the listbox root's open model.
        ['Select.Popup', (state, show) => (
            <Select.Root model:open={[state, 'open']}>
                <Select.Trigger><Select.Value /></Select.Trigger>
                {show.on ? <Select.Popup><Select.Item value="a">A</Select.Item></Select.Popup> : null}
            </Select.Root>
        )],
        // Drawer.Panel syncs its own dialog (modal or docked) to the open model.
        ['Drawer.Panel', (state, show) => (
            <Drawer.Root model={[state, 'open']}>
                <Drawer.Trigger>Menu</Drawer.Trigger>
                {show.on ? <Drawer.Panel><Drawer.Title>Navigation</Drawer.Title></Drawer.Panel> : null}
            </Drawer.Root>
        ), 'panel'],
    ];
    for (const [name, view, part = 'popup'] of popups) {
        it(`${name} under a surviving root`, async () => {
            const state = signal({ open: false });
            const show = signal({ on: false });
            const App = component(() => () => <div>{view(state, show)}</div>);
            render(<App />, container);

            const recs = await track(() => { show.on = true; });
            expect(recs.length).toBeGreaterThan(0);
            show.on = false;
            await tick();
            expect(container.querySelector(`[data-part="${part}"]`)).toBeNull();
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

    it('Checkbox: its mount effect is stopped on unmount', async () => {
        // The mount effect reads only `props.indeterminate`, and an unmounted
        // part's props are never written again — no outside write can reach
        // a leaked effect. So the test invokes the runner itself: a stopped
        // runner is a no-op, a leaked one re-runs its dead closure.
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
        poke(recs);
        await tick();
        expect(totalRuns(recs)).toBe(0);
    });
});
