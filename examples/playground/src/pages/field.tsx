import { component } from 'sigx';
import { Checkbox, Field, Switch } from '@sigx/zero';
import type { PageEntry } from './registry';

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
    </>
), { name: 'FieldDemos' });

export const fieldPage: PageEntry = {
    id: 'field',
    title: 'Field',
    category: 'Forms & inputs',
    Demos: FieldDemos,
};
