import { component } from 'sigx';
import { Tooltip } from '@sigx/zero';
import type { PageEntry } from './registry';

const TooltipDemos = component(({ signal }) => {
    const archive = signal({ count: 0 });
    return () => (
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
            {/*
              * An icon trigger that ACTS (#486): the tooltip labels the icon, and
              * the trigger's own `onClick` runs the action — no asChild button
              * underneath. The icon is decoration; `aria-label` names the button
              * and the tooltip describes it. The e2e spec hovers it for the
              * tooltip and clicks it for the count.
              */}
            <div data-demo="tooltip-action" style="display: flex; gap: 0.5rem; align-items: center; margin-top: 1rem;">
                <Tooltip.Root>
                    <Tooltip.Trigger aria-label="Archive" onClick={() => { archive.count += 1; }}>
                        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                            <rect x="1.5" y="2.5" width="13" height="3" rx="0.5" />
                            <path d="M2.5 5.5v7a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-7M6.5 8.5h3" />
                        </svg>
                    </Tooltip.Trigger>
                    <Tooltip.Popup>Archive the conversation</Tooltip.Popup>
                </Tooltip.Root>
                <output aria-label="Archive action count">Archived {archive.count}×</output>
            </div>
        </>
    );
}, { name: 'TooltipDemos' });

export const tooltipPage: PageEntry = {
    id: 'tooltip',
    title: 'Tooltip',
    category: 'Overlays',
    Demos: TooltipDemos,
};
