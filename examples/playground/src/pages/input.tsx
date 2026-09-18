import { component, signal } from 'sigx';
import { Field, Input } from '@sigx/zero';
import { DemoRow } from '../demo/Section';
import { pickRole } from '../design-systems';
import type { PageEntry } from './registry';

const InputDemos = component(() => {
    const state = signal({ email: '' });

    return () => (
        <>
            <p>
                A single-line text field. The model is a plain string written
                through on every keystroke — no draft/commit split, unlike
                NumberInput, because a string is always already itself.{' '}
                <code>control</code> is the box the border, the focus ring and
                the invalid tint draw on; the <code>input</code> inside it is
                transparent.
            </p>
            <DemoRow gap="1rem" align="flex-end">
                <Input.Root model={() => state.email} type="email" name="email" autocomplete="email">
                    <Input.Label>Email</Input.Label>
                    <Input.Control>
                        <Input.Input placeholder="you@example.com" />
                    </Input.Control>
                </Input.Root>
                <Input.Root type="password" autocomplete="current-password" color={pickRole('secondary')}>
                    <Input.Label>Password</Input.Label>
                    <Input.Control>
                        <Input.Input placeholder="••••••••" />
                    </Input.Control>
                </Input.Root>
                <Input.Root type="search" defaultValue="brutalist">
                    <Input.Label>Search</Input.Label>
                    <Input.Control>
                        <Input.Input placeholder="Filter…" />
                    </Input.Control>
                </Input.Root>
            </DemoRow>
            <DemoRow gap="1rem" align="flex-end">
                <Input.Root defaultValue="Locked" disabled>
                    <Input.Label>Disabled</Input.Label>
                    <Input.Control>
                        <Input.Input />
                    </Input.Control>
                </Input.Root>
                {/*
                  * Readonly is not disabled: the text stays selectable,
                  * focusable and copyable — only editing is shut.
                  */}
                <Input.Root defaultValue="ZX-4417-B" readonly>
                    <Input.Label>Readonly</Input.Label>
                    <Input.Control>
                        <Input.Input />
                    </Input.Control>
                </Input.Root>
                <Input.Root defaultValue="not-an-email" required invalid>
                    <Input.Label>Invalid + required</Input.Label>
                    <Input.Control>
                        <Input.Input />
                    </Input.Control>
                </Input.Root>
            </DemoRow>
            <p>
                Inside a <code>Field</code> the input adopts the field's id,
                its flags and its <code>aria-describedby</code>, so the field
                owns the label and the messages — which is the wiring a raw
                <code>&lt;input&gt;</code> in a <code>Field</code> never got.
            </p>
            <DemoRow gap="1rem" align="flex-start">
                <Field.Root invalid required>
                    <Field.Label>Work email</Field.Label>
                    <Input.Root type="email">
                        <Input.Control>
                            <Input.Input placeholder="you@work.com" />
                        </Input.Control>
                    </Input.Root>
                    <Field.Description>We only use this for receipts.</Field.Description>
                    <Field.Error>That address is already registered.</Field.Error>
                </Field.Root>
            </DemoRow>
            <p><small>Email model: <code>{state.email || '—'}</code></small></p>
        </>
    );
}, { name: 'InputDemos' });

export const inputPage: PageEntry = {
    id: 'input',
    title: 'Input',
    category: 'Forms & inputs',
    Demos: InputDemos,
};
