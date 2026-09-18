import { component } from 'sigx';
import { Collapsible } from '@sigx/zero';
import type { PageEntry } from './registry';

const CollapsibleDemos = component(() => () => (
    <Collapsible.Root defaultOpen>
        <Collapsible.Trigger>What is zero?</Collapsible.Trigger>
        <Collapsible.Panel>
            Headless, accessible components rendering a stable
            data-scope/data-part/data-state anatomy. Styling is a
            separate, generatable artifact.
        </Collapsible.Panel>
    </Collapsible.Root>
), { name: 'CollapsibleDemos' });

export const collapsiblePage: PageEntry = {
    id: 'collapsible',
    title: 'Collapsible',
    category: 'Navigation & structure',
    Demos: CollapsibleDemos,
};
