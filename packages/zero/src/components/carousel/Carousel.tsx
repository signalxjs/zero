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
 * drives it back (`scrollIntoView`, smooth unless reduced motion) — see
 * `anatomy.ts` for the full decision record. `label` is required: the root
 * is a `region`, and a region without a name is an axe violation.
 */
import { component, compound, defineInjectable, defineProvide, watch } from 'sigx';
import type { Define } from 'sigx';
import { createControllableState, createInertState, type ControllableState } from '../../behaviors/controllable.js';
import { isFocusVisible } from '../../behaviors/focus-visible.js';
import { createPressFeedback } from '../../behaviors/press.js';
import { dataAttr, stateAttr } from '../../contract/data-attrs.js';
import { variantAttrs } from '../../contract/props.js';
import type { WithClass, WithVariantAxes } from '../../contract/props.js';
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
    & Define.Slot<'default'>;

const CarouselRoot = component<CarouselRootProps>(({ props, slots, emit, signal, onUnmounted }) => {
    const state = createControllableState<number>(
        () => props.model,
        props.defaultIndex ?? 0,
        (v) => emit('indexChange', v),
    );
    // Registration count in a signal: "n of m" labels and bound-clamping
    // re-render as items arrive.
    const reg = signal({ count: 0 });
    const items: ItemEntry[] = [];
    let viewport: HTMLElement | null = null;
    // The index the observer last reported — a model write matching it came
    // FROM scroll, so scrolling again would fight the user's finger.
    let observedIndex = -1;

    const clamp = (i: number): number =>
        Math.min(Math.max(0, reg.count - 1), Math.max(0, Math.round(i)));

    const scrollToItem = (i: number, behavior?: ScrollBehavior): void => {
        const el = items[i]?.el();
        if (!el || typeof el.scrollIntoView !== 'function') return;
        el.scrollIntoView({
            // Smooth is the affordance; reduced motion collapses it to a jump.
            behavior: behavior ?? (prefersReducedMotion() ? 'auto' : 'smooth'),
            // Logical center within the snap viewport; 'nearest' block keeps
            // a horizontal movement from scrolling the page vertically.
            inline: 'center',
            block: 'nearest',
        });
    };

    watch(
        () => state.value,
        (v) => {
            if (v === observedIndex) {
                // The scroll produced this value — do not scroll back.
                observedIndex = -1;
                return;
            }
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
            items.push(entry);
            reg.count = items.length;
            return () => {
                const i = items.indexOf(entry);
                if (i !== -1) {
                    items.splice(i, 1);
                    reg.count = items.length;
                }
            };
        },
        itemIndex: (entry) => Math.max(0, items.indexOf(entry)),
        observed(i) {
            if (i === state.value) return;
            observedIndex = i;
            state.value = i;
        },
        setViewport: (el) => { viewport = el; },
        viewportEl: () => viewport,
        itemEls: () => items.map((e) => e.el()).filter((el): el is HTMLElement => el !== null),
    };
    defineProvide(useCarouselContext, () => ctx);
    onUnmounted(() => { /* the viewport owns observer teardown */ });

    return () => (
        <div
            data-scope={SCOPE}
            data-part="root"
            role="region"
            aria-roledescription="carousel"
            aria-label={props.label}
            {...variantAttrs(props)}
            class={props.class}
        >
            {slots.default?.()}
        </div>
    );
}, { name: 'Carousel.Root' });

export type CarouselViewportProps = WithClass & Define.Slot<'default'>;

/**
 * The scroll container. The IntersectionObserver lives here — created in
 * `onMounted` (SSR never observes), thresholded at 0.6 so the item that
 * owns most of the viewport owns the model.
 */
const CarouselViewport = component<CarouselViewportProps>(({ props, slots, onMounted, onUnmounted }) => {
    const carousel = useCarouselContext();
    let el: HTMLElement | null = null;
    let observer: IntersectionObserver | null = null;

    onMounted(() => {
        // The initial index may not be 0 (`defaultIndex`, a controlled
        // model) — the resting scroll position must agree with it, and no
        // watch fires for a value that never changed. An instant jump: the
        // initial position is a fact, not an animation.
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
    });
    onUnmounted(() => {
        carousel.setObserverHooks(() => {}, () => {});
        observer?.disconnect();
    });

    return () => (
        <div
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
    & Define.Slot<'default'>;

const CarouselItem = component<CarouselItemProps>(({ props, slots, onMounted, onUnmounted }) => {
    const carousel = useCarouselContext();
    let el: HTMLElement | null = null;
    const entry: ItemEntry = { el: () => el };
    const unregister = carousel.registerItem(entry);
    // Late-arriving items (rendered after the viewport mounted) must reach
    // the observer too — the viewport publishes hooks for exactly this.
    onMounted(() => {
        if (el) carousel.observeEl(el);
    });
    onUnmounted(() => {
        if (el) carousel.unobserveEl(el);
        unregister();
    });

    return () => {
        const i = carousel.itemIndex(entry);
        return (
            <div
                data-scope={SCOPE}
                data-part="item"
                data-state={stateAttr(carousel.index() === i, 'active', 'inactive')}
                role="group"
                aria-roledescription="slide"
                aria-label={props.label ?? `${i + 1} of ${carousel.count()}`}
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

        return () => (
            <button
                type="button"
                data-scope={SCOPE}
                data-part={partName}
                data-disabled={dataAttr(atBound())}
                data-focus-visible={dataAttr(focus.visible)}
                disabled={atBound()}
                aria-label={props.label ?? defaultLabel}
                class={props.class}
                ref={(node: HTMLElement | null) => { el = node; }}
                onClick={() => carousel.goTo(carousel.index() + step)}
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
    }, { name });

const CarouselPrevTrigger = stepTrigger('prev-trigger', -1, 'Previous slide', 'Carousel.PrevTrigger');
const CarouselNextTrigger = stepTrigger('next-trigger', 1, 'Next slide', 'Carousel.NextTrigger');

export type CarouselIndicatorGroupProps = WithClass & Define.Slot<'default'>;

const CarouselIndicatorGroup = component<CarouselIndicatorGroupProps>(({ props, slots }) => {
    return () => (
        <div data-scope={SCOPE} data-part="indicator-group" class={props.class}>
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
        return (
            <button
                type="button"
                data-scope={SCOPE}
                data-part="indicator"
                data-state={stateAttr(active, 'active', 'inactive')}
                data-focus-visible={dataAttr(focus.visible)}
                aria-label={props.label ?? `Go to slide ${idx() + 1}`}
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
