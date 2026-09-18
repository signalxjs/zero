import { component } from 'sigx';
import { Swap } from '@sigx/zero';
import { pickRole } from '../design-systems';
import type { PageEntry } from './registry';

const SwapDemos = component(({ signal }) => {
    const state = signal({ dark: false, muted: true });
    return () => (
        <>
            <p>
                Two faces over one boolean. Interactive swaps are real{' '}
                <code>aria-pressed</code> buttons; display swaps are spans that
                follow external state. Both faces stay rendered — the
                transition between them is each design system's own gesture —
                and the inactive one is <code>aria-hidden</code>.
            </p>
            <p>
                <Swap.Root interactive label="Toggle theme" model={() => state.dark} size="lg">
                    <Swap.On>🌙</Swap.On>
                    <Swap.Off>☀️</Swap.Off>
                </Swap.Root>
                {' '}
                <Swap.Root interactive label="Toggle sound" model={() => state.muted} size="lg" color={pickRole('primary')}>
                    <Swap.On>🔇</Swap.On>
                    <Swap.Off>🔊</Swap.Off>
                </Swap.Root>
            </p>
            <p>
                A display swap mirroring the theme toggle above — no role, no
                tab stop, programmatic only:{' '}
                <Swap.Root model={() => state.dark}>
                    <Swap.On>dark</Swap.On>
                    <Swap.Off>light</Swap.Off>
                </Swap.Root>
            </p>
            <p>
                Disabled:{' '}
                <Swap.Root interactive disabled label="Locked toggle" size="lg">
                    <Swap.On>🔓</Swap.On>
                    <Swap.Off>🔒</Swap.Off>
                </Swap.Root>
            </p>
        </>
    );
}, { name: 'SwapDemos' });

export const swapPage: PageEntry = {
    id: 'swap',
    title: 'Swap',
    category: 'Actions',
    Demos: SwapDemos,
};
