import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Avatar — the two representations swap by presence, not by paint.
 *
 * `image` and `fallback` both mirror the load status, and the runtime hides
 * whichever one is not the avatar's current face (`Avatar.tsx`): the image
 * while `error` (it would render the broken-image glyph), the fallback once
 * the image has `loaded`. Hence `hiddenIn` on both — a recipe styling those
 * states identically is correct, and only the anatomy can say so.
 */
export const avatarAnatomy = defineAnatomy('avatar', {
    root: {
        element: 'span',
        states: ['loading', 'loaded', 'error'],
        tokens: ['color', 'radius-selector', 'size'],
    },
    image: {
        element: 'img',
        parent: 'root',
        states: ['loading', 'loaded', 'error'],
        hiddenIn: ['error'],
        asChild: true,
    },
    fallback: {
        element: 'span',
        parent: 'root',
        states: ['loading', 'loaded', 'error'],
        hiddenIn: ['loaded'],
        tokens: ['color', 'radius-selector', 'text'],
    },
});
