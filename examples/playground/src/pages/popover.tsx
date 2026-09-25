import { component } from 'sigx';
import { Input, Popover, Switch } from '@sigx/zero';
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
    </>
), { name: 'PopoverDemos' });

export const popoverPage: PageEntry = {
    id: 'popover',
    title: 'Popover',
    category: 'Overlays',
    Demos: PopoverDemos,
};
