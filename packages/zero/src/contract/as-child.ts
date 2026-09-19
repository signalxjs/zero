/**
 * asChild rendering helper.
 *
 * Sigx passes function children through uncalled (scoped slots are normally
 * provided via the `slots` prop, which DOES receive scoped props). asChild
 * supports both spellings:
 *
 * ```tsx
 * <Tabs.Tab value="a" asChild>{(p) => <a href="#a" {...p}>A</a>}</Tabs.Tab>
 * <Tabs.Tab value="a" asChild slots={{ default: (p) => <a {...p}>A</a> }} />
 * ```
 */
import type { JSXElement } from 'sigx';
import type { PartProps } from './props.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SlotAccessor = ((scopedProps?: any) => any) | undefined;

/**
 * What a view returns — `ViewFn`'s range. Typed rather than `unknown` since
 * sigx 1.0 ships the global `JSX.Element` (rfc-1.0 §4.1, sigx#529): a view
 * returning `unknown` used to pass because every JSX expression was `any`,
 * and now fails `SetupFn`. An empty slot is `undefined` (the range's own
 * "nothing"); a nullish ENTRY inside a slot's array is `null`, which
 * `JSXElement` admits as a hole — so every value here is one the runtime
 * renders.
 */
export type AsChildResult = JSXElement | JSXElement[] | undefined;

/**
 * `bag` is a part's `PartProps` everywhere but `VisuallyHidden`, which is no
 * part (no scope) and spreads its one attribute through the same seam.
 */
export function renderAsChild(slot: SlotAccessor, bag: PartProps | Record<string, unknown>): AsChildResult {
    const out = slot?.(bag);
    if (out == null) return undefined;
    const items = Array.isArray(out) ? out : [out];
    const rendered = items.map((item): JSXElement => {
        const value: unknown = typeof item === 'function' ? item(bag) : item;
        return value == null ? null : (value as JSXElement);
    });
    return rendered.length === 1 ? rendered[0] : rendered;
}

/**
 * Whether the platform will synthesize a click from THIS key on THIS
 * element. Components synthesizing keyboard activation for asChild elements
 * skip exactly these cases — doubling a native synthesis would activate
 * twice per press. Per-key because anchors only synthesize on Enter: a
 * role="button" anchor still needs Space supplied by the component.
 */
export function synthesizesClickFrom(target: EventTarget | null, key: string): boolean {
    // Duck-typed rather than `instanceof HTMLElement` — the one runtime DOM
    // binding this module had. Cross-realm elements fail instanceof anyway,
    // and on a platform without HTMLElement (Lynx) the read yields '' →
    // false, which is correct: nothing there synthesizes clicks from keys.
    const tagName = (target as { tagName?: unknown } | null)?.tagName;
    const tag = typeof tagName === 'string' ? tagName : '';
    if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'SUMMARY') return true;
    return tag === 'A' && key === 'Enter';
}
