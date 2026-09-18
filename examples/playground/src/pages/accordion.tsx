import { component } from 'sigx';
import { Accordion } from '@sigx/zero';
import type { PageEntry } from './registry';

const AccordionDemos = component(() => () => (
    <Accordion.Root defaultValue={['one']}>
        <Accordion.Item value="one">
            <Accordion.Trigger>Native details</Accordion.Trigger>
            <Accordion.Panel>Exclusive by default, `multiple` for many.</Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="two">
            <Accordion.Trigger>Second section</Accordion.Trigger>
            <Accordion.Panel>Hello.</Accordion.Panel>
        </Accordion.Item>
    </Accordion.Root>
), { name: 'AccordionDemos' });

export const accordionPage: PageEntry = {
    id: 'accordion',
    title: 'Accordion',
    category: 'Navigation & structure',
    Demos: AccordionDemos,
};
