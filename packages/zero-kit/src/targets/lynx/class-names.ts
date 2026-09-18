/**
 * The lynx class grammar — the kit's mirror of
 * `@sigx/zero/src/contract/class-names.ts`, kept because the kit is a pure
 * Node tool with no runtime dependency on zero (the same arrangement as the
 * contract mirror in `../../contract.ts`). `contract-parity.test.ts` holds
 * the two byte-honest: the runtime composes an element's class list with
 * zero's copy, the emitter writes selectors with this one, and a drift
 * between them is CSS that matches nothing.
 *
 * Grammar version 2 — see zero's copy for the full table and the axis
 * push-down rule (the runtime stamps axis/modifier classes on every part
 * from carrier context, so this target never emits a combinator for them).
 */

export const CLASS_GRAMMAR_VERSION = 2;

/** The token host — the projection of `:root` (lynx has no `:root`). */
export const HOST_CLASS = 'zx-root';

/** `zx-<scope>__<part>` — the part identity, and every compound's anchor. */
export const partClass = (scope: string, part: string): string => `zx-${scope}__${part}`;

/** `zx-s-<state>` — one machine state from the part's closed set. */
export const stateClass = (state: string): string => `zx-s-${state}`;

/** `zx-f-<flag>` — a presence-only boolean flag (`disabled`, `pressed`, …). */
export const flagClass = (flag: string): string => `zx-f-${flag}`;

/** `zx-a-<axis>-<value>` — a variant-axis value (`color`, `size`, custom). */
export const axisClass = (axis: string, value: string): string => `zx-a-${axis}-${value}`;

/** `zx-m-<name>` — a presence-only design-system modifier. */
export const modClass = (name: string): string => `zx-m-${name}`;

/** `zx-o-<value>` — layout orientation. */
export const orientationClass = (value: string): string => `zx-o-${value}`;

/** `zx-p-<value>` — declared placement (anchored popups, toast, rows). */
export const placementClass = (value: string): string => `zx-p-${value}`;

/** `zx-l-<attr>-<value>` — a layout attribute (`gap`, `cols`, `align`, …). */
export const layoutClass = (attr: string, value: string): string => `zx-l-${attr}-${value}`;

/** `zx-theme-<name>` — the theme block a token host switches between. */
export const themeClass = (name: string): string => `zx-theme-${name}`;
