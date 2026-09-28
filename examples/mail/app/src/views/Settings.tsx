import { component } from 'sigx';
import { Button, Col, Dialog, Field, Kbd, RadioGroup, Switch, Table, Tabs, Textarea, themeController } from '@sigx/zero';
import { Text } from '@sigx/zero-mail-kit';
import { st } from '../store';

export const Settings = component(() => {
    const theme = themeController();
    // The theme lives in the controller (the top bar changes it too), so the
    // radio group binds straight through to it.
    const themeChoice = { get v(): string { return theme.theme() ?? 'system'; }, set v(x: string) { theme.setTheme(x === 'system' ? null : x); } };
    return () => (
        <Dialog.Root model={() => st.settingsOpen}>
            <Dialog.Popup>
                <Dialog.Title>Settings</Dialog.Title>
                <Dialog.Description>Changes apply immediately.</Dialog.Description>
                <Tabs.Root defaultValue="appearance">
                    <Tabs.List aria-label="Settings sections">
                        <Tabs.Tab value="appearance">Appearance</Tabs.Tab>
                        <Tabs.Tab value="reading">Reading</Tabs.Tab>
                        <Tabs.Tab value="notifications">Notifications</Tabs.Tab>
                        <Tabs.Tab value="signature">Signature</Tabs.Tab>
                        <Tabs.Indicator />
                    </Tabs.List>
                    <Tabs.Panel value="appearance">
                        <Col gap="lg">
                            <RadioGroup.Root model={[themeChoice, 'v']}>
                                <RadioGroup.Label>Theme</RadioGroup.Label>
                                <RadioGroup.Item value="system">Match system</RadioGroup.Item>
                                <RadioGroup.Item value="mail">Light</RadioGroup.Item>
                                <RadioGroup.Item value="mail-dark">Dark</RadioGroup.Item>
                            </RadioGroup.Root>
                            <RadioGroup.Root model={() => st.density}>
                                <RadioGroup.Label>List density</RadioGroup.Label>
                                <RadioGroup.Item value="comfortable">Comfortable</RadioGroup.Item>
                                <RadioGroup.Item value="compact">Compact</RadioGroup.Item>
                            </RadioGroup.Root>
                        </Col>
                    </Tabs.Panel>
                    <Tabs.Panel value="reading">
                        <Col gap="md">
                            <Switch.Root model={() => st.snippets}>Show message previews in the list</Switch.Root>
                            <Switch.Root model={() => st.advanceOnArchive}>After archiving, open the next conversation</Switch.Root>
                        </Col>
                    </Tabs.Panel>
                    <Tabs.Panel value="notifications">
                        <Col gap="md">
                            <Switch.Root model={() => st.notify.desktop}>Desktop notifications</Switch.Root>
                            <Switch.Root model={() => st.notify.sound}>Play a sound for new mail</Switch.Root>
                            <Switch.Root model={() => st.notify.importantOnly} disabled={!st.notify.desktop}>Only for important mail</Switch.Root>
                        </Col>
                    </Tabs.Panel>
                    <Tabs.Panel value="signature">
                        <Field.Root>
                            <Field.Label>Signature</Field.Label>
                            <Field.Description>Added below every message you send.</Field.Description>
                            <Textarea.Root model={() => st.signature} minRows={3} maxRows={8}>
                                <Textarea.Textarea />
                            </Textarea.Root>
                        </Field.Root>
                    </Tabs.Panel>
                </Tabs.Root>
                <Dialog.Footer>
                    <Button.Root onClick={() => { st.settingsOpen = false; }}>Done</Button.Root>
                </Dialog.Footer>
            </Dialog.Popup>
        </Dialog.Root>
    );
}, { name: 'Settings' });

const SHORTCUTS: [string[], string][] = [
    [['j'], 'Next conversation'],
    [['k'], 'Previous conversation'],
    [['↑', '↓'], 'Move in the list'],
    [['Enter'], 'Open the highlighted conversation'],
    [['Space'], 'Select the highlighted conversation'],
    [['x'], 'Select the highlighted conversation'],
    [['e'], 'Archive'],
    [['#'], 'Delete'],
    [['s'], 'Star / unstar'],
    [['u'], 'Mark as unread'],
    [['r'], 'Reply'],
    [['a'], 'Reply all'],
    [['f'], 'Forward'],
    [['c'], 'Compose'],
    [['/'], 'Search'],
    [['Esc'], 'Close the conversation'],
    [['?'], 'This list'],
];

export const Shortcuts = component(() => () => (
    <Dialog.Root model={() => st.shortcutsOpen}>
        <Dialog.Popup>
            <Dialog.Title>Keyboard shortcuts</Dialog.Title>
            <Table.Root size="sm">
                <Table.Caption><Text tone="muted" size="sm">Shortcuts pause while you type.</Text></Table.Caption>
                <Table.Head>
                    <Table.Row>
                        <Table.HeaderCell>Keys</Table.HeaderCell>
                        <Table.HeaderCell>Action</Table.HeaderCell>
                    </Table.Row>
                </Table.Head>
                <Table.Body>
                    {SHORTCUTS.map(([keys, what]) => (
                        <Table.Row key={what + keys.join()}>
                            <Table.Cell>{keys.map((k, i) => <>{i > 0 ? ' ' : ''}<Kbd size="sm">{k}</Kbd></>)}</Table.Cell>
                            <Table.Cell>{what}</Table.Cell>
                        </Table.Row>
                    ))}
                </Table.Body>
            </Table.Root>
            <Dialog.Footer>
                <Button.Root onClick={() => { st.shortcutsOpen = false; }}>Got it</Button.Root>
            </Dialog.Footer>
        </Dialog.Popup>
    </Dialog.Root>
), { name: 'Shortcuts' });
