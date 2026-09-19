import { component, signal } from 'sigx';
import { Combobox, Field, Textarea } from '@sigx/zero';
import { DemoRow } from '../demo/Section';
import { STATIONS } from './fixtures';
import type { PageEntry } from './registry';

const COUNTRIES = [
    'Argentina', 'Australia', 'Brazil', 'Canada', 'Denmark', 'Finland',
    'Germany', 'Iceland', 'Japan', 'Kenya', 'Mexico', 'Norway',
    'Portugal', 'Sweden', 'Thailand', 'Uruguay',
];

const TOOLS = ['browser', 'editor', 'git', 'search', 'shell'];

const AGENTS = [
    { id: 'atlas', name: 'Atlas' },
    { id: 'ada', name: 'Ada' },
    { id: 'grace', name: 'Grace' },
    { id: 'linus', name: 'Linus' },
];

const ComboboxDemos = component(() => {
    const state = signal({
        country: '',
        countryQuery: '',
        countryOpen: false,
        message: '',
        mentioned: [] as string[],
        sent: '',
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
            <h2>Long lists</h2>
            <p>
                <small>
                    <code>virtual</code> windows a data-mode list (#96): 10,000
                    options, filtered as you type, with only the ones near the
                    popup's scroll position in the document. The highlighted
                    option stays rendered even when you scroll away from it —
                    the input's <code>aria-activedescendant</code> always names
                    a real element.
                </small>
            </p>
            <Field.Root>
                <Field.Label>Station search (10,000 options)</Field.Label>
                <Combobox.Root
                    items={STATIONS}
                    virtual
                    name="station-search"
                    placeholder="Search stations…"
                    emptyText="No station matches"
                />
            </Field.Root>
            <h2>Multiple, with tags</h2>
            <p>
                <small>
                    Under <code>multiple</code> each chosen value is a tag in the
                    control. Backspace on the empty input removes the last one;
                    each tag's remove button is a real button.{' '}
                    <code>allowCustom</code> commits free text on Enter while no
                    option is highlighted. Every value posts as a repeated
                    field.
                </small>
            </p>
            <Field.Root>
                <Field.Label>Tools</Field.Label>
                <Combobox.Root
                    multiple
                    allowCustom
                    items={TOOLS}
                    defaultValue={['search', 'shell']}
                    name="tools"
                    placeholder="Add a tool…"
                    emptyText="Press Enter to add it"
                />
            </Field.Root>
            <p>
                Trigger mode: <code>trigger="@"</code> turns the{' '}
                <code>Textarea</code> inside the root into the combobox's
                control. The token at the caret is the query, the textarea is an
                ARIA combobox while the list is open, and Enter or Tab replaces
                the token with the label — while the list is closed, Enter is
                the composer's own (send).
            </p>
            <Combobox.Root
                trigger="@"
                items={AGENTS}
                itemKey={(a) => a.id}
                itemLabel={(a) => a.name}
                onInsert={(d) => { state.mentioned = [...state.mentioned, d.value.id]; }}
            >
                <Textarea.Root model={() => state.message} minRows={2} maxRows={6}>
                    <Textarea.Label>Message (@ to mention)</Textarea.Label>
                    <Textarea.Textarea
                        placeholder="Ask the team, @ someone…"
                        onKeydown={(e: KeyboardEvent) => {
                            if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
                            e.preventDefault();
                            state.sent = state.message;
                            state.message = '';
                        }}
                    />
                </Textarea.Root>
            </Combobox.Root>
            <p><small>Mentioned: <code>{state.mentioned.join(', ') || '—'}</code> · Sent: <code>{state.sent || '—'}</code></small></p>
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
