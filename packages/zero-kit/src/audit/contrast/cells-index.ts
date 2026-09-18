/**
 * The cell product in one import: the text and axis cells (`cells.ts`) and
 * the indicator cells (`paint-parts.ts`), which depend on the former and
 * would otherwise force the matrix to know two files.
 */
export {
    AXIS_CELL_BUDGET,
    axisCellsFor,
    axisTag,
    cellKey,
    chainFor,
    colourBearingAxes,
    combosFor,
    derivedChainAncestors,
    restingCombos,
    textCells,
} from './cells.js';
export type { Cell, Combo, IndicatorCell, NodeSpec, WiredAxes } from './cells.js';
export {
    INDICATORS,
    NOT_RENDERED_ON_WEB,
    PAINT_ONLY_PART,
    indicatorAncestors,
    indicatorChains,
    indicatorCells as indicatorCellsFor,
    uncoveredPaintParts,
} from './paint-parts.js';
export type { IndicatorSpec } from './paint-parts.js';
