import { component } from 'sigx';
import { Menu, Menubar } from '@sigx/zero';
import { pickRole, pickSize } from '../design-systems';
import type { PageEntry } from './registry';

const MenubarDemos = component(({ signal }) => {
    const state = signal({ open: '', wrap: true, zoom: 'fit' });
    return () => (
        <>
            <p>
                The APG menubar: one tab stop across the triggers,
                ArrowLeft/ArrowRight between them (mirrored under RTL),
                ArrowDown / Enter / Space to open. Inside an open menu,
                ArrowRight from an item that opens nothing — and ArrowLeft from
                a top-level item — moves to the adjacent menu. With a menu
                open, hovering another trigger switches to it.{' '}
                <code>Menu.Shortcut</code> draws the hint; the item's{' '}
                <code>keyshortcuts</code> announces it (zero binds no keys).
            </p>
            <Menubar.Root aria-label="Editor" model={() => state.open}>
                <Menu.Root value="file" onSelect={(v) => console.log('menubar select:', v)}>
                    <Menu.Trigger>File</Menu.Trigger>
                    <Menu.Popup>
                        <Menu.Item value="new" keyshortcuts="Control+N">
                            New file <Menu.Shortcut>Ctrl+N</Menu.Shortcut>
                        </Menu.Item>
                        <Menu.Item value="open" keyshortcuts="Control+O">
                            Open… <Menu.Shortcut>Ctrl+O</Menu.Shortcut>
                        </Menu.Item>
                        <Menu.Sub>
                            <Menu.SubTrigger>Open recent</Menu.SubTrigger>
                            <Menu.SubPopup>
                                <Menu.Item value="notes.md">notes.md</Menu.Item>
                                <Menu.Item value="todo.md">todo.md</Menu.Item>
                            </Menu.SubPopup>
                        </Menu.Sub>
                        <Menu.Separator />
                        <Menu.Item value="save" keyshortcuts="Control+S">
                            Save <Menu.Shortcut>Ctrl+S</Menu.Shortcut>
                        </Menu.Item>
                    </Menu.Popup>
                </Menu.Root>
                <Menu.Root value="edit" onSelect={(v) => console.log('menubar select:', v)}>
                    <Menu.Trigger>Edit</Menu.Trigger>
                    <Menu.Popup>
                        <Menu.Item value="undo" keyshortcuts="Control+Z">
                            Undo <Menu.Shortcut>Ctrl+Z</Menu.Shortcut>
                        </Menu.Item>
                        <Menu.Item value="redo" keyshortcuts="Control+Shift+Z">
                            Redo <Menu.Shortcut>Ctrl+Shift+Z</Menu.Shortcut>
                        </Menu.Item>
                        <Menu.Separator />
                        <Menu.CheckboxItem value="wrap" model={() => state.wrap} keyshortcuts="Alt+Z">
                            Word wrap <Menu.Shortcut>Alt+Z</Menu.Shortcut>
                        </Menu.CheckboxItem>
                    </Menu.Popup>
                </Menu.Root>
                <Menu.Root value="view" onSelect={(v) => console.log('menubar select:', v)}>
                    <Menu.Trigger>View</Menu.Trigger>
                    <Menu.Popup>
                        <Menu.RadioGroup model={() => state.zoom}>
                            <Menu.GroupLabel>Zoom</Menu.GroupLabel>
                            <Menu.RadioItem value="fit" keyshortcuts="Control+0">
                                Fit <Menu.Shortcut>Ctrl+0</Menu.Shortcut>
                            </Menu.RadioItem>
                            <Menu.RadioItem value="actual">Actual size</Menu.RadioItem>
                        </Menu.RadioGroup>
                    </Menu.Popup>
                </Menu.Root>
                <Menu.Root value="help">
                    <Menu.Trigger disabled>Help</Menu.Trigger>
                    <Menu.Popup>
                        <Menu.Item value="about">About</Menu.Item>
                    </Menu.Popup>
                </Menu.Root>
            </Menubar.Root>
            <p>
                Open menu: <code data-testid="menubar-open">{state.open === '' ? '(none)' : state.open}</code>
            </p>

            <h2>Vertical, with axes</h2>
            <p>
                <code>orientation="vertical"</code>: ArrowUp/ArrowDown move
                between triggers, the inline-end arrow opens. The bar carries
                the <code>color</code> / <code>size</code> axes the active design
                system declares.
            </p>
            <Menubar.Root
                aria-label="Tools"
                orientation="vertical"
                color={pickRole('primary')}
                size={pickSize('sm')}
            >
                <Menu.Root value="format" placement="right-start">
                    <Menu.Trigger>Format</Menu.Trigger>
                    <Menu.Popup>
                        <Menu.Item value="bold" keyshortcuts="Control+B">
                            Bold <Menu.Shortcut>Ctrl+B</Menu.Shortcut>
                        </Menu.Item>
                        <Menu.Item value="italic" keyshortcuts="Control+I">
                            Italic <Menu.Shortcut>Ctrl+I</Menu.Shortcut>
                        </Menu.Item>
                    </Menu.Popup>
                </Menu.Root>
                <Menu.Root value="insert" placement="right-start">
                    <Menu.Trigger>Insert</Menu.Trigger>
                    <Menu.Popup>
                        <Menu.Item value="image">Image</Menu.Item>
                        <Menu.Item value="table">Table</Menu.Item>
                    </Menu.Popup>
                </Menu.Root>
            </Menubar.Root>
        </>
    );
}, { name: 'MenubarDemos' });

export const menubarPage: PageEntry = {
    id: 'menubar',
    title: 'Menubar',
    category: 'Overlays',
    Demos: MenubarDemos,
};
