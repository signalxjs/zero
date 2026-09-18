import { component } from 'sigx';
import { Status } from '@sigx/zero';
import { DemoRow } from '../demo/Section';
import { pickRole } from '../design-systems';
import type { PageEntry } from './registry';

const StatusDemos = component(() => () => (
    <>
        <p>
            A presence dot with <em>no states</em> on purpose: online, busy
            and degraded are colours of the same resting render — the{' '}
            <code>color</code> axis — not a machine lifecycle. Next to visible
            text the dot is <code>aria-hidden</code>; standing alone it takes
            a <code>label</code> and announces as <code>role="img"</code>.
        </p>
        <DemoRow align="center">
            <span><Status color={pickRole('success')} /> Online</span>
            <span><Status color={pickRole('warning')} /> Away</span>
            <span><Status color={pickRole('error', 'danger')} /> Do not disturb</span>
            <span><Status /> Unknown</span>
        </DemoRow>
        <DemoRow align="center">
            <Status size="sm" label="Small status" />
            <Status label="Medium status" />
            <Status size="lg" label="Large status" />
        </DemoRow>
    </>
), { name: 'StatusDemos' });

export const statusPage: PageEntry = {
    id: 'status',
    title: 'Status',
    category: 'Display & feedback',
    Demos: StatusDemos,
};
