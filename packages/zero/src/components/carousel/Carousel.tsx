/**
 * Carousel — a scroll-snap viewport whose model is the active index.
 *
 * ```tsx
 * <Carousel.Root label="Featured">
 *     <Carousel.Viewport>
 *         <Carousel.Item><img … /></Carousel.Item>
 *         <Carousel.Item><img … /></Carousel.Item>
 *     </Carousel.Viewport>
 *     <Carousel.PrevTrigger>Prev</Carousel.PrevTrigger>
 *     <Carousel.NextTrigger>Next</Carousel.NextTrigger>
 *     <Carousel.IndicatorGroup>
 *         <Carousel.Indicator index={0} />
 *         <Carousel.Indicator index={1} />
 *     </Carousel.IndicatorGroup>
 * </Carousel.Root>
 * ```
 *
 * The model follows real scroll (IntersectionObserver, mounted only) and
 * drives it back by scrolling the viewport alone (never the page — #171),
 * smooth unless reduced motion — see
 * `anatomy.ts` for the full decision record. `label` is required: the root
 * is a `region`, and a region without a name is an axe violation.
 */
import { component, compound, defineInjectable, defineProvide, watch } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState, createInertState, type ControllableState } from '../../behaviors/controllable.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { sortByDomOrder } from '../../behaviors/list-core.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { dataAttr, stateAttr } from '../../contract/data-attrs.js';
import { htmlAttrs, variantAttrs } from '../../contract/props.js';
import type { WithClass, WithHtmlAttrs, WithVariantAxes } from '../../contract/props.js';
import { carouselAnatomy } from './anatomy.js';

const SCOPE = carouselAnatomy.scope;

interface ItemEntry {
    el(): HTMLElement | null;
}

interface CarouselContext {
    state: ControllableState<number>;
    /** The viewport's observer hooks — items call these from their own mount. */
    observeEl(el: HTMLElement): void;
    unobserveEl(el: HTMLElement): void;
    setObserverHooks(observe: (el: HTMLElement) => void, unobserve: (el: HTMLElement) => void): void;
    count(): number;
    index(): number;
    /** Clamp and set; the watch scrolls the item into view. */
    goTo(index: number): void;
    /** Scroll one item into view directly — the viewport's initial sync. */
    scrollToIndex(index: number, behavior: ScrollBehavior): void;
    registerItem(entry: ItemEntry): () => void;
    /** An item's element mounted — DOM order may have changed. */
    itemMounted(): void;
    itemIndex(entry: ItemEntry): number;
    /** The observer's writes must not scroll back — see the watch. */
    observed(index: number): void;
    setViewport(el: HTMLElement | null): void;
    viewportEl(): HTMLElement | null;
    itemEls(): HTMLElement[];
}

function makeInert(): CarouselContext {
    return {
        state: createInertState<number>(0),
        observeEl: () => {},
        unobserveEl: () => {},
        setObserverHooks: () => {},
        count: () => 0,
        index: () => 0,
        goTo: () => {},
        scrollToIndex: () => {},
        registerItem: () => () => {},
        itemMounted: () => {},
        itemIndex: () => 0,
        observed: () => {},
        setViewport: () => {},
        viewportEl: () => null,
        itemEls: () => [],
    };
}

export const useCarouselContext = defineInjectable<CarouselContext>(() => makeInert());

const prefersReducedMotion = (): boolean =>
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export type CarouselRootProps =
    & Define.Model<number>
    & Define.Prop<'defaultIndex', number, false>
    & Define.Event<'indexChange', number>
    /** Accessible name for the region — required; a nameless region is an axe violation. */
    & Define.Prop<'label', string>
    & WithVariantAxes<'carousel'>
    & WithClass
    /** Not `role`: the root is the carousel `region`. */
    & Omit<WithHtmlAttrs, 'role'>
    & Define.Slot<'default'>;

const CarouselRoot = component<CarouselRootProps>(({ props, slots, emit, signal, onUnmounted }) => {
    const state = createControllableState<number>(
        () => props.model,
        props.defaultIndex ?? 0,
        (v) => emit('indexChange', v),
    );
    // Registration count in a signal: "n of m" labels and bound-clamping
    // re-render as items arrive. `order` bumps when an item's element
    // mounts: a slide rendered conditionally AHEAD of the others registers
    // last but sits first, and only its mounted element can say so — every
    // index (labels, active state, scroll target, the observer's report)
    // reads the DOM-ordered collection, never registration order.
    const reg = signal({ count: 0, order: 0 });
    const registered: ItemEntry[] = [];
    // Sorted once per (count, order) change, not per call: every Item reads
    // its index during render, and a re-sort per read made a render pass
    // O(n² log n) in `compareDocumentPosition` calls. `version` counts
    // every add and remove (a swap in one tick leaves `count` unchanged);
    // `order` is read for reactivity and bumps when an element mounts.
    let version = 0;
    let sorted: ItemEntry[] = [];
    let sortedKey = '';
    const items = (): ItemEntry[] => {
        const key = `${version}:${reg.count}:${reg.order}`;
        if (key !== sortedKey) {
            sorted = sortByDomOrder(registered);
            sortedKey = key;
        }
        return sorted;
    };
    let viewport: HTMLElement | null = null;
    // The index the observer last reported — a model write matching it came
    // FROM scroll, so scrolling again would fight the user's finger.
    let observedIndex = -1;

    const clamp = (i: number): number =>
        Math.min(Math.max(0, reg.count - 1), Math.max(0, Math.round(i)));

    const scrollToItem = (i: number, behavior?: ScrollBehavior): void => {
        const el = items()[i]?.el();
        // Scroll the VIEWPORT, never `el.scrollIntoView`: that scrolls every
        // scrollable ancestor, the document included, so a carousel below
        // the fold with a non-zero index jumped the page on mount and on
        // every external model write (#171).
        if (!el || !viewport || typeof viewport.scrollTo !== 'function') return;
        const vp = viewport.getBoundingClientRect();
        const box = el.getBoundingClientRect();
        viewport.scrollTo({
            // Centre the item in the viewport, measured as a delta between
            // boxes rather than from `offsetLeft`: direction-agnostic, since
            // the delta is added to scrollLeft in whatever RTL convention the
            // engine reads and writes it (CSSOM's negative one in current
            // engines), so an RTL viewport lands right too.
            left: viewport.scrollLeft + (box.left + box.width / 2) - (vp.left + vp.width / 2),
            // Smooth is the affordance; reduced motion collapses it to a jump.
            behavior: behavior ?? (prefersReducedMotion() ? 'auto' : 'smooth'),
        });
    };

    watch(
        () => state.value,
        (v) => {
            // The scroll produced this value — do not scroll back. Kept
            // (not cleared) on a match: a bound model echoes the write back
            // through the prop, and the watch fires again with the same
            // value; clearing here turned that echo into a scroll back to
            // the slide a smooth scroll was passing, stalling it there.
            if (v === observedIndex) return;
            observedIndex = -1;
            scrollToItem(clamp(v));
        },
    );

    let observeHook: ((el: HTMLElement) => void) | null = null;
    let unobserveHook: ((el: HTMLElement) => void) | null = null;

    const ctx: CarouselContext = {
        state,
        observeEl: (el) => observeHook?.(el),
        unobserveEl: (el) => unobserveHook?.(el),
        setObserverHooks(observe, unobserve) {
            observeHook = observe;
            unobserveHook = unobserve;
        },
        count: () => reg.count,
        index: () => clamp(state.value),
        goTo(i) {
            const next = clamp(i);
            if (next !== state.value) state.value = next;
        },
        scrollToIndex: (i, behavior) => scrollToItem(clamp(i), behavior),
        registerItem(entry) {
            registered.push(entry);
            version += 1;
            reg.count = registered.length;
            return () => {
                const i = registered.indexOf(entry);
                if (i !== -1) {
                    registered.splice(i, 1);
                    version += 1;
                    reg.count = registered.length;
                }
            };
        },
        itemMounted: () => { reg.order += 1; },
        itemIndex: (entry) => Math.max(0, items().indexOf(entry)),
        observed(i) {
            if (i === state.value) return;
            observedIndex = i;
            state.value = i;
        },
        setViewport: (el) => { viewport = el; },
        viewportEl: () => viewport,
        itemEls: () => items().map((e) => e.el()).filter((el): el is HTMLElement => el !== null),
    };
    defineProvide(useCarouselContext, () => ctx);
    onUnmounted(() => { /* the viewport owns observer teardown */ });

    return () => {
        const attrs = htmlAttrs(props);
        return (
            <div
                {...attrs}
                data-scope={SCOPE}
                data-part="root"
                role="region"
                aria-roledescription="carousel"
                aria-label={props.label ?? attrs['aria-label']}
                {...variantAttrs(props)}
                class={props.class}
            >
                {slots.default?.()}
            </div>
        );
    };
}, { name: 'Carousel.Root' });

export type CarouselViewportProps = WithClass & WithHtmlAttrs & Define.Slot<'default'>;

/**
 * The scroll container. The IntersectionObserver lives here — created in
 * `onMounted` (SSR never observes), thresholded at 0.6 so the item that
 * owns most of the viewport owns the model.
 */
const CarouselViewport = component<CarouselViewportProps>(({ props, slots, onMounted, onUnmounted }) => {
    const carousel = useCarouselContext();
    let el: HTMLElement | null = null;
    let observer: IntersectionObserver | null = null;
    let frame = 0;
    // Frames left to wait for a detached viewport to be attached.
    let waits = 60;

    /**
     * Start once the viewport is in the document: a tree can mount before
     * it is attached (an app rendered whole, then inserted), and a detached
     * viewport has no layout — a scroll then measures nothing and moves
     * nothing, and the observer's first report would be slide 0 writing
     * the model back. Re-arm per frame until connected, bounded so a tree
     * that is never attached still starts (and stops polling).
     */
    const startWhenConnected = (): void => {
        frame = 0;
        if (el?.isConnected || waits-- <= 0 || typeof requestAnimationFrame !== 'function') start();
        else frame = requestAnimationFrame(startWhenConnected);
    };

    const start = (): void => {
        // The initial index may not be 0 (`defaultIndex`, a controlled
        // model) — the resting scroll position must agree with it, and no
        // watch fires for a value that never changed. An instant jump: the
        // initial position is a fact, not an animation. It lands BEFORE the
        // observer exists, so the observer's first report is this slide,
        // not slide 0 writing the model back.
        if (carousel.index() > 0) carousel.scrollToIndex(carousel.index(), 'auto');
        if (typeof IntersectionObserver === 'undefined') return;
        observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (!entry.isIntersecting) continue;
                    const idx = carousel.itemEls().indexOf(entry.target as HTMLElement);
                    if (idx !== -1) carousel.observed(idx);
                }
            },
            { root: el, threshold: 0.6 },
        );
        // Items mounted before the observer existed — observe them now;
        // items that mount LATER observe themselves through the hooks.
        for (const item of carousel.itemEls()) observer.observe(item);
        carousel.setObserverHooks(
            (target) => observer?.observe(target),
            (target) => observer?.unobserve(target),
        );
    };

    onMounted(startWhenConnected);
    onUnmounted(() => {
        if (frame) cancelAnimationFrame(frame);
        carousel.setObserverHooks(() => {}, () => {});
        observer?.disconnect();
    });

    return () => (
        <div
            // The slides change without the user's focus moving to them
            // (prev/next, a dot, a swipe): a polite live region announces
            // the newly visible slide. Not atomic — only the slide that
            // changed is read, not the whole strip. Before the app's
            // attributes, so an app that auto-rotates can set `off`.
            aria-live="polite"
            aria-atomic="false"
            {...htmlAttrs(props)}
            data-scope={SCOPE}
            data-part="viewport"
            // A scrollable region must be reachable by keyboard (axe
            // scrollable-region-focusable): focused, the platform's arrow
            // keys scroll it — the swipe gesture's keyboard equivalent.
            tabIndex={0}
            class={props.class}
            ref={(node: HTMLElement | null) => {
                el = node;
                carousel.setViewport(node);
            }}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Carousel.Viewport' });

export type CarouselItemProps =
    /** Accessible name override; defaults to APG's "n of m". */
    & Define.Prop<'label', string, false>
    & WithClass
    /** Not `role`: a slide is a `group`. */
    & Omit<WithHtmlAttrs, 'role'>
    & Define.Slot<'default'>;

const CarouselItem = component<CarouselItemProps>(({ props, slots, onMounted, onUnmounted }) => {
    const carousel = useCarouselContext();
    let el: HTMLElement | null = null;
    const entry: ItemEntry = { el: () => el };
    const unregister = carousel.registerItem(entry);
    // Late-arriving items (rendered after the viewport mounted) must reach
    // the observer too — the viewport publishes hooks for exactly this.
    onMounted(() => {
        carousel.itemMounted();
        if (el) carousel.observeEl(el);
    });
    onUnmounted(() => {
        if (el) carousel.unobserveEl(el);
        unregister();
    });

    return () => {
        const i = carousel.itemIndex(entry);
        const attrs = htmlAttrs(props);
        return (
            <div
                {...attrs}
                data-scope={SCOPE}
                data-part="item"
                data-state={stateAttr(carousel.index() === i, 'active', 'inactive')}
                role="group"
                aria-roledescription="slide"
                aria-label={props.label ?? attrs['aria-label'] ?? `${i + 1} of ${carousel.count()}`}
                class={props.class}
                ref={(node: HTMLElement | null) => { el = node; }}
            >
                {slots.default?.()}
            </div>
        );
    };
}, { name: 'Carousel.Item' });

export type CarouselTriggerProps =
    /** Accessible name override for an icon-only trigger. */
    & Define.Prop<'label', string, false>
    & WithClass
    & WithHtmlAttrs
    & Define.Slot<'default'>;

const stepTrigger = (
    partName: 'prev-trigger' | 'next-trigger',
    step: -1 | 1,
    defaultLabel: string,
    name: string,
) =>
    component<CarouselTriggerProps>(({ props, slots, signal }) => {
        const carousel = useCarouselContext();
        let el: HTMLElement | null = null;
        const focus = signal({ visible: false });
        const atBound = (): boolean =>
            step === -1 ? carousel.index() <= 0 : carousel.index() >= carousel.count() - 1;
        const press = createPressFeedback({
            getElement: () => el,
            isDisabled: () => atBound(),
        });
        const advance = (): void => { if (!atBound()) carousel.goTo(carousel.index() + step); };

        return () => {
            const attrs = htmlAttrs(props);
            return (
                <button
                    {...attrs}
                    type="button"
                    data-scope={SCOPE}
                    data-part={partName}
                    data-disabled={dataAttr(atBound())}
                    data-focus-visible={dataAttr(focus.visible)}
                    // At a bound the trigger is aria-disabled, NOT natively
                    // disabled: a native `disabled` drops focus to <body>
                    // the moment the user steps onto the last slide, and a
                    // keyboard user has to find their way back. It stays
                    // focusable and a press is a no-op.
                    aria-disabled={atBound() ? 'true' : undefined}
                    aria-label={props.label ?? attrs['aria-label'] ?? defaultLabel}
                    class={props.class}
                    ref={(node: HTMLElement | null) => { el = node; }}
                    onClick={advance}
                    onKeydown={press.onKeydown}
                    onKeyup={press.onKeyup}
                    onPointerdown={press.onPointerdown}
                    onPointerup={press.onPointerup}
                    onPointercancel={press.onPointercancel}
                    onPointerleave={press.onPointerleave}
                    onFocus={() => { focus.visible = isFocusVisible(el); }}
                    onBlur={(e: FocusEvent) => {
                        press.onBlur(e);
                        focus.visible = false;
                    }}
                >
                    {slots.default?.()}
                </button>
            );
        };
    }, { name });

const CarouselPrevTrigger = stepTrigger('prev-trigger', -1, 'Previous slide', 'Carousel.PrevTrigger');
const CarouselNextTrigger = stepTrigger('next-trigger', 1, 'Next slide', 'Carousel.NextTrigger');

export type CarouselIndicatorGroupProps = WithClass & WithHtmlAttrs & Define.Slot<'default'>;

const CarouselIndicatorGroup = component<CarouselIndicatorGroupProps>(({ props, slots }) => {
    return () => (
        <div {...htmlAttrs(props)} data-scope={SCOPE} data-part="indicator-group" class={props.class}>
            {slots.default?.()}
        </div>
    );
}, { name: 'Carousel.IndicatorGroup' });

export type CarouselIndicatorProps =
    /** Which slide this dot names and activates. */
    & Define.Prop<'index', number>
    /** Accessible name override; defaults to "Go to slide n". */
    & Define.Prop<'label', string, false>
    & WithClass
    & WithHtmlAttrs
    & Define.Slot<'default'>;

/** One dot — a plain labelled button, not a tab: no roving tabindex. */
const CarouselIndicator = component<CarouselIndicatorProps>(({ props, slots, signal }) => {
    const carousel = useCarouselContext();
    let el: HTMLElement | null = null;
    const focus = signal({ visible: false });
    const press = createPressFeedback({
        getElement: () => el,
        isDisabled: () => false,
    });

    const idx = (): number => props.index ?? 0;

    return () => {
        const active = carousel.index() === idx();
        const attrs = htmlAttrs(props);
        return (
            <button
                {...attrs}
                type="button"
                data-scope={SCOPE}
                data-part="indicator"
                data-state={stateAttr(active, 'active', 'inactive')}
                data-focus-visible={dataAttr(focus.visible)}
                aria-label={props.label ?? attrs['aria-label'] ?? `Go to slide ${idx() + 1}`}
                aria-current={active ? 'true' : undefined}
                class={props.class}
                ref={(node: HTMLElement | null) => { el = node; }}
                onClick={() => carousel.goTo(idx())}
                onKeydown={press.onKeydown}
                onKeyup={press.onKeyup}
                onPointerdown={press.onPointerdown}
                onPointerup={press.onPointerup}
                onPointercancel={press.onPointercancel}
                onPointerleave={press.onPointerleave}
                onFocus={() => { focus.visible = isFocusVisible(el); }}
                onBlur={(e: FocusEvent) => {
                    press.onBlur(e);
                    focus.visible = false;
                }}
            >
                {slots.default?.()}
            </button>
        );
    };
}, { name: 'Carousel.Indicator' });

export const Carousel = compound(CarouselRoot, {
    Root: CarouselRoot,
    Viewport: CarouselViewport,
    Item: CarouselItem,
    PrevTrigger: CarouselPrevTrigger,
    NextTrigger: CarouselNextTrigger,
    IndicatorGroup: CarouselIndicatorGroup,
    Indicator: CarouselIndicator,
});
