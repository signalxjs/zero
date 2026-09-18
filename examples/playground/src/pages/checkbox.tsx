import { component } from 'sigx';
import { Checkbox } from '@sigx/zero';
import { DemoRow } from '../demo/Section';
import type { PageEntry } from './registry';

const CheckboxDemos = component(() => () => (
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
    </>
), { name: 'CheckboxDemos' });

export const checkboxPage: PageEntry = {
    id: 'checkbox',
    title: 'Checkbox',
    category: 'Forms & inputs',
    Demos: CheckboxDemos,
};
