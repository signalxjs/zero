import { component } from 'sigx';
import { Diff } from '@sigx/zero';
import { pickRole } from '../design-systems';
import type { PageEntry } from './registry';

/**
 * Pane content sized to the ROOT, not the pane — the after pane clips by
 * width, and content sized to the clipped box would squish instead of
 * revealing. The demo panes are gradients so the divider is visible in
 * every skin without image assets.
 */
const pane = (bg: string, label: string) => (
    <div
        style={`inline-size: 28rem; max-inline-size: 80vw; block-size: 10rem; display: grid; place-items: center; background: ${bg};`}
    >
        {label}
    </div>
);

const DiffDemos = component(() => () => (
    <>
        <p>
            A before/after reveal. The divider handle is an APG slider —
            focus it and use the arrow keys (RTL-aware), PageUp/PageDown, or
            Home/End — and a pointer drag keeps working after the pointer
            leaves the box. The panes are content: clicks on them do nothing.
        </p>
        <Diff.Root defaultValue={50}>
            <Diff.Before>{pane('color-mix(in oklch, currentColor 8%, transparent)', 'Before')}</Diff.Before>
            <Diff.After>{pane('color-mix(in oklch, currentColor 22%, transparent)', 'After')}</Diff.After>
            <Diff.Handle label="Reveal comparison" />
        </Diff.Root>
        <p>Starting at 25%, with the colour axis on the divider:</p>
        <Diff.Root defaultValue={25} color={pickRole('primary')}>
            <Diff.Before>{pane('color-mix(in oklch, currentColor 8%, transparent)', 'Draft')}</Diff.Before>
            <Diff.After>{pane('color-mix(in oklch, currentColor 22%, transparent)', 'Final')}</Diff.After>
            <Diff.Handle label="Reveal final version" />
        </Diff.Root>
    </>
), { name: 'DiffDemos' });

export const diffPage: PageEntry = {
    id: 'diff',
    title: 'Diff',
    category: 'Display & feedback',
    Demos: DiffDemos,
};
