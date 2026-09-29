import { component } from 'sigx';
import {
    Avatar, Badge, Button, Card, Col, Collapsible, Container, Divider, EmptyState, Grid, HoverCard, Kbd, Menu, Row,
    Stack, Textarea, Toggle, formatBytes,
} from '@sigx/zero';
import { ActionButton, Heading, Icon, MenuAction, Shell, Text, Time, Toolbar } from '@sigx/zero-mail-kit';
import type { IconName } from '@sigx/zero-mail-kit';
import { initials, LABELS, ME } from '../data/mock';
import type { Attachment, Contact, Message } from '../data/mock';
import {
    archive, closeThread, markSpam, openThread, replyRecipients, sendReply, setRead, st, startReply, step, toggleStar,
    trash, visible,
} from '../store';
import { LabelMenu, MoveMenu, SnoozeMenu } from './MessageList';

const ATTACHMENT_ICON: Record<Attachment['kind'], IconName> = { pdf: 'file', image: 'image', doc: 'file', sheet: 'file', zip: 'archive' };

const Person = component<{ contact: Contact }>(({ props }) => () => {
    const c = props.contact;
    return (
        <HoverCard.Root placement="bottom-start" openDelay={350}>
            <HoverCard.Trigger href={`mailto:${c.email}`}>{c.id === ME.id ? 'me' : c.name}</HoverCard.Trigger>
            <HoverCard.Popup>
                <Row gap="md" align="center">
                    <Avatar.Root size="lg" color={c.color}><Avatar.Fallback>{initials(c.name)}</Avatar.Fallback></Avatar.Root>
                    <Col gap="2xs">
                        <Text weight="semibold">{c.name}</Text>
                        <Text size="sm" tone="muted">{c.email}</Text>
                        {c.title ? <Text size="sm" tone="muted">{c.company ? `${c.title} · ${c.company}` : c.title}</Text> : null}
                    </Col>
                </Row>
            </HoverCard.Popup>
        </HoverCard.Root>
    );
}, { name: 'Person' });

/**
 * One message of the thread: a non-native Collapsible around its Card
 * (#453), bound to `st.expanded` so "Expand all" still reaches it. The
 * header's chevron action is the trigger — lent through the ActionButton's
 * tooltip onto its Button, one element with `aria-expanded`/`aria-controls`
 * — and the body is the panel.
 */
const MessageCard = component<{ message: Message }>(({ props }) => () => {
    const m = props.message;
    const open = !!st.expanded[m.id];
    return (
        <Collapsible.Root native={false} model={() => st.expanded[m.id]}>
            <Card.Root variant={open ? 'outline' : 'soft'}>
                <Card.Header>
                    <Row gap="md" align="start">
                        <Avatar.Root size="md" color={m.from.color}><Avatar.Fallback>{initials(m.from.name)}</Avatar.Fallback></Avatar.Root>
                        <Stack.Item grow>
                            <Col gap="2xs">
                                <Row gap="sm" align="baseline" wrap="wrap">
                                    <Text weight="semibold"><Person contact={m.from} /></Text>
                                    <Text size="sm" tone="muted">{`<${m.from.email}>`}</Text>
                                </Row>
                                {open ? (
                                    <Text size="sm" tone="muted" truncate>
                                        {'to '}
                                        {m.to.map((c, i) => <>{i > 0 ? ', ' : ''}<Person contact={c} /></>)}
                                        {m.cc.length ? <>{', cc '}{m.cc.map((c, i) => <>{i > 0 ? ', ' : ''}<Person contact={c} /></>)}</> : null}
                                    </Text>
                                ) : (
                                    <Text size="sm" tone="muted" truncate>{m.body.join(' ')}</Text>
                                )}
                            </Col>
                        </Stack.Item>
                        <Row gap="xs" align="center">
                            {m.attachments.length ? <Icon name="paperclip" size="sm" tone="muted" label={`${m.attachments.length} attachments`} /> : null}
                            <Time value={m.date} format={open ? 'long' : 'relative'} tone="muted" />
                            <Collapsible.Trigger asChild>
                                {(c) => <ActionButton lend={c} icon={open ? 'chevron-down' : 'chevron-right'} label={open ? 'Collapse message' : 'Expand message'} />}
                            </Collapsible.Trigger>
                        </Row>
                    </Row>
                </Card.Header>
                <Collapsible.Panel>
                    <Card.Body>
                        <Col gap="md">
                            {m.body.map((p) => <Text as="p">{p}</Text>)}
                            {m.attachments.length ? (
                                <Col gap="sm">
                                    <Divider.Root decorative />
                                    <Text size="sm" tone="muted" weight="medium">{`${m.attachments.length} attachment${m.attachments.length > 1 ? 's' : ''}`}</Text>
                                    <Grid.Root cols="auto" track="sm" gap="sm">
                                        {m.attachments.map((a) => (
                                            <Card.Root key={a.name} variant="outline" size="sm">
                                                <Card.Body>
                                                    <Row gap="sm" align="center">
                                                        <Icon name={ATTACHMENT_ICON[a.kind]} size="lg" tone={a.kind === 'pdf' ? 'error' : a.kind === 'image' ? 'accent' : 'info'} />
                                                        <Stack.Item grow>
                                                            <Col gap="none">
                                                                <Text size="sm" weight="medium" truncate title={a.name}>{a.name}</Text>
                                                                <Text size="xs" tone="muted">{formatBytes(a.size)}</Text>
                                                            </Col>
                                                        </Stack.Item>
                                                    </Row>
                                                </Card.Body>
                                            </Card.Root>
                                        ))}
                                    </Grid.Root>
                                </Col>
                            ) : null}
                        </Col>
                    </Card.Body>
                </Collapsible.Panel>
            </Card.Root>
        </Collapsible.Root>
    );
}, { name: 'MessageCard' });

const ReplyBox = component(() => () => {
    const t = openThread.value!;
    if (!st.reply.open) {
        return (
            <Row gap="sm" wrap="wrap">
                <Button.Root variant="outline" onClick={() => startReply('reply')}><Icon name="reply" /> Reply</Button.Root>
                {replyRecipients(t, 'reply-all').length > 1
                    ? <Button.Root variant="outline" onClick={() => startReply('reply-all')}><Icon name="reply-all" /> Reply all</Button.Root>
                    : null}
                <Button.Root variant="outline" onClick={() => startReply('forward')}><Icon name="forward" /> Forward</Button.Root>
            </Row>
        );
    }
    const to = replyRecipients(t, st.reply.mode);
    return (
        <Card.Root variant="outline">
            <Card.Body>
                <Col gap="sm">
                    <Row gap="xs" align="center">
                        <Icon name={st.reply.mode === 'reply-all' ? 'reply-all' : 'reply'} tone="muted" />
                        <Text size="sm" tone="muted" truncate>{`To ${to.map((c) => c.name).join(', ')}`}</Text>
                    </Row>
                    <Textarea.Root model={() => st.reply.body} minRows={4} maxRows={14} autofocus>
                        <Textarea.Label visuallyHidden>Reply</Textarea.Label>
                        <Textarea.Textarea
                            placeholder="Write a reply…"
                            onKeydown={(e: KeyboardEvent) => {
                                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sendReply(); }
                                if (e.key === 'Escape') { st.reply.open = false; }
                            }}
                        />
                    </Textarea.Root>
                    <Row gap="sm" align="center">
                        <Button.Root disabled={!st.reply.body.trim()} onClick={sendReply}><Icon name="send" /> Send</Button.Root>
                        <Text size="sm" tone="subtle"><Kbd size="xs">Ctrl</Kbd> + <Kbd size="xs">Enter</Kbd></Text>
                        <Stack.Item grow />
                        <Button.Root variant="ghost" size="sm" aria-label="Discard reply" onClick={() => { st.reply = { open: false, mode: 'reply', body: '' }; }}>
                            <Icon name="trash" />
                        </Button.Root>
                    </Row>
                </Col>
            </Card.Body>
        </Card.Root>
    );
}, { name: 'ReplyBox' });

const Nothing = component(() => () => (
    <EmptyState.Root>
        <EmptyState.Icon><Icon name="mail-open" size="xl" tone="subtle" /></EmptyState.Icon>
        <EmptyState.Title>No conversation selected</EmptyState.Title>
        <EmptyState.Description>
            Pick a message from the list, or move with <Kbd size="xs">j</Kbd> and <Kbd size="xs">k</Kbd>.
        </EmptyState.Description>
    </EmptyState.Root>
), { name: 'NoConversation' });

export const ReadingPane = component(() => () => {
    const t = openThread.value;
    if (!t) return <Nothing />;
    const list = visible.value;
    const at = list.indexOf(t);
    return (
        <>
            <Col gap="none" pad="sm">
                <Toolbar.Root label="Conversation actions">
                    <ActionButton icon="chevron-left" label="Back to list" shortcut="Esc" onClick={closeThread} />
                    <Toolbar.Separator />
                    <ActionButton icon="archive" label="Archive" shortcut="E" onClick={() => archive([t.id])} />
                    <ActionButton icon="trash" label={t.folder === 'trash' ? 'Delete forever' : 'Delete'} shortcut="#" onClick={() => trash([t.id])} />
                    <ActionButton icon="spam" label="Report spam" onClick={() => markSpam([t.id])} />
                    <ActionButton icon="mail" label="Mark as unread" shortcut="U" onClick={() => setRead(false, [t.id])} />
                    <SnoozeMenu />
                    <MoveMenu />
                    <LabelMenu />
                    <Stack.Item grow />
                    <Text size="sm" tone="muted">{at >= 0 ? `${at + 1} of ${list.length}` : ''}</Text>
                    <ActionButton icon="chevron-left" label="Newer" shortcut="K" disabled={at <= 0} onClick={() => step(-1)} />
                    <ActionButton icon="chevron-right" label="Older" shortcut="J" disabled={at < 0 || at >= list.length - 1} onClick={() => step(1)} />
                    <Menu.Root
                        placement="bottom-end"
                        onSelect={(v: string) => {
                            if (v === 'reply' || v === 'reply-all' || v === 'forward') startReply(v);
                            if (v === 'star') toggleStar(t.id);
                            if (v === 'expand') for (const m of t.messages) st.expanded[m.id] = true;
                            if (v === 'collapse') for (const m of t.messages) st.expanded[m.id] = false;
                        }}
                    >
                        <MenuAction icon="more" label="More actions" />
                        <Menu.Popup>
                            <Menu.Item value="reply"><Icon name="reply" /> Reply<Menu.Shortcut>R</Menu.Shortcut></Menu.Item>
                            <Menu.Item value="reply-all"><Icon name="reply-all" /> Reply all<Menu.Shortcut>A</Menu.Shortcut></Menu.Item>
                            <Menu.Item value="forward"><Icon name="forward" /> Forward<Menu.Shortcut>F</Menu.Shortcut></Menu.Item>
                            <Menu.Separator />
                            <Menu.Item value="star"><Icon name="star" /> {t.starred ? 'Remove star' : 'Star'}<Menu.Shortcut>S</Menu.Shortcut></Menu.Item>
                            <Menu.Item value="expand">Expand all</Menu.Item>
                            <Menu.Item value="collapse">Collapse all</Menu.Item>
                        </Menu.Popup>
                    </Menu.Root>
                </Toolbar.Root>
            </Col>
            <Divider.Root decorative />
            <Shell.Region label={`Conversation: ${t.subject}`}>
                <Container measure="lg" pad="xl">
                    <Col gap="lg">
                        <Row gap="md" align="start">
                            <Stack.Item grow>
                                <Col gap="sm">
                                    <Heading level={2} size="lg">{t.subject}</Heading>
                                    <Row gap="xs" wrap="wrap" align="center">
                                        {t.important ? <Badge size="sm" color="warning" variant="soft">Important</Badge> : null}
                                        {t.labels.map((id) => {
                                            const l = LABELS.find((x) => x.id === id)!;
                                            return <Badge key={id} size="sm" color={l.color} variant="soft">{l.name}</Badge>;
                                        })}
                                        <Text size="sm" tone="muted">{`${t.messages.length} message${t.messages.length > 1 ? 's' : ''}`}</Text>
                                    </Row>
                                </Col>
                            </Stack.Item>
                            <Toggle.Root
                                variant="ghost"
                                label={t.starred ? 'Unstar conversation' : 'Star conversation'}
                                model={[{ get v() { return t.starred; }, set v(_: boolean) { toggleStar(t.id); } }, 'v']}
                            >
                                <Icon name="star" size="lg" filled={t.starred} tone={t.starred ? 'warning' : 'subtle'} />
                            </Toggle.Root>
                        </Row>
                        <Col gap="sm">
                            {t.messages.map((m) => <MessageCard key={m.id} message={m} />)}
                        </Col>
                        <ReplyBox />
                    </Col>
                </Container>
            </Shell.Region>
        </>
    );
}, { name: 'ReadingPane' });
