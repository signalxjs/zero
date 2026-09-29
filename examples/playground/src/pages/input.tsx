import { component, signal } from 'sigx';
import { Field, Input } from '@sigx/zero';
import { DemoRow } from '../demo/Section';
import { pickRole, pickScopeVariant } from '../design-systems';
import type { PageEntry } from './registry';

const InputDemos = component(() => {
    const state = signal({ email: '', code: '', codeError: '', query: 'anatomy', shown: false });

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
            <p>
                The native constraint and keyboard hints are typed props on
                the Root — <code>pattern</code>, <code>minlength</code>,{' '}
                <code>inputmode</code>, <code>enterkeyhint</code>,{' '}
                <code>autocorrect</code>, <code>spellcheck</code> — so the
                browser's own validation runs. The error below exists only
                while the value fails it, and the input's{' '}
                <code>aria-describedby</code> follows: it never names an id
                nothing carries.
            </p>
            <DemoRow gap="1rem" align="flex-start">
                <Field.Root invalid={!!state.codeError} data-demo="verification-code">
                    <Field.Label>Verification code</Field.Label>
                    <Input.Root
                        model={() => state.code}
                        name="code"
                        pattern="[0-9]{6}"
                        maxlength={6}
                        inputmode="numeric"
                        enterkeyhint="done"
                        autocomplete="one-time-code"
                        autocorrect="off"
                        autocapitalize="off"
                        spellcheck={false}
                    >
                        <Input.Control>
                            <Input.Input
                                placeholder="123456"
                                onInput={(e: Event) => {
                                    const el = e.target as HTMLInputElement;
                                    state.codeError = el.value === '' || el.checkValidity() ? '' : 'Six digits, nothing else.';
                                }}
                            />
                        </Input.Control>
                    </Input.Root>
                    {state.codeError ? <Field.Error>{state.codeError}</Field.Error> : null}
                </Field.Root>
            </DemoRow>
            <p>
                The control is also a row for the affordances.{' '}
                <code>Adornment</code> puts an icon at a logical edge
                (<code>placement="start" | "end"</code>), and{' '}
                <code>Affix</code> puts prefix or suffix text there — two parts,
                because a design system lays them out apart (Material sets an
                affix on the text line and shows it only once the label has
                floated). A press on either focuses the input.{' '}
                <code>ClearTrigger</code> empties the value
                the way typing would and exists only while there is something
                to clear; in a <code>search</code> field Escape does the same.{' '}
                <code>VisibilityTrigger</code> shows a password through{' '}
                <code>model:visible</code>, as a pressed toggle.
            </p>
            <DemoRow gap="1rem" align="flex-end">
                <Input.Root type="search" model={() => state.query} data-demo="search-affordances">
                    <Input.Label>Search docs</Input.Label>
                    <Input.Control>
                        <Input.Adornment placement="start"><span aria-hidden="true">⌕</span></Input.Adornment>
                        <Input.Input placeholder="Filter…" />
                        <Input.ClearTrigger label="Clear search" />
                    </Input.Control>
                </Input.Root>
                <Input.Root type="password" defaultValue="correct horse" model:visible={() => state.shown} autocomplete="new-password" data-demo="password-affordances">
                    <Input.Label>New password</Input.Label>
                    <Input.Control>
                        <Input.Input />
                        <Input.ClearTrigger />
                        <Input.VisibilityTrigger />
                    </Input.Control>
                </Input.Root>
                <Input.Root type="url" defaultValue="example" data-demo="url-affordances">
                    <Input.Label>Website</Input.Label>
                    <Input.Control>
                        <Input.Affix placement="start">https://</Input.Affix>
                        <Input.Input />
                        <Input.Affix placement="end">.com</Input.Affix>
                    </Input.Control>
                </Input.Root>
                <Input.Root inputmode="decimal" data-demo="weight-affix">
                    <Input.Label>Weight</Input.Label>
                    <Input.Control>
                        <Input.Input />
                        <Input.Affix placement="end">kg</Input.Affix>
                    </Input.Control>
                </Input.Root>
            </DemoRow>
            <p>
                <code>Outline</code> is optional: a <code>&lt;fieldset&gt;</code>{' '}
                over the control whose <code>&lt;legend&gt;</code> — the{' '}
                <code>notch</code> — cuts the gap a floated label sits in. The
                runtime publishes the label's width as{' '}
                <code>--input-label-inline-size</code>, so a design system
                whose label floats onto the border (Material's outlined field)
                really cuts it, over any background. A skin whose label never
                floats leaves it undisplayed.
            </p>
            <DemoRow gap="1rem" align="flex-end">
                <Input.Root variant={pickScopeVariant('input', 'outlined')} data-demo="outline-empty">
                    <Input.Label>Outlined, empty</Input.Label>
                    <Input.Control>
                        <Input.Input />
                        <Input.Outline />
                    </Input.Control>
                </Input.Root>
                <Input.Root variant={pickScopeVariant('input', 'outlined')} defaultValue="Ada Lovelace" data-demo="outline-filled">
                    <Input.Label>Full name</Input.Label>
                    <Input.Control>
                        <Input.Input />
                        <Input.Outline />
                    </Input.Control>
                </Input.Root>
                <Field.Root data-demo="outline-field">
                    <Field.Label>Home city</Field.Label>
                    <Input.Root variant={pickScopeVariant('input', 'outlined')} defaultValue="Uppsala">
                        <Input.Control>
                            <Input.Adornment placement="start"><span aria-hidden="true">⌂</span></Input.Adornment>
                            <Input.Input />
                            <Input.Outline />
                        </Input.Control>
                    </Input.Root>
                </Field.Root>
            </DemoRow>
            <p><small>
                Query: <code>{state.query || '—'}</code> · password shown:{' '}
                <code>{state.shown ? 'yes' : 'no'}</code>
            </small></p>
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
