import { component } from 'sigx';
import { Popover, Switch } from '@sigx/zero';
import type { PageEntry } from './registry';

const PopoverDemos = component(() => () => (
    <Popover.Root placement="bottom-start">
        <Popover.Trigger>Filters</Popover.Trigger>
        <Popover.Popup>
            <Popover.Title>Filters</Popover.Title>
            <Switch.Root defaultChecked>Only mine</Switch.Root>
            <br />
            <Popover.Close>Done</Popover.Close>
        </Popover.Popup>
    </Popover.Root>
), { name: 'PopoverDemos' });

export const popoverPage: PageEntry = {
    id: 'popover',
    title: 'Popover',
    category: 'Overlays',
    Demos: PopoverDemos,
};
