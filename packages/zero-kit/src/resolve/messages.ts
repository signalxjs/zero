/**
 * Validation messages shared by the token-layer and recipe-layer validators.
 * A module of its own so the two validators — `validate.ts` already imports
 * `validateRecipes` — never have to import each other.
 */

/**
 * The message for a value `AXIS_VALUE_PATTERN` refuses. Names the two places
 * the value is written verbatim, so the reason reads as a fact about the
 * artifacts rather than a style rule.
 */
export function badAxisValue(value: string): string {
    return `"${value}" is not a valid axis value — lowercase letters, digits and hyphens only, so it survives [data-…="…"] and .zx-a-…-… verbatim`;
}
