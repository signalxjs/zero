import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Carousel — a scroll-snap viewport with an active-index model.
 *
 * The scrolling IS the mechanism: `viewport` is a real overflow container
 * recipes give `scroll-snap-type`, each `item` a snap stop, and the model
 * (the active index) is DERIVED from real scroll position by an
 * IntersectionObserver — created only after mount, so SSR renders the
 * resting markup and never observes. Setting the model scrolls the
 * viewport (and only the viewport — never the page, #171) to centre the
 * item (`behavior: 'smooth'`, collapsing to `auto` under
 * `prefers-reduced-motion` — the runtime owns that answer because it owns
 * the scroll call).
 *
 * ARIA per the APG carousel pattern: root is a labelled `region` with
 * `aria-roledescription="carousel"`; each item announces as a "slide"
 * group labelled "n of m" — n counted in DOCUMENT order, so a slide
 * rendered conditionally ahead of the others takes its real place. The
 * viewport is a polite, non-atomic live region, so a slide change the
 * user did not focus is still announced. Prev/next are plain buttons that
 * CLAMP (no wrap — "1 of 5" after "5 of 5" reads as a bug) and are
 * `aria-disabled` (+ `data-disabled`) at their bounds — never natively
 * disabled, which would drop keyboard focus to the body on the press that
 * reaches the end; they stay focusable and a press is a no-op. The dots are BUTTONS with per-dot labels (APG grouped-carousel
 * pagination), not tabs — no roving tabindex, every dot its own stop; the
 * active dot also carries `aria-current`. Horizontal only: a vertical
 * scroll-snap gallery is a scrolling page, not a carousel.
 *
 * `indicator` is a PAINT part (no text hint): the contrast audit's
 * indicator matrix grades both of its states inside the
 * `root > indicator-group` chain.
 */
export const carouselAnatomy = defineAnatomy('carousel', {
    root: {
        element: 'div',
        tokens: ['color', 'radius-box', 'size'],
    },
    viewport: {
        element: 'div',
        parent: 'root',
        tokens: ['radius-box'],
    },
    item: {
        element: 'div',
        parent: 'viewport',
        states: ['active', 'inactive'],
        tokens: ['color', 'radius-box'],
    },
    'prev-trigger': {
        element: 'button',
        parent: 'root',
        flags: ['disabled', 'focus-visible', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-selector', 'size', 'text'],
    },
    'next-trigger': {
        element: 'button',
        parent: 'root',
        flags: ['disabled', 'focus-visible', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-selector', 'size', 'text'],
    },
    'indicator-group': {
        element: 'div',
        parent: 'root',
    },
    indicator: {
        element: 'button',
        // Both states are measured — an inactive dot a viewer cannot find is a
        // pagination they cannot use.
        paint: true,
        parent: 'indicator-group',
        states: ['active', 'inactive'],
        // No `disabled`: every dot names a slide that exists, so none is
        // ever rendered disabled.
        flags: ['focus-visible', 'pressed'],
        tokens: ['color', 'radius-selector', 'size'],
    },
}, {
    models: [
        { concept: 'index', type: 'number' },
    ],
});
