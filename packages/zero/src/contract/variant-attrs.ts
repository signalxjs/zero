/**
 * The variant pass-through — the runtime half of the axis surface, in a
 * module of its own so platforms without DOM types can import it: `props.ts`
 * (which re-exports everything here, its historical home) types the asChild
 * bag with `lib.dom` event shapes, and a Lynx runtime needs `variantAttrs`
 * without them.
 */
import type { ColorValue, SizeScale } from './tokens.js';
import { TOKEN_KEY_PATTERN as AXIS_NAME_PATTERN } from './tokens.js';
import { FLAG_VOCABULARY } from './data-attrs.js';

/**
 * Axis names `axes` may not use, because the anatomy contract already gives
 * these attributes a meaning that design systems select on. Shadowing
 * `data-state` from userland would be a genuinely nasty failure: every
 * `[data-state="open"]` rule in the design system would start matching the
 * wrong thing, with no error anywhere.
 */
export const RESERVED_AXES: ReadonlySet<string> = new Set([
    'scope', 'part', 'state', 'orientation', ...FLAG_VOCABULARY,
]);

/**
 * The axes with named props, mapped to the attributes they render.
 * Deliberately NOT in `RESERVED_AXES`: a recipe keying `variants.color` is
 * the ordinary case and the validator must keep allowing it. These are only
 * reserved on the runtime `axes` bag, where they would be a second way to
 * write one attribute. The kit keeps an identical copy (it is a pure Node
 * tool with no runtime dependency on zero); `contract-parity.test.ts` holds
 * the two honest.
 */
export const VARIANT_AXES: Record<string, string> = {
    color: 'data-color',
    size: 'data-size',
    variant: 'data-variant',
};

/**
 * The namespace design-system modifiers render into. Prefixed so it can never
 * collide with `FLAG_VOCABULARY`, which zero owns and extends between versions
 * — see `WithMods`. The kit keeps an identical copy; `contract-parity.test.ts`
 * holds the two honest.
 */
export const MOD_ATTR_PREFIX = 'data-mod-';

/**
 * Build the shared variant pass-through attributes from contract props.
 * Returns only the attributes whose props are set.
 *
 * Extra `axes` become `data-<axis>` alongside the three named ones. An axis
 * name is rejected outright rather than dropped: a silently missing attribute
 * is exactly the failure this whole mechanism exists to remove, and the value
 * comes from application code, not from user input. An `undefined` VALUE is
 * skipped before the guards run — a narrowed `AxesFor<S>` bag has optional
 * members, and an unset one must neither throw nor emit `data-<axis>`.
 */
export function variantAttrs(props: {
    color?: ColorValue;
    size?: SizeScale;
    variant?: string;
    axes?: Record<string, string | undefined>;
    mods?: Record<string, boolean | undefined>;
}): Record<string, string | undefined> {
    const attrs: Record<string, string | undefined> = {
        'data-color': props.color,
        'data-size': props.size,
        'data-variant': props.variant,
    };
    for (const [axis, value] of Object.entries(props.axes ?? {})) {
        if (value === undefined) continue;
        // hasOwnProperty.call, not `in` or an index read: a plain object says
        // yes to `'toString' in …`, and this package targets ES2020, which
        // predates Object.hasOwn.
        if (Object.prototype.hasOwnProperty.call(VARIANT_AXES, axis)) {
            // Otherwise this loop, running after the named props are applied,
            // silently wins: `color="primary" axes={{ color: 'x' }}` rendered
            // `data-color="x"`. Two ways to write one attribute, with
            // precedence nobody would guess and none of the autocomplete the
            // named prop exists to give.
            throw new Error(
                `[zero] axes: "${axis}" has a prop of its own — use ${axis}="…" rather than axes`,
            );
        }
        if (RESERVED_AXES.has(axis)) {
            throw new Error(
                `[zero] axes: "${axis}" is part of the anatomy contract — data-${axis} already means something and cannot be overwritten`,
            );
        }
        if (!AXIS_NAME_PATTERN.test(axis)) {
            throw new Error(
                `[zero] axes: "${axis}" is not a kebab-case identifier — it becomes the attribute name data-${axis}`,
            );
        }
        attrs[`data-${axis}`] = value;
    }
    // Presence-only: `false` and `undefined` both mean "absent", and the
    // attribute carries the empty string when on — the same shape the anatomy
    // contract's own flags use (`data-disabled=""`, never `="false"`).
    //
    // No reserved-name guard is needed here, unlike `axes`: the `data-mod-`
    // prefix puts every modifier outside the contract's namespace by
    // construction, so there is nothing to shadow.
    for (const [name, on] of Object.entries(props.mods ?? {})) {
        if (!on) continue;
        if (!AXIS_NAME_PATTERN.test(name)) {
            throw new Error(
                `[zero] mods: "${name}" is not a kebab-case identifier — it becomes the attribute name ${MOD_ATTR_PREFIX}${name}`,
            );
        }
        attrs[`${MOD_ATTR_PREFIX}${name}`] = '';
    }
    return attrs;
}
