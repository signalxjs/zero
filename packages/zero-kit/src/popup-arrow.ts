/**
 * The arrow on an anchored popup (zero#279) — `Popover.Arrow`,
 * `Tooltip.Arrow`, `Menu.Arrow` — as recipe data a skin paints.
 *
 * Zero's position strategy knows where the anchor's centre falls along the
 * popup edge that faces it (after the flip and the shift), and writes it on
 * the arrow as `--arrow-x` (a popup above or below) or `--arrow-y` (one
 * beside). Which edge that is, the recipe reads from the popup's
 * `data-placement`. {@link popupArrow} is that reading, once: a square of
 * the popup's own paint, rotated 45°, centred on the edge and clipped to the
 * half that sticks out — so its two outer sides continue the popup's border
 * and its fill covers the border beneath it. The skin passes the paint and
 * the size; the geometry is the same in every skin.
 *
 * Only a ROOT popup (`[data-part="popup"]`) places its arrow. An arrow
 * anywhere else — inside a menu's `sub-popup`, which the strategy never
 * hands an arrow — keeps `display: none`, so it cannot paint at the corner
 * an absolutely positioned box falls back to.
 *
 * Web-only: `--arrow-x`/`--arrow-y` are runtime properties, so a skin that
 * also builds lynx puts both halves in its `targets.web` section.
 */
import type { CssProps, PartStyles } from './recipes.js';

export interface PopupArrowOptions {
    /**
     * The side of the square, a CSS length — the arrow sticks out about
     * 0.7× this past the popup's padding edge. Default `0.625rem`.
     */
    size?: string;
    /**
     * The popup's surface, continued: its `background` and `border` (or
     * `borderColor`/`borderWidth`/`borderStyle`), and whatever else the
     * skin's popup paints with. Spread into the arrow's base.
     */
    paint: CssProps;
}

/**
 * "…and the reading direction is right-to-left", appended to the popup's
 * selector — the same forgiving `:where()` guard the shipped skins use.
 */
const RTL = ':where(:dir(rtl), [dir="rtl"], [dir="rtl"] *)';

/**
 * The half of the rotated square that sticks out, per direction the tip
 * points, in the square's own (pre-rotation) coordinates. `rotate: 45deg`
 * turns the top-left corner up, the top-right one right, and so on, so
 * each tip keeps its corner and the two corners beside it.
 */
const CLIP = {
    up: 'polygon(0 0, 100% 0, 0 100%)',
    right: 'polygon(0 0, 100% 0, 100% 100%)',
    down: 'polygon(100% 0, 100% 100%, 0 100%)',
    left: 'polygon(0 0, 100% 100%, 0 100%)',
} as const;

/**
 * The arrow part's styles for `scope`'s popup:
 *
 * ```ts
 * arrow: popupArrow('popover', {
 *     size: '0.625rem',
 *     paint: { background: surface, border: hairline },
 * }),
 * ```
 *
 * The popup edge the arrow sits on is the one facing the anchor: the bottom
 * edge for `top*`, the top edge for `bottom*`, the right edge for `left*`,
 * the left edge for `right*`, and the inline-end / inline-start edge for
 * `start` / `end` (logical, so RTL moves them — and turns the tip, the one
 * thing a logical property cannot). Along the edge it sits at
 * `--arrow-x`/`--arrow-y`, else centred (a substituted strategy that
 * publishes neither).
 *
 * The popup must let it out: see {@link popupArrowHost}.
 */
export function popupArrow(scope: string, options: PopupArrowOptions): PartStyles {
    const size = options.size ?? '0.625rem';
    const popup = (side: string): string =>
        `[data-scope="${scope}"][data-part="popup"][data-placement^="${side}"]`;
    // The square's centre on the padding edge: the diagonal the clip cuts
    // along IS the edge, so the fill covers the popup's border there.
    const near = `calc(${size} / -2)`;
    const far = `calc(100% - ${size} / 2)`;
    const alongX = `var(--arrow-x, calc(50% - ${size} / 2))`;
    const alongY = `var(--arrow-y, calc(50% - ${size} / 2))`;
    return {
        base: {
            display: 'none',
            position: 'absolute',
            boxSizing: 'border-box',
            width: size,
            height: size,
            rotate: '45deg',
            pointerEvents: 'none',
            ...options.paint,
        },
        selectors: {
            [`${popup('top')} > &`]: { display: 'block', top: far, left: alongX, clipPath: CLIP.down },
            [`${popup('bottom')} > &`]: { display: 'block', top: near, left: alongX, clipPath: CLIP.up },
            // Physical sides are physical: `left`/`right` do not mirror.
            [`${popup('left')} > &`]: { display: 'block', left: far, top: alongY, clipPath: CLIP.right },
            [`${popup('right')} > &`]: { display: 'block', left: near, top: alongY, clipPath: CLIP.left },
            // `start`/`end` are the inline-start/-end SIDE of the anchor, so
            // the arrow is on the popup's opposite inline edge.
            [`${popup('start')} > &`]: { display: 'block', insetInlineStart: far, top: alongY, clipPath: CLIP.right },
            [`${popup('end')} > &`]: { display: 'block', insetInlineStart: near, top: alongY, clipPath: CLIP.left },
            // A clip has no logical spelling: under RTL the tips turn. Same
            // specificity (`:where()`), so these win on source order.
            [`${popup('start')}${RTL} > &`]: { clipPath: CLIP.left },
            [`${popup('end')}${RTL} > &`]: { clipPath: CLIP.right },
        },
    };
}

/**
 * The popup-side half, spread into the popup part's `selectors`: a popup
 * that holds an arrow lets it paint outside its box. `[popover]` is
 * `overflow: auto` in the UA stylesheet, which would clip the half that
 * sticks out — so only while an arrow is rendered does the popup give that
 * up. A popup that must scroll its own content and show an arrow wants an
 * inner scroller.
 */
export function popupArrowHost(scope: string): Record<string, CssProps> {
    return {
        [`&:has(> [data-scope="${scope}"][data-part="arrow"])`]: { overflow: 'visible' },
    };
}
