import { component, signal } from 'sigx';
import { Combobox, Field } from '@sigx/zero';
import { DemoRow } from '../demo/Section';
import type { PageEntry } from './registry';

const COUNTRIES = [
    'Argentina', 'Australia', 'Brazil', 'Canada', 'Denmark', 'Finland',
    'Germany', 'Iceland', 'Japan', 'Kenya', 'Mexico', 'Norway',
    'Portugal', 'Sweden', 'Thailand', 'Uruguay',
];

const ComboboxDemos = component(() => {
    const state = signal({
        country: '',
        countryQuery: '',
        countryOpen: false,
    });

    return () => (
        <>
            <p>
                The named-models convention in action: <code>model</code> is the
                selected value, <code>model:inputValue</code> the text,
                <code>model:open</code> the popup — and filtering is the
                consumer's, so this list is a plain <code>.filter()</code> over
                the bound query.
            </p>
            <Combobox.Root
                model={() => state.country}
                model:inputValue={() => state.countryQuery}
                model:open={() => state.countryOpen}
                name="country"
                placeholder="Search countries…"
            >
                <Combobox.Control>
                    <Combobox.Input />
                    <Combobox.Trigger />
                </Combobox.Control>
                <Combobox.Popup>
                    {COUNTRIES
                        .filter((c) => c.toLowerCase().includes(state.countryQuery.toLowerCase()))
                        .map((c) => (
                            <Combobox.Item value={c.toLowerCase()} key={c}>{c}</Combobox.Item>
                        ))}
                    {COUNTRIES.every((c) => !c.toLowerCase().includes(state.countryQuery.toLowerCase()))
                        ? <Combobox.Empty>No countries match</Combobox.Empty>
                        : null}
                </Combobox.Popup>
            </Combobox.Root>
            <p><small>Selected: <code>{state.country || '—'}</code></small></p>
            <h2>Option groups</h2>
            <p>
                <small>
                    <code>Combobox.Group</code> + <code>Combobox.GroupLabel</code>{' '}
                    — the optgroup equivalent; the consumer's filter renders or
                    omits whole groups.
                </small>
            </p>
            <Combobox.Root name="grouped-country" placeholder="Pick a region…">
                <Combobox.Control>
                    <Combobox.Input />
                    <Combobox.Trigger />
                </Combobox.Control>
                <Combobox.Popup>
                    <Combobox.Group>
                        <Combobox.GroupLabel>Nordics</Combobox.GroupLabel>
                        <Combobox.Item value="norway">Norway</Combobox.Item>
                        <Combobox.Item value="sweden">Sweden</Combobox.Item>
                    </Combobox.Group>
                    <Combobox.Group>
                        <Combobox.GroupLabel>Oceania</Combobox.GroupLabel>
                        <Combobox.Item value="australia">Australia</Combobox.Item>
                    </Combobox.Group>
                </Combobox.Popup>
            </Combobox.Root>
            <p>
                <code>readonly</code> and <code>invalid</code> are chrome, not
                branches you have to write: readonly keeps the value, refuses to
                open and marks every part, invalid only flags. Both are stated
                once on the root.
            </p>
            {/*
              * Each sample wrapped in its own Field: unlike the interactive
              * demo above (whose placeholder doubles as a hint), these carry
              * no placeholder, so without a Field.Label naming the input
              * through the field's control id they are unlabelled text
              * inputs — the axe audit hard-fails on exactly that (#326).
              */}
            <DemoRow gap="1rem">
                <Field.Root>
                    <Field.Label>Readonly country</Field.Label>
                    <Combobox.Root readonly defaultValue="sweden" defaultInputValue="Sweden">
                        <Combobox.Control>
                            <Combobox.Input />
                            <Combobox.Trigger />
                        </Combobox.Control>
                        <Combobox.Popup>
                            <Combobox.Item value="sweden">Sweden</Combobox.Item>
                        </Combobox.Popup>
                    </Combobox.Root>
                </Field.Root>
                <Field.Root>
                    <Field.Label>Invalid country</Field.Label>
                    <Combobox.Root invalid defaultInputValue="Atlantis">
                        <Combobox.Control>
                            <Combobox.Input />
                            <Combobox.Trigger />
                        </Combobox.Control>
                        <Combobox.Popup>
                            <Combobox.Item value="sweden">Sweden</Combobox.Item>
                            <Combobox.Item value="norway">Norway</Combobox.Item>
                        </Combobox.Popup>
                    </Combobox.Root>
                </Field.Root>
            </DemoRow>
        </>
    );
}, { name: 'ComboboxDemos' });

export const comboboxPage: PageEntry = {
    id: 'combobox',
    title: 'Combobox',
    category: 'Forms & inputs',
    Demos: ComboboxDemos,
};
