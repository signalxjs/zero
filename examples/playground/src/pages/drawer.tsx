import { component } from 'sigx';
import { Drawer } from '@sigx/zero';
import type { PageEntry } from './registry';

const DrawerDemos = component(() => () => (
    <>
        <p>
            The edge panel on the native <code>&lt;dialog&gt;</code> — Dialog's
            machinery (top layer, scrim, Escape via <code>cancel</code>, native
            focus restore) with the edge as its own contract:{' '}
            <code>data-placement="start|end"</code> from the logical pair, so
            RTL mirrors free. <code>modal={'{false}'}</code> is the inline
            mode: in flow, no dismiss trap, Escape still closes.
        </p>
        <Drawer.Root>
            <Drawer.Trigger>Open drawer</Drawer.Trigger>
            <Drawer.Panel>
                <Drawer.Title>Navigation</Drawer.Title>
                <nav aria-label="Drawer demo">
                    {/* Inline links in a sentence — a lone block anchor would
                        fail the axe target-size floor (24px), and a drawer's
                        nav is the consumer's own layout anyway. */}
                    <p>
                        Jump to the <a href="#/drawer">dashboard</a> or your{' '}
                        <a href="#/drawer">settings</a>.
                    </p>
                </nav>
                <Drawer.Close>Close drawer</Drawer.Close>
            </Drawer.Panel>
        </Drawer.Root>
        <p>From the far edge:</p>
        <Drawer.Root placement="end">
            <Drawer.Trigger>Open end drawer</Drawer.Trigger>
            <Drawer.Panel>
                <Drawer.Title>Details</Drawer.Title>
                <p>An inspector panel sits at the reading end.</p>
                <Drawer.Close>Close details</Drawer.Close>
            </Drawer.Panel>
        </Drawer.Root>
        <p>Inline (non-modal) — furniture, not a popup:</p>
        <Drawer.Root modal={false} label="Filters">
            <Drawer.Trigger>Open filters</Drawer.Trigger>
            <Drawer.Panel>
                <Drawer.Title>Filters</Drawer.Title>
                <p>Outside clicks are a non-event; Escape closes.</p>
                <Drawer.Close>Close filters</Drawer.Close>
            </Drawer.Panel>
        </Drawer.Root>
    </>
), { name: 'DrawerDemos' });

export const drawerPage: PageEntry = {
    id: 'drawer',
    title: 'Drawer',
    category: 'Overlays',
    Demos: DrawerDemos,
};
