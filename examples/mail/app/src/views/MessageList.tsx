import { component } from 'sigx';
import type { PartProps } from '@sigx/zero';
import {
    Avatar, Badge, Button, Checkbox, Col, EmptyState, Menu, Row, Select, Skeleton, Stack, Tabs, Toggle,
} from '@sigx/zero';
import { ActionButton, Heading, Icon, MailList, MailRow, MenuAction, Text, Time, Toolbar } from '@sigx/zero-mail-kit';
import { initials, LABELS, participants, snippet } from '../data/mock';
import type { Category, FolderId, Thread } from '../data/mock';
import { route } from '../router';
import {
    archive, CATEGORIES, FOLDERS, markAllRead, markSpam, moveTo, openThread, openThreadById, refresh, searching,
    setRead, snooze, st, targets, toggleLabel, toggleSelected, toggleStar, trash, unreadCount, visible,
} from '../store';

const heading = (): string => {
    if (searching()) return 'Search results';
    const r = route();
    if (r.kind === 'label') return LABELS.find((l) => l.id === r.id)!.name;
    return FOLDERS.find((f) => f.id === r.id)!.name;
};

const MOVE_TARGETS: FolderId[] = ['inbox', 'archive', 'spam', 'trash'];

/** The Move / Label / Snooze menus, shared by the toolbar, the row menu and the reading pane. */
export const MoveMenu = component(() => () => (
    <Menu.Root onSelect={(v: string) => moveTo(v as FolderId)}>
        <MenuAction icon="folder" label="Move to" />
        <Menu.Popup>
            <Menu.GroupLabel>Move to</Menu.GroupLabel>
            {MOVE_TARGETS.map((f) => {
                const folder = FOLDERS.find((x) => x.id === f)!;
                return <Menu.Item key={f} value={f}><Icon name={folder.icon} /> {folder.name}</Menu.Item>;
            })}
        </Menu.Popup>
    </Menu.Root>
), { name: 'MoveMenu' });

export const LabelMenu = component(() => () => {
    const ids = targets();
    const has = (label: string): boolean => ids.length > 0 && st.threads.filter((t) => ids.includes(t.id)).every((t) => t.labels.includes(label as never));
    return (
        <Menu.Root closeOnSelect={false}>
            <MenuAction icon="tag" label="Labels" />
            <Menu.Popup>
                <Menu.GroupLabel>Label as</Menu.GroupLabel>
                {LABELS.map((l) => (
                    <Menu.CheckboxItem key={l.id} value={l.id} model={[{ get v() { return has(l.id); }, set v(_: boolean) { toggleLabel(l.id); } }, 'v']}>
                        <Icon name="tag" tone={l.color === 'neutral' ? 'muted' : l.color} /> {l.name}
                    </Menu.CheckboxItem>
                ))}
            </Menu.Popup>
        </Menu.Root>
    );
}, { name: 'LabelMenu' });

export const SnoozeMenu = component(() => () => (
    <Menu.Root onSelect={(v: string) => snooze(Number(v))}>
        <MenuAction icon="clock" label="Snooze" />
        <Menu.Popup>
            <Menu.GroupLabel>Snooze until…</Menu.GroupLabel>
            <Menu.Item value="0.25">Later today</Menu.Item>
            <Menu.Item value="1">Tomorrow</Menu.Item>
            <Menu.Item value="3">This weekend</Menu.Item>
            <Menu.Item value="7">Next week</Menu.Item>
        </Menu.Popup>
    </Menu.Root>
), { name: 'SnoozeMenu' });

const BulkToolbar = component(() => () => {
    const list = visible.value;
    const count = st.selected.length;
    const all = count > 0 && list.every((t) => st.selected.includes(t.id));
    const anyUnread = st.threads.some((t) => st.selected.includes(t.id) && !t.read);
    const inTrash = route().kind === 'folder' && route().id === 'trash';
    return (
        <Toolbar.Root label="Message actions">
            <Checkbox.Root
                hideLabel
                model={[{ get v() { return all; }, set v(on: boolean) { st.selected = on ? list.map((t) => t.id) : []; } }, 'v']}
                indeterminate={count > 0 && !all}
            >
                Select all
            </Checkbox.Root>
            {count > 0 ? (
                <Toolbar.Group label="Selection">
                    <ActionButton icon="archive" label="Archive" onClick={() => archive()} />
                    <ActionButton icon="trash" label={inTrash ? 'Delete forever' : 'Delete'} onClick={() => trash()} />
                    <ActionButton icon="spam" label="Report spam" onClick={() => markSpam()} />
                    <ActionButton icon={anyUnread ? 'mail-open' : 'mail'} label={anyUnread ? 'Mark as read' : 'Mark as unread'} onClick={() => setRead(anyUnread)} />
                    <Toolbar.Separator />
                    <SnoozeMenu />
                    <MoveMenu />
                    <LabelMenu />
                    <Text size="sm" tone="muted">{`${count} selected`}</Text>
                </Toolbar.Group>
            ) : (
                <Toolbar.Group label="Mailbox">
                    <ActionButton icon="refresh" label="Refresh" onClick={refresh} />
                    <ActionButton icon="check" label="Mark all as read" onClick={markAllRead} />
                </Toolbar.Group>
            )}
        </Toolbar.Root>
    );
}, { name: 'BulkToolbar' });

const SortSelect = component(() => () => (
    <Select.Root model={() => st.sort} size="sm" variant="ghost">
        <Select.Trigger label="Sort messages"><Select.Value /><Select.Indicator /></Select.Trigger>
        <Select.Popup>
            <Select.Item value="newest">Newest first</Select.Item>
            <Select.Item value="oldest">Oldest first</Select.Item>
            <Select.Item value="unread">Unread first</Select.Item>
        </Select.Popup>
    </Select.Root>
), { name: 'SortSelect' });

const Row_ = component<{ thread: Thread; index: number }>(({ props }) => () => {
    const t = props.thread;
    const people = participants(t);
    const lead = people[0]!;
    const selected = st.selected.includes(t.id);
    const hasFiles = t.messages.some((m) => m.attachments.length > 0);
    const names = t.folder === 'sent' || t.folder === 'drafts'
        ? `To: ${people.map((p) => p.name.split(' ')[0]).join(', ')}`
        : people.map((p) => (people.length > 1 ? p.name.split(' ')[0] : p.name)).join(', ');
    return (
        <MailRow.Root
            index={props.index}
            itemKey={t.id}
            active={openThread.value?.id === t.id}
            selected={selected}
            unread={!t.read}
            aria-label={`${t.read ? '' : 'Unread, '}${lead.name}: ${t.subject}`}
        >
            <Row gap="md" align="start">
                <Checkbox.Root hideLabel model={[{ get v() { return selected; }, set v(_: boolean) { toggleSelected(t.id); } }, 'v']} size="sm">
                    {`Select “${t.subject}”`}
                </Checkbox.Root>
                <Avatar.Root size="sm" color={lead.color}>
                    <Avatar.Fallback>{initials(lead.name)}</Avatar.Fallback>
                </Avatar.Root>
                <Stack.Item grow>
                    <Col gap="2xs">
                        <Row gap="sm" align="center">
                            <Stack.Item grow>
                                <Text truncate>
                                    {names}
                                    {t.messages.length > 1 ? <Text tone="muted" weight="medium">{` ${t.messages.length}`}</Text> : null}
                                </Text>
                            </Stack.Item>
                            {hasFiles ? <Icon name="paperclip" size="sm" tone="muted" label="Has attachments" /> : null}
                            <Time value={t.messages[t.messages.length - 1]!.date} tone={t.read ? 'muted' : 'primary'} />
                        </Row>
                        <Row gap="sm" align="center">
                            <Stack.Item grow>
                                <Text truncate>{t.subject}</Text>
                            </Stack.Item>
                            <Toggle.Root
                                size="xs"
                                variant="ghost"
                                label={t.starred ? 'Unstar' : 'Star'}
                                model={[{ get v() { return t.starred; }, set v(_: boolean) { toggleStar(t.id); } }, 'v']}
                            >
                                <Icon name="star" filled={t.starred} tone={t.starred ? 'warning' : 'subtle'} />
                            </Toggle.Root>
                        </Row>
                        {st.snippets ? <Text size="sm" tone="muted" weight="normal" clamp>{snippet(t)}</Text> : null}
                        {t.labels.length > 0 ? (
                            <Row gap="xs" wrap="wrap">
                                {t.labels.map((id) => {
                                    const l = LABELS.find((x) => x.id === id)!;
                                    return <Badge key={id} size="xs" variant="soft" color={l.color}>{l.name}</Badge>;
                                })}
                            </Row>
                        ) : null}
                    </Col>
                </Stack.Item>
            </Row>
        </MailRow.Root>
    );
}, { name: 'MailListRow' });

const LoadingRows = component(() => () => (
    <Col gap="none">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <MailRow.Root key={i} index={-1 - i} itemKey={`skeleton-${i}`} aria-hidden="true">
                <Row gap="md" align="start">
                    <Skeleton.Root><Avatar.Root size="sm"><Avatar.Fallback>··</Avatar.Fallback></Avatar.Root></Skeleton.Root>
                    <Stack.Item grow>
                        <Col gap="xs">
                            <Skeleton.Root><Text>Loading sender name</Text></Skeleton.Root>
                            <Skeleton.Root><Text>Loading the subject line of a message</Text></Skeleton.Root>
                            <Skeleton.Root><Text size="sm">Loading a preview of the message body text…</Text></Skeleton.Root>
                        </Col>
                    </Stack.Item>
                </Row>
            </MailRow.Root>
        ))}
    </Col>
), { name: 'LoadingRows' });

const Empty = component(() => () => {
    const r = route();
    const inbox = r.kind === 'folder' && r.id === 'inbox';
    return (
        <EmptyState.Root>
            <EmptyState.Icon><Icon name={searching() ? 'search' : inbox ? 'sparkles' : 'inbox'} size="xl" tone="subtle" /></EmptyState.Icon>
            <EmptyState.Title>{searching() ? 'No messages match' : inbox ? 'Inbox zero' : 'Nothing here'}</EmptyState.Title>
            <EmptyState.Description>
                {searching()
                    ? 'Try a different search, or clear the filters.'
                    : inbox ? 'You\'re all caught up. Enjoy the quiet.' : `There are no conversations in ${heading()}.`}
            </EmptyState.Description>
            {searching() ? (
                <EmptyState.Actions>
                    <Button.Root variant="outline" size="sm" onClick={() => { st.query = ''; st.filters = { from: '', attachments: false, unread: false, range: 'any' }; }}>
                        Clear search
                    </Button.Root>
                </EmptyState.Actions>
            ) : null}
        </EmptyState.Root>
    );
}, { name: 'EmptyMailbox' });

/** Right-click menu for a row: acts on the selection when the row is in it, else on that row. */
const RowMenu = component(() => () => (
    <Menu.Popup>
        <Menu.Item value="open"><Icon name="mail-open" /> Open</Menu.Item>
        <Menu.Item value="read"><Icon name="check" /> Mark as read</Menu.Item>
        <Menu.Item value="unread"><Icon name="mail" /> Mark as unread</Menu.Item>
        <Menu.Item value="star"><Icon name="star" /> Star / unstar<Menu.Shortcut>S</Menu.Shortcut></Menu.Item>
        <Menu.Separator />
        <Menu.Item value="archive"><Icon name="archive" /> Archive<Menu.Shortcut>E</Menu.Shortcut></Menu.Item>
        <Menu.Sub>
            <Menu.SubTrigger><Icon name="clock" /> Snooze</Menu.SubTrigger>
            <Menu.SubPopup>
                <Menu.Item value="snooze:1">Tomorrow</Menu.Item>
                <Menu.Item value="snooze:7">Next week</Menu.Item>
            </Menu.SubPopup>
        </Menu.Sub>
        <Menu.Sub>
            <Menu.SubTrigger><Icon name="tag" /> Label</Menu.SubTrigger>
            <Menu.SubPopup>
                {LABELS.map((l) => <Menu.Item key={l.id} value={`label:${l.id}`}>{l.name}</Menu.Item>)}
            </Menu.SubPopup>
        </Menu.Sub>
        <Menu.Separator />
        <Menu.Item value="spam"><Icon name="spam" /> Report spam</Menu.Item>
        <Menu.Item value="trash"><Icon name="trash" /> Delete<Menu.Shortcut>#</Menu.Shortcut></Menu.Item>
    </Menu.Popup>
), { name: 'RowMenu' });

function rowAction(value: string): void {
    const row = visible.value[st.highlight];
    if (!row) return;
    const ids = st.selected.includes(row.id) ? [...st.selected] : [row.id];
    const [verb, arg] = value.split(':');
    switch (verb) {
        case 'open': openThreadById(row.id); break;
        case 'read': setRead(true, ids); break;
        case 'unread': setRead(false, ids); break;
        case 'star': ids.forEach(toggleStar); break;
        case 'archive': archive(ids); break;
        case 'snooze': snooze(Number(arg), ids); break;
        case 'label': toggleLabel(arg as never, ids); break;
        case 'spam': markSpam(ids); break;
        case 'trash': trash(ids); break;
    }
}

export const MessageList = component(() => () => {
    const r = route();
    const list = visible.value;
    const inbox = r.kind === 'folder' && r.id === 'inbox' && !searching();
    const unread = list.filter((t) => !t.read).length;
    return (
        <>
            <Col gap="sm" pad="md">
                <Row gap="sm" align="baseline" justify="between">
                    <Row gap="sm" align="baseline">
                        <Heading level={2} size="sm">{heading()}</Heading>
                        <Text size="sm" tone="muted">{unread > 0 ? `${unread} unread` : `${list.length} conversations`}</Text>
                    </Row>
                    <SortSelect />
                </Row>
                {inbox ? (
                    <Tabs.Root model={() => st.category} activationMode="automatic">
                        <Tabs.List aria-label="Inbox categories">
                            {CATEGORIES.map((c) => (
                                <Tabs.Tab key={c.id} value={c.id}>
                                    <Icon name={c.icon} size="sm" />
                                    {c.name}
                                    {unreadCount(c.id as Category) > 0 && c.id !== st.category
                                        ? <Badge size="xs" variant="soft" color="primary">{unreadCount(c.id as Category)}</Badge>
                                        : null}
                                </Tabs.Tab>
                            ))}
                            <Tabs.Indicator />
                        </Tabs.List>
                    </Tabs.Root>
                ) : null}
                <BulkToolbar />
            </Col>
            {st.loading ? <LoadingRows /> : list.length === 0 ? <Empty /> : (
                <Menu.Root onSelect={rowAction}>
                    <Menu.ContextTrigger asChild>
                        {(p: PartProps) => <MailList.Root
                            lend={p}
                            label={`${heading()} — ${list.length} conversations`}
                            mods={{ compact: st.density === 'compact' }}
                            count={list.length}
                            itemKey={(i) => list[i]?.id ?? `gone-${i}`}
                            estimateSize={st.snippets ? 104 : 72}
                            scrollKey={`${st.query}|${JSON.stringify(st.filters)}|${st.sort}|${st.category}`}
                            model={() => st.highlight}
                            onOpen={(i: number) => { const t = list[i]; if (t) openThreadById(t.id); }}
                            onToggle={(i: number) => { const t = list[i]; if (t) toggleSelected(t.id); }}
                            // The window can briefly ask for an index past a list that just shrank.
                            renderRow={(i) => (list[i] ? <Row_ thread={list[i]!} index={i} /> : null)}
                        />}
                    </Menu.ContextTrigger>
                    <RowMenu />
                </Menu.Root>
            )}
        </>
    );
}, { name: 'MessageList' });
