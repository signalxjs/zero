import { component, signal } from 'sigx';
import { ExtStepper } from '@sigx/zero-ext-example';
import type { PageEntry } from './registry';

/**
 * The ecosystem scope (#194): `ext-stepper` from `@sigx/zero-ext-example`,
 * a component zero does not ship. zero-basic merges its fragment and spreads
 * its recipe pack at build time, so the scope is in basic's manifest and CSS —
 * and until this page existed, nothing in the playground ever rendered it,
 * so no sweeping spec (ds-smoke, press-feedback, the axe audit) ever saw it.
 * `scope-coverage.spec.ts` now fails if a declared scope goes unrendered.
 *
 * The other five skins do not adopt the fragment: there it renders
 * unstyled-but-accessible, which is the documented outcome, not a defect.
 */
const StepperDemos = component(() => {
    const checkout = signal({ step: 'details' });
    return () => (
        <>
            <p>
                <code>ExtStepper</code> — the <code>ext-stepper</code> scope,
                built by <code>@sigx/zero-ext-example</code> entirely from{' '}
                <code>@sigx/zero</code>'s public surface and published to design
                systems as a manifest fragment plus a recipe pack. Only Basic
                merges that fragment; every other skin leaves it
                unstyled-but-accessible. Apps wanting a stepper should use{' '}
                <a href="#/steps">Steps</a>.
            </p>
            <ExtStepper.Root model={[checkout, 'step']} label="Checkout (ecosystem)">
                <ExtStepper.Item value="cart">Cart</ExtStepper.Item>
                <ExtStepper.Item value="details">Details</ExtStepper.Item>
                <ExtStepper.Item value="pay">Pay</ExtStepper.Item>
                <ExtStepper.Item value="done" disabled>Done</ExtStepper.Item>
            </ExtStepper.Root>
            <p data-demo="ext-stepper-step">Current step: {checkout.step}</p>
        </>
    );
}, { name: 'StepperDemos' });

export const stepperPage: PageEntry = {
    id: 'ext-stepper',
    title: 'Ecosystem: Stepper',
    category: 'Concepts',
    Demos: StepperDemos,
};
