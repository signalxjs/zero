import { component } from 'sigx';
import { Checkbox, Field, Input, Select, Switch } from '@sigx/zero';
import { activeVocabulary } from '../design-systems';
import type { PageEntry } from './registry';

const MODES = ['ask', 'allow', 'deny'];

const FieldDemos = component(() => () => (
    <>
        <Field.Root required>
            <Field.Label>Subscription</Field.Label>
            <Checkbox.Root defaultChecked>Weekly newsletter</Checkbox.Root>
            <Field.Description>Wired label, description and required flag — automatically.</Field.Description>
        </Field.Root>
        {/*
          * `invalid` is a flag, not a colour. The field owns it and
          * every zero control inside adopts it — the checkbox below
          * is never told — and `Field.Error` is the part that carries
          * the message (`role="alert"`). What "wrong" looks like is
          * the design system's answer, so nothing here sets a colour.
          */}
        <Field.Root invalid required>
            <Field.Label>Terms</Field.Label>
            <Checkbox.Root>I accept the terms</Checkbox.Root>
            <Field.Description>Required before the form can be submitted.</Field.Description>
            <Field.Error>You must accept the terms to continue.</Field.Error>
        </Field.Root>
        {/*
          * Its OWN field, not a second control in the one above:
          * a `Field.Root` mints exactly one `ids.control`, so two
          * controls under one field is a duplicate `id` and a
          * `for` that resolves to whichever came first.
          *
          * Rendered at all because "every zero control inside
          * adopts it" was a claim with one control standing behind
          * it. Switch was the one that did not — it read no Field
          * context whatsoever until #269.
          */}
        <Field.Root invalid required>
            <Field.Label>Change notifications</Field.Label>
            <Switch.Root>Email me about changes</Switch.Root>
            <Field.Error>Pick a delivery method.</Field.Error>
        </Field.Root>

        <h2>Visually hidden labels</h2>
        {/*
          * One accessible name, three ways (#54). A Field.Label and the
          * Switch's own text are BOTH <label>s of the same input, so the
          * name concatenates them — name it once: here the Field names it
          * and the Switch renders no text of its own.
          */}
        <Field.Root>
            <Field.Label>Dark mode</Field.Label>
            <Switch.Root />
        </Field.Root>
        {/* The row says what it is; the switch keeps a name for AT alone. */}
        <p data-demo="row-named">
            Airplane mode <Switch.Root hideLabel>Airplane mode</Switch.Root>
        </p>
        {/* A compact control whose label is out of sight but still `for` it. */}
        <Field.Root>
            <Field.Label visuallyHidden>Search the docs</Field.Label>
            <Input.Root>
                <Input.Control>
                    <Input.Input placeholder="Search…" />
                </Input.Control>
            </Input.Root>
        </Field.Root>

        <h2>Compact</h2>
        {/*
          * #57: a field inside a chip. The Field's `size` reaches the control
          * — every zero control without a size of its own takes the Field's —
          * so one prop shrinks the select's chrome, and the label stays in
          * the accessibility tree while it leaves the screen. The step is the
          * active design system's smallest, read from its manifest: heroui's
          * ramp starts at `sm`, the recommended one at `xs`.
          */}
        <div data-demo="compact-field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>Bash</span>
            <Field.Root size={activeVocabulary().sizes[0]}>
                <Field.Label visuallyHidden>Mode for Bash</Field.Label>
                <Select.Root items={MODES} defaultValue="ask" />
            </Field.Root>
        </div>
        <Field.Root>
            <Field.Label>Mode for Read (the default step)</Field.Label>
            <Select.Root items={MODES} defaultValue="allow" />
        </Field.Root>
    </>
), { name: 'FieldDemos' });

export const fieldPage: PageEntry = {
    id: 'field',
    title: 'Field',
    category: 'Forms & inputs',
    Demos: FieldDemos,
};
