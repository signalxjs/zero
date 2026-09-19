import { component } from 'sigx';
import { Drawer } from '@sigx/zero';
import type { DrawerCloseDetail } from '@sigx/zero';
import type { PageEntry } from './registry';

const DrawerDemos = component(({ signal }) => {
    // What the responsive drawer REPORTED — the e2e reads it to prove a
    // regime switch says nothing (#82).
    const reported = signal({ openChange: 0, close: 0 });
    return () => (
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
            <p>
                <code>measure</code> sizes the panel from the design system's{' '}
                <code>--measure-*</code> ramp: a modal sheet spans the viewport up
                to it, so <code>full</code> is the whole viewport.
            </p>
            <Drawer.Root placement="end">
                <Drawer.Trigger>Open wide drawer</Drawer.Trigger>
                <Drawer.Panel measure="md">
                    <Drawer.Title>Wide inspector</Drawer.Title>
                    <Drawer.Close>Close wide drawer</Drawer.Close>
                </Drawer.Panel>
            </Drawer.Root>
            <Drawer.Root>
                <Drawer.Trigger>Open full-screen drawer</Drawer.Trigger>
                <Drawer.Panel measure="full">
                    <Drawer.Title>Full-screen sheet</Drawer.Title>
                    <Drawer.Close>Close full-screen drawer</Drawer.Close>
                </Drawer.Panel>
            </Drawer.Root>
            <p>
                A shell's drawer whose visible heading is a brand row: the title
                stays the panel's accessible name, out of sight
                (<code>Drawer.Title visuallyHidden</code>).
            </p>
            <Drawer.Root>
                <Drawer.Trigger>Open app menu</Drawer.Trigger>
                <Drawer.Panel measure="xs">
                    <Drawer.Title visuallyHidden>App menu</Drawer.Title>
                    <p><strong>Acme</strong> workspace</p>
                    <Drawer.Close>Close app menu</Drawer.Close>
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
            <p>
                Responsive — <code>modal={'{{ below: \'md\' }}'}</code>: docked
                open inline at or above the design system's <code>md</code>, a
                modal sheet below it. The model governs the sheet only, and
                crossing the breakpoint reports nothing. The breakpoint is read
                once, so after a design-system switch reload to re-read it.
            </p>
            <div class="demo-dock">
                <Drawer.Root
                    modal={{ below: 'md' }}
                    onOpenChange={() => { reported.openChange++; }}
                    onClose={(_: DrawerCloseDetail) => { reported.close++; }}
                >
                    <Drawer.Trigger>Open workspace menu</Drawer.Trigger>
                    <Drawer.Panel measure="xs">
                        <Drawer.Title>Workspace</Drawer.Title>
                        <nav aria-label="Workspace">
                            <p>
                                Go to the <a href="#/drawer">inbox</a> or the{' '}
                                <a href="#/drawer">archive</a>.
                            </p>
                        </nav>
                        <Drawer.Close>Close workspace menu</Drawer.Close>
                    </Drawer.Panel>
                </Drawer.Root>
                <p>
                    The page's own content, beside the docked panel.{' '}
                    <output aria-label="Workspace drawer reports">
                        openChange ×{reported.openChange}, close ×{reported.close}
                    </output>
                </p>
            </div>
        </>
    );
}, { name: 'DrawerDemos' });

export const drawerPage: PageEntry = {
    id: 'drawer',
    title: 'Drawer',
    category: 'Overlays',
    Demos: DrawerDemos,
};
