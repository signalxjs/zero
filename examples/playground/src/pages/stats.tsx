import { component } from 'sigx';
import { Stats } from '@sigx/zero';
import { pickRole } from '../design-systems';
import type { PageEntry } from './registry';

const StatsDemos = component(() => () => (
    <>
        <p>
            Figures with their labels — Card's cousin: a pure styling
            container, no state, no ARIA. Both the root and every item carry{' '}
            <code>data-orientation</code>, because the between-item divider is
            directional CSS on the item and a sibling selector cannot see the
            root.
        </p>
        <Stats.Root>
            <Stats.Item>
                <Stats.Figure><span aria-hidden="true">↗</span></Stats.Figure>
                <Stats.Title>Total revenue</Stats.Title>
                <Stats.Value>$12,930</Stats.Value>
                <Stats.Desc>+8% month over month</Stats.Desc>
            </Stats.Item>
            <Stats.Item>
                <Stats.Title>Signups</Stats.Title>
                <Stats.Value>1,204</Stats.Value>
                <Stats.Desc>past 30 days</Stats.Desc>
            </Stats.Item>
            <Stats.Item>
                <Stats.Title>Uptime</Stats.Title>
                <Stats.Value>99.98%</Stats.Value>
            </Stats.Item>
        </Stats.Root>
        <p>Vertical, with the value ink accented by the colour axis:</p>
        <div style="max-width: 18rem">
            <Stats.Root orientation="vertical" color={pickRole('primary')}>
                <Stats.Item>
                    <Stats.Title>Open issues</Stats.Title>
                    <Stats.Value>17</Stats.Value>
                </Stats.Item>
                <Stats.Item>
                    <Stats.Title>Merged this week</Stats.Title>
                    <Stats.Value>42</Stats.Value>
                    <Stats.Desc>nice</Stats.Desc>
                </Stats.Item>
            </Stats.Root>
        </div>
    </>
), { name: 'StatsDemos' });

export const statsPage: PageEntry = {
    id: 'stats',
    title: 'Stats',
    category: 'Display & feedback',
    Demos: StatsDemos,
};
