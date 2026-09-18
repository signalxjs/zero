import { component } from 'sigx';
import { Kbd } from '@sigx/zero';
import { DemoRow } from '../demo/Section';
import { pickRole } from '../design-systems';
import type { PageEntry } from './registry';

const KbdDemos = component(() => () => (
    <>
        <p>
            A keyboard key on the platform's own <code>&lt;kbd&gt;</code>{' '}
            element — the element is the semantics, so there is no{' '}
            <code>asChild</code> to swap it away. One part, no state; each
            design system decides how literal a keycap it draws.
        </p>
        <DemoRow>
            Press <Kbd>⌘</Kbd> <Kbd>K</Kbd> to search, or{' '}
            <Kbd>Ctrl</Kbd> <Kbd>Shift</Kbd> <Kbd>P</Kbd> for the command
            palette.
        </DemoRow>
        <DemoRow align="center">
            <Kbd size="sm">Esc</Kbd>
            <Kbd>Enter</Kbd>
            <Kbd size="lg">Space</Kbd>
        </DemoRow>
        <DemoRow>
            <Kbd color={pickRole('primary')}>F1</Kbd>
            <Kbd color={pickRole('error', 'danger')}>Del</Kbd>
        </DemoRow>
    </>
), { name: 'KbdDemos' });

export const kbdPage: PageEntry = {
    id: 'kbd',
    title: 'Kbd',
    category: 'Display & feedback',
    Demos: KbdDemos,
};
