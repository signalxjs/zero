import { component, signal } from 'sigx';
import { Tabs } from '@sigx/zero';
import { activeVocabulary } from '../design-systems';
import { AxisLabel, DemoRow } from '../demo/Section';
import type { PageEntry } from './registry';

/**
 * Until the playground grew real pages, Tabs had no demo of its own — the
 * component WAS the navigation chrome. This is that chrome, kept as a demo:
 * three reachable panels plus a disabled tab, which is the state the old
 * shell existed to show.
 */
const TabsDemos = component(() => {
    const state = signal({ tab: 'overview' });

    return () => (
        <Tabs.Root model={() => state.tab}>
            <Tabs.List>
                <Tabs.Tab value="overview">Overview</Tabs.Tab>
                <Tabs.Tab value="details">Details</Tabs.Tab>
                <Tabs.Tab value="history">History</Tabs.Tab>
                <Tabs.Tab value="disabled" disabled>Disabled</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="overview">
                <p>
                    One roving tab stop, arrow keys move the active tab, and{' '}
                    <code>activationMode</code> decides whether focus selects.
                </p>
            </Tabs.Panel>
            <Tabs.Panel value="details">
                <p>Each panel is labelled by its tab and hidden with the platform's own <code>hidden</code>.</p>
            </Tabs.Panel>
            <Tabs.Panel value="history">
                <p>Hello.</p>
            </Tabs.Panel>
            <Tabs.Panel value="disabled">
                <p>Unreachable.</p>
            </Tabs.Panel>
        </Tabs.Root>
    );
}, { name: 'TabsDemos' });

/**
 * One compact tab list per `variant` the live design system wires on the
 * `tabs` scope (#377: zero-daisyui wires daisy's `border | lift | box`;
 * other design systems wire none, and the row is absent). The list is the
 * manifest's, not a retyped literal — the same rule the select page follows
 * for its scope. Tab labels carry the flavor name rather than the main
 * demo's Overview/Details set, so `demoLabelled('tabs', 'Overview')` in the
 * interaction specs keeps resolving to exactly one instance.
 */
const TabsFlavors = component(() => {
    const flavors = () => activeVocabulary().perScope['tabs']?.variants ?? [];

    return () => (
        <>
            {flavors().map((variant) => (
                <DemoRow>
                    <AxisLabel>{variant}</AxisLabel>
                    <Tabs.Root variant={variant} defaultValue="one">
                        <Tabs.List>
                            <Tabs.Tab value="one">{`${variant} one`}</Tabs.Tab>
                            <Tabs.Tab value="two">{`${variant} two`}</Tabs.Tab>
                        </Tabs.List>
                        <Tabs.Panel value="one"><p>{`The ${variant} flavor.`}</p></Tabs.Panel>
                        <Tabs.Panel value="two"><p>Second panel.</p></Tabs.Panel>
                    </Tabs.Root>
                </DemoRow>
            ))}
        </>
    );
}, { name: 'TabsFlavors' });

const TabsPage = component(() => () => (
    <>
        <TabsDemos />
        <TabsFlavors />
    </>
), { name: 'TabsPage' });

export const tabsPage: PageEntry = {
    id: 'tabs',
    title: 'Tabs',
    category: 'Navigation & structure',
    Demos: TabsPage,
};
