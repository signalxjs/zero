import { component, signal } from 'sigx';
import { RadioGroup } from '@sigx/zero';
import type { PageEntry } from './registry';

const RadioGroupDemos = component(() => {
    const state = signal({ plan: 'free' });

    return () => (
        <>
            <RadioGroup.Root model={() => state.plan}>
                <RadioGroup.Label>Plan</RadioGroup.Label>
                <RadioGroup.Item value="free">Free</RadioGroup.Item>
                <RadioGroup.Item value="pro">Pro</RadioGroup.Item>
                <RadioGroup.Item value="team">Team</RadioGroup.Item>
            </RadioGroup.Root>
            {/*
              * Invalidity is the GROUP's fact — no item carries the
              * flag — so a design system has to reach the controls from
              * the root to show it. Rendered because it was not: five
              * of the six painted nothing here (#269).
              */}
            <RadioGroup.Root invalid required defaultValue="free">
                <RadioGroup.Label>Billing period</RadioGroup.Label>
                <RadioGroup.Item value="free">Monthly</RadioGroup.Item>
                <RadioGroup.Item value="pro">Yearly</RadioGroup.Item>
            </RadioGroup.Root>
        </>
    );
}, { name: 'RadioGroupDemos' });

export const radioGroupPage: PageEntry = {
    id: 'radio-group',
    title: 'RadioGroup',
    category: 'Forms & inputs',
    Demos: RadioGroupDemos,
};
