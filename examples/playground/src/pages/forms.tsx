import { component, signal } from 'sigx';
import {
    Button, Checkbox, Combobox, Field, Input, NumberInput,
    RadioGroup, RatingGroup, Select, Slider, Switch, Textarea,
} from '@sigx/zero';
import type { PageEntry } from './registry';

const FRUITS = [
    { value: 'apple', label: 'Apple' },
    { value: 'banana', label: 'Banana' },
    { value: 'cherry', label: 'Cherry' },
];
const COUNTRIES = [
    { value: 'sweden', label: 'Sweden' },
    { value: 'norway', label: 'Norway' },
    { value: 'finland', label: 'Finland' },
];

/**
 * One real `<form>` over every posting control — the browser is the judge
 * here, not an attribute check: what `FormData` reads on submit, what
 * constraint validation blocks, what `reset` restores, what `form="id"`
 * pulls in from outside. The e2e forms spec drives this page in three
 * engines; the unit table (`form-participation.test.tsx`) proves the same
 * six claims per scope in happy-dom.
 */
const FormsDemos = component(() => {
    const state = signal({ posted: '' });

    const onSubmit = (e: Event): void => {
        e.preventDefault();
        const entries = [...new FormData(e.target as HTMLFormElement).entries()]
            .filter((entry): entry is [string, string] => typeof entry[1] === 'string');
        state.posted = JSON.stringify(Object.fromEntries(entries));
    };

    return () => (
        <>
            <p>
                <small>
                    Every control posts through the platform: the Select and
                    Combobox through a real, visually-hidden <code>&lt;select&gt;</code>{' '}
                    (so <code>required</code> is a browser constraint), the rest
                    through their own native element. Submit with the fruit
                    empty to see validation land on the trigger; Reset restores
                    every default, model included; the disabled field never
                    posts; the field <em>outside</em> the form posts through{' '}
                    <code>form="demo-form"</code>.
                </small>
            </p>
            <form id="demo-form" onSubmit={onSubmit}>
                <Field.Root required>
                    <Field.Label>Fruit</Field.Label>
                    <Select.Root name="form-fruit" placeholder="Pick a fruit…">
                        <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popup>
                            {FRUITS.map((f) => <Select.Item value={f.value} key={f.value}>{f.label}</Select.Item>)}
                        </Select.Popup>
                    </Select.Root>
                    <Field.Description>Required — submit without one to see the platform block it.</Field.Description>
                </Field.Root>
                <Field.Root required>
                    <Field.Label>Email</Field.Label>
                    <Input.Root name="form-email" type="email" defaultValue="me@example.com">
                        <Input.Control><Input.Input /></Input.Control>
                    </Input.Root>
                </Field.Root>
                <Field.Root>
                    <Field.Label>Country</Field.Label>
                    <Combobox.Root name="form-country" placeholder="Search countries…" items={COUNTRIES} />
                </Field.Root>
                <Field.Root>
                    <Field.Label>Plan</Field.Label>
                    <RadioGroup.Root
                        name="form-plan"
                        defaultValue="starter"
                        items={[{ id: 'starter', name: 'Starter' }, { id: 'team', name: 'Team' }]}
                        itemKey={(p) => p.id}
                        itemLabel={(p) => p.name}
                    />
                </Field.Root>
                {/* Unnamed: the radios share a generated name for the platform's
                  * arrow-key roving, but an unnamed group must not post under it. */}
                <RadioGroup.Root defaultValue="a">
                    <RadioGroup.Item value="a">Unnamed A</RadioGroup.Item>
                    <RadioGroup.Item value="b">Unnamed B</RadioGroup.Item>
                </RadioGroup.Root>
                <Checkbox.Root name="form-terms" value="yes">Agree to the form terms</Checkbox.Root>
                {' '}
                <Switch.Root name="form-notify" defaultChecked>Email me</Switch.Root>
                <Field.Root>
                    <Field.Label>Quantity</Field.Label>
                    <NumberInput.Root name="form-qty" defaultValue={1} min={0} max={9}>
                        <NumberInput.Control>
                            <NumberInput.DecrementTrigger>−</NumberInput.DecrementTrigger>
                            <NumberInput.Input />
                            <NumberInput.IncrementTrigger>+</NumberInput.IncrementTrigger>
                        </NumberInput.Control>
                    </NumberInput.Root>
                </Field.Root>
                <Field.Root>
                    <Field.Label>Rating</Field.Label>
                    <RatingGroup.Root name="form-stars" defaultValue={3}>
                        <RatingGroup.Control>
                            {[1, 2, 3, 4, 5].map((i) => <RatingGroup.Item index={i} key={i} />)}
                        </RatingGroup.Control>
                    </RatingGroup.Root>
                </Field.Root>
                <Field.Root>
                    <Field.Label>Volume</Field.Label>
                    <Slider.Root name="form-volume" defaultValue={40}>
                        <Slider.Control />
                    </Slider.Root>
                </Field.Root>
                <Field.Root>
                    <Field.Label>Bio</Field.Label>
                    <Textarea.Root name="form-bio" rows={2}>
                        <Textarea.Textarea />
                    </Textarea.Root>
                </Field.Root>
                <Field.Root disabled>
                    <Field.Label>Skipped (disabled never posts)</Field.Label>
                    <Input.Root name="form-skipped" defaultValue="never posts">
                        <Input.Control><Input.Input /></Input.Control>
                    </Input.Root>
                </Field.Root>
                <p>
                    <Button.Root type="submit">Submit</Button.Root>
                    {' '}
                    <Button.Root type="reset">Reset</Button.Root>
                </p>
            </form>
            <Field.Root>
                <Field.Label>Outside the form, associated by form="demo-form"</Field.Label>
                <Input.Root name="form-outside" form="demo-form" defaultValue="associated">
                    <Input.Control><Input.Input /></Input.Control>
                </Input.Root>
            </Field.Root>
            <p><small>Posted (FormData on submit):</small></p>
            <pre data-testid="posted">{state.posted || '—'}</pre>
        </>
    );
}, { name: 'FormsDemos' });

export const formsPage: PageEntry = {
    id: 'forms',
    title: 'Forms',
    category: 'Forms & inputs',
    Demos: FormsDemos,
};
