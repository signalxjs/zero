import { defineAnatomy } from '../../contract/anatomy.js';

/**
 * Diff — a before/after reveal with a draggable divider.
 *
 * The HANDLE IS A SLIDER (APG): `role="slider"`, `aria-valuenow` 0–100,
 * arrows/PageUp/PageDown/Home/End (RTL-aware exactly like Slider), and a
 * pointer drag with window listeners so it survives leaving the box. The
 * panes are CONTENT and stay inert — a click on an image is not a command,
 * so the handle is the one control and the one tab stop.
 *
 * The model is the reveal percent (0–100, default 50), published as
 * `--diff-percent` on the root. Recipes clip the `after` pane with a
 * logical `inline-size` (never a physical `clip-path` inset — a transform
 * or physical inset has no logical spelling, which is the exact blind spot
 * AGENTS.md's RTL section documents); the runtime positions the handle
 * structurally at `inset-inline-start: <value>%`, so RTL mirrors for free
 * and e2e/diff.spec.ts measures the physical result.
 *
 * `handle` is a PAINT part (no text hint), opted into the contrast
 * audit's indicator matrix by hand — its grab affordance must clear the
 * 3:1 non-text floor over the images it straddles is not measurable, so
 * it is graded against the root's resting surface.
 */
export const diffAnatomy = defineAnatomy('diff', {
    root: {
        element: 'div',
        tokens: ['color', 'radius-box', 'size'],
    },
    before: {
        element: 'div',
        parent: 'root',
        tokens: ['radius-box'],
    },
    after: {
        element: 'div',
        parent: 'root',
        tokens: ['radius-box'],
    },
    handle: {
        element: 'div',
        parent: 'root',
        flags: ['focus-visible', 'pressed', 'press-animating'],
        tokens: ['color', 'radius-selector', 'size'],
    },
}, {
    models: [
        { concept: 'value', type: 'number' },
    ],
});
