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
        <p>Hover-highlight, where the design system offers it — and enough columns to prove the root scrolls:</p>
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
