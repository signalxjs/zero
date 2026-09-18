import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Alert — a message that announces itself, and can be dismissed.
 *
 * `root` carries `role="alert"`, and that is the line between this and Card:
 * an alert nobody is told about is a coloured box, and a coloured box is a
 * card. The role costs nothing when the alert is server-rendered — a live
 * region only announces CHANGES, so static content present at load is silent,
 * and an alert inserted or updated later is announced. Exactly the behaviour
 * wanted in both cases, from one declaration.
 *
 * `open|closed` with `hiddenIn: ['closed']` because dismissal has to live
 * somewhere: `Alert.Close` with no state would be a button that does nothing
 * until the consumer writes the removal themselves. The runtime sets `hidden`
 * on a closed root, so the two states are told apart by PRESENCE — which is
 * why no design system has to paint `closed`, and why the state-legibility
 * guard accepts the pair (`presenceDiffers`) without a `skipStates` waiver.
 *
 * `icon` is decorative (`aria-hidden`): the severity a design system paints
 * into it is already in the text, and a glyph that announced itself would say
 * it twice.
 */
export const alertAnatomy = defineAnatomy('alert', {
    root: {
        element: 'div',
        states: ['open', 'closed'],
        hiddenIn: ['closed'],
        tokens: ['color', 'radius-box', 'size'],
    },
    icon: {
        element: 'span',
        parent: 'root',
        tokens: ['color'],
    },
    title: {
        element: 'div',
        parent: 'root',
        tokens: ['color', 'text'],
    },
    description: {
        element: 'div',
        parent: 'root',
        tokens: ['color', 'text'],
    },
    close: {
        element: 'button',
        parent: 'root',
        flags: ['disabled', 'focus-visible', 'pressed', 'press-animating'],
        tokens: ['color'],
        asChild: true,
    },
}, {
    models: [
        { concept: 'open', type: 'boolean' },
    ],
});
