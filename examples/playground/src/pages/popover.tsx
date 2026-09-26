import { component } from 'sigx';
import { Input, Popover, Switch } from '@sigx/zero';
import type { PartProps } from '@sigx/zero';
import { DemoRow } from '../demo/Section';
import type { PageEntry } from './registry';

const PopoverDemos = component(() => () => (
    <>
        <p>
            Focus moves into the popup on open and back to the trigger on
            close — unless you already put it somewhere else: click into the
            field beside it while the popup is open and it keeps focus.
        </p>
        <DemoRow gap="1rem" align="flex-end">
            <Popover.Root placement="bottom-start">
                <Popover.Trigger>Filters</Popover.Trigger>
                <Popover.Popup>
                    <Popover.Title>Filters</Popover.Title>
                    <Switch.Root defaultChecked>Only mine</Switch.Root>
                    <br />
                    <Popover.Close>Done</Popover.Close>
                </Popover.Popup>
            </Popover.Root>
            <Input.Root type="search" name="popover-search">
                <Input.Label>Search</Input.Label>
                <Input.Control>
                    <Input.Input placeholder="Filter…" />
                </Input.Control>
            </Input.Root>
        </DemoRow>

        <h2>Arrow and description</h2>
        <p>
            <code>Popover.Arrow</code> points at the trigger: the position
            strategy writes the anchor's centre on it as{' '}
            <code>--arrow-x</code>/<code>--arrow-y</code>, after any flip or
            shift, and the skin draws it on the edge the popup's{' '}
            <code>data-placement</code> names. <code>Popover.Description</code>{' '}
            describes the popup (<code>aria-describedby</code>) while it renders.
        </p>
        <div class="demo-row">
            <Popover.Root placement="bottom">
                <Popover.Trigger>Sharing</Popover.Trigger>
                <Popover.Popup>
                    <Popover.Arrow />
                    <Popover.Title>Sharing</Popover.Title>
                    <Popover.Description>Shared with 3 people.</Popover.Description>
                    <Popover.Close>Done</Popover.Close>
                </Popover.Popup>
            </Popover.Root>
            <Popover.Root placement="right">
                <Popover.Trigger>Beside</Popover.Trigger>
                <Popover.Popup>
                    <Popover.Arrow />
                    <Popover.Description>Opens to the right, arrow on the left edge.</Popover.Description>
                </Popover.Popup>
            </Popover.Root>
        </div>
        {/*
          * Pushed to the far edge of the column, with a popup wider than
          * the room beside it: centred under the trigger it would run off
          * the viewport, so the strategy shifts it back — and the arrow
          * keeps pointing at the trigger, not the popup's middle. The e2e
          * spec narrows the viewport so the shift is certain.
          */}
        <div class="demo-row" style={{ justifyContent: 'flex-end' }}>
            <Popover.Root placement="bottom">
                <Popover.Trigger>Near the edge</Popover.Trigger>
                <Popover.Popup>
                    <Popover.Arrow />
                    <Popover.Description>
                        <span style={{ display: 'block', width: '18rem' }}>
                            Shifted to stay on screen; the arrow still points at the trigger.
                        </span>
                    </Popover.Description>
                </Popover.Popup>
            </Popover.Root>
        </div>

        <h2>Anchor</h2>
        <p>
            <code>Popover.Anchor</code> is what the popup lines up with in the
            trigger's place — here the whole row, while the small button
            stays the toggle and gets focus back on close.
        </p>
        <Popover.Root placement="bottom-start">
            <Popover.Anchor asChild>
                {(p: PartProps) => (
                    <div
                        {...p}
                        class="demo-row"
                        style={{
                            border: '1px dashed var(--color-base-300)',
                            borderRadius: 'var(--radius-field)',
                            padding: '0.5rem 0.75rem',
                            justifyContent: 'space-between',
                            maxWidth: '24rem',
                        }}
                    >
                        <span>Due date: not set</span>
                        <Popover.Trigger>Pick</Popover.Trigger>
                    </div>
                )}
            </Popover.Anchor>
            <Popover.Popup>
                <Popover.Title>Due date</Popover.Title>
                <Popover.Description>Lined up with the row, not the button.</Popover.Description>
                <Popover.Close>Done</Popover.Close>
            </Popover.Popup>
        </Popover.Root>
    </>
), { name: 'PopoverDemos' });

export const popoverPage: PageEntry = {
    id: 'popover',
    title: 'Popover',
    category: 'Overlays',
    Demos: PopoverDemos,
};
