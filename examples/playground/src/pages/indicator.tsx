import { component } from 'sigx';
import { Badge, Indicator, Status } from '@sigx/zero';
import { DemoRow } from '../demo/Section';
import { pickRole } from '../design-systems';
import type { PageEntry } from './registry';

const IndicatorDemos = component(() => () => (
    <>
        <p>
            A wrapper that anchors a floating item to a corner or edge of
            whatever it wraps. Zero stamps <code>data-placement</code> from a
            declared eight-slot subset spelled <em>logically</em> —{' '}
            <code>start</code>/<code>end</code> are the reading-direction
            inline sides, so the whole grid mirrors under RTL for free. The
            item carries no paint of its own: a Badge or a Status dot brings
            the meaning.
        </p>
        <DemoRow gap="2rem" align="center">
            <Indicator.Root>
                <Indicator.Item>
                    <Badge color={pickRole('error', 'danger')}>99+</Badge>
                </Indicator.Item>
                <button type="button">Inbox</button>
            </Indicator.Root>
            <Indicator.Root>
                <Indicator.Item placement="top-start">
                    <Badge color={pickRole('info')}>new</Badge>
                </Indicator.Item>
                <button type="button">Releases</button>
            </Indicator.Root>
            <Indicator.Root>
                <Indicator.Item placement="bottom-end">
                    <Status color={pickRole('success')} label="Online" />
                </Indicator.Item>
                <span style="display:inline-block; inline-size:2.5rem; block-size:2.5rem; border-radius:50%; background: var(--color-base-300)"></span>
            </Indicator.Root>
        </DemoRow>
        <p>
            All eight slots, on one box:
        </p>
        <DemoRow gap="3rem" align="center">
            <Indicator.Root>
                {(['top-start', 'top', 'top-end', 'start', 'end', 'bottom-start', 'bottom', 'bottom-end'] as const).map((p) => (
                    <Indicator.Item placement={p}>
                        <Badge size="sm">{p}</Badge>
                    </Indicator.Item>
                ))}
                <div style="inline-size: 14rem; block-size: 6rem; border: 1px dashed var(--color-base-300); border-radius: var(--radius-box)"></div>
            </Indicator.Root>
        </DemoRow>
    </>
), { name: 'IndicatorDemos' });

export const indicatorPage: PageEntry = {
    id: 'indicator',
    title: 'Indicator',
    category: 'Display & feedback',
    Demos: IndicatorDemos,
};
