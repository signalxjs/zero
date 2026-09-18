import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Countdown — display-only digits; the app owns time.
 *
 * NO internal timer, deliberately: a timer is application logic (which
 * clock, paused when, what happens at zero) and an SSR hazard — a ticking
 * interval in a component is exactly the shared mutable state the SSR rule
 * forbids, and server markup would render an instantly stale tick anyway.
 * The app passes `value`; the component renders it.
 *
 * `root` is a container for COMPOSED units — hours, minutes, seconds are
 * separate `value`s with consumer separators between them. Each `value`
 * publishes its number as `--countdown-value` and renders `digits`: real
 * text (AT reads "10:04" straight off the DOM, no aria mirror), KEYED by
 * the value so a change replaces the element and a recipe's enter
 * animation (translate/fade, collapsed under reduced motion) plays per
 * tick — CSS owns the motion, the runtime owns nothing but the swap.
 *
 * No states, no flags: a countdown at 0 is the number 0, and "expired" is
 * the app's word for it.
 */
export const countdownAnatomy = defineAnatomy('countdown', {
    root: {
        element: 'span',
        tokens: ['color', 'size', 'text'],
    },
    value: {
        element: 'span',
        parent: 'root',
        tokens: ['color', 'text'],
    },
    digits: {
        element: 'span',
        parent: 'value',
        tokens: ['color', 'text'],
    },
});
