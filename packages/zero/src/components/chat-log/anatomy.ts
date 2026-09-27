import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * ChatLog — the transcript container around `Chat` rows: a `role="log"`
 * scroll box that follows its tail, and a trigger back to it.
 *
 * `root` IS the scroll box and the live region. `role="log"` carries the
 * semantics a transcript needs (`aria-live="polite"`, restated for the
 * engines that do not imply it, and `aria-relevant="additions"` — a row
 * arriving is news, a row re-rendering is not), and `label` names it. It is
 * a keyboard stop (`tabIndex=0`: a transcript taller than its box must
 * scroll without a pointer — focused, the arrow keys scroll it), so it
 * carries `data-focus-visible` for the design system's ring. The variant
 * axes ride it; recipes wire colour to the jump trigger.
 *
 * `content` is the element the rows render into — what the behavior
 * watches for size changes (`createStickToBottom`), and whose direct
 * children are the rows the reading anchor picks from.
 *
 * `jump-trigger` is the way back to the tail: `open` while the log is not
 * following (the reader scrolled up), `closed` — and `hidden` — while it
 * is, hence `hiddenIn: ['closed']`. It sits inside the scroll box, after
 * the content, so recipes float it over the rows with `position: sticky`.
 *
 * The one model is the root's named `model:following` — whether the log
 * follows its tail — which the reader's scroll writes as well as the app.
 */
export const chatLogAnatomy = defineAnatomy('chat-log', {
    root: {
        element: 'div',
        // The scroll box is a keyboard stop, and recipes ring it.
        flags: ['focus-visible'],
        tokens: ['color', 'radius-box', 'size'],
    },
    content: {
        element: 'div',
        parent: 'root',
    },
    'jump-trigger': {
        element: 'button',
        parent: 'root',
        states: ['open', 'closed'],
        hiddenIn: ['closed'],
        flags: ['focus-visible', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-selector', 'size', 'text'],
        asChild: true,
    },
}, {
    models: [
        { name: 'following', concept: 'following', type: 'boolean' },
    ],
});
