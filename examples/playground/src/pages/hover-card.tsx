import { component } from 'sigx';
import { HoverCard } from '@sigx/zero';
import { pickRole } from '../design-systems';
import type { PageEntry } from './registry';

const HoverCardDemos = component(() => () => (
    <>
        <p>
            A preview on the way to a destination: hover the link (after a
            700&nbsp;ms intent delay) or give it keyboard focus, and the card
            opens. It is not a tooltip — the card may hold links and buttons,
            so the pointer can travel into it and Tab moves focus through it.
            Escape closes it from anywhere.
        </p>
        <div data-demo="hover-card-profile">
            Written by{' '}
            <HoverCard.Root>
                <HoverCard.Trigger href="#/hover-card">@ada</HoverCard.Trigger>
                <HoverCard.Popup>
                    <strong>Ada Lovelace</strong>
                    <div style="margin-block: 0.5rem;">
                        Mathematician. Wrote the first published algorithm for a machine.
                    </div>
                    <a href="#/hover-card">View profile</a>{' '}
                    <button type="button">Follow</button>
                </HoverCard.Popup>
            </HoverCard.Root>
            , who never saw the engine built.
        </div>
        {/*
          * A plain focus target with no card of its own. The e2e spec parks
          * keyboard focus here while the card above is hover-open — Escape
          * must still close it, through the document-level dismiss layer.
          */}
        <button type="button" style="margin-top: 1rem;">Elsewhere</button>
        {/*
          * A coloured link with an arrow, placed above: the strategy points
          * the arrow at the trigger's centre (`--arrow-x`).
          */}
        <div data-demo="hover-card-arrow" style="margin-top: 1rem;">
            See the{' '}
            <HoverCard.Root placement="top" openDelay={300}>
                <HoverCard.Trigger href="#/hover-card" color={pickRole('primary')}>release notes</HoverCard.Trigger>
                <HoverCard.Popup>
                    <HoverCard.Arrow />
                    Every change since the last release, with links to the pull requests.
                </HoverCard.Popup>
            </HoverCard.Root>
            {' '}for what changed.
        </div>
    </>
), { name: 'HoverCardDemos' });

export const hoverCardPage: PageEntry = {
    id: 'hover-card',
    title: 'Hover card',
    category: 'Overlays',
    Demos: HoverCardDemos,
};
