import { component } from 'sigx';
import { Accordion } from '@sigx/zero';
import type { PageEntry } from './registry';

// Three items so the keyboard has somewhere to go: ArrowDown/ArrowUp move
// between the triggers (wrapping), Home/End jump to the ends, and every
// trigger stays tabbable (#276). Each panel is a region named by its trigger,
// and a close plays the skin's exit before the <details> shuts.
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
        <Accordion.Item value="three">
            <Accordion.Trigger>Keyboard</Accordion.Trigger>
            <Accordion.Panel>
                Arrow keys move between the headings; Home and End jump to
                the first and last.
            </Accordion.Panel>
        </Accordion.Item>
    </Accordion.Root>
), { name: 'AccordionDemos' });

export const accordionPage: PageEntry = {
    id: 'accordion',
    title: 'Accordion',
    category: 'Navigation & structure',
    Demos: AccordionDemos,
};
