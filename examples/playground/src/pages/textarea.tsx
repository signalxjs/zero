import { component, signal } from 'sigx';
import { Field, Textarea } from '@sigx/zero';
import { DemoRow } from '../demo/Section';
import { pickRole } from '../design-systems';
import type { PageEntry } from './registry';

const TextareaDemos = component(() => {
    const state = signal({ bio: '' });

    return () => (
        <>
            <p>
                The multi-line field. Input's shape minus the{' '}
                <code>control</code> box: nothing sits inside a textarea for a
                wrapper to hold, so the border, the ring and the invalid tint
                draw on the element itself. Height is the reader's — the design
                system supplies <code>resize</code>, the runtime does not
                auto-size.
            </p>
            <DemoRow gap="1rem" align="flex-end">
                <Textarea.Root model={() => state.bio} name="bio" rows={4}>
                    <Textarea.Label>Bio</Textarea.Label>
                    <Textarea.Textarea placeholder="Tell us about yourself" />
                </Textarea.Root>
                <Textarea.Root rows={4} maxlength={280} color={pickRole('secondary')}>
                    <Textarea.Label>Note (max 280)</Textarea.Label>
                    <Textarea.Textarea placeholder="Short version…" />
                </Textarea.Root>
            </DemoRow>
            <DemoRow gap="1rem" align="flex-end">
                <Textarea.Root rows={3} defaultValue="Locked content." disabled>
                    <Textarea.Label>Disabled</Textarea.Label>
                    <Textarea.Textarea />
                </Textarea.Root>
                <Textarea.Root rows={3} defaultValue="Generated — not editable." readonly>
                    <Textarea.Label>Readonly</Textarea.Label>
                    <Textarea.Textarea />
                </Textarea.Root>
                <Textarea.Root rows={3} defaultValue="Too short" required invalid>
                    <Textarea.Label>Invalid + required</Textarea.Label>
                    <Textarea.Textarea />
                </Textarea.Root>
            </DemoRow>
            <p>
                Same Field adoption as Input — the field owns the label, the
                description and the error, and the textarea takes their ids.
            </p>
            <DemoRow gap="1rem" align="flex-start">
                <Field.Root invalid required>
                    <Field.Label>Why are you appealing?</Field.Label>
                    <Textarea.Root rows={3}>
                        <Textarea.Textarea placeholder="A sentence or two" />
                    </Textarea.Root>
                    <Field.Description>Plain text; markdown is not rendered.</Field.Description>
                    <Field.Error>Please give a reason.</Field.Error>
                </Field.Root>
            </DemoRow>
            <p><small>Bio model: <code>{state.bio || '—'}</code></small></p>
        </>
    );
}, { name: 'TextareaDemos' });

export const textareaPage: PageEntry = {
    id: 'textarea',
    title: 'Textarea',
    category: 'Forms & inputs',
    Demos: TextareaDemos,
};
