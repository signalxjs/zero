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
    </>
), { name: 'TooltipDemos' });

export const tooltipPage: PageEntry = {
    id: 'tooltip',
    title: 'Tooltip',
    category: 'Overlays',
    Demos: TooltipDemos,
};
