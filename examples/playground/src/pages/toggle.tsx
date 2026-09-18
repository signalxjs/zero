import { component } from 'sigx';
import { Toggle } from '@sigx/zero';
import { pickRole } from '../design-systems';
import { DemoRow } from '../demo/Section';
import type { PageEntry } from './registry';

const ToggleDemos = component(() => () => (
    <>
        <p>
            A mode you flip, not a value you submit: <code>aria-pressed</code>{' '}
            semantics, <code>on|off</code> on <code>data-state</code>.
        </p>
        <DemoRow gap="1rem">
            <Toggle.Root>Mute</Toggle.Root>
            <Toggle.Root color={pickRole('warning')} defaultPressed>Pinned</Toggle.Root>
            <Toggle.Root disabled>Disabled</Toggle.Root>
        </DemoRow>
    </>
), { name: 'ToggleDemos' });

export const togglePage: PageEntry = {
    id: 'toggle',
    title: 'Toggle',
    category: 'Actions',
    Demos: ToggleDemos,
};
