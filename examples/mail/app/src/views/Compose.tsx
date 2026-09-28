import { component } from 'sigx';
import { Button, Col, Combobox, Dialog, Field, FileUpload, Input, Kbd, Row, Stack, Textarea } from '@sigx/zero';
import { ActionButton, Icon, Text } from '@sigx/zero-mail-kit';
import { ALL_CONTACTS } from '../data/mock';
import type { Contact } from '../data/mock';
import { discardDraft, saveDraft, send, st } from '../store';

/** To / Cc: a multi-select combobox over the address book that also takes any typed address. */
const Recipients = component<{ field: 'to' | 'cc'; label: string }>(({ props }) => () => (
    <Field.Root>
        <Field.Label>{props.label}</Field.Label>
        <Combobox.Root
            multiple
            allowCustom
            autoHighlight
            items={ALL_CONTACTS}
            itemKey={(c: Contact) => c.email}
            itemLabel={(c: Contact) => c.name}
            itemValue={(c: Contact) => c.email}
            filter={(c: Contact, q: string) => `${c.name} ${c.email}`.toLowerCase().includes(q.toLowerCase())}
            model={[st.draft, props.field]}
            placeholder={st.draft[props.field].length ? '' : 'Name or email address'}
            emptyText="Press Enter to add this address"
            slots={{
                item: ({ item }: { item: Contact }) => (
                    <Col gap="none">
                        <Text weight="medium">{item.name}</Text>
                        <Text size="sm" tone="muted">{item.email}</Text>
                    </Col>
                ),
            }}
        />
    </Field.Root>
), { name: 'Recipients' });

export const Compose = component(() => {
    let sent = false;
    return () => (
        <Dialog.Root
            model={() => st.composeOpen}
            modal={false}
            // Start in To, not on the close button the tab order reaches first.
            initialFocus={() => document.querySelector<HTMLElement>('[aria-label="New message"] [data-scope="combobox"][data-part="input"]')}
            onClose={() => {
                if (!sent) saveDraft();
                sent = false;
            }}
        >
            <Dialog.Popup aria-label="New message">
                <Col gap="md">
                    <Row gap="sm" align="center" justify="between">
                        <Dialog.Title>{st.draft.subject || 'New message'}</Dialog.Title>
                        <ActionButton icon="x" label="Close and save draft" shortcut="Esc" onClick={() => { st.composeOpen = false; }} />
                    </Row>
                    <Recipients field="to" label="To" />
                    {st.draft.showCc ? <Recipients field="cc" label="Cc" /> : (
                        <Row justify="end">
                            <Button.Root variant="ghost" size="xs" onClick={() => { st.draft.showCc = true; }}>Add Cc</Button.Root>
                        </Row>
                    )}
                    <Input.Root model={() => st.draft.subject}>
                        <Input.Label>Subject</Input.Label>
                        <Input.Control><Input.Input placeholder="What's it about?" /></Input.Control>
                    </Input.Root>
                    <Textarea.Root model={() => st.draft.body} minRows={8} maxRows={18}>
                        <Textarea.Label visuallyHidden>Message</Textarea.Label>
                        <Textarea.Textarea
                            placeholder="Write your message…"
                            onKeydown={(e: KeyboardEvent) => {
                                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                    e.preventDefault();
                                    sent = send();
                                }
                            }}
                        />
                    </Textarea.Root>
                    <FileUpload.Root multiple maxFileSize={25_000_000} model={() => st.draft.files}>
                        <FileUpload.Label>Attachments</FileUpload.Label>
                        <FileUpload.ItemGroup>
                            {(files: File[]) => files.map((f) => (
                                <FileUpload.Item file={f} key={`${f.name}${f.size}${f.lastModified}`}>
                                    <FileUpload.ItemName />
                                    <FileUpload.ItemSize />
                                    <FileUpload.ItemRemove label={`Remove ${f.name}`}><Icon name="x" size="sm" /></FileUpload.ItemRemove>
                                </FileUpload.Item>
                            ))}
                        </FileUpload.ItemGroup>
                        <Dialog.Footer>
                            <Row gap="sm" align="center">
                                <Button.Root onClick={() => { sent = send(); }}><Icon name="send" /> Send</Button.Root>
                                <FileUpload.Trigger><Icon name="paperclip" /> Attach</FileUpload.Trigger>
                                <Text size="sm" tone="subtle"><Kbd size="xs">Ctrl</Kbd> + <Kbd size="xs">Enter</Kbd></Text>
                                <Stack.Item grow />
                                <Button.Root variant="ghost" size="sm" aria-label="Discard draft" onClick={() => { sent = true; discardDraft(); }}>
                                    <Icon name="trash" />
                                </Button.Root>
                            </Row>
                        </Dialog.Footer>
                    </FileUpload.Root>
                </Col>
            </Dialog.Popup>
        </Dialog.Root>
    );
}, { name: 'Compose' });
