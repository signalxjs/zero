import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Status — a presence dot: the smallest paint-only component there is.
 *
 * One empty element, NO states, and that asymmetry is deliberate. "Online",
 * "busy" and "degraded" are different colours of the same resting render —
 * an app's vocabulary, not a machine lifecycle — so they travel on the
 * `color` axis where every design system already declares its role names.
 * Minting a `data-state` family for them would be styling wearing a contract
 * costume, and the governed STATE_VOCABULARY exists to keep exactly that
 * out.
 *
 * No `text` token: the dot never prints a glyph, which is why it stands in
 * the contrast audit's INDICATOR matrix (the non-text 3:1 floor) rather than
 * the text one — an invisible presence dot is a real bug, same as an
 * invisible spinner.
 */
export const statusAnatomy = defineAnatomy('status', {
    root: {
        element: 'span',
        tokens: ['color', 'size'],
    },
});
