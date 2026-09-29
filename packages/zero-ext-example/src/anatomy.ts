/**
 * The stepper anatomy — an ecosystem scope, so it carries the vendor prefix
 * the fragment convention asks for (`ext-`), and it is declared with zero's
 * PUBLIC `defineAnatomy`: this package is the acceptance test that the
 * authoring surface is sufficient, so nothing here may reach into zero's
 * internals.
 */
import { defineAnatomy } from '@sigx/zero/anatomy';

export const stepperAnatomy = defineAnatomy('ext-stepper', {
    'root': { element: 'div' },
    'item': {
        element: 'button',
        // `complete` is position-derived (before the current step), which is
        // exactly the kind of state a design system wants to paint: the walk
        // of a wizard is told by ink, not by position alone.
        states: ['active', 'complete', 'inactive'],
        flags: ['disabled', 'focus-visible'],
        tokens: ['color', 'radius-selector', 'text'],
        // A fact of the stepper's own domain, not the shared vocabulary
        // (#457): an optional step renders `data-x-optional=""`, keyed
        // `x-optional` in selectors and recipe `states`. It carries no
        // accessibility meaning, so the item says it in text as well.
        domainFlags: ['optional'],
        asChild: true,
    },
}, {
    // What the API binds (#451): the manifest says so, and mergeManifests
    // holds the companions to the naming rule.
    models: [{ concept: 'step', type: 'string' }],
    // What the runtime writes inline (#456): the root publishes its item
    // count, under the scope's own prefix, which mergeManifests enforces.
    // A recipe may then read it bare; it is web-only, so the pack reads it
    // in `targets.web` alone.
    runtimeProperties: ['--ext-stepper-count'],
});
