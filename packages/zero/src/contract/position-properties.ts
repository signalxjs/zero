// Its own module rather than a line in `data-attrs.ts`: every component
// imports that one, and a list only the position behavior reads has no
// business on that path (the same reasoning as `layout-attrs.ts`).

/**
 * The custom properties the built-in anchored-position strategy
 * (`fixedPositionStrategy`) publishes on every floating part it positions —
 * the popups of Select, Combobox, Menu (and its submenus), Popover and
 * Tooltip — beside `data-placement`, re-measured on every update. Runtime
 * geometry a stylesheet cannot know, like the press point's
 * `--press-x`/`--press-y`/`--press-r`:
 *
 * - `--anchor-width` / `--anchor-height` — the anchor's client rect, px. A
 *   listbox popup at least as wide as its trigger is
 *   `min-width: var(--anchor-width, <fallback>)`.
 * - `--available-width` / `--available-height` — the room between the
 *   anchor and the viewport edge on the side the popup resolved to (after
 *   flipping), less the offset and the collision padding; the cross axis
 *   is the viewport less the padding at both ends. A popup that must not
 *   run off screen caps itself with
 *   `max-height: min(<cap>, var(--available-height, <cap>))`.
 * - `--transform-origin` — the anchor-facing edge and the aligned point, as
 *   a physical keyword pair (`top left` for `bottom-start` in LTR,
 *   `top right` for it in RTL), so a scale-in grows out of the anchor.
 *
 * Physical on purpose: they measure the glass, exactly as the coordinates
 * do. Written by the built-in strategy only — a substituted
 * `PositionStrategy` publishes them or not, so a recipe always reads them
 * with a fallback.
 */
export const POSITION_PROPERTIES = [
    '--anchor-width',
    '--anchor-height',
    '--available-width',
    '--available-height',
    '--transform-origin',
] as const;

/**
 * The custom properties the built-in strategy publishes on a popup's ARROW
 * part (`Popover.Arrow`, `Tooltip.Arrow`, `Menu.Arrow`) when one is
 * rendered — the arrow's offset along the popup edge that faces the anchor,
 * px, from the popup's padding edge:
 *
 * - `--arrow-x` — on a `top*`/`bottom*` popup (the arrow runs along the
 *   top or bottom edge): the arrow's left offset.
 * - `--arrow-y` — on a side popup (`left*`/`right*`/`start`/`end`): the
 *   arrow's top offset.
 *
 * Exactly one is set at a time; the other is removed. The value centres the
 * arrow on the anchor's centre AFTER the flip and the shift, clamped to
 * `[arrowPadding, popupSize - arrowSize - arrowPadding]` so the arrow never
 * leaves the popup's straight edge. Which EDGE it sits on is the recipe's
 * to say, from the popup's `data-placement`. Physical for the same reason as
 * `POSITION_PROPERTIES`, and written by the built-in strategy only.
 */
export const ARROW_PROPERTIES = [
    '--arrow-x',
    '--arrow-y',
] as const;
