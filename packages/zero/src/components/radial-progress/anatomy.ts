import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * RadialProgress — circular progress, as its own scope.
 *
 * The decision (#334): NOT `progress` plus a `data-mod-radial`. Linear
 * progress paints a `range` INSIDE a `track` — two rendered boxes whose
 * geometry (width against channel) IS the display. A radial has neither: the
 * ring is one painted layer on the root (a conic sweep masked to an
 * annulus), so reusing progress's anatomy would ship two dead parts that no
 * recipe could honestly style — and a `data-mod-*` is a design-system
 * styling hook by contract, never a structural switch zero keys behavior on.
 *
 * What IS shared is the value model, verbatim: `value: number | null`
 * (null = indeterminate), min/max, `role="progressbar"` with the aria value
 * trio, the same `loading | complete | indeterminate` states, and the same
 * runtime-published `--progress-percent` custom property — recipes paint the
 * arc from it, and tooling that reads one progress component reads both.
 */
export const radialProgressAnatomy = defineAnatomy('radial-progress', {
    root: {
        element: 'div',
        states: ['loading', 'complete', 'indeterminate'],
        tokens: ['color', 'size'],
    },
    label: {
        element: 'div',
        parent: 'root',
        tokens: ['color', 'text'],
    },
    'value-text': {
        element: 'div',
        parent: 'root',
        tokens: ['color', 'text'],
    },
});
