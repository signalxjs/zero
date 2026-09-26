import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Fieldset — a labelled group of form controls, and the one place a group's
 * disabled / read-only / invalid is said once (#285).
 *
 * `root` is a native `<fieldset>`: the platform groups it (`role="group"`),
 * names it from its first `<legend>` child, and — with `disabled` —
 * disables every native control inside. What the platform cannot reach is
 * the controls zero renders as non-native elements (a Slider thumb, a
 * RadioGroup item, a RatingGroup star); those read the Fieldset's context,
 * so `data-disabled` / `aria-disabled` and blocked activation follow the
 * group too. `readonly` and `invalid` have no native fieldset spelling and
 * travel by the context alone. Nested fieldsets chain: a control's flag is
 * its own OR its Field's OR any enclosing fieldset's.
 *
 * `legend` is the native `<legend>`, rendered as the root's first child —
 * the accessible name comes from the platform, so there is no
 * `aria-labelledby`. Controls inside it are exempt from the fieldset's
 * flags, as the platform exempts them from its `disabled`: the
 * "enable this section" checkbox lives there. It repeats the root's
 * `disabled` / `invalid` so a skin can dim or tint the caption without an
 * ancestor selector.
 */
export const fieldsetAnatomy = defineAnatomy('fieldset', {
    root: {
        element: 'fieldset',
        flags: ['disabled', 'readonly', 'invalid'],
        tokens: ['color', 'size'],
    },
    legend: {
        element: 'legend',
        parent: 'root',
        flags: ['disabled', 'invalid'],
        tokens: ['color', 'text'],
    },
});
