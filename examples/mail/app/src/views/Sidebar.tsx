import { component } from 'sigx';
import { Badge, Button, Col, Drawer, NavList, Progress } from '@sigx/zero';
import { Icon } from '@sigx/zero-mail-kit';
import { LABELS } from '../data/mock';
import { route } from '../router';
import { compose, FOLDERS, labelCount, st, unreadCount } from '../store';

const count = (n: number) => (n > 0 ? <NavList.Meta><Badge size="xs" variant="soft">{n > 999 ? '999+' : n}</Badge></NavList.Meta> : null);

export const Sidebar = component(() => () => {
    const r = route();
    return (
        <Drawer.Panel measure="xs">
            <Drawer.Title visuallyHidden>Mailboxes</Drawer.Title>
            <Col gap="lg" pad="md">
                <Button.Root onClick={() => { st.navOpen = false; compose(); }}>
                    <Icon name="pencil" />
                    New message
                </Button.Root>
                <NavList.Root label="Mailboxes">
                    <NavList.List>
                        {FOLDERS.map((f) => (
                            <NavList.Item key={f.id}>
                                <NavList.Link href={`#/${f.id}`} current={r.kind === 'folder' && r.id === f.id}>
                                    <NavList.Icon><Icon name={f.icon} /></NavList.Icon>
                                    {f.name}
                                    {f.id === 'drafts' || f.id === 'sent' || f.id === 'archive' ? null : count(unreadCount(f.id))}
                                </NavList.Link>
                            </NavList.Item>
                        ))}
                    </NavList.List>
                    <NavList.Group>
                        <NavList.Heading>Labels</NavList.Heading>
                        <NavList.List>
                            {LABELS.map((l) => (
                                <NavList.Item key={l.id}>
                                    <NavList.Link href={`#/label/${l.id}`} current={r.kind === 'label' && r.id === l.id}>
                                        <NavList.Icon><Icon name="tag" tone={l.color === 'neutral' ? 'muted' : l.color} /></NavList.Icon>
                                        {l.name}
                                        {count(labelCount(l.id))}
                                    </NavList.Link>
                                </NavList.Item>
                            ))}
                        </NavList.List>
                    </NavList.Group>
                </NavList.Root>
                <Progress.Root value={9.3} max={15} getValueText={(v) => `${v} GB of 15 GB used`} size="sm">
                    <Progress.Label>Storage</Progress.Label>
                    <Progress.Track><Progress.Range /></Progress.Track>
                    <Progress.ValueText />
                </Progress.Root>
            </Col>
        </Drawer.Panel>
    );
}, { name: 'Sidebar' });
