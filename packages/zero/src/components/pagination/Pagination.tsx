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
 */
import { component, compound } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState } from '../../behaviors/controllable.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { dataAttr, stateAttr } from '../../contract/data-attrs.js';
import { variantAttrs } from '../../contract/props.js';
import type { WithClass, WithDisabled, WithVariantAxes } from '../../contract/props.js';
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
    & WithVariantAxes<'pagination'>
    & WithDisabled
    & WithClass;

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

    const item = (n: number) => {
        const key = `page-${n}`;
        const active = (): boolean => page() === n;
        const disabled = (): boolean => !!props.disabled;
        return (
            <button
                type="button"
                data-scope={SCOPE}
                data-part="item"
                data-state={stateAttr(active(), 'active', 'inactive')}
                data-disabled={dataAttr(disabled())}
                data-focus-visible={dataAttr(focus.visibleKey === key)}
                aria-current={active() ? 'page' : undefined}
                aria-label={`Page ${n}`}
                disabled={disabled()}
                onClick={() => select(n)}
                onFocus={() => { focus.visibleKey = isFocusVisible(els.get(key) ?? null) ? key : ''; }}
                ref={(node: HTMLElement | null) => { track(key, node); }}
                {...pressBag(key, disabled)}
            >
                {String(n)}
            </button>
        );
    };

    const ellipsis = () => (
        <span aria-hidden="true" data-scope={SCOPE} data-part="ellipsis">…</span>
    );

    const stepper = (partName: 'prev-trigger' | 'next-trigger') => {
        const step = partName === 'prev-trigger' ? -1 : 1;
        const disabled = (): boolean =>
            !!props.disabled || (step === -1 ? page() <= 1 : page() >= count());
        const label = partName === 'prev-trigger'
            ? props.prevLabel ?? 'Previous page'
            : props.nextLabel ?? 'Next page';
        return (
            <button
                type="button"
                data-scope={SCOPE}
                data-part={partName}
                data-disabled={dataAttr(disabled())}
                data-focus-visible={dataAttr(focus.visibleKey === partName)}
                aria-label={label}
                disabled={disabled()}
                onClick={() => { if (!disabled()) select(page() + step); }}
                onFocus={() => { focus.visibleKey = isFocusVisible(els.get(partName) ?? null) ? partName : ''; }}
                ref={(node: HTMLElement | null) => { track(partName, node); }}
                {...pressBag(partName, disabled)}
            >
                {/* Select.Indicator's convention: a default glyph the recipe
                    styles (and flips under RTL — the character is physical
                    ink, so the reading-direction correction is the design
                    system's scaleX(-1) under its rtl guard). The name comes
                    from aria-label, never from the glyph. */}
                {step === -1 ? '‹' : '›'}
            </button>
        );
    };

    return () => (
        <nav
            aria-label={props.label ?? 'Pagination'}
            data-scope={SCOPE}
            data-part="root"
            data-disabled={dataAttr(props.disabled)}
            {...variantAttrs(props)}
            class={props.class}
        >
            {stepper('prev-trigger')}
            {paginationRow(page(), count(), intAtLeast(props.siblingCount ?? 1, 0), intAtLeast(props.boundaryCount ?? 1, 0))
                .map((entry) => (typeof entry === 'number' ? item(entry) : ellipsis()))}
            {stepper('next-trigger')}
        </nav>
    );
}, { name: 'Pagination.Root' });

export const Pagination = compound(PaginationRoot, {
    Root: PaginationRoot,
});
