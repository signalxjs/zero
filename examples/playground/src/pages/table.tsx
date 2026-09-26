import { component } from 'sigx';
import { Table } from '@sigx/zero';
import { pickMod, pickRole } from '../design-systems';
import type { PageEntry } from './registry';

/** The mods bag for one preferred-name chain, or nothing if the DS offers none. */
const mod = (...names: string[]): Record<string, boolean> | undefined => {
    const found = pickMod(...names);
    return found ? { [found]: true } : undefined;
};

const TableDemos = component(() => () => (
    <>
        <p>
            Semantic data table over the real table elements — the root is the
            scroll container (a <code>&lt;table&gt;</code> cannot be its own
            overflow box), so wide content scrolls inside the component instead
            of the page. No states; a row can carry <code>data-selected</code>.
        </p>
        <Table.Root>
            <Table.Caption>Quarterly revenue</Table.Caption>
            <Table.Head>
                <Table.Row>
                    <Table.HeaderCell>Quarter</Table.HeaderCell>
                    <Table.HeaderCell>Revenue</Table.HeaderCell>
                    <Table.HeaderCell>Change</Table.HeaderCell>
                </Table.Row>
            </Table.Head>
            <Table.Body>
                <Table.Row>
                    <Table.Cell>Q1</Table.Cell>
                    <Table.Cell>$12,930</Table.Cell>
                    <Table.Cell>+8%</Table.Cell>
                </Table.Row>
                <Table.Row selected>
                    <Table.Cell>Q2</Table.Cell>
                    <Table.Cell>$14,102</Table.Cell>
                    <Table.Cell>+9%</Table.Cell>
                </Table.Row>
                <Table.Row>
                    <Table.Cell>Q3</Table.Cell>
                    <Table.Cell>$13,551</Table.Cell>
                    <Table.Cell>−4%</Table.Cell>
                </Table.Row>
            </Table.Body>
            <Table.Foot>
                <Table.Row>
                    <Table.Cell>Total</Table.Cell>
                    <Table.Cell>$40,583</Table.Cell>
                    <Table.Cell />
                </Table.Row>
            </Table.Foot>
        </Table.Root>
        <p>
            A column spec on <code>Table.Root</code> — label, width, alignment.
            <code>&lt;Table.Head /&gt;</code> renders the header row from the
            labels and the widths as a <code>&lt;colgroup&gt;</code>; a cell
            that names its <code>column</code> takes the alignment:
        </p>
        <Table.Root columns={[
            { label: 'Time', width: '8rem' },
            { label: 'What happened' },
            { key: 'cost', label: 'Cost', width: '6rem', align: 'end' },
        ]}>
            <Table.Caption>Activity (column spec)</Table.Caption>
            <Table.Head />
            <Table.Body>
                <Table.Row>
                    <Table.Cell column={0}>09:12</Table.Cell>
                    <Table.Cell column={1}>Deployed api-gateway 2.14.0</Table.Cell>
                    <Table.Cell column="cost">$0.42</Table.Cell>
                </Table.Row>
                <Table.Row>
                    <Table.Cell column={0}>09:40</Table.Cell>
                    <Table.Cell column={1}>Rolled back search</Table.Cell>
                    <Table.Cell column="cost">$12.08</Table.Cell>
                </Table.Row>
                <Table.Row>
                    <Table.Cell colSpan={3}>No more activity today</Table.Cell>
                </Table.Row>
            </Table.Body>
        </Table.Root>
        <p>
            Stacked below a breakpoint: <code>stack="md"</code> turns every row
            into a card under the design system's <code>md</code>, and each cell
            that names a labelled <code>column</code> prints the label beside its
            value. The head row stays in the accessibility tree, visually hidden.
            Narrow the window to see it:
        </p>
        <Table.Root stack="md" columns={[
            { label: 'Service', width: '10rem' },
            { label: 'What happened' },
            { key: 'cost', label: 'Cost', width: '6rem', align: 'end' },
        ]}>
            <Table.Caption>Deploys (stacked below md)</Table.Caption>
            <Table.Head />
            <Table.Body>
                <Table.Row>
                    <Table.Cell column={0}>api-gateway</Table.Cell>
                    <Table.Cell column={1}>Deployed <code>2.14.0</code> to eu-north after a green canary</Table.Cell>
                    <Table.Cell column="cost">$0.42</Table.Cell>
                </Table.Row>
                <Table.Row selected>
                    <Table.Cell column={0}>search</Table.Cell>
                    <Table.Cell column={1}>Rolled back to <code>0.41.0</code></Table.Cell>
                    <Table.Cell column="cost">$12.08</Table.Cell>
                </Table.Row>
                <Table.Row>
                    <Table.Cell column={0}>billing</Table.Cell>
                    <Table.Cell column={1}>Scaled to 4 replicas</Table.Cell>
                    <Table.Cell column="cost">$3.10</Table.Cell>
                </Table.Row>
            </Table.Body>
        </Table.Root>
        <p>
            Zebra striping and hover-highlight are design-system mods
            (<code>data-mod-*</code>), spelled in each skin's own vocabulary —
            zebra here rides whichever name the live design system declares:
        </p>
        <Table.Root size="sm" color={pickRole('primary')} mods={mod('zebra', 'striped')}>
            <Table.Caption>Deployments (zebra, small)</Table.Caption>
            <Table.Head>
                <Table.Row>
                    <Table.HeaderCell>Service</Table.HeaderCell>
                    <Table.HeaderCell>Version</Table.HeaderCell>
                    <Table.HeaderCell>Status</Table.HeaderCell>
                </Table.Row>
            </Table.Head>
            <Table.Body>
                <Table.Row>
                    <Table.Cell>api-gateway</Table.Cell>
                    <Table.Cell>2.14.0</Table.Cell>
                    <Table.Cell>healthy</Table.Cell>
                </Table.Row>
                <Table.Row>
                    <Table.Cell>billing</Table.Cell>
                    <Table.Cell>1.9.3</Table.Cell>
                    <Table.Cell>healthy</Table.Cell>
                </Table.Row>
                <Table.Row>
                    <Table.Cell>search</Table.Cell>
                    <Table.Cell>0.41.1</Table.Cell>
                    <Table.Cell>degraded</Table.Cell>
                </Table.Row>
                <Table.Row>
                    <Table.Cell>notifications</Table.Cell>
                    <Table.Cell>3.2.7</Table.Cell>
                    <Table.Cell>healthy</Table.Cell>
                </Table.Row>
            </Table.Body>
        </Table.Root>
        <p>
            Hover-highlight, where the design system offers it — and enough
            columns to prove the root scrolls. The root is a keyboard stop
            named by the caption: Tab to it and the arrow keys scroll it.
        </p>
        <div style="max-width: 24rem">
            <Table.Root mods={mod('hover')}>
                <Table.Caption>Regions (hover, constrained width)</Table.Caption>
                <Table.Head>
                    <Table.Row>
                        <Table.HeaderCell>Region</Table.HeaderCell>
                        <Table.HeaderCell>Zone</Table.HeaderCell>
                        <Table.HeaderCell>Instances</Table.HeaderCell>
                        <Table.HeaderCell>CPU</Table.HeaderCell>
                        <Table.HeaderCell>Memory</Table.HeaderCell>
                        <Table.HeaderCell>Latency</Table.HeaderCell>
                    </Table.Row>
                </Table.Head>
                <Table.Body>
                    <Table.Row>
                        <Table.Cell>eu-north</Table.Cell>
                        <Table.Cell>a</Table.Cell>
                        <Table.Cell>12</Table.Cell>
                        <Table.Cell>41%</Table.Cell>
                        <Table.Cell>63%</Table.Cell>
                        <Table.Cell>12 ms</Table.Cell>
                    </Table.Row>
                    <Table.Row>
                        <Table.Cell>us-east</Table.Cell>
                        <Table.Cell>c</Table.Cell>
                        <Table.Cell>31</Table.Cell>
                        <Table.Cell>58%</Table.Cell>
                        <Table.Cell>71%</Table.Cell>
                        <Table.Cell>87 ms</Table.Cell>
                    </Table.Row>
                </Table.Body>
            </Table.Root>
        </div>
    </>
), { name: 'TableDemos' });

export const tablePage: PageEntry = {
    id: 'table',
    title: 'Table',
    category: 'Display & feedback',
    Demos: TableDemos,
};
