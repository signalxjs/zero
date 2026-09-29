/**
 * Zero Mail's own anatomies — declared with zero's PUBLIC `defineAnatomy`,
 * exactly as an ecosystem package would. Every scope here stands in for
 * something `@sigx/zero` does not ship yet; each is an entry in the gap
 * tracker (signalxjs/zero#440). The `mail-` prefix is the vendor prefix the
 * fragment convention asks for.
 */
import { defineAnatomy } from '@sigx/zero/anatomy';

/** A run of text — the typography primitive zero lacks (every string needs an element). */
export const textAnatomy = defineAnatomy('mail-text', {
    root: { element: 'span', tokens: ['text'], asChild: true },
});

/** A heading at a given outline level. */
export const headingAnatomy = defineAnatomy('mail-heading', {
    root: { element: 'h2', tokens: ['text'] },
});

/** A glyph from the kit's built-in set, drawn with `currentColor`. */
export const iconAnatomy = defineAnatomy('mail-icon', {
    root: { element: 'svg', tokens: ['size'] },
});

/** `role="toolbar"` with one roving tab stop across its controls. */
export const toolbarAnatomy = defineAnatomy('mail-toolbar', {
    root: { element: 'div' },
    group: { element: 'div', parent: 'root' },
    separator: { element: 'div', parent: 'root' },
});

/** A virtualised, keyboard-navigable list: the scroll box and the list inside it. */
export const mailListAnatomy = defineAnatomy('mail-list', {
    root: { element: 'div' },
    content: { element: 'div', parent: 'root' },
}, {
    models: [{ concept: 'highlight', type: 'number' }],
});

/** One row of the mail list. `active` is the message open in the reading pane. */
export const mailRowAnatomy = defineAnatomy('mail-row', {
    root: {
        element: 'div',
        states: ['active', 'inactive'],
        flags: ['selected', 'highlighted', 'focus-visible'],
        tokens: ['color', 'text'],
    },
});

/** The full-height application frame: the viewport-sized root, `<main>`, and scrolling regions. */
export const shellAnatomy = defineAnatomy('mail-shell', {
    root: { element: 'div', tokens: ['color', 'text'] },
    body: { element: 'div', parent: 'root' },
    main: { element: 'main', parent: 'root' },
    region: { element: 'section', parent: 'root' },
});

/** Two panes and a draggable, keyboard-operable separator between them. */
export const splitAnatomy = defineAnatomy('mail-split', {
    root: { element: 'div' },
    pane: { element: 'div', parent: 'root' },
    handle: { element: 'div', parent: 'root', flags: ['focus-visible'] },
}, {
    models: [{ concept: 'size', type: 'number' }],
    // The primary pane's size, written inline on the root (#456): declared
    // here, under the scope's prefix, so a recipe reads it bare.
    runtimeProperties: ['--mail-split-size'],
});

/** A `<time>` element that formats itself. */
export const timeAnatomy = defineAnatomy('mail-time', {
    root: { element: 'time', tokens: ['text'] },
});

export const mailAnatomies = [
    textAnatomy,
    headingAnatomy,
    iconAnatomy,
    toolbarAnatomy,
    mailListAnatomy,
    mailRowAnatomy,
    shellAnatomy,
    splitAnatomy,
    timeAnatomy,
] as const;
