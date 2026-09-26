/**
 * Pagination — a page picker over a numbered range.
 *
 * ```tsx
 * <Pagination.Root count={12} model={() => state.page} />
 * ```
 *
 * Options-driven rather than compound: the visible row derives from `count`,
 * the model and the windowing props, so zero renders the buttons itself —
 * a consumer cannot compose a window it cannot compute. The windowing is
 * the established constant-width shape (boundary pages at both ends,
 * siblings around the current page, ellipses where the window elides), so
 * the row never changes width as the user walks it.
 *
 * `withEdges` adds first/last triggers outside prev/next; `getPageHref`
 * switches the row to links (#294):
 *
 * ```tsx
 * <Pagination.Root count={12} withEdges getPageHref={(n) => `/posts?page=${n}`} />
 * ```
 */
import { component, compound } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState } from '../../behaviors/controllable.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { dataAttr, stateAttr } from '../../contract/data-attrs.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type { WithClass, WithDisabled, WithHtmlAttrs, WithVariantAxes } from '../../contract/props.js';
import { paginationAnatomy } from './anatomy.js';

const SCOPE = paginationAnatomy.scope;

/** One slot of the computed row. */
type RowEntry = number | 'start-ellipsis' | 'end-ellipsis';

const range = (from: number, to: number): number[] => {
    const out: number[] = [];
    for (let i = from; i <= to; i += 1) out.push(i);
    return out;
};

/** Whole, at least `min` — consumer numbers are sanitized at every source. */
const intAtLeast = (n: number, min: number): number =>
    Math.max(min, Math.floor(Number.isFinite(n) ? n : min));

/**
 * The constant-width window: boundary pages at both ends, `siblingCount`
 * pages around the current one, ellipses where the row elides — and when
 * the current page sits near an edge, the sibling block slides instead of
 * shrinking, so page 1 of many shows as wide a row as page 5.
 */
export function paginationRow(
    page: number,
    count: number,
    siblingCount: number,
    boundaryCount: number,
): RowEntry[] {
    const startPages = range(1, Math.min(boundaryCount, count));
    const endPages = range(Math.max(count - boundaryCount + 1, boundaryCount + 1), count);

    const siblingsStart = Math.max(
        Math.min(page - siblingCount, count - boundaryCount - siblingCount * 2 - 1),
        boundaryCount + 2,
    );
    const siblingsEnd = Math.min(
        Math.max(page + siblingCount, boundaryCount + siblingCount * 2 + 2),
        count - boundaryCount - 1,
    );

    return [
        ...startPages,
        ...(siblingsStart > boundaryCount + 2
            ? ['start-ellipsis' as const]
            : boundaryCount + 1 < count - boundaryCount
                ? [boundaryCount + 1]
                : []),
        ...range(siblingsStart, siblingsEnd),
        ...(siblingsEnd < count - boundaryCount - 1
            ? ['end-ellipsis' as const]
            : count - boundaryCount > boundaryCount
                ? [count - boundaryCount]
                : []),
        ...endPages,
    ];
}

export type PaginationRootProps =
    & Define.Model<number>
    & Define.Prop<'defaultPage', number, false>
    & Define.Event<'pageChange', number>
    /** Total number of pages. */
    & Define.Prop<'count', number, true>
    /** Pages shown on each side of the current page. Default 1. */
    & Define.Prop<'siblingCount', number, false>
    /** Pages pinned at each end of the row. Default 1. */
    & Define.Prop<'boundaryCount', number, false>
    /** Accessible name of the navigation landmark. Default: "Pagination". */
    & Define.Prop<'label', string, false>
    /** Accessible name of the previous-page trigger. Default: "Previous page". */
    & Define.Prop<'prevLabel', string, false>
    /** Accessible name of the next-page trigger. Default: "Next page". */
    & Define.Prop<'nextLabel', string, false>
    /** Accessible name of the first-page trigger. Default: "First page". */
    & Define.Prop<'firstLabel', string, false>
    /** Accessible name of the last-page trigger. Default: "Last page". */
    & Define.Prop<'lastLabel', string, false>
    /**
     * Render the first-page and last-page triggers (`«`/`»`) outside
     * prev/next. Default false.
     */
    & Define.Prop<'withEdges', boolean, false>
    /**
     * Link mode: every page and trigger renders as `<a href={getPageHref(n)}>`
     * instead of a button. A press still moves the model (a plain primary
     * click, never prevented), so an SPA router can intercept the click.
     */
    & Define.Prop<'getPageHref', (page: number) => string, false>
    /** Accessible name of page `n`'s button. Default: `(n) => \`Page ${n}\``. */
    & Define.Prop<'pageLabel', (n: number) => string, false>
    & WithVariantAxes<'pagination'>
    & WithDisabled
    & WithClass
    & WithHtmlAttrs;

interface TriggerPressBag {
    onKeydown: (e: KeyboardEvent) => void;
    onKeyup: (e: KeyboardEvent) => void;
    onBlur: (e: FocusEvent) => void;
    onPointerdown: (e: PointerEvent) => void;
    onPointerup: (e: PointerEvent) => void;
    onPointercancel: (e: PointerEvent) => void;
    onPointerleave: (e: PointerEvent) => void;
}

const PaginationRoot = component<PaginationRootProps>(({ props, emit, signal }) => {
    const state = createControllableState<number>(
        () => props.model,
        props.defaultPage ?? 1,
        (v) => emit('pageChange', v),
    );

    const count = (): number => intAtLeast(props.count, 1);
    // A float or NaN from the consumer would render fractional page numbers
    // and unstable keys — every number is clamped to a whole page in range.
    const page = (): number => Math.min(intAtLeast(state.value, 1), count());

    const select = (value: number): void => {
        if (props.disabled) return;
        const next = Math.min(intAtLeast(value, 1), count());
        if (next !== state.value) state.value = next;
    };

    // Press feedback per rendered button. The row's buttons come and go as
    // the window slides, so the element map is keyed by the row slot and a
    // press bag is created lazily per key — each button keeps a stable
    // feedback identity for as long as it exists. A null ref (unmount)
    // DELETES the key and its press instance: walking a large count must
    // not grow the maps unbounded.
    const els = new Map<string, HTMLElement | null>();
    const presses = new Map<string, ReturnType<typeof createPressFeedback>>();
    const track = (key: string, node: HTMLElement | null): void => {
        if (node) {
            els.set(key, node);
        } else {
            els.delete(key);
            presses.delete(key);
        }
    };
    const focus = signal({ visibleKey: '' });
    const pressFor = (key: string, disabled: () => boolean) => {
        let press = presses.get(key);
        if (!press) {
            press = createPressFeedback({
                getElement: () => els.get(key) ?? null,
                isDisabled: disabled,
            });
            presses.set(key, press);
        }
        return press;
    };

    const pressBag = (key: string, disabled: () => boolean): TriggerPressBag => {
        const press = pressFor(key, disabled);
        return {
            onKeydown: press.onKeydown,
            onKeyup: press.onKeyup,
            onBlur: (e: FocusEvent) => {
                press.onBlur(e);
                if (focus.visibleKey === key) focus.visibleKey = '';
            },
            onPointerdown: press.onPointerdown,
            onPointerup: press.onPointerup,
            onPointercancel: press.onPointercancel,
            onPointerleave: press.onPointerleave,
        };
    };

    // Link mode (#294): with `getPageHref`, every control is an `<a>` —
    // crawlable, and a no-JS page still pages. The press still moves the
    // model and is never prevented, so an SPA router that intercepts the
    // click (and prevents it) keeps its own navigation. A modified or
    // non-primary click is left alone entirely: it opens the page
    // elsewhere, and the view in front of the user must not change page.
    const linkMode = (): boolean => typeof props.getPageHref === 'function';
    const isPlainClick = (e: MouseEvent): boolean =>
        e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

    /**
     * One control of the row — an item or a trigger — as a `<button>`, or
     * as an `<a>` in link mode. `inert` is "this press does nothing":
     * the whole Root disabled, or a trigger at its bound. The Root's
     * `disabled` removes the control from the tab order (natively on a
     * button; an `<a>` without `href` is not focusable); a bound stays
     * focusable either way, so the press that reaches the first or last
     * page keeps keyboard focus (#270).
     */
    const control = (
        key: string,
        partName: 'item' | 'prev-trigger' | 'next-trigger' | 'first-trigger' | 'last-trigger',
        target: () => number,
        inert: () => boolean,
        extra: Record<string, unknown>,
        content: string,
    ) => {
        const bag = pressBag(key, inert);
        const common = {
            key,
            'data-scope': SCOPE,
            'data-part': partName,
            'data-disabled': dataAttr(inert()),
            'data-focus-visible': dataAttr(focus.visibleKey === key),
            ...extra,
            onFocus: () => { focus.visibleKey = isFocusVisible(els.get(key) ?? null) ? key : ''; },
            ref: (node: HTMLElement | null) => { track(key, node); },
            ...bag,
        };
        if (!linkMode()) {
            return (
                <button
                    type="button"
                    {...common}
                    // A bound is aria-disabled, not natively disabled:
                    // `disabled` would drop focus to <body> on the very press
                    // that reaches the first or last page. The Root's
                    // `disabled` still disables every button natively.
                    aria-disabled={!props.disabled && inert() ? 'true' : undefined}
                    disabled={!!props.disabled}
                    onClick={() => { if (!inert()) select(target()); }}
                >
                    {content}
                </button>
            );
        }
        // Space does not activate a link, so it must not press one either.
        const notSpace = (h: (e: KeyboardEvent) => void) => (e: KeyboardEvent): void => {
            if (e.key !== ' ') h(e);
        };
        return (
            <a
                {...common}
                onKeydown={notSpace(bag.onKeydown)}
                onKeyup={notSpace(bag.onKeyup)}
                // An inert link has no destination: no `href`, so there is
                // nothing to follow, `role="link"` because an `<a>` without
                // one is not a link to assistive tech, and `aria-disabled`.
                // A bound keeps a tab stop (the `href` it just lost was it).
                href={inert() ? undefined : props.getPageHref!(target())}
                role={inert() ? 'link' : undefined}
                aria-disabled={inert() ? 'true' : undefined}
                tabIndex={!props.disabled && inert() ? 0 : undefined}
                onClick={(e: MouseEvent) => { if (!inert() && isPlainClick(e)) select(target()); }}
            >
                {content}
            </a>
        );
    };

    const item = (n: number) => {
        const active = (): boolean => page() === n;
        return control(`page-${n}`, 'item', () => n, () => !!props.disabled, {
            'data-state': stateAttr(active(), 'active', 'inactive'),
            'aria-current': active() ? 'page' : undefined,
            'aria-label': props.pageLabel ? props.pageLabel(n) : `Page ${n}`,
        }, String(n));
    };

    const ellipsis = (key: 'start-ellipsis' | 'end-ellipsis') => (
        <span key={key} aria-hidden="true" data-scope={SCOPE} data-part="ellipsis">…</span>
    );

    /**
     * The four triggers: prev/next step the page, first/last jump to the
     * bounds (#294). Each is inert at the bound it moves toward. The glyph
     * is Select.Indicator's convention — a default the recipe styles (and
     * flips under RTL: the character is physical ink, so the
     * reading-direction correction is the design system's scaleX(-1) under
     * its rtl guard). The name comes from aria-label, never from the glyph.
     */
    const trigger = (partName: 'prev-trigger' | 'next-trigger' | 'first-trigger' | 'last-trigger') => {
        const toStart = partName === 'prev-trigger' || partName === 'first-trigger';
        const target = (): number => {
            switch (partName) {
                case 'prev-trigger': return page() - 1;
                case 'next-trigger': return page() + 1;
                case 'first-trigger': return 1;
                default: return count();
            }
        };
        const atBound = (): boolean => (toStart ? page() <= 1 : page() >= count());
        const label = {
            'prev-trigger': props.prevLabel ?? 'Previous page',
            'next-trigger': props.nextLabel ?? 'Next page',
            'first-trigger': props.firstLabel ?? 'First page',
            'last-trigger': props.lastLabel ?? 'Last page',
        }[partName];
        const glyph = { 'prev-trigger': '‹', 'next-trigger': '›', 'first-trigger': '«', 'last-trigger': '»' }[partName];
        return control(partName, partName, target, () => !!props.disabled || atBound(), { 'aria-label': label }, glyph);
    };

    return () => {
        const attrs = htmlAttrs(props);
        return (
            <nav
                {...attrs}
                aria-label={props.label ?? attrs['aria-label'] ?? 'Pagination'}
                data-scope={SCOPE}
                data-part="root"
                data-disabled={dataAttr(props.disabled)}
                {...variantAttrs(props)}
                class={props.class}
            >
                {props.withEdges ? trigger('first-trigger') : null}
                {trigger('prev-trigger')}
                {/* Keyed by row slot — page number or which ellipsis — so a
                    sliding window moves the focused page's button rather than
                    patching it in place to show a different page (#176). */}
                {paginationRow(page(), count(), intAtLeast(props.siblingCount ?? 1, 0), intAtLeast(props.boundaryCount ?? 1, 0))
                    .map((entry) => (typeof entry === 'number' ? item(entry) : ellipsis(entry)))}
                {trigger('next-trigger')}
                {props.withEdges ? trigger('last-trigger') : null}
            </nav>
        );
    };
}, { name: 'Pagination.Root' });

export const Pagination = compound(PaginationRoot, {
    Root: PaginationRoot,
});
