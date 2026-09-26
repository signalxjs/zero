import { component, signal } from 'sigx';
import {
    Button, Checkbox, Combobox, Field, Fieldset, Input, NumberInput,
    RadioGroup, RatingGroup, Select, Slider, Switch, Textarea, ToggleGroup,
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
    const state = signal({ posted: '', validPosted: '', fieldsetPosted: '', shipElsewhere: false });

    const onSubmit = (e: Event): void => {
        e.preventDefault();
        const entries = [...new FormData(e.target as HTMLFormElement).entries()]
            .filter((entry): entry is [string, string] => typeof entry[1] === 'string');
        // A repeated field (a `multiple` ToggleGroup) reads as an array.
        const posted: Record<string, string | string[]> = {};
        for (const [k, v] of entries) {
            const prev = posted[k];
            posted[k] = prev === undefined ? v : Array.isArray(prev) ? [...prev, v] : [prev, v];
        }
        state.posted = JSON.stringify(posted);
    };

    return () => (
        <>
            <p>
                <small>
                    Every control posts through the platform: the Select,
                    Combobox and ToggleGroup through a real, visually-hidden <code>&lt;select&gt;</code>{' '}
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
                <Field.Root>
                    <Field.Label>Layout</Field.Label>
                    <ToggleGroup.Root name="form-layout" defaultValue="grid">
                        <ToggleGroup.Item value="list">List</ToggleGroup.Item>
                        <ToggleGroup.Item value="grid">Grid</ToggleGroup.Item>
                    </ToggleGroup.Root>
                </Field.Root>
                <Field.Root>
                    <Field.Label>Marks</Field.Label>
                    <ToggleGroup.Root name="form-marks" multiple defaultValue={['bold']}>
                        <ToggleGroup.Item value="bold">Bold</ToggleGroup.Item>
                        <ToggleGroup.Item value="italic">Italic</ToggleGroup.Item>
                    </ToggleGroup.Root>
                </Field.Root>
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
            <h2>Validation</h2>
            <p>
                <small>
                    <code>Field.Root</code> surfaces the platform's constraint API
                    (#284): each <code>Field.Error</code> below names the{' '}
                    <code>ValidityState</code> key it speaks for
                    (<code>match="valueMissing"</code>,{' '}
                    <code>"patternMismatch"</code>, <code>"typeMismatch"</code>) or <code>"custom"</code> for the
                    Field's own <code>validate</code>, whose message blocks the
                    native submit through <code>setCustomValidity</code>. Nothing
                    shows until a failed submit — then every change revalidates —
                    except the email, which validates on leaving it
                    (<code>validateOn="blur"</code>). Focus goes to the first
                    invalid control; Reset forgets it all.
                </small>
            </p>
            <form
                id="validated-form"
                data-demo="validated-form"
                onSubmit={(e: Event) => {
                    e.preventDefault();
                    const data = new FormData(e.target as HTMLFormElement);
                    state.validPosted = JSON.stringify(Object.fromEntries(
                        [...data.entries()].filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
                    ));
                }}
                onReset={() => { state.validPosted = ''; }}
            >
                <Field.Root validate={(v) => (v === 'admin' ? 'That username is reserved.' : null)}>
                    <Field.Label>Username</Field.Label>
                    <Input.Root name="val-user" required pattern="[a-z]{3,}">
                        <Input.Control><Input.Input /></Input.Control>
                    </Input.Root>
                    <Field.Description>Three or more lowercase letters.</Field.Description>
                    <Field.Error match="valueMissing">Choose a username.</Field.Error>
                    <Field.Error match="patternMismatch">Three or more lowercase letters.</Field.Error>
                    <Field.Error match="custom" />
                </Field.Root>
                <Field.Root validateOn="blur">
                    <Field.Label>Contact email</Field.Label>
                    <Input.Root name="val-email" type="email" required>
                        <Input.Control><Input.Input /></Input.Control>
                    </Input.Root>
                    <Field.Error match="valueMissing">Enter an email address.</Field.Error>
                    <Field.Error match="typeMismatch">That is not an email address.</Field.Error>
                </Field.Root>
                <Field.Root required>
                    <Field.Label>Favourite fruit</Field.Label>
                    <Select.Root name="val-fruit" placeholder="Pick a fruit…" items={FRUITS} itemKey={(f) => f.value} itemValue={(f) => f.value} />
                    <Field.Error match="valueMissing">Pick a fruit.</Field.Error>
                </Field.Root>
                <Field.Root required>
                    <Checkbox.Root name="val-terms" value="yes">I accept the terms</Checkbox.Root>
                    <Field.Error match="valueMissing">Accept the terms to continue.</Field.Error>
                </Field.Root>
                <p>
                    <Button.Root type="submit">Create account</Button.Root>
                    {' '}
                    <Button.Root type="reset">Reset</Button.Root>
                </p>
            </form>
            <pre data-testid="validated-posted">{state.validPosted || '—'}</pre>
            <h2>Readonly</h2>
            <p>
                <small>
                    <code>readonly</code> on a <code>Field.Root</code> reaches every
                    control inside it, not only the text inputs (#267). Each one
                    below stays focusable and announced, but no click, key,
                    press or drag changes its value — the Select does not open,
                    the radios' arrow keys move focus without choosing, and the
                    sliders neither step nor drag.
                </small>
            </p>
            <Field.Root readonly>
                <Field.Label>Terms (readonly)</Field.Label>
                <Checkbox.Root name="ro-terms" defaultChecked>Accepted at sign-up</Checkbox.Root>
            </Field.Root>
            <Field.Root readonly>
                <Field.Label>Notifications (readonly)</Field.Label>
                <Switch.Root name="ro-notify">Email me</Switch.Root>
            </Field.Root>
            <Field.Root readonly>
                <Field.Label>Plan (readonly)</Field.Label>
                <RadioGroup.Root
                    name="ro-plan"
                    defaultValue="starter"
                    items={[{ id: 'starter', name: 'Starter' }, { id: 'team', name: 'Team' }]}
                    itemKey={(p) => p.id}
                    itemLabel={(p) => p.name}
                />
            </Field.Root>
            <Field.Root readonly>
                <Field.Label>Fruit (readonly)</Field.Label>
                <Select.Root name="ro-fruit" defaultValue="banana" items={FRUITS} itemKey={(f) => f.value} itemValue={(f) => f.value} />
            </Field.Root>
            <Field.Root readonly>
                <Field.Label>Volume (readonly)</Field.Label>
                <Slider.Root name="ro-volume" defaultValue={40}>
                    <Slider.Control />
                </Slider.Root>
            </Field.Root>
            <Slider.Root name="ro-price" defaultValue={[20, 60]} readonly>
                <Slider.Label>Price range (readonly)</Slider.Label>
                <Slider.Track>
                    <Slider.Range />
                    <Slider.Thumb label="Minimum price" />
                    <Slider.Thumb label="Maximum price" />
                </Slider.Track>
                <Slider.ValueText />
            </Slider.Root>
            <h2>Fieldset</h2>
            <p>
                <small>
                    <code>Fieldset.Root</code> renders a native{' '}
                    <code>&lt;fieldset&gt;</code> named by its{' '}
                    <code>Fieldset.Legend</code> (#285). Its <code>disabled</code>{' '}
                    disables the native controls the platform's way and reaches
                    the ones zero draws itself — the slider thumb, the radio
                    items, the select trigger — through context, so nothing
                    inside takes input or posts. The checkbox in the legend
                    stays live, as the platform exempts a legend's controls:
                    tick it to enable the section. <code>readonly</code> and{' '}
                    <code>invalid</code>, which a native fieldset cannot say,
                    reach every control the same way.
                </small>
            </p>
            <form
                data-demo="fieldset-form"
                onSubmit={(e: Event) => {
                    e.preventDefault();
                    const data = new FormData(e.target as HTMLFormElement);
                    state.fieldsetPosted = JSON.stringify(Object.fromEntries(
                        [...data.entries()].filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
                    ));
                }}
            >
                <Fieldset.Root disabled={!state.shipElsewhere}>
                    <Fieldset.Legend>
                        <Checkbox.Root model={[state, 'shipElsewhere']}>Ship to a different address</Checkbox.Root>
                    </Fieldset.Legend>
                    <Field.Root>
                        <Field.Label>Street</Field.Label>
                        <Input.Root name="fs-street" defaultValue="Storgatan 1">
                            <Input.Control><Input.Input /></Input.Control>
                        </Input.Root>
                    </Field.Root>
                    <Field.Root>
                        <Field.Label>Country</Field.Label>
                        <Select.Root name="fs-country" defaultValue="sweden" items={COUNTRIES} itemKey={(c) => c.value} itemValue={(c) => c.value} />
                    </Field.Root>
                    <Field.Root>
                        <Field.Label>Delivery</Field.Label>
                        <RadioGroup.Root
                            name="fs-delivery"
                            defaultValue="standard"
                            items={[{ id: 'standard', name: 'Standard' }, { id: 'express', name: 'Express' }]}
                            itemKey={(d) => d.id}
                            itemLabel={(d) => d.name}
                        />
                    </Field.Root>
                    <Slider.Root name="fs-priority" defaultValue={[2]} min={0} max={5}>
                        <Slider.Label>Priority</Slider.Label>
                        <Slider.Track>
                            <Slider.Range />
                            <Slider.Thumb label="Priority" />
                        </Slider.Track>
                    </Slider.Root>
                </Fieldset.Root>
                <p><Button.Root type="submit">Save address</Button.Root></p>
            </form>
            <pre data-testid="fieldset-posted">{state.fieldsetPosted || '—'}</pre>
            <Fieldset.Root readonly>
                <Fieldset.Legend>Billing (readonly)</Fieldset.Legend>
                <Field.Root>
                    <Field.Label>Company</Field.Label>
                    <Input.Root name="fs-company" defaultValue="Acme AB">
                        <Input.Control><Input.Input /></Input.Control>
                    </Input.Root>
                </Field.Root>
                <Switch.Root name="fs-invoice" defaultChecked>Paper invoice</Switch.Root>
            </Fieldset.Root>
            <Fieldset.Root invalid>
                <Fieldset.Legend>Contact me by (invalid)</Fieldset.Legend>
                <Checkbox.Root name="fs-contact-email">Email</Checkbox.Root>
                <Checkbox.Root name="fs-contact-phone">Phone</Checkbox.Root>
                <p><small>Choose at least one.</small></p>
            </Fieldset.Root>
        </>
    );
}, { name: 'FormsDemos' });

export const formsPage: PageEntry = {
    id: 'forms',
    title: 'Forms',
    category: 'Forms & inputs',
    Demos: FormsDemos,
};
