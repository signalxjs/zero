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
        asChild: true,
    },
}, {
    // What the API binds (#451): the manifest says so, and mergeManifests
    // holds the companions to the naming rule.
    models: [{ concept: 'step', type: 'string' }],
});
