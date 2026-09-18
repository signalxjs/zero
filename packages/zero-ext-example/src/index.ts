// @sigx/zero-ext-example — the ecosystem-component acceptance test.
//
// A component zero doesn't ship, built entirely from @sigx/zero's public
// surface, held to the contract by the published `@sigx/zero/testing`
// assertion, and consumed by a design system through its manifest fragment
// and recipe pack (`./fragment`).

export { stepperAnatomy } from './anatomy.js';
// The root export carries componentExportName('ext-stepper') — the name the
// generated ./components module of an adopting design system imports. The
// convention is load-bearing, not cosmetic: components-dts.test.ts asserts
// this export resolves (#316; the original `Stepper` spelling broke every
// api-declaring adopter, unnoticed because api-mode and fragment-mode had
// never been composed).
export { Stepper as ExtStepper, useStepperContext } from './Stepper.js';
export type { StepperRootProps, StepperItemProps } from './Stepper.js';
export { fragment, recipes } from './fragment.js';
