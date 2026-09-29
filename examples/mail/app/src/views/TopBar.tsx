import { component } from 'sigx';
import { Avatar, Button, Drawer, Input, Kbd, Menu, Navbar, Row, Swap, themeController } from '@sigx/zero';
import type { InputHandle } from '@sigx/zero';
import { ActionButton, Heading, Icon, MenuAction, Text } from '@sigx/zero-mail-kit';
import { initials } from '../data/mock';
import { compose, ME, st } from '../store';
import { SearchFilters } from './SearchFilters';

/** The search field's handle, so `/` can focus it from anywhere. */
export const searchField: { handle: InputHandle | null } = { handle: null };

export const TopBar = component(() => {
    const theme = themeController();
    const dark = { get v(): boolean { return theme.resolvedScheme() === 'dark'; }, set v(on: boolean) { theme.setTheme(on ? 'mail-dark' : 'mail'); } };

    return () => (
        <Navbar.Root size="sm">
            <Navbar.Start>
                <Drawer.Trigger variant="ghost" size="sm" aria-label="Open mailboxes">
                    <Icon name="menu" />
                </Drawer.Trigger>
                <Row gap="sm" align="center">
                    <Icon name="mail" size="lg" tone="primary" />
                    <Heading level={1} size="xs" weight="bold" truncate>Zero Mail</Heading>
                </Row>
            </Navbar.Start>
            <Navbar.Center>
                <Row gap="xs" align="center">
                    <Input.Root type="search" model={() => st.query} autocomplete="off" spellcheck={false}>
                        <Input.Label visuallyHidden>Search mail</Input.Label>
                        <Input.Control>
                            <Input.Adornment placement="start"><Icon name="search" tone="muted" /></Input.Adornment>
                            <Input.Input
                                ref={(h: InputHandle | null) => { searchField.handle = h; }}
                                placeholder="Search mail"
                                onKeydown={(e: KeyboardEvent) => {
                                    if (e.key === 'Escape') (e.target as HTMLElement).blur();
                                }}
                            />
                            <Input.ClearTrigger label="Clear search" />
                            <Input.Adornment placement="end"><Kbd size="xs">/</Kbd></Input.Adornment>
                        </Input.Control>
                    </Input.Root>
                    <SearchFilters />
                </Row>
            </Navbar.Center>
            <Navbar.End>
                <Button.Root size="sm" onClick={() => compose()}>
                    <Icon name="pencil" />
                    Compose
                </Button.Root>
                <Swap.Root interactive label="Dark theme" model={[dark, 'v']}>
                    <Swap.On><Icon name="moon" /></Swap.On>
                    <Swap.Off><Icon name="sun" /></Swap.Off>
                </Swap.Root>
                <ActionButton icon="keyboard" label="Keyboard shortcuts" shortcut="?" onClick={() => { st.shortcutsOpen = true; }} />
                <Menu.Root
                    placement="bottom-end"
                    onSelect={(v: string) => {
                        if (v === 'settings') st.settingsOpen = true;
                        if (v === 'shortcuts') st.shortcutsOpen = true;
                    }}
                >
                    <MenuAction label="Account" placement="bottom-end">
                        <Avatar.Root size="xs" color="primary">
                            <Avatar.Fallback>{initials(ME.name)}</Avatar.Fallback>
                        </Avatar.Root>
                    </MenuAction>
                    <Menu.Popup>
                        <Menu.Group>
                            <Menu.GroupLabel>
                                <Text weight="semibold">{ME.name}</Text>
                            </Menu.GroupLabel>
                        </Menu.Group>
                        <Menu.Separator />
                        <Menu.Item value="settings"><Icon name="settings" /> Settings</Menu.Item>
                        <Menu.Item value="shortcuts"><Icon name="keyboard" /> Keyboard shortcuts<Menu.Shortcut>?</Menu.Shortcut></Menu.Item>
                        <Menu.Separator />
                        <Menu.Item value="signout" disabled><Icon name="logout" /> Sign out</Menu.Item>
                    </Menu.Popup>
                </Menu.Root>
            </Navbar.End>
        </Navbar.Root>
    );
}, { name: 'TopBar' });
