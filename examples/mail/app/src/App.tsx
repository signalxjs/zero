import { component, watch } from 'sigx';
import { Drawer, Toast } from '@sigx/zero';
import { Hotkeys, Shell, Split } from '@sigx/zero-mail-kit';
import { mailboxKey, route } from './router';
import {
    archive, closeThread, compose, onMailboxChange, openThread, openThreadById, setRead, st, startReply, step,
    toggleSelected, toggleStar, trash, visible,
} from './store';
import { Compose } from './views/Compose';
import { MessageList } from './views/MessageList';
import { ReadingPane } from './views/ReadingPane';
import { Settings, Shortcuts } from './views/Settings';
import { Sidebar } from './views/Sidebar';
import { searchField, TopBar } from './views/TopBar';

export const App = component(() => {
    watch(mailboxKey, () => {
        onMailboxChange();
        st.navOpen = false;
    });
    onMailboxChange();

    const current = (): string | undefined => openThread.value?.id ?? visible.value[st.highlight]?.id;

    const bindings = {
        j: () => step(1, !!openThread.value),
        k: () => step(-1, !!openThread.value),
        e: () => archive(),
        '#': () => trash(),
        s: () => { const id = current(); if (id) toggleStar(id); },
        u: () => setRead(false),
        x: () => { const id = visible.value[st.highlight]?.id; if (id) toggleSelected(id); },
        o: () => { const id = visible.value[st.highlight]?.id; if (id) openThreadById(id); },
        r: () => startReply('reply'),
        a: () => startReply('reply-all'),
        f: () => startReply('forward'),
        c: () => compose(),
        '/': () => searchField.handle?.focus(),
        '?': () => { st.shortcutsOpen = true; },
        Escape: () => {
            if (st.selected.length) st.selected = [];
            else if (openThread.value) closeThread();
        },
    };

    return () => (
        <Shell.Root>
            <Drawer.Root modal={{ below: 'md' }} model={() => st.navOpen} label="Mailboxes">
                <TopBar />
                <Shell.Body>
                    <Sidebar />
                    <Shell.Main>
                        <Split.Root
                            label="Resize the message list"
                            model={() => st.listWidth}
                            min={320}
                            max={720}
                            show={route().thread ? 'secondary' : 'primary'}
                        >
                            <Split.Pane primary>
                                <MessageList />
                            </Split.Pane>
                            <Split.Handle />
                            <Split.Pane>
                                <ReadingPane />
                            </Split.Pane>
                        </Split.Root>
                    </Shell.Main>
                </Shell.Body>
            </Drawer.Root>
            <Compose />
            <Settings />
            <Shortcuts />
            <Toast.Viewport placement="bottom" />
            <Hotkeys bindings={bindings} />
        </Shell.Root>
    );
}, { name: 'App' });
