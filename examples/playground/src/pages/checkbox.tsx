import { component, signal } from 'sigx';
import { Checkbox, CheckboxGroup } from '@sigx/zero';
import { DemoRow } from '../demo/Section';
import type { PageEntry } from './registry';

const TOPPINGS = ['ham', 'olives', 'basil'];

const CheckboxDemos = component(() => {
    const state = signal({ toppings: ['olives'] as string[] });

    return () => (
        <>
            <p>
                A checkbox has three states, not two: <code>indeterminate</code>{' '}
                is its own <code>data-state</code>, and it survives the round trip
                to the hidden input, which carries the DOM property no attribute
                can express.
            </p>
            <DemoRow gap="1rem">
                <Checkbox.Root indeterminate>Some selected</Checkbox.Root>
                <Checkbox.Root defaultChecked>All selected</Checkbox.Root>
                <Checkbox.Root>None selected</Checkbox.Root>
            </DemoRow>
            <p>
                A <code>CheckboxGroup</code> gives the boxes one{' '}
                <code>string[]</code> model and a name. The <code>parent</code>{' '}
                box derives its state from the others — checked when all are,
                indeterminate when some are — and toggling it selects all or none.
            </p>
            <CheckboxGroup.Root model={() => state.toppings} allValues={TOPPINGS} name="toppings">
                <CheckboxGroup.Label>Toppings</CheckboxGroup.Label>
                <Checkbox.Root parent>All toppings</Checkbox.Root>
                <Checkbox.Root value="ham">Ham</Checkbox.Root>
                <Checkbox.Root value="olives">Olives</Checkbox.Root>
                <Checkbox.Root value="basil">Basil</Checkbox.Root>
            </CheckboxGroup.Root>
            <p>
                Selected: <output data-testid="toppings-value">{state.toppings.join(', ') || 'none'}</output>
            </p>
            <CheckboxGroup.Root orientation="horizontal" required defaultValue={['email']}>
                <CheckboxGroup.Label>Notify me by</CheckboxGroup.Label>
                <Checkbox.Root value="email">Email</Checkbox.Root>
                <Checkbox.Root value="sms">SMS</Checkbox.Root>
                <Checkbox.Root value="push">Push</Checkbox.Root>
            </CheckboxGroup.Root>
        </>
    );
}, { name: 'CheckboxDemos' });

export const checkboxPage: PageEntry = {
    id: 'checkbox',
    title: 'Checkbox',
    category: 'Forms & inputs',
    Demos: CheckboxDemos,
};
