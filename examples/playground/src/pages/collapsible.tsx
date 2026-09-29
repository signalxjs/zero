import { component } from 'sigx';
import { Button, Card, Collapsible } from '@sigx/zero';
import type { PageEntry } from './registry';

const CollapsibleDemos = component(() => () => (
    <>
        <Collapsible.Root defaultOpen>
            <Collapsible.Trigger>What is zero?</Collapsible.Trigger>
            <Collapsible.Panel>
                Headless, accessible components rendering a stable
                data-scope/data-part/data-state anatomy. Styling is a
                separate, generatable artifact.
            </Collapsible.Panel>
        </Collapsible.Root>

        {/*
          * The non-native mode (#453): a <summary> must be its <details>'
          * first child, so a trigger inside another part's layout — a Card
          * header here — needs `native={false}`. The trigger is lent onto a
          * Button (#452), which renders the one element and keeps its own
          * anatomy; the panel hides with `hidden="until-found"`, so
          * find-in-page reaches "tangerine quartz" while it is closed.
          */}
        <div data-demo="collapsible-card" style="margin-top: 1rem;">
            <Collapsible.Root native={false}>
                <Card.Root>
                    <Card.Header>
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;">
                            <Card.Title>Card header</Card.Title>
                            <Collapsible.Trigger asChild>
                                {(c) => <Button.Root lend={c}>Show details</Button.Root>}
                            </Collapsible.Trigger>
                        </div>
                    </Card.Header>
                    <Collapsible.Panel>
                        <Card.Body>
                            The release ships the tangerine quartz build: a
                            disclosure whose trigger lives in a card header,
                            next to anything else the header holds.
                        </Card.Body>
                    </Collapsible.Panel>
                </Card.Root>
            </Collapsible.Root>
        </div>

        {/*
          * The optional indicator (#437): an empty, aria-hidden span inside
          * the trigger mirroring open|closed, where the design system draws
          * its chevron. Without one (the first demo) the trigger still says it.
          */}
        <div data-demo="collapsible-indicator" style="margin-top: 1rem;">
            <Collapsible.Root>
                <Collapsible.Trigger>
                    Release notes
                    <Collapsible.Indicator />
                </Collapsible.Trigger>
                <Collapsible.Panel>
                    The chevron is a part of its own, so a skin whose trigger
                    spends both pseudo-elements on a state layer and a ripple
                    still has somewhere to draw it.
                </Collapsible.Panel>
            </Collapsible.Root>
        </div>
    </>
), { name: 'CollapsibleDemos' });

export const collapsiblePage: PageEntry = {
    id: 'collapsible',
    title: 'Collapsible',
    category: 'Navigation & structure',
    Demos: CollapsibleDemos,
};
