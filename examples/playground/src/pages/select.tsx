import { component, signal } from 'sigx';
import { Field, Select } from '@sigx/zero';
import { activeVocabulary } from '../design-systems';
import type { PageEntry } from './registry';

const SelectDemos = component(() => {
    const state = signal({ fruit: '' });

    return () => (
        <>
            {/*
              * Named like the Combobox page's: the hidden input is
              * what a Select posts, so the interactive one carries the
              * field name it would have in a real form. It is also what
              * identifies this instance to the e2e suite — the invalid
              * sample beside it and the five in the size ramp are the
              * same anatomy, and a spec that means *this* select has to
              * say so rather than take whichever comes first.
              */}
            <Select.Root model={() => state.fruit} name="fruit" placeholder="Pick a fruit…">
                {/*
                  * `label` on every bare trigger below: role="combobox"
                  * prohibits name-from-content, so without it (or a Field
                  * wrapping the demo) each select is a nameless button to
                  * AT — the axe audit hard-fails on exactly that (#326).
                  */}
                <Select.Trigger label="Fruit">
                    <Select.Value />
                    <Select.Indicator />
                </Select.Trigger>
                <Select.Popup>
                    <Select.Item value="apple">Apple</Select.Item>
                    <Select.Item value="banana">Banana</Select.Item>
                    <Select.Item value="cherry">Cherry</Select.Item>
                </Select.Popup>
            </Select.Root>
            {' '}
            <Select.Root invalid placeholder="Pick a fruit…">
                <Select.Trigger label="Fruit (invalid sample)">
                    <Select.Value />
                    <Select.Indicator />
                </Select.Trigger>
                <Select.Popup>
                    <Select.Item value="apple">Apple</Select.Item>
                    <Select.Item value="banana">Banana</Select.Item>
                </Select.Popup>
            </Select.Root>
            <h2>Options array</h2>
            <p>
                <small>
                    The one-liner (#333): <code>options</code> on{' '}
                    <code>Select.Root</code> renders the default composition —
                    items, and Group/GroupLabel per distinct{' '}
                    <code>group</code> — through the same anatomy. Slot
                    children win entirely when both are given. The Field names
                    the generated trigger.
                </small>
            </p>
            <Field.Root>
                <Field.Label>Fruit (options-driven)</Field.Label>
                <Select.Root
                    name="sugar-fruit"
                    placeholder="Pick a fruit…"
                    items={[
                        { value: 'lemon', label: 'Lemon', group: 'Citrus' },
                        { value: 'lime', label: 'Lime', group: 'Citrus' },
                        { value: 'peach', label: 'Peach', group: 'Stone fruit' },
                        { value: 'banana', label: 'Banana' },
                        { value: 'durian', label: 'Durian', disabled: true },
                    ]}
                />
            </Field.Root>
            <h2>Option groups</h2>
            <p>
                <small>
                    The optgroup equivalent: <code>Select.Group</code> +{' '}
                    <code>Select.GroupLabel</code> — <code>role="group"</code>{' '}
                    named by its label inside the listbox.
                </small>
            </p>
            <Select.Root name="grouped-fruit" placeholder="Pick a fruit…">
                <Select.Trigger label="Fruit (grouped)">
                    <Select.Value />
                    <Select.Indicator />
                </Select.Trigger>
                <Select.Popup>
                    <Select.Group>
                        <Select.GroupLabel>Citrus</Select.GroupLabel>
                        <Select.Item value="lemon">Lemon</Select.Item>
                        <Select.Item value="lime">Lime</Select.Item>
                    </Select.Group>
                    <Select.Group>
                        <Select.GroupLabel>Stone fruit</Select.GroupLabel>
                        <Select.Item value="peach">Peach</Select.Item>
                        <Select.Item value="plum">Plum</Select.Item>
                    </Select.Group>
                </Select.Popup>
            </Select.Root>
            {/*
              * The first scope other than button to wire a variant (#297).
              * zero-basic gives select its OWN three-value vocabulary through
              * `tokens.scopes` — `outline | soft | ghost`, without button's
              * `solid`, because a field filled with the role at full strength
              * reads as a button.
              *
              * The row is the manifest's, not a retyped literal: it maps the
              * live design system's per-scope wired list, so a design system
              * that wires two variants shows two and one that wires none
              * shows none — the same rule the axis rows follow, asked of the
              * scope. Retyping a hardcoded array here was exactly the drift
              * the axis rows already paid for (see the note above
              * `basicManifestUrl` in design-systems.ts).
              */}
            <p>
                <small>
                    Every <code>variant</code> the live design system wires on
                    the <code>select</code> scope, straight from its manifest.
                    zero-basic wires <code>outline | soft | ghost</code>; other
                    design systems wire none here, and the row is empty.
                </small>
            </p>
            {(activeVocabulary().perScope['select']?.variants ?? []).map((v) => (
                <>
                    <Select.Root variant={v} placeholder={`${v}…`}>
                        <Select.Trigger label={`Fruit (${v} variant)`}>
                            <Select.Value />
                            <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popup>
                            <Select.Item value="apple">Apple</Select.Item>
                            <Select.Item value="banana">Banana</Select.Item>
                        </Select.Popup>
                    </Select.Root>
                    {' '}
                </>
            ))}
        </>
    );
}, { name: 'SelectDemos' });

export const selectPage: PageEntry = {
    id: 'select',
    title: 'Select',
    category: 'Forms & inputs',
    Demos: SelectDemos,
};
