/**
 * Program (a): the `/register` surface, as an app consumes it (#326).
 *
 * One side-effect import narrows every axis prop repo-wide to what
 * zero-basic's compiled recipes actually wire — this file is the first
 * consumer-side proof that the EMITTED `register.d.ts` (dist/, via package
 * exports — not the source, not a golden copy) delivers that narrowing to
 * an app's own tsc. The kit-side golden tests prove the file's content;
 * this proves the *pipeline*: exports resolution, module augmentation
 * across package boundaries, and the JSX prop surface.
 */
import '@sigx/zero-basic/register';
import { component } from 'sigx';
import { Badge, Button, Collapsible, Select, Switch, Tabs } from '@sigx/zero';

export const App = component(() => () => (
    <>
        {/* ── positive narrowing: values zero-basic wires compile ── */}
        <Button.Root color="primary" variant="ghost" size="lg">Save</Button.Root>
        <Badge.Root color="warning" variant="soft" size="sm">3</Badge.Root>
        <Switch.Root color="accent" size="md" defaultChecked>Notify</Switch.Root>
        <Tabs.Root color="neutral" size="sm" defaultValue="one">
            <Tabs.List>
                <Tabs.Tab value="one">One</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="one">…</Tabs.Panel>
        </Tabs.Root>
        {/* select's variant vocabulary is its OWN (tokens.scopes): outline |
          * soft | ghost — narrower than button's, and without `solid`. */}
        <Select.Root variant="outline" placeholder="Pick…">
            <Select.Trigger label="Fruit">
                <Select.Value />
            </Select.Trigger>
            <Select.Popup>
                <Select.Item value="apple">Apple</Select.Item>
            </Select.Popup>
        </Select.Root>

        {/* ── invalid axis values are compile errors under the register ── */}
        <Button.Root
            /* @ts-expect-error — not a zero-basic color */
            color="crimson"
        >
            Nope
        </Button.Root>
        <Button.Root
            /* @ts-expect-error — zero-basic wires no 2xl size step */
            size="2xl"
        >
            Nope
        </Button.Root>
        {/* per-scope vocabularies stay separate: `solid` is button's
          * variant, never select's */}
        <Select.Root
            /* @ts-expect-error — not a select variant under zero-basic */
            variant="solid"
        >
            <Select.Trigger label="Fruit" />
        </Select.Root>

        {/* ── unwired means unusable: the vocabulary says `never`, and the
          * JSX prop surface strips the prop entirely ── */}
        <Tabs.Root
            defaultValue="one"
            /* @ts-expect-error — basic wires no variant on tabs */
            variant="solid"
        />
        {/* #321 wired color/size on the Contract v1 carriers, so `color` now
          * compiles here — the axis that stays unusable is `variant`. */}
        <Collapsible.Root
            color="primary"
            /* @ts-expect-error — basic wires no variant on collapsible */
            variant="solid"
        />
    </>
), { name: 'TypedApp.Register' });
