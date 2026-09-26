import { component } from 'sigx';
import { Tooltip } from '@sigx/zero';
import type { PageEntry } from './registry';

const TooltipDemos = component(() => () => (
    <>
        <Tooltip.Root>
            <Tooltip.Trigger>Hover me</Tooltip.Trigger>
            <Tooltip.Popup>Tooltips ride the top layer via popover="manual"</Tooltip.Popup>
        </Tooltip.Root>
        {/*
          * A plain focus target with no tooltip of its own. The WCAG 1.4.13
          * e2e check parks keyboard focus here while the tooltip above is
          * hover-open — Escape must still dismiss it, which only works
          * through a document-level listener, not a trigger-local one.
          */}
        <button type="button">Elsewhere</button>
        {/*
          * With an arrow: the strategy points it at the trigger's centre
          * (`--arrow-x` here, the tooltip sitting above).
          */}
        <div style="margin-top: 1rem;">
            <Tooltip.Root>
                <Tooltip.Trigger>With arrow</Tooltip.Trigger>
                <Tooltip.Popup>Points at what it describes<Tooltip.Arrow /></Tooltip.Popup>
            </Tooltip.Root>
        </div>
        {/*
          * A delay group — a toolbar's worth of tooltips. Once one is open,
          * moving to a neighbour opens it at once (and closes the first);
          * within `skipDelay` of a close, likewise. The e2e spec measures
          * that the second opens well inside the 600 ms intent delay.
          */}
        <div role="group" aria-label="Formatting" data-demo="tooltip-group" style="display: flex; gap: 0.5rem; margin-top: 1rem;">
            <Tooltip.Group>
                <Tooltip.Root>
                    <Tooltip.Trigger>Bold</Tooltip.Trigger>
                    <Tooltip.Popup>Bold (Ctrl+B)</Tooltip.Popup>
                </Tooltip.Root>
                <Tooltip.Root>
                    <Tooltip.Trigger>Italic</Tooltip.Trigger>
                    <Tooltip.Popup>Italic (Ctrl+I)</Tooltip.Popup>
                </Tooltip.Root>
                <Tooltip.Root>
                    <Tooltip.Trigger>Underline</Tooltip.Trigger>
                    <Tooltip.Popup>Underline (Ctrl+U)</Tooltip.Popup>
                </Tooltip.Root>
            </Tooltip.Group>
        </div>
    </>
), { name: 'TooltipDemos' });

export const tooltipPage: PageEntry = {
    id: 'tooltip',
    title: 'Tooltip',
    category: 'Overlays',
    Demos: TooltipDemos,
};
