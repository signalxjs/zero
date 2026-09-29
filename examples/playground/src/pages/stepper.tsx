import { component, signal } from 'sigx';
import { ExtStepper } from '@sigx/zero-ext-example';
import type { PageEntry } from './registry';

/**
 * The ecosystem scope (#194): `ext-stepper` from `@sigx/zero-ext-example`,
 * a component zero does not ship. zero-basic and zero-heroui merge its fragment
 * and spread its recipe pack at build time, so the scope is in their manifests
 * and CSS —
 * and until this page existed, nothing in the playground ever rendered it,
 * so no sweeping spec (ds-smoke, press-feedback, the axe audit) ever saw it.
 * `scope-coverage.spec.ts` now fails if a declared scope goes unrendered.
 *
 * The root publishes its item count as `--ext-stepper-count`, a runtime
 * property the fragment declares (#456); the pack's web grid reads it, which
 * `e2e/ext-stepper.spec.ts` measures.
 *
 * The other four skins do not adopt the fragment: there it renders
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
                systems as a manifest fragment plus a recipe pack. Basic and
                HeroUI merge that fragment; every other skin leaves it
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
