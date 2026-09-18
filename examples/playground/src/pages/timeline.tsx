import { component } from 'sigx';
import { Timeline } from '@sigx/zero';
import { pickRole } from '../design-systems';
import type { PageEntry } from './registry';

const TimelineDemos = component(() => () => (
    <>
        <p>
            An ordered sequence of events on a real <code>&lt;ul&gt;</code>/
            <code>&lt;li&gt;</code> list — assistive tech announces and walks
            it. The marker and connector are <code>aria-hidden</code>{' '}
            decoration; each content box declares its side of the axis as{' '}
            <code>data-placement="start|end"</code> from the logical pair, so
            alternating layouts are per-item markup and RTL mirrors free.
        </p>
        <Timeline.Root color={pickRole('primary')}>
            <Timeline.Item>
                <Timeline.Marker />
                <Timeline.Content>First commit</Timeline.Content>
                <Timeline.Connector />
            </Timeline.Item>
            <Timeline.Item>
                <Timeline.Marker />
                <Timeline.Content placement="start">v1.0 shipped</Timeline.Content>
                <Timeline.Connector />
            </Timeline.Item>
            <Timeline.Item>
                <Timeline.Marker />
                <Timeline.Content>The design-system rewrite</Timeline.Content>
            </Timeline.Item>
        </Timeline.Root>
        <p>Horizontal — the process strip:</p>
        <Timeline.Root orientation="horizontal">
            <Timeline.Item>
                <Timeline.Marker />
                <Timeline.Content placement="start">Ordered</Timeline.Content>
                <Timeline.Connector />
            </Timeline.Item>
            <Timeline.Item>
                <Timeline.Marker />
                <Timeline.Content>Shipped</Timeline.Content>
                <Timeline.Connector />
            </Timeline.Item>
            <Timeline.Item>
                <Timeline.Marker />
                <Timeline.Content placement="start">Delivered</Timeline.Content>
            </Timeline.Item>
        </Timeline.Root>
    </>
), { name: 'TimelineDemos' });

export const timelinePage: PageEntry = {
    id: 'timeline',
    title: 'Timeline',
    category: 'Display & feedback',
    Demos: TimelineDemos,
};
