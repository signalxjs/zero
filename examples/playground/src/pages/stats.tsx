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
            root. A value never wraps, so a row too wide for its container
            scrolls inside the root instead of pushing the page sideways.
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
        {/*
          * #161: an item RE-CARRIES the colour axis. The root's colour
          * paints every value; an Item's own `color` outranks it for that one
          * stat, and an Item without one keeps following the root. `pickRole`
          * returns nothing on the colourless skins, so there every stat is
          * the default one.
          */}
        <p>Per-item tone — a stat's own colour outranks the row's:</p>
        {/* The row is `secondary`, not `primary`: brutalist spells primary and
          * error with one token, and the demo must show two colours. */}
        <Stats.Root color={pickRole('secondary')}>
            <Stats.Item>
                <Stats.Title>Requests</Stats.Title>
                <Stats.Value>8,412</Stats.Value>
            </Stats.Item>
            <Stats.Item color={pickRole('warning')}>
                <Stats.Title>Estimated share</Stats.Title>
                <Stats.Value>62%</Stats.Value>
                <Stats.Desc>estimate, month in progress</Stats.Desc>
            </Stats.Item>
            <Stats.Item color={pickRole('error')}>
                <Stats.Title>Failed runs</Stats.Title>
                <Stats.Value>3</Stats.Value>
            </Stats.Item>
            <Stats.Item>
                <Stats.Title>Tokens</Stats.Title>
                <Stats.Value>1.2M</Stats.Value>
            </Stats.Item>
        </Stats.Root>
    </>
), { name: 'StatsDemos' });

export const statsPage: PageEntry = {
    id: 'stats',
    title: 'Stats',
    category: 'Display & feedback',
    Demos: StatsDemos,
};
