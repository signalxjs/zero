/**
 * `useMediaQuery` — a media query as a reactive boolean, SSR-safe and bound
 * to the calling component.
 *
 * The first render — on the server AND on the client — reads the caller's
 * `initial` value, never the real match: the server has no viewport to ask,
 * and a client whose first render disagreed with the server's markup would
 * hydrate a mismatch. The real match is read on mount and followed from
 * there; the listener detaches on unmount. Nothing is module-global — every
 * call owns its own signal and its own `MediaQueryList` subscription.
 *
 * Breakpoint ranges resolve against the registered design system's ramp
 * (`getBreakpoints()`, seeded by its `installThemes()`), with the same
 * boundaries its compiled CSS uses: `{ above: 'md' }` is exactly the
 * `@media (min-width: <md>)` an `at: { md }` recipe block compiles to, and
 * `{ below: 'md' }` is its exact complement — no `767.98px` fudge, no
 * pixel where both or neither match.
 */
import { getCurrentInstance, onMounted, onUnmounted, signal } from 'sigx';
import { getBreakpoints } from '../theme/registry.js';
import type { ZeroBreakpointName } from '../contract/vocabulary.js';

/**
 * A viewport range named by the design system's breakpoints. Either bound
 * alone, or both (`{ above: 'sm', below: 'lg' }` — the band between).
 */
export interface BreakpointRange {
    /** At or above the breakpoint's min-width: `(min-width: <value>)`. */
    above?: ZeroBreakpointName;
    /** Strictly below the breakpoint's min-width: `(width < <value>)`. */
    below?: ZeroBreakpointName;
}

/** A raw media query (`'(prefers-reduced-motion: reduce)'`) or a breakpoint range. */
export type MediaQueryInput = string | BreakpointRange;

export interface MediaQueryOptions {
    /**
     * What the query reads until the component mounts — the server render
     * and the first client render, which must agree. Default `false`. Pick
     * the answer for the layout the server should emit (`true` for a
     * desktop-first page asking `{ above: 'md' }`).
     */
    initial?: boolean;
    /**
     * Breakpoints to resolve a range against, instead of the registered
     * design system's — for a query that is about a ramp the design system
     * does not own.
     */
    breakpoints?: Readonly<Record<string, string>>;
}

/** A read-only reactive boolean: read `.value` in a render or effect to track it. */
export interface MediaQueryMatch {
    readonly value: boolean;
}

/**
 * The media query a breakpoint range names — the string `useMediaQuery`
 * hands to `matchMedia`, exported for code that needs the query itself (a
 * `<source media>`, a `<link media>`, a hand-written `matchMedia`).
 *
 * Throws on a breakpoint the ramp does not declare, listing the ones it
 * does: a misspelled name would otherwise produce a query that never
 * matches, which reads as "the layout is wrong" rather than "the name is".
 */
export function breakpointQuery(
    range: BreakpointRange,
    breakpoints: Readonly<Record<string, string>> = getBreakpoints(),
): string {
    const width = (name: string): string => {
        // hasOwnProperty.call: a plain-object ramp says yes to `toString`, and
        // this package targets ES2020, which predates Object.hasOwn.
        const value = Object.prototype.hasOwnProperty.call(breakpoints, name) ? breakpoints[name] : undefined;
        if (value === undefined) {
            const declared = Object.keys(breakpoints);
            throw new Error(
                `[zero] breakpoint "${name}" is not declared — `
                + (declared.length > 0
                    ? `the ramp declares ${declared.join(', ')}`
                    : 'the ramp is empty: call your design system\'s installThemes(), or pass `breakpoints`'),
            );
        }
        return value;
    };
    const clauses: string[] = [];
    if (range.above !== undefined) clauses.push(`(min-width: ${width(range.above)})`);
    if (range.below !== undefined) clauses.push(`(width < ${width(range.below)})`);
    if (clauses.length === 0) {
        throw new Error('[zero] a breakpoint range needs `above`, `below`, or both');
    }
    return clauses.join(' and ');
}

/**
 * A media query as a reactive boolean. Call from a component's setup.
 *
 * ```tsx
 * const wide = useMediaQuery({ above: 'md' }, { initial: true });
 * const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
 * return () => <Drawer.Root modal={!wide.value}>…</Drawer.Root>;
 * ```
 *
 * The range resolves at setup, so an undeclared breakpoint throws on the
 * server and the client alike rather than silently never matching. Where
 * `matchMedia` does not exist (the server, a non-browser runtime) the value
 * stays `initial`.
 */
export function useMediaQuery(input: MediaQueryInput, options: MediaQueryOptions = {}): MediaQueryMatch {
    if (!getCurrentInstance()) {
        throw new Error('[zero] useMediaQuery() must be called from a component\'s setup — it subscribes on mount and detaches on unmount');
    }
    const query = typeof input === 'string' ? input : breakpointQuery(input, options.breakpoints);
    const state = signal({ matches: options.initial ?? false });

    let list: MediaQueryList | null = null;
    const onChange = (e: MediaQueryListEvent): void => {
        state.matches = e.matches;
    };
    onMounted(() => {
        if (typeof matchMedia !== 'function') return;
        list = matchMedia(query);
        state.matches = list.matches;
        list.addEventListener('change', onChange);
    });
    onUnmounted(() => {
        list?.removeEventListener('change', onChange);
        list = null;
    });

    return {
        get value() {
            return state.matches;
        },
    };
}
