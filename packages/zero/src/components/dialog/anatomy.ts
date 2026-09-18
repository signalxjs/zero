import { defineAnatomy } from '../../contract/anatomy.js';

// The backdrop is a real part of the anatomy but renders no element of its
// own on the web — the native `<dialog>` top layer provides `::backdrop`, so
// the part projects onto it (`[data-part="popup"][data-state="open"]::backdrop`).
// Platforms without a native top layer (Lynx) render it as an actual view;
// sharing the part name is what lets one recipe style both.
export const dialogAnatomy = defineAnatomy('dialog', {
    trigger: {
        element: 'button',
        states: ['open', 'closed'],
        flags: ['disabled', 'focus-visible', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-field', 'size', 'text'],
        asChild: true,
    },
    popup: {
        element: 'dialog',
        states: ['open', 'closed'],
        tokens: ['color', 'radius-box'],
    },
    backdrop: {
        element: 'dialog',
        states: ['open', 'closed'],
        tokens: ['color'],
        pseudo: { of: 'popup', selector: '::backdrop' },
    },
    title: {
        element: 'h2',
        parent: 'popup',
        tokens: ['color', 'text'],
    },
    description: {
        element: 'p',
        parent: 'popup',
        tokens: ['color', 'text'],
    },
    footer: {
        element: 'footer',
        parent: 'popup',
        tokens: ['color'],
    },
    close: {
        element: 'button',
        parent: 'popup',
        flags: ['disabled', 'focus-visible', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-field', 'size'],
        asChild: true,
    },
    // The least-destructive action of an alert dialog — behaviorally a close
    // button, but a distinct part: recipes style it as the quiet member of
    // the pair, and in `role="alertdialog"` mode it carries `autofocus` so
    // `showModal()`'s focusing steps land on it (APG: initial focus goes to
    // the least destructive action).
    cancel: {
        element: 'button',
        parent: 'popup',
        flags: ['disabled', 'focus-visible', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-field', 'size'],
        asChild: true,
    },
}, {
    models: [
        { concept: 'open', type: 'boolean' },
    ],
});
