import { component, signal } from 'sigx';
import { Dialog, Hotkeys, Input, Kbd, Menu } from '@sigx/zero';
import { DemoRow } from '../demo/Section';
import type { PageEntry } from './registry';

/**
 * `createHotkeys` through its renderless `<Hotkeys>` (#460). One binding,
 * `]`, which the menu item below also announces with `keyshortcuts` — the
 * same string binds and announces. The input, the modal dialog and the open
 * menu are the three places it must stay quiet; `e2e/hotkeys.spec.ts`
 * presses the key in each.
 */
const HotkeysDemos = component(() => {
    const state = signal({ count: 0, dialogOpen: false });
    const bump = (): void => { state.count++; };

    return () => (
        <>
            <p>
                <code>createHotkeys</code> binds shortcuts in{' '}
                <code>aria-keyshortcuts</code> syntax, and <code>&lt;Hotkeys&gt;</code>{' '}
                is the same as a component that renders nothing. A key never
                fires while you type, on a modifier chord it does not name, or
                while a modal dialog or an open popup owns the keyboard.
            </p>
            <Hotkeys bindings={{ ']': bump }} />
            <DemoRow align="center">
                Press <Kbd>]</Kbd>:{' '}
                <output data-demo="hotkeys-count">Fired {state.count} times</output>
            </DemoRow>
            <DemoRow gap="1rem" align="flex-end">
                <Input.Root name="hotkeys-typing">
                    <Input.Label>Typing here fires nothing</Input.Label>
                    <Input.Control>
                        <Input.Input placeholder="Try ]" />
                    </Input.Control>
                </Input.Root>
                <Dialog.Root model={() => state.dialogOpen}>
                    <Dialog.Trigger>Open hotkeys dialog</Dialog.Trigger>
                    <Dialog.Popup>
                        <Dialog.Title>Shortcuts are paused</Dialog.Title>
                        <Dialog.Description>
                            A modal dialog owns the keyboard: <Kbd>]</Kbd> does
                            nothing until it closes.
                        </Dialog.Description>
                        <Dialog.Footer>
                            <Dialog.Close>Close</Dialog.Close>
                        </Dialog.Footer>
                    </Dialog.Popup>
                </Dialog.Root>
                <Menu.Root onSelect={bump}>
                    <Menu.Trigger>Hotkeys menu</Menu.Trigger>
                    <Menu.Popup>
                        <Menu.Item value="bump" keyshortcuts="]">
                            Bump the count <Menu.Shortcut>]</Menu.Shortcut>
                        </Menu.Item>
                    </Menu.Popup>
                </Menu.Root>
            </DemoRow>
        </>
    );
}, { name: 'HotkeysDemos' });

export const hotkeysPage: PageEntry = {
    id: 'hotkeys',
    title: 'Hotkeys',
    category: 'Actions',
    Demos: HotkeysDemos,
};
