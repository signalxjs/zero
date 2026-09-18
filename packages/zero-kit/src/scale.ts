/**
 * Modular type scale — `{ base, ratio }` expanded into a `--text-*` ramp.
 *
 * A design system's type scale is a ratio, not seven unrelated numbers, and
 * stating it as one lets the whole ramp be retuned by changing the ratio.
 * Explicit `sizes` still win per key, so a hand-tuned display size can sit on
 * top of a generated ramp.
 */

import { TOKEN_KEY_PATTERN } from './contract.js';

/**
 * CSS `<length>` units, plus `%`.
 *
 * Curated rather than "any letters": `base: '1rme'` would otherwise generate
 * a whole ramp of `--text-*` values CSS drops on sight, and the failure would
 * only show up as unstyled text much later. The viewport family is expanded
 * programmatically because it is large and regular.
 */
const LENGTH_UNITS: ReadonlySet<string> = new Set([
    '%',
    'px', 'cm', 'mm', 'q', 'in', 'pt', 'pc',
    'em', 'rem', 'ex', 'rex', 'ch', 'rch', 'cap', 'rcap', 'ic', 'ric', 'lh', 'rlh',
    ...['', 's', 'l', 'd'].flatMap((p) =>
        ['vw', 'vh', 'vi', 'vb', 'vmin', 'vmax'].map((v) => `${p}${v}`)),
]);

/** `1rem` → `{ magnitude: 1, unit: 'rem' }`. */
const NUMERIC = /^\s*(-?(?:\d+\.?\d*|\.\d+))([a-z%]*)\s*$/i;

export interface TypeScale {
    /** The value of the `origin` step. Every other step derives from it. */
    base: string;
    /** Ratio between adjacent steps — 1.125 minor third, 1.618 golden. */
    ratio: number;
    /** Step names, small to large. Defaults to the recommended ramp. */
    steps?: readonly string[];
    /** Which step carries `base`. Defaults to `md`, else the middle step. */
    origin?: string;
    /** Decimal places before trailing zeros are trimmed. Default 4. */
    precision?: number;
}

/**
 * Trim trailing zeros without touching an integer's own digits.
 *
 * `(100).toFixed(4)` is `"100.0000"`; a naive `/\.?0+$/` turns that into
 * `"1"`. Anchoring on the decimal point is the whole job here.
 */
function trim(value: string): string {
    return value.includes('.')
        ? value.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
        : value;
}

export function generateTypeScale(
    scale: TypeScale,
    recommended: readonly string[],
): Record<string, string> {
    const parsed = NUMERIC.exec(scale.base);
    if (!parsed) {
        throw new Error(
            `[zero-kit] typography.scale.base must be a number with a unit, got "${scale.base}" — ` +
            'use typography.sizes for a clamp()/calc() ramp',
        );
    }
    const [, magnitude, unit] = parsed as unknown as [string, string, string];
    if (!unit) {
        throw new Error(`[zero-kit] typography.scale.base "${scale.base}" has no unit`);
    }
    if (!LENGTH_UNITS.has(unit.toLowerCase())) {
        throw new Error(
            `[zero-kit] typography.scale.base "${scale.base}" uses "${unit}", which is not a CSS ` +
            'length unit — every generated --text-* value would be dropped by the browser',
        );
    }
    // Every input is design-system-authored, so each gets a targeted message
    // rather than a RangeError from toFixed or a ramp of NaN/-1rem sizes.
    const start = Number(magnitude);
    if (!Number.isFinite(start) || start <= 0) {
        throw new Error(
            `[zero-kit] typography.scale.base must be a positive finite length, got "${scale.base}"`,
        );
    }
    if (!Number.isFinite(scale.ratio) || scale.ratio <= 1) {
        throw new Error(
            `[zero-kit] typography.scale.ratio must be a finite number greater than 1, got ${scale.ratio} — ` +
            'a ratio of 1 or less produces a flat or inverted ramp',
        );
    }
    const precision = scale.precision ?? 4;
    if (!Number.isInteger(precision) || precision < 0 || precision > 20) {
        throw new Error(
            `[zero-kit] typography.scale.precision must be an integer between 0 and 20, got ${precision}`,
        );
    }

    const steps = scale.steps ?? recommended;
    if (steps.length === 0) throw new Error('[zero-kit] typography.scale needs at least one step');
    // Step names become the tail of `--text-<step>`, so they go through the
    // same grammar as any declared token key. Without this a step could carry
    // a `;` or `}` and break out of the declaration into the surrounding
    // rule — the generated stylesheet is not a place to trust input.
    for (const step of steps) {
        if (!TOKEN_KEY_PATTERN.test(step)) {
            throw new Error(
                `[zero-kit] typography.scale step "${step}" is not a kebab-case identifier ` +
                `(it becomes --text-${step})`,
            );
        }
    }
    const duplicate = steps.find((step, i) => steps.indexOf(step) !== i);
    if (duplicate) {
        // Object.fromEntries would silently keep only the last one, so the
        // ramp would come out a step short with no indication why.
        throw new Error(`[zero-kit] typography.scale lists step "${duplicate}" more than once`);
    }

    const origin = scale.origin ?? (steps.includes('md') ? 'md' : steps[Math.floor(steps.length / 2)]!);
    const originIndex = steps.indexOf(origin);
    if (originIndex < 0) {
        throw new Error(
            `[zero-kit] typography.scale.origin "${origin}" is not one of steps: ${steps.join(', ')}`,
        );
    }

    return Object.fromEntries(steps.map((step, i) => {
        const value = start * scale.ratio ** (i - originIndex);
        const rounded = trim(value.toFixed(precision));
        // A step that rounds away to zero is invisible text, and nothing
        // downstream would complain: `0rem` is valid CSS. Catch it here,
        // where the cause (precision, or too many steps below the origin)
        // is still obvious.
        if (Number(rounded) === 0 && value !== 0) {
            throw new Error(
                `[zero-kit] typography.scale step "${step}" rounds to 0${unit} at precision ` +
                `${precision} (exact value ${value}) — raise precision, raise base, or use ` +
                'fewer steps below the origin',
            );
        }
        return [step, `${rounded}${unit}`];
    }));
}
