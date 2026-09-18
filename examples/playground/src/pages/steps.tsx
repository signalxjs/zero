import { component, signal } from 'sigx';
import { Steps } from '@sigx/zero';
import { pickRole } from '../design-systems';
import type { PageEntry } from './registry';

const StepsDemos = component(() => {
    const checkout = signal({ step: 'details' });
    return () => (
        <>
            <p>
                The wizard step rail, promoted from the ecosystem{' '}
                <code>ext-stepper</code> pattern: arrow keys rove focus without
                changing the step, click/Space/Enter select, one tab stop on
                the active step. <code>complete</code> is position-derived —
                every step before the current one.
            </p>
            <Steps.Root model={[checkout, 'step']} label="Checkout">
                <Steps.Item value="cart">
                    <Steps.Indicator>1</Steps.Indicator>
                    <Steps.Title>Cart</Steps.Title>
                    <Steps.Description>What you picked</Steps.Description>
                    <Steps.Separator />
                </Steps.Item>
                <Steps.Item value="details">
                    <Steps.Indicator>2</Steps.Indicator>
                    <Steps.Title>Details</Steps.Title>
                    <Steps.Description>Address and shipping</Steps.Description>
                    <Steps.Separator />
                </Steps.Item>
                <Steps.Item value="pay">
                    <Steps.Indicator>3</Steps.Indicator>
                    <Steps.Title>Pay</Steps.Title>
                    <Steps.Description>Card or invoice</Steps.Description>
                </Steps.Item>
            </Steps.Root>
            <p>Vertical, coloured where the vocabulary has roles, with a disabled step:</p>
            <Steps.Root defaultStep="build" orientation="vertical" color={pickRole('primary')} label="Release">
                <Steps.Item value="plan">
                    <Steps.Indicator>1</Steps.Indicator>
                    <Steps.Title>Plan</Steps.Title>
                    <Steps.Separator />
                </Steps.Item>
                <Steps.Item value="build">
                    <Steps.Indicator>2</Steps.Indicator>
                    <Steps.Title>Build</Steps.Title>
                    <Steps.Separator />
                </Steps.Item>
                <Steps.Item value="ship" disabled>
                    <Steps.Indicator>3</Steps.Indicator>
                    <Steps.Title>Ship</Steps.Title>
                </Steps.Item>
            </Steps.Root>
        </>
    );
}, { name: 'StepsDemos' });

export const stepsPage: PageEntry = {
    id: 'steps',
    title: 'Steps',
    category: 'Navigation & structure',
    Demos: StepsDemos,
};
