import { component } from 'sigx';
import { Button, Tooltip } from '@sigx/zero';
import { activeVocabulary } from '../design-systems';
import type { PageEntry } from './registry';

const TooltipDemos = component(({ signal }) => {
    const archive = signal({ count: 0 });
    const thread = signal({ count: 0 });
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
            {/*
              * A tooltip LENT to a Button (#494): one element, the Button's —
              * it keeps `button.root` and the skin's button paint, `loading`
              * and `focusableWhenDisabled`, while the tooltip trigger it
              * absorbs adds the hover/focus intent, `aria-describedby` and the
              * anchor. `lend={p}` rather than `{...p}`: a zero component takes
              * the bag through a prop. The e2e spec hovers, clicks and presses
              * Escape on it.
              */}
            <div data-demo="tooltip-lend" style="display: flex; gap: 0.5rem; align-items: center; margin-top: 1rem;">
                <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                        {(p) => (
                            <Button.Root lend={p} aria-label="Archive thread" onClick={() => { thread.count += 1; }}>
                                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                                    <rect x="1.5" y="2.5" width="13" height="3" rx="0.5" />
                                    <path d="M2.5 5.5v7a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-7M6.5 8.5h3" />
                                </svg>
                            </Button.Root>
                        )}
                    </Tooltip.Trigger>
                    <Tooltip.Popup>Move the thread to the archive</Tooltip.Popup>
                </Tooltip.Root>
                <output aria-label="Archived threads">archived: {thread.count}</output>
            </div>
            {/*
              * Surface variants (#514): the trigger takes `variant`, and the
              * popup — a top-layer sibling — mirrors every axis attribute the
              * trigger renders, so a design system can vary the BUBBLE, not
              * only the button. One tooltip per value the active design
              * system wires for the tooltip scope (Material's `plain` /
              * `rich`); a skin that wires none renders none, since a value it
              * does not declare is exactly what ds-smoke forbids. The
              * overlay-variants e2e spec opens each and compares the surfaces.
              */}
            <h2>Surface variants</h2>
            <p>
                The trigger's axes reach the popup: it mirrors them, so a
                design system can style the surface per use.
                {(activeVocabulary().perScope['tooltip']?.variants ?? []).length === 0
                    ? ' This design system wires no tooltip variant.'
                    : ''}
            </p>
            <div data-demo="tooltip-variants" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                {(activeVocabulary().perScope['tooltip']?.variants ?? []).map((variant) => (
                    <Tooltip.Root>
                        <Tooltip.Trigger variant={variant}>{`${variant} tooltip`}</Tooltip.Trigger>
                        <Tooltip.Popup>{`A ${variant} tooltip: the popup takes its trigger's variant`}</Tooltip.Popup>
                    </Tooltip.Root>
                ))}
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
