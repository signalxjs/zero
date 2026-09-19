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
        {/*
          * #57: nothing on the start side, so the skins collapse the start
          * track (a `:has()` rule on the root, no prop) — the events sit
          * against the axis instead of past an empty half of the item.
          */}
        <p>No start content — the start column collapses on its own:</p>
        <Timeline.Root>
            <Timeline.Item>
                <Timeline.Marker />
                <Timeline.Content>Task queued</Timeline.Content>
                <Timeline.Connector />
            </Timeline.Item>
            <Timeline.Item>
                <Timeline.Marker />
                <Timeline.Content>Agent picked it up</Timeline.Content>
                <Timeline.Connector />
            </Timeline.Item>
            <Timeline.Item>
                <Timeline.Marker />
                <Timeline.Content>Waiting for approval</Timeline.Content>
            </Timeline.Item>
        </Timeline.Root>
        {/*
          * #94: a marker RE-CARRIES the colour axis. The root's colour paints
          * every dot; a Marker's own `color` outranks it for that one entry,
          * and a Marker without one keeps following the root. `pickRole`
          * returns nothing on the colourless skins, so there every dot is
          * the default one — the prop does not exist in their vocabulary.
          */}
        <p>Per-entry tone — a marker's own colour outranks the root's:</p>
        <Timeline.Root color={pickRole('neutral')}>
            <Timeline.Item>
                <Timeline.Marker color={pickRole('success')} />
                <Timeline.Content>Build passed</Timeline.Content>
                <Timeline.Connector />
            </Timeline.Item>
            <Timeline.Item>
                <Timeline.Marker color={pickRole('warning')} />
                <Timeline.Content>Review requested changes</Timeline.Content>
                <Timeline.Connector />
            </Timeline.Item>
            <Timeline.Item>
                <Timeline.Marker color={pickRole('error')} />
                <Timeline.Content>Deploy failed</Timeline.Content>
                <Timeline.Connector />
            </Timeline.Item>
            <Timeline.Item>
                <Timeline.Marker />
                <Timeline.Content>Rollback pending</Timeline.Content>
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
