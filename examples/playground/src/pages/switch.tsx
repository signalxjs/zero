import { component, signal } from 'sigx';
import { Switch } from '@sigx/zero';
import { pickRole } from '../design-systems';
import type { PageEntry } from './registry';

const SwitchDemos = component(() => {
    const state = signal({ switchOn: true });

    return () => (
        <>
            {/*
              * The same rule as the Button page's matrix, for a single
              * choice: a role prop is picked from what the active
              * design system declares, never named here. `undefined`
              * under a colourless design system leaves the prop off —
              * an uncoloured control, rather than a `data-color`
              * nothing in the sheet matches.
              */}
            <Switch.Root model={() => state.switchOn}>Notifications</Switch.Root>
            {' '}
            <Switch.Root color={pickRole('success')} defaultChecked>Autosave</Switch.Root>
            {' '}
            <Switch.Root disabled>Disabled</Switch.Root>
        </>
    );
}, { name: 'SwitchDemos' });

export const switchPage: PageEntry = {
    id: 'switch',
    title: 'Switch',
    category: 'Forms & inputs',
    Demos: SwitchDemos,
};
